import { describe, expect, it, vi } from "vitest";
import { dailyPeriodKey, hourlyPeriodKey, runObservedAutomation } from "./automationMonitoring";

function fakeDb(options: { duplicate?: boolean } = {}) {
  const insertValues = vi.fn(async () => {
    if (options.duplicate) throw { code: "ER_DUP_ENTRY" };
  });
  const updateWhere = vi.fn(async () => undefined);
  return {
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) })),
    insertValues,
    updateWhere,
  };
}

describe("supervision des automatisations", () => {
  it("produit des clés de période stables pour les tâches horaires et quotidiennes", () => {
    const now = new Date("2026-08-29T08:48:00.000Z");
    expect(hourlyPeriodKey(now, 6)).toBe("2026-08-29T06:00Z/6h");
    expect(dailyPeriodKey(now)).toBe("2026-08-29");
  });

  it("ignore un doublon de période sans exécuter deux fois l’action métier", async () => {
    const db = fakeDb({ duplicate: true });
    const execute = vi.fn();
    await expect(runObservedAutomation({ db, companyId: 11, jobType: "backup", periodKey: "2026-08-29T06:00Z/6h", correlationId: "corr", execute })).resolves.toEqual({ status: "skipped" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("marque une exécution en erreur sans enregistrer son message interne", async () => {
    const db = fakeDb();
    await expect(runObservedAutomation({ db, companyId: 11, jobType: "payment_due_reminders", periodKey: "2026-08-29", correlationId: "corr", execute: async () => { throw new Error("détail sensible"); } })).rejects.toThrow("détail sensible");
    expect(db.updateWhere).toHaveBeenCalled();
  });
});
