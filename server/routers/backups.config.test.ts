import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), createHeartbeatJob: vi.fn(), updateHeartbeatJob: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../_core/heartbeat", () => ({ createHeartbeatJob: mocks.createHeartbeatJob, updateHeartbeatJob: mocks.updateHeartbeatJob }));
import { backupRouter } from "./backups";

function dbFor(settings: Record<string, unknown>) {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  const values = vi.fn().mockResolvedValue([{ insertId: 1 }]);
  return {
    select: vi.fn(() => ({ from: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([settings]) })) })),
    update: vi.fn(() => ({ set })),
    insert: vi.fn(() => ({ values })),
    set,
  };
}

const ctx = { user: { id: 1, role: "admin" }, req: { headers: { cookie: "app_session_id=session-1" } } } as any;

describe("configuration Heartbeat des sauvegardes", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("crée une tâche Heartbeat pour activer les sauvegardes quotidiennes", async () => {
    const db = dbFor({ id: 1, scheduleCronTaskUid: null, scheduleNextAt: null });
    mocks.getDb.mockResolvedValue(db); mocks.createHeartbeatJob.mockResolvedValue({ taskUid: "backup-job", nextExecutionAt: "2026-08-22T02:00:00.000Z" });
    const result = await backupRouter.createCaller(ctx).saveConfiguration({ automaticEnabled: true, frequencyHours: 24, retentionCount: 14, googleDriveFolderId: null });
    expect(result.nextExecutionAt).toBe("2026-08-22T02:00:00.000Z");
    expect(mocks.createHeartbeatJob).toHaveBeenCalledWith(expect.objectContaining({ cron: "0 0 2 * * *", path: "/api/scheduled/backup" }), "session-1");
  });

  it("suspend une tâche existante lorsque l’automatisation est désactivée", async () => {
    const db = dbFor({ id: 1, scheduleCronTaskUid: "backup-job", scheduleNextAt: null });
    mocks.getDb.mockResolvedValue(db); mocks.updateHeartbeatJob.mockResolvedValue({ nextExecutionAt: null });
    await backupRouter.createCaller(ctx).saveConfiguration({ automaticEnabled: false, frequencyHours: 24, retentionCount: 14, googleDriveFolderId: null });
    expect(mocks.updateHeartbeatJob).toHaveBeenCalledWith("backup-job", { enable: false }, "session-1");
  });

  it("met à jour la fréquence d’une tâche Heartbeat déjà active", async () => {
    const db = dbFor({ id: 1, scheduleCronTaskUid: "backup-job", scheduleNextAt: null });
    mocks.getDb.mockResolvedValue(db); mocks.updateHeartbeatJob.mockResolvedValue({ nextExecutionAt: "2026-08-21T12:00:00.000Z" });
    await backupRouter.createCaller(ctx).saveConfiguration({ automaticEnabled: true, frequencyHours: 12, retentionCount: 21, googleDriveFolderId: null });
    expect(mocks.updateHeartbeatJob).toHaveBeenCalledWith("backup-job", expect.objectContaining({ cron: "0 0 */12 * * *", enable: true }), "session-1");
    expect(mocks.createHeartbeatJob).not.toHaveBeenCalled();
  });
});
