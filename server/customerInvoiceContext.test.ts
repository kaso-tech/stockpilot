import { describe, expect, it, vi } from "vitest";
import { customers, products, saleItems, sales } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { appRouter } from "./routers";

const mockedGetDb = vi.mocked(getDb);
function context(): TrpcContext { return { user: { id: 1, openId: "invoice-context-admin", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", active: true, companyId: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] }; }

describe("commerce.customers.invoiceContext", () => {
  it("retourne la dernière adresse livrée et les produits réellement achetés encore en stock", async () => {
    const rows = new Map<unknown, unknown[]>([
      [customers, [{ id: 7, name: "Client", address: "Adresse fiche" }]],
      [sales, [{ id: 12, status: "paid", createdAt: new Date("2026-08-22"), deliveryAddress: null }, { id: 11, status: "paid", createdAt: new Date("2026-08-20"), deliveryAddress: "12 Rue du Marché" }, { id: 10, status: "void", createdAt: new Date("2026-08-19"), deliveryAddress: "À ignorer" }]],
      [saleItems, [{ id: 1, saleId: 11, productId: 3, quantity: 2 }, { id: 2, saleId: 12, productId: 3, quantity: 1 }, { id: 3, saleId: 10, productId: 4, quantity: 9 }]],
      [products, [{ id: 3, name: "Produit habituel", reference: "PH-01", quantity: 5 }, { id: 4, name: "Produit annulé", reference: "PA-02", quantity: 6 }]],
    ]);
    const db: any = { select: () => ({ from: (table: unknown) => { const values = rows.get(table) ?? []; const chain = { limit: async () => values, orderBy: () => ({ limit: async () => values }), then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(values).then(resolve) }; return { where: () => chain }; } }) };
    mockedGetDb.mockResolvedValue(db);
    const result = await appRouter.createCaller(context()).commerce.customers.invoiceContext({ id: 7 });
    expect(result.deliveryAddress).toBe("12 Rue du Marché");
    expect(result.suggestions).toEqual([expect.objectContaining({ productId: 3, name: "Produit habituel", purchaseCount: 2, quantity: 3, availableQuantity: 5 })]);
  });
});
