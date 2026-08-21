import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogs, inventoryItems, inventorySessions, products, stockMovements } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../db";
import { inventoryRouter } from "./inventory";

const mockedGetDb = vi.mocked(getDb);

function adminContext(): TrpcContext {
  return {
    user: { id: 3, openId: "admin-test", name: "Admin test", email: "admin@test.local", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("inventory.validate", () => {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: unknown }> = [];

  beforeEach(() => {
    inserts.length = 0; updates.length = 0;
    const session = { id: 42, name: "Inventaire test", status: "draft" as const };
    const item = { id: 81, inventorySessionId: 42, productId: 12, expectedQuantity: 10, countedQuantity: 8 };
    const product = { id: 12, quantity: 10, name: "Produit inventorié" };
    const tx: any = {
      select: () => ({ from: (table: unknown) => {
        const rows = table === inventorySessions ? [session] : table === inventoryItems ? [item] : table === products ? [product] : [];
        const chainableRows = Object.assign(rows, { limit: async () => rows });
        return { where: () => chainableRows, limit: async () => rows };
      }}),
      update: (table: unknown) => ({ set: (values: unknown) => ({ where: async () => { updates.push({ table, values }); } }) }),
      insert: (table: unknown) => ({ values: async (values: unknown) => { inserts.push({ table, values }); return [{ insertId: 1 }]; } }),
    };
    mockedGetDb.mockResolvedValue({ transaction: async (callback: (value: unknown) => Promise<void>) => callback(tx) } as any);
  });

  it("met à jour le stock physique et consigne un mouvement d’ajustement", async () => {
    const caller = inventoryRouter.createCaller(adminContext());
    await expect(caller.validate({ id: 42 })).resolves.toEqual({ success: true });

    expect(updates.find(item => item.table === products)?.values).toEqual({ quantity: 8 });
    expect(inserts.find(item => item.table === stockMovements)?.values).toMatchObject({ productId: 12, type: "adjustment", quantity: -2, previousQuantity: 10, resultingQuantity: 8, createdByUserId: 3 });
    expect(updates.find(item => item.table === inventorySessions)?.values).toMatchObject({ status: "validated", validatedByUserId: 3 });
    expect(inserts.find(item => item.table === auditLogs)?.values).toMatchObject({ action: "Inventaire validé", entityId: "42" });
  });
});
