import { beforeEach, describe, expect, it, vi } from "vitest";
import { productPriceTiers, products, saleItems, sales, stockMovements, suppliers } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { appRouter } from "./routers";

const mockedGetDb = vi.mocked(getDb);
function context(): TrpcContext { return { user: { id: 1, openId: "admin-product", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", active: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] }; }

describe("products.detail", () => {
  beforeEach(() => {
    const product = { id: 12, reference: "SKU-12", name: "Produit test", description: "Une référence de test", category: "Électronique", unit: "pièce", purchasePriceCents: 6000, retailPriceCents: 10000, wholesalePriceCents: 8500, quantity: 3, minimumQuantity: 5, supplierId: 8 };
    const tableRows = new Map<unknown, unknown[]>([[products, [product]], [productPriceTiers, [{ productId: 12, customerType: "retail", minQuantity: 5, unitPriceCents: 9000 }]], [stockMovements, [{ id: 1, productId: 12, type: "entry", quantity: 8, previousQuantity: 0, resultingQuantity: 8, reason: "Réception", occurredAt: new Date("2026-08-20") }]], [saleItems, [{ id: 1, productId: 12, saleId: 71, quantity: 2, lineTotalCents: 20000, lineCostCents: 12000 }]], [suppliers, [{ id: 8, name: "Fournisseur test" }]], [sales, [{ id: 71, invoiceNumber: "FAC-71", totalCents: 20000, createdAt: new Date("2026-08-21") }]]]);
    const db: any = { select: () => ({ from: (table: unknown) => { const rows = tableRows.get(table) ?? []; const chain = Object.assign(rows, { limit: async () => rows, then: (resolve: (value: unknown[]) => unknown) => resolve([...rows]) }); return { where: () => ({ ...chain, orderBy: () => chain }), orderBy: () => chain }; } }) };
    mockedGetDb.mockResolvedValue(db);
  });

  it("regroupe les données commerciales et opérationnelles du produit", async () => {
    const detail = await appRouter.createCaller(context()).products.detail({ id: 12 });
    expect(detail.supplier?.name).toBe("Fournisseur test");
    expect(detail.statistics).toMatchObject({ revenueCents: 20000, costCents: 12000, grossMarginCents: 8000, marginRate: 40, unitsSold: 2, saleCount: 1 });
    expect(detail.movements).toHaveLength(1);
    expect(detail.tiers.retail[0]?.unitPriceCents).toBe(9000);
  });
});
