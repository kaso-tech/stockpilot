import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogs, saleSettings } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../db";
import { printingSettingsRouter } from "./printingSettings";

const mockedGetDb = vi.mocked(getDb);

function adminContext(companyId = 1): TrpcContext {
  return { user: { id: 9, openId: "printing-admin", name: "Admin", email: "admin@example.test", loginMethod: "password", role: "admin", companyId, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("printingSettingsRouter", () => {
  const inserts: Array<{ table: unknown; values: unknown }> = [];

  beforeEach(() => {
    inserts.length = 0;
    const db: any = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      insert: (table: unknown) => ({ values: async (values: unknown) => { inserts.push({ table, values }); return [{ insertId: 1 }]; } }),
    };
    mockedGetDb.mockResolvedValue(db);
  });

  it("enregistre la préférence d’imprimante dans l’entreprise active et crée une trace", async () => {
    const caller = printingSettingsRouter.createCaller(adminContext(4));
    await expect(caller.save({ ticketHeader: "Merci", ticketFooter: "À bientôt", ticketWidthMm: "58", printerName: "Caisse principale", printerType: "thermal" })).resolves.toEqual({ success: true });
    expect(inserts.find(item => item.table === saleSettings)?.values).toMatchObject({ companyId: 4, printerName: "Caisse principale", printerType: "thermal", ticketWidthMm: "58", updatedByUserId: 9 });
    expect(inserts.find(item => item.table === auditLogs)?.values).toMatchObject({ companyId: 4, actorUserId: 9, action: "Paramètres d’impression mis à jour" });
  });

  it("refuse un nom d’imprimante trop court", async () => {
    const caller = printingSettingsRouter.createCaller(adminContext());
    await expect(caller.save({ ticketHeader: "Merci", ticketFooter: "À bientôt", ticketWidthMm: "80", printerName: "X", printerType: "browser" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
