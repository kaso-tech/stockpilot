import { beforeEach, describe, expect, it, vi } from "vitest";
import { purchaseOrderItems, purchaseOrders } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { appRouter } from "./routers";

const mockedGetDb = vi.mocked(getDb);
function context(): TrpcContext { return { user: { id: 1, openId: "admin-order", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", active: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] }; }

describe("purchaseOrders.listBySupplier", () => {
  beforeEach(() => {
    const orders = [{ id: 9, orderNumber: "BC-2026-001", supplierId: 4, status: "draft", totalCents: 54000, notes: "Réassort", createdAt: new Date("2026-08-22") }];
    const items = [{ id: 1, purchaseOrderId: 9, productId: 12, productName: "Produit A", productReference: "SKU-A", unit: "pièce", quantity: 6, purchasePriceCents: 9000, lineTotalCents: 54000 }];
    const rows = new Map<unknown, unknown[]>([[purchaseOrders, orders], [purchaseOrderItems, items]]);
    const db: any = { select: () => ({ from: (table: unknown) => { const values = rows.get(table) ?? []; const chain = Object.assign(values, { then: (resolve: (value: unknown[]) => unknown) => resolve([...values]), orderBy: async () => values }); return { where: () => ({ orderBy: async () => values }), orderBy: async () => values, then: chain.then }; } }) };
    mockedGetDb.mockResolvedValue(db);
  });

  it("retourne les lignes de chaque bon de commande du fournisseur", async () => {
    const result = await appRouter.createCaller(context()).purchaseOrders.listBySupplier({ supplierId: 4 });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ orderNumber: "BC-2026-001", totalCents: 54000 });
    expect(result[0]?.items).toMatchObject([{ productName: "Produit A", quantity: 6 }]);
  });
});
