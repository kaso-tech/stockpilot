import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, storagePutMock } = vi.hoisted(() => ({ getDbMock: vi.fn(), storagePutMock: vi.fn() }));

vi.mock("./db", () => ({ getDb: getDbMock }));
vi.mock("./storage", () => ({ storagePut: storagePutMock, storageGetSignedUrl: vi.fn() }));

import { createBackupSnapshot, restoreBackupPayload } from "./backups";

function archiveDb() {
  const where = vi.fn().mockResolvedValue([]);
  const from = vi.fn(() => ({ where }));
  const values = vi.fn().mockResolvedValue([{ insertId: 42 }]);
  return { select: vi.fn(() => ({ from })), insert: vi.fn(() => ({ values })), from, where, values };
}

describe("sauvegarde locale intégrée", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("crée une archive JSON, la stocke et enregistre ses métadonnées", async () => {
    const db = archiveDb();
    getDbMock.mockResolvedValue(db);
    storagePutMock.mockResolvedValue({ key: "backups/archive.json", url: "/manus-storage/backups/archive.json" });

    const archive = await createBackupSnapshot(7, "manual", 12);

    expect(archive.id).toBe(42);
    expect(archive.filename).toMatch(/^stockpilot-backup-/);
    expect(archive.payload.source).toBe("StockPilot");
    expect(archive.payload.companyId).toBe(12);
    expect(db.where).toHaveBeenCalled();
    expect(storagePutMock).toHaveBeenCalledWith(expect.stringContaining("backups/"), expect.any(Buffer), "application/json");
    expect(db.values).toHaveBeenCalledWith(expect.objectContaining({ trigger: "manual", createdByUserId: 7 }));
  });

  it("restaure les tables de l’archive puis crée une trace d’audit", async () => {
    const deleteMock = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const selectMock = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) }));
    const tx = { select: selectMock, delete: deleteMock, insert: vi.fn(() => ({ values: insertValues })) };
    const auditValues = vi.fn().mockResolvedValue(undefined);
    const db = { transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx)), insert: vi.fn(() => ({ values: auditValues })) };
    getDbMock.mockResolvedValue(db);

    const result = await restoreBackupPayload({ schemaVersion: 1, source: "StockPilot", exportedAt: "2026-08-21T00:00:00.000Z", companyId: 12, tables: { products: [{ id: 1, companyId: 12, name: "Produit" }], sales: [] } }, 7, 12);

    expect(result.restoredCount).toBe(1);
    expect(deleteMock).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith([{ id: 1, companyId: 12, name: "Produit" }]);
    expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 7, action: "Restauration" }));
  });
});
