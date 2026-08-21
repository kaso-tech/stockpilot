import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogs, saleSettings } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../db";
import { commerceRouter } from "./commerce";

const mockedGetDb = vi.mocked(getDb);

function adminContext(): TrpcContext {
  return { user: { id: 1, openId: "settings-admin", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("commerce.settings.save", () => {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  beforeEach(() => {
    inserts.length = 0;
    const db: any = { select: () => ({ from: () => ({ limit: async () => [] }) }), insert: (table: unknown) => ({ values: async (values: unknown) => { inserts.push({ table, values }); return [{ insertId: 1 }]; } }) };
    mockedGetDb.mockResolvedValue(db);
  });
  it.each(["USD", "EUR", "XOF"] as const)("enregistre %s comme devise de référence", async currency => {
    const caller = commerceRouter.createCaller(adminContext());
    await expect(caller.settings.save({ defaultSalesAgentId: null, defaultCashierId: null, requireSalesAgent: false, requireCashier: false, currency })).resolves.toEqual({ success: true });
    expect(inserts.find(item => item.table === saleSettings)?.values).toMatchObject({ currency, updatedByUserId: 1 });
    expect(inserts.find(item => item.table === auditLogs)?.values).toMatchObject({ action: "Paramètres mis à jour" });
  });
});
