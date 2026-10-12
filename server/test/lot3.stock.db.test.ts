import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { ctx, realDb, realDbUrl, resetDatabase, seedTenant, type SeededTenant } from "./realDb";
import { appRouter } from "../routers";
import { products, salePayments, saleSettings, stockMovements } from "../../drizzle/schema";

const productInput = (overrides: Record<string, unknown> = {}) => ({ reference: `REF-${Math.random().toString(36).slice(2, 8)}`, name: "Produit", description: null, category: "Divers", unit: "pièce", purchasePriceCents: 100, retailPriceCents: 1000, wholesalePriceCents: 800, quantity: 10, minimumQuantity: 0, supplierId: null, ...overrides });
const agents = { salesAgentId: null, cashierId: null };
const draft = (productId: number, quantity: number, extra: Array<{ productId: number; quantity: number }> = []) => ({ channel: "pos" as const, customerId: null, note: null, items: [{ productId, quantity }, ...extra], ...agents });

async function stockOf(productId: number) {
  const db = await realDb();
  return (await db.select({ quantity: products.quantity }).from(products).where(eq(products.id, productId)))[0]!.quantity;
}

describe.skipIf(!realDbUrl)("Lot 3 — concurrence et intégrité du stock (MySQL réel)", () => {
  let a: SeededTenant;

  beforeEach(async () => {
    await resetDatabase();
    a = await seedTenant("a");
  });

  it("E1 — deux encaissements simultanés d'une même vente ne décrémentent le stock qu'une fois", async () => {
    const admin = appRouter.createCaller(ctx(a.admin));
    const { id: productId } = await admin.products.create(productInput({ quantity: 10 }));
    const sale = await admin.transactions.createDraft(draft(productId, 3));
    const checkout = () => appRouter.createCaller(ctx(a.admin)).transactions.checkout({ saleId: sale.id, settlementMode: "full", payments: [{ method: "cash", amountCents: sale.totalCents }], ...agents }).then(() => "ok", error => error.code as string);
    const results = await Promise.all([checkout(), checkout(), checkout()]);
    expect(results.filter(result => result === "ok")).toHaveLength(1);
    expect(await stockOf(productId)).toBe(7);
    const db = await realDb();
    expect(await db.select().from(salePayments).where(eq(salePayments.saleId, sale.id))).toHaveLength(1);
    expect(await db.select().from(stockMovements).where(and(eq(stockMovements.productId, productId), eq(stockMovements.type, "exit")))).toHaveLength(1);
  });

  it("E2 — des ventes concurrentes sur le même produit ne perdent aucune mise à jour", async () => {
    const admin = appRouter.createCaller(ctx(a.admin));
    const { id: productId } = await admin.products.create(productInput({ quantity: 5 }));
    const drafts = [];
    for (let index = 0; index < 5; index += 1) drafts.push(await admin.transactions.createDraft(draft(productId, 1)));
    await Promise.all(drafts.map(sale => appRouter.createCaller(ctx(a.admin)).transactions.checkout({ saleId: sale.id, settlementMode: "full", payments: [{ method: "cash", amountCents: sale.totalCents }], ...agents })));
    expect(await stockOf(productId)).toBe(0);
    const extra = await admin.transactions.createDraft(draft(productId, 1));
    await expect(admin.transactions.checkout({ saleId: extra.id, settlementMode: "full", payments: [{ method: "cash", amountCents: extra.totalCents }], ...agents })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await stockOf(productId)).toBe(0);
  });

  it("E3 — une vente avec deux lignes du même produit s'encaisse et se rembourse correctement", async () => {
    const admin = appRouter.createCaller(ctx(a.admin));
    const { id: productId } = await admin.products.create(productInput({ quantity: 10 }));
    const sale = await admin.transactions.createDraft(draft(productId, 2, [{ productId, quantity: 3 }]));
    await admin.transactions.checkout({ saleId: sale.id, settlementMode: "full", payments: [{ method: "cash", amountCents: sale.totalCents }], ...agents });
    expect(await stockOf(productId)).toBe(5);
    await admin.transactions.refund({ saleId: sale.id });
    expect(await stockOf(productId)).toBe(10);
  });

  it("refuse un moyen de paiement désactivé et une vente d'une autre entreprise", async () => {
    const db = await realDb();
    await db.update(saleSettings).set({ paymentCardEnabled: false }).where(eq(saleSettings.companyId, a.companyId));
    const admin = appRouter.createCaller(ctx(a.admin));
    const { id: productId } = await admin.products.create(productInput());
    const sale = await admin.transactions.createDraft(draft(productId, 1));
    await expect(admin.transactions.checkout({ saleId: sale.id, settlementMode: "full", payments: [{ method: "card", amountCents: sale.totalCents }], ...agents })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const b = await seedTenant("b");
    await expect(appRouter.createCaller(ctx(b.admin)).transactions.checkout({ saleId: sale.id, settlementMode: "full", payments: [{ method: "cash", amountCents: sale.totalCents }], ...agents })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await stockOf(productId)).toBe(10);
  });

  it("E9 — modifier la quantité depuis la fiche produit trace un mouvement d'ajustement", async () => {
    const admin = appRouter.createCaller(ctx(a.admin));
    const input = productInput({ quantity: 10 });
    const { id } = await admin.products.create(input);
    await admin.products.update({ id, ...input, quantity: 7 });
    const db = await realDb();
    const movements = await db.select().from(stockMovements).where(eq(stockMovements.productId, id));
    expect(movements).toEqual([expect.objectContaining({ type: "adjustment", quantity: -3, previousQuantity: 10, resultingQuantity: 7 })]);
  });

  it("E7 — une vente entre le comptage et la validation d'inventaire est prise en compte", async () => {
    const admin = appRouter.createCaller(ctx(a.admin));
    const { id: productId } = await admin.products.create(productInput({ quantity: 10 }));
    const inventory = await admin.inventory.create({ name: "Inventaire" });
    const detail = await admin.inventory.detail({ id: inventory.id });
    const line = detail.items.find((item: { productId: number }) => item.productId === productId)!;
    await admin.inventory.count({ itemId: line.id, countedQuantity: 8 });
    const sale = await admin.transactions.createDraft(draft(productId, 1));
    await admin.transactions.checkout({ saleId: sale.id, settlementMode: "full", payments: [{ method: "cash", amountCents: sale.totalCents }], ...agents });
    await admin.inventory.validate({ id: inventory.id });
    expect(await stockOf(productId)).toBe(7);
  });

  it("réceptionne un bon de commande une seule fois même en cas de double soumission", async () => {
    const admin = appRouter.createCaller(ctx(a.admin));
    const supplier = await admin.suppliers.create({ name: "Fournisseur", otherReference: null, address: null, email: null, phone: null, taxNumber: null, notes: null });
    const { id: productId } = await admin.products.create(productInput({ quantity: 0, supplierId: supplier.id }));
    const order = await admin.purchaseOrders.create({ supplierId: supplier.id, items: [{ productId, quantity: 4 }] });
    const detail = await admin.purchaseOrders.get({ id: order.id });
    const receive = () => appRouter.createCaller(ctx(a.admin)).purchaseOrders.receive({ id: order.id, lines: [{ id: detail.items[0]!.id, quantity: 4 }] }).then(() => "ok", error => error.code as string);
    const results = await Promise.all([receive(), receive()]);
    expect(results.filter(result => result === "ok").length).toBeGreaterThanOrEqual(1);
    expect(await stockOf(productId)).toBe(4);
  });
});
