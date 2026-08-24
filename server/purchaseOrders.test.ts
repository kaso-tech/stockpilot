import { beforeEach, describe, expect, it, vi } from "vitest";
import { products, purchaseOrderItems, purchaseOrders, stockMovements, suppliers } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { appRouter } from "./routers";

const mockedGetDb = vi.mocked(getDb);
function context(): TrpcContext { return { user: { id: 1, openId: "admin-order", name: "Admin", email: "admin@example.test", phone: null, loginMethod: "password", role: "admin", active: true, companyId: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] }; }
function chain(values: unknown[]) { return Object.assign(values, { then: (resolve: (value: unknown[]) => unknown) => resolve([...values]), limit: async () => values, orderBy: async () => values }); }
function mockDatabase(rows: Map<unknown, unknown[]>) {
  const from = (table: unknown) => ({ where: () => chain(rows.get(table) ?? []), limit: async () => rows.get(table) ?? [], orderBy: async () => rows.get(table) ?? [], then: (resolve: (value: unknown[]) => unknown) => resolve([...(rows.get(table) ?? [])]) });
  const select = () => ({ from });
  return { select, update: () => ({ set: () => ({ where: async () => [{ affectedRows: 1 }] }) }), insert: () => ({ values: async () => [] }), transaction: async (callback: (transaction: unknown) => unknown) => callback({ select, update: () => ({ set: () => ({ where: async () => [{ affectedRows: 1 }] }) }), insert: () => ({ values: async () => [] }) }) };
}

describe("purchaseOrders.listBySupplier", () => {
  beforeEach(() => {
    const orders = [{ id: 9, companyId: 1, orderNumber: "BC-2026-001", supplierId: 4, status: "draft", totalCents: 54000, notes: "Réassort", createdAt: new Date("2026-08-22") }];
    const items = [{ id: 1, purchaseOrderId: 9, productId: 12, productName: "Produit A", productReference: "SKU-A", unit: "pièce", quantity: 6, receivedQuantity: 0, purchasePriceCents: 9000, lineTotalCents: 54000 }];
    mockedGetDb.mockResolvedValue(mockDatabase(new Map([[purchaseOrders, orders], [purchaseOrderItems, items], [suppliers, [{ id: 4, companyId: 1, name: "Fournisseur A" }]]] as any)) as any);
  });
  it("retourne les lignes de chaque bon de commande du fournisseur", async () => {
    const result = await appRouter.createCaller(context()).purchaseOrders.listBySupplier({ supplierId: 4 });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ orderNumber: "BC-2026-001", totalCents: 54000 });
    expect(result[0]?.items).toMatchObject([{ productName: "Produit A", quantity: 6 }]);
  });
});

describe("purchaseOrders.list", () => {
  beforeEach(() => {
    const orders = [{ id: 10, companyId: 1, orderNumber: "BC-2026-002", supplierId: 4, status: "sent", totalCents: 72000, notes: null, createdAt: new Date("2026-08-23") }];
    const items = [{ id: 2, purchaseOrderId: 10, productId: 13, productName: "Produit B", productReference: "SKU-B", unit: "pièce", quantity: 4, receivedQuantity: 1, purchasePriceCents: 18000, lineTotalCents: 72000 }];
    const supplierRows = [{ id: 4, companyId: 1, name: "Fournisseur B" }];
    mockedGetDb.mockResolvedValue(mockDatabase(new Map([[purchaseOrders, orders], [purchaseOrderItems, items], [suppliers, supplierRows]] as any)) as any);
  });
  it("retourne chaque bon avec son fournisseur et ses lignes", async () => {
    const result = await appRouter.createCaller(context()).purchaseOrders.list();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ orderNumber: "BC-2026-002", supplier: { name: "Fournisseur B" }, items: [{ productName: "Produit B", receivedQuantity: 1 }] });
  });
});

describe("purchaseOrders transitions", () => {
  const order = { id: 9, companyId: 1, orderNumber: "BC-2026-001", supplierId: 4, status: "draft", totalCents: 54000, notes: null, expectedDeliveryDate: null, createdAt: new Date("2026-08-22") };
  const item = { id: 1, purchaseOrderId: 9, productId: 12, productName: "Produit A", productReference: "SKU-A", unit: "pièce", quantity: 6, receivedQuantity: 0, purchasePriceCents: 9000, lineTotalCents: 54000 };
  let productUpdates: unknown[];
  let stockRows: unknown[];
  beforeEach(() => {
    productUpdates = [];
    stockRows = [];
    const tableRows = new Map<unknown, unknown[]>([[purchaseOrders, [order]], [purchaseOrderItems, [item]], [products, [{ id: 12, companyId: 1, name: "Produit A", quantity: 3 }]]]);
    const update = (table: unknown) => ({ set: (values: unknown) => ({ where: async () => { if (table === products) productUpdates.push(values); return [{ affectedRows: 1 }]; } }) });
    const insert = (table: unknown) => ({ values: async (values: unknown) => { if (table === stockMovements) stockRows.push(values); return []; } });
    const select = () => ({ from: (table: unknown) => ({ where: () => chain(tableRows.get(table) ?? []), then: (resolve: (value: unknown[]) => unknown) => resolve([...(tableRows.get(table) ?? [])]), limit: async () => tableRows.get(table) ?? [] }) });
    const tx: any = { select, update, insert };
    const db: any = { select, update, insert, transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx) };
    mockedGetDb.mockResolvedValue(db);
  });
  it("marque un bon comme envoyé", async () => {
    const result = await appRouter.createCaller(context()).purchaseOrders.markSent({ id: 9 });
    expect(result).toEqual({ success: true, status: "sent" });
  });
  it("enregistre une date de livraison attendue sur un bon modifiable", async () => {
    const result = await appRouter.createCaller(context()).purchaseOrders.updateDetails({ id: 9, notes: "Livraison express", expectedDeliveryDate: new Date("2026-08-30T12:00:00Z") });
    expect(result).toEqual({ success: true });
  });
  it("réceptionne partiellement le bon et crée l’entrée de stock correspondante", async () => {
    const result = await appRouter.createCaller(context()).purchaseOrders.receive({ id: 9, lines: [{ id: 1, quantity: 2 }] });
    expect(result).toEqual({ success: true, alreadyReceived: false, status: "sent", complete: false });
    expect(productUpdates).toContainEqual({ quantity: 5 });
    expect(stockRows).toContainEqual(expect.objectContaining({ companyId: 1, productId: 12, supplierId: 4, type: "entry", quantity: 2, previousQuantity: 3, resultingQuantity: 5 }));
  });
  it("annule le bon avec un motif explicite", async () => {
    const result = await appRouter.createCaller(context()).purchaseOrders.cancel({ id: 9, reason: "Délai fournisseur dépassé" });
    expect(result).toEqual({ success: true, status: "cancelled" });
  });
});
