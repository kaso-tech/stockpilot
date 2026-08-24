import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), getDb: vi.fn(), runBackup: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticate } }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./backups", () => ({ runBackupWithStatus: mocks.runBackup }));
import { runScheduledBackup } from "./scheduledBackups";

function response() { const status = vi.fn().mockReturnThis(); const json = vi.fn().mockReturnThis(); return { status, json }; }

describe("callback planifié de sauvegarde", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuse les requêtes qui ne proviennent pas du planificateur", async () => {
    mocks.authenticate.mockResolvedValue({ isCron: false }); const res = response();
    await runScheduledBackup({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("exécute une sauvegarde pour la tâche planifiée active", async () => {
    mocks.authenticate.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    const settings = { scheduleCronTaskUid: "task-1", automaticEnabled: true, updatedByUserId: 7, retentionCount: 14, companyId: 3 };
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([settings]) })) })) })) });
    mocks.runBackup.mockResolvedValue({ id: 4, filename: "archive.json" }); const res = response();
    await runScheduledBackup({} as any, res as any);
    expect(mocks.runBackup).toHaveBeenCalledWith(7, "scheduled", 14, 3);
    expect(res.json).toHaveBeenCalledWith({ ok: true, archiveId: 4, filename: "archive.json" });
  });

  it("ne divulgue pas le message interne lorsque l’exécution échoue", async () => {
    mocks.authenticate.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    const settings = { scheduleCronTaskUid: "task-1", automaticEnabled: true, updatedByUserId: 7, retentionCount: 14, companyId: 3 };
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([settings]) })) })) })) });
    mocks.runBackup.mockRejectedValue(new Error("message interne sensible")); const res = response();
    await runScheduledBackup({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "scheduled-backup-failed" }));
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ error: "message interne sensible" }));
  });

  it("refuse une configuration planifiée sans entreprise", async () => {
    mocks.authenticate.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    const settings = { scheduleCronTaskUid: "task-1", automaticEnabled: true, updatedByUserId: 7, retentionCount: 14, companyId: null };
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([settings]) })) })) })) }); const res = response();
    await runScheduledBackup({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.runBackup).not.toHaveBeenCalled();
  });
});
