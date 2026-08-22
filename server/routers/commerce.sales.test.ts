import { beforeEach, describe, expect, it, vi } from "vitest";
import { customers, productPriceTiers, products, remunerationProfiles, saleCommissions, saleItems, sales, stockAlerts, stockMovements } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../db";
import { commerceRouter } from "./commerce";

const mockedGetDb = vi.mocked(getDb);

function sellerContext(): TrpcContext {
  return {
    user: { id: 7, openId: "seller-test", name: "Vendeur test", email: "seller@test.local", loginMethod: "manus", role: "seller", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("commerce.sales.create", () => {
  const inserted: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: unknown }> = [];

  beforeEach(() => {
    inserted.length = 0; updates.length = 0;
    const customer = { id: 11, name: "Client détail", type: "ordinary" as const };
    const product = { id: 21, reference: "SKU-21", name: "Article", unit: "unité", quantity: 10, minimumQuantity: 3, purchasePriceCents: 600, retailPriceCents: 1000, wholesalePriceCents: 800 };
    const tiers = [{ productId: 21, minQuantity: 5, unitPriceCents: 850 }];
    const profile = { id: 1, beneficiaryType: "user" as const, beneficiaryId: 7, remunerationMode: "commission" as const, fixedMonthlyCents: 0, commissionBasis: "revenue" as const, rateBasisPoints: 500, active: true };
    const tx: any = {
      select: () => ({ from: (table: unknown) => {
        const rows = table === customers ? [customer] : table === products ? [product] : table === productPriceTiers ? tiers : table === stockAlerts ? [] : table === remunerationProfiles ? [profile] : [];
        const chainableRows = Object.assign(rows, { limit: async () => rows });
        return { where: () => chainableRows, limit: async () => rows };
      }}),
      insert: (table: unknown) => ({ values: async (values: unknown) => { inserted.push({ table, values }); return table === sales ? [{ insertId: 501 }] : [{ insertId: 1 }]; } }),
      update: (table: unknown) => ({ set: (values: unknown) => ({ where: async () => { updates.push({ table, values }); } }) }),
    };
    mockedGetDb.mockResolvedValue({ transaction: async (callback: (value: unknown) => Promise<void>) => callback(tx) } as any);
  });

  it("applique le tarif détail, décrémente le stock et enregistre la commission du vendeur", async () => {
    const caller = commerceRouter.createCaller(sellerContext());
    const result = await caller.sales.create({ customerId: 11, salesAgentId: null, cashierId: null, paymentMethod: "cash", note: null, items: [{ productId: 21, quantity: 2 }] });

    expect(result.success).toBe(true);
    expect(inserted.find(item => item.table === sales)?.values).toMatchObject({ totalCents: 2000, totalCostCents: 1200, netProfitCents: 800, sellerUserId: 7 });
    expect(inserted.find(item => item.table === saleItems)?.values).toMatchObject({ saleId: 501, quantity: 2, unitPriceCents: 1000, lineTotalCents: 2000 });
    expect(updates.find(item => item.table === products)?.values).toEqual({ quantity: 8 });
    expect(inserted.find(item => item.table === stockMovements)?.values).toMatchObject({ quantity: -2, previousQuantity: 10, resultingQuantity: 8 });
    expect(inserted.find(item => item.table === saleCommissions)?.values).toMatchObject({ saleId: 501, beneficiaryType: "user", beneficiaryId: 7, commissionCents: 100 });
  });

  it("applique le palier de quantité à un client détail", async () => {
    const caller = commerceRouter.createCaller(sellerContext());
    await caller.sales.create({ customerId: 11, salesAgentId: null, cashierId: null, paymentMethod: "cash", note: null, items: [{ productId: 21, quantity: 5 }] });
    expect(inserted.find(item => item.table === saleItems)?.values).toMatchObject({ quantity: 5, unitPriceCents: 850, lineTotalCents: 4250 });
  });
});
