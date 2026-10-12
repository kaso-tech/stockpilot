import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const stored = new Map<string, Buffer>();
vi.mock("../storage", () => ({
  storagePut: async (key: string, data: Buffer) => { stored.set(key, Buffer.from(data)); return { key, url: `/manus-storage/${key}` }; },
  storageGetSignedUrl: async (key: string) => `memory://${key}`,
}));

import { ctx, realDb, realDbUrl, resetDatabase, seedTenant, type SeededTenant } from "./realDb";
import { appRouter } from "../routers";
import { createBackupSnapshot, parseBackupPayload, restoreBackupPayload } from "../backups";
import { productPriceTiers, products, purchaseOrders, salePayments, sales } from "../../drizzle/schema";

const toDataUrl = (buffer: Buffer) => `data:application/json;base64,${buffer.toString("base64")}`;
const productInput = { reference: "P-1", name: "Produit", description: null, category: "Divers", unit: "pièce", purchasePriceCents: 100, retailPriceCents: 1000, wholesalePriceCents: 800, quantity: 10, minimumQuantity: 0, supplierId: null, retailPriceTiers: [{ minQuantity: 5, unitPriceCents: 900 }] };

async function seedActivity(tenant: SeededTenant) {
  const admin = appRouter.createCaller(ctx(tenant.admin));
  const supplier = await admin.suppliers.create({ name: "Fournisseur", otherReference: null, address: null, email: null, phone: null, taxNumber: null, notes: null });
  const { id: productId } = await admin.products.create({ ...productInput, supplierId: supplier.id });
  await admin.categories.create({ name: "Boissons" });
  await admin.purchaseOrders.create({ supplierId: supplier.id, items: [{ productId, quantity: 2 }] });
  const sale = await admin.transactions.createDraft({ channel: "pos", customerId: null, note: null, items: [{ productId, quantity: 2 }], salesAgentId: null, cashierId: null });
  await admin.transactions.checkout({ saleId: sale.id, settlementMode: "full", payments: [{ method: "cash", amountCents: sale.totalCents }], salesAgentId: null, cashierId: null });
  return { productId };
}

describe.skipIf(!realDbUrl)("Lot 5 — sauvegarde et restauration (MySQL réel)", () => {
  let a: SeededTenant;

  beforeEach(async () => {
    stored.clear();
    delete process.env.BACKUP_ENCRYPTION_KEY;
    await resetDatabase();
    a = await seedTenant("a");
  });

  it("E14/E15 — une archive contient toutes les tables métier et la restauration revient exactement à cet état", async () => {
    const { productId } = await seedActivity(a);
    const archive = await createBackupSnapshot(a.admin.id, "manual", a.companyId);
    for (const name of ["productPriceTiers", "productCategories", "salePayments", "purchaseOrders", "purchaseOrderItems"]) expect(archive.payload.tables[name]?.length).toBeGreaterThan(0);
    const db = await realDb();
    // Modifications postérieures à la sauvegarde.
    const admin = appRouter.createCaller(ctx(a.admin));
    const later = await admin.transactions.createDraft({ channel: "pos", customerId: null, note: null, items: [{ productId, quantity: 1 }], salesAgentId: null, cashierId: null });
    await admin.transactions.checkout({ saleId: later.id, settlementMode: "full", payments: [{ method: "cash", amountCents: later.totalCents }], salesAgentId: null, cashierId: null });
    await db.delete(productPriceTiers);
    const payload = parseBackupPayload(toDataUrl(stored.values().next().value!));
    await restoreBackupPayload(payload, a.admin.id, a.companyId);
    expect((await db.select().from(products).where(eq(products.id, productId)))[0]?.quantity).toBe(8);
    expect(await db.select().from(productPriceTiers)).toHaveLength(1);
    expect(await db.select().from(sales).where(eq(sales.companyId, a.companyId))).toHaveLength(1);
    expect(await db.select().from(salePayments)).toHaveLength(1);
    expect(await db.select().from(purchaseOrders)).toHaveLength(1);
  });

  it("B2 — avec BACKUP_ENCRYPTION_KEY l'archive est illisible sans la clé et reste restaurable", async () => {
    process.env.BACKUP_ENCRYPTION_KEY = "11".repeat(32);
    await seedActivity(a);
    await createBackupSnapshot(a.admin.id, "manual", a.companyId);
    const content = stored.values().next().value!.toString("utf8");
    expect(content).not.toContain("Fournisseur");
    expect(JSON.parse(content).format).toBe("stockpilot-backup-encrypted");
    const payload = parseBackupPayload(toDataUrl(Buffer.from(content)));
    await expect(restoreBackupPayload(payload, a.admin.id, a.companyId)).resolves.toHaveProperty("restoredCount");
    process.env.BACKUP_ENCRYPTION_KEY = "22".repeat(32);
    expect(() => parseBackupPayload(toDataUrl(Buffer.from(content)))).toThrow("déchiffrer");
  });

  it("S6 — refuse une archive forgée qui référence un produit d'une autre entreprise ou une colonne inconnue", async () => {
    await seedActivity(a);
    const b = await seedTenant("b");
    const { productId: foreignProductId } = await seedActivity(b);
    const archive = await createBackupSnapshot(a.admin.id, "manual", a.companyId);
    const forged = structuredClone(archive.payload) as any;
    forged.tables.saleItems[0].productId = foreignProductId;
    expect(() => parseBackupPayload(toDataUrl(Buffer.from(JSON.stringify(forged))))).toThrow("absente de la sauvegarde");
    const unknownColumn = structuredClone(archive.payload) as any;
    unknownColumn.tables.users[0].isSuperAdmin = true;
    expect(() => parseBackupPayload(toDataUrl(Buffer.from(JSON.stringify(unknownColumn))))).toThrow("Colonne inconnue");
  });

  it("refuse une restauration qui supprimerait le compte de l'administrateur", async () => {
    const archive = await createBackupSnapshot(a.admin.id, "manual", a.companyId);
    const withoutAdmin = { ...archive.payload, tables: { ...archive.payload.tables, users: archive.payload.tables.users!.filter(row => row.id !== a.admin.id) } };
    await expect(restoreBackupPayload(withoutAdmin, a.admin.id, a.companyId)).rejects.toThrow("compte administrateur");
  });

  it("restaure via l'API tRPC avec la confirmation et refuse l'archive d'une autre entreprise", async () => {
    await seedActivity(a);
    await createBackupSnapshot(a.admin.id, "manual", a.companyId);
    const dataUrl = toDataUrl(stored.values().next().value!);
    const b = await seedTenant("b");
    await expect(appRouter.createCaller(ctx(b.admin)).backups.restore({ dataUrl, confirmation: "RESTAURER" })).rejects.toThrow("autre entreprise");
    await expect(appRouter.createCaller(ctx(a.admin)).backups.restore({ dataUrl, confirmation: "RESTAURER" })).resolves.toHaveProperty("restoredCount");
  });
});
