import { describe, expect, it, vi } from "vitest";
import { applyRetentionPolicy, assertBackupCompany, assertRestoreConfirmation } from "./backups";

describe("rétention et garde-fou de restauration", () => {
  it("supprime uniquement les archives dépassant la limite de conservation", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    await applyRetentionPolicy([{ id: 8 }, { id: 7 }, { id: 6 }, { id: 5 }], 2, remove);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenNthCalledWith(1, 6);
    expect(remove).toHaveBeenNthCalledWith(2, 5);
  });

  it("impose le mot de confirmation avant la restauration", () => {
    expect(() => assertRestoreConfirmation("CONFIRMER")).toThrow("RESTAURER");
    expect(() => assertRestoreConfirmation("RESTAURER")).not.toThrow();
  });

  it("refuse une archive attribuée à une autre entreprise", () => {
    const payload = { schemaVersion: 1 as const, source: "StockPilot" as const, exportedAt: "2026-08-23T00:00:00.000Z", companyId: 9, tables: {} };
    expect(() => assertBackupCompany(payload, 10)).toThrow("autre entreprise");
    expect(() => assertBackupCompany(payload, 9)).not.toThrow();
  });
});
