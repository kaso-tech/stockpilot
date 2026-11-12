import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../storage", () => ({
  storagePut: async (key: string) => ({ key, url: `/manus-storage/${key}` }),
  storageGetSignedUrl: async (key: string) => `memory://${key}`,
  storageDelete: async () => false,
}));
import { eq } from "drizzle-orm";
import {
  ctx,
  realDb,
  realDbUrl,
  resetDatabase,
  seedTenant,
  type SeededTenant,
} from "./realDb";
import { appRouter } from "../routers";
import { productStocks, products, stockLots } from "../../drizzle/schema";
import { createBackupSnapshot, restoreBackupPayload } from "../backups";
import { weightedAverageCost } from "../stockLedger";

const base = {
  description: null,
  category: "Divers",
  unit: "pièce",
  retailPriceCents: 2000,
  wholesalePriceCents: 1500,
  minimumQuantity: 0,
};
const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe("coût moyen pondéré", () => {
  it("pondère l'ancien stock et l'entrée", () => {
    expect(weightedAverageCost(10, 1000, 10, 1400)).toBe(1200);
    expect(weightedAverageCost(0, 1000, 5, 1400)).toBe(1400);
    expect(weightedAverageCost(-2, 1000, 4, 800)).toBe(800);
  });
});

describe.skipIf(!realDbUrl)(
  "Lot 9.7 — dépôts, lots et CMUP (MySQL réel)",
  () => {
    let a: SeededTenant;
    beforeEach(async () => {
      await resetDatabase();
      a = await seedTenant("a");
    });

    async function received(
      lots: Array<{
        quantity: number;
        lotNumber?: string;
        expiryDate?: string;
      }>,
      unitCost = 1400
    ) {
      const admin = appRouter.createCaller(ctx(a.admin));
      const supplier = await admin.suppliers.create({
        name: "Fournisseur",
        otherReference: null,
        address: null,
        email: null,
        phone: null,
        taxNumber: null,
        notes: null,
      });
      const { id: productId } = await admin.products.create({
        ...base,
        reference: "LOT-1",
        name: "Yaourt",
        purchasePriceCents: 1000,
        quantity: 10,
        supplierId: supplier.id,
      });
      await (await realDb())
        .update(products)
        .set({ purchasePriceCents: unitCost })
        .where(eq(products.id, productId));
      for (const lot of lots) {
        const order = await admin.purchaseOrders.create({
          supplierId: supplier.id,
          items: [{ productId, quantity: lot.quantity }],
        });
        const detail = await admin.purchaseOrders.get({ id: order.id });
        await admin.purchaseOrders.receive({
          id: order.id,
          lines: [
            {
              id: detail.items[0]!.id,
              quantity: lot.quantity,
              lotNumber: lot.lotNumber,
              expiryDate: lot.expiryDate,
            },
          ],
        });
      }
      await (await realDb())
        .update(products)
        .set({ purchasePriceCents: 1000 })
        .where(eq(products.id, productId));
      return { admin, productId };
    }

    it("met à jour le coût moyen pondéré à la réception", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      const supplier = await admin.suppliers.create({
        name: "Fournisseur riz",
        otherReference: null,
        address: null,
        email: null,
        phone: null,
        taxNumber: null,
        notes: null,
      });
      const { id: productId } = await admin.products.create({
        ...base,
        reference: "CMUP-1",
        name: "Riz",
        purchasePriceCents: 1000,
        quantity: 10,
        supplierId: supplier.id,
      });
      await (await realDb())
        .update(products)
        .set({ purchasePriceCents: 1400 })
        .where(eq(products.id, productId));
      const order = await admin.purchaseOrders.create({
        supplierId: supplier.id,
        items: [{ productId, quantity: 10 }],
      });
      const detail = await admin.purchaseOrders.get({ id: order.id });
      // Le coût actuel (1 400) est celui de la ligne ; ancien coût moyen : on le remet à 1 000.
      await (await realDb())
        .update(products)
        .set({ purchasePriceCents: 1000 })
        .where(eq(products.id, productId));
      await admin.purchaseOrders.receive({
        id: order.id,
        lines: [{ id: detail.items[0]!.id, quantity: 10 }],
      });
      expect(
        (
          await (await realDb())
            .select()
            .from(products)
            .where(eq(products.id, productId))
        )[0]
      ).toMatchObject({ quantity: 20, purchasePriceCents: 1200 });
    });

    it("consomme les lots en premier expiré, premier sorti et signale les péremptions proches", async () => {
      const { admin, productId } = await received([
        { quantity: 5, lotNumber: "L-TARD", expiryDate: inDays(90) },
        { quantity: 5, lotNumber: "L-TOT", expiryDate: inDays(10) },
      ]);
      const sale = await admin.transactions.createDraft({
        channel: "pos",
        customerId: null,
        note: null,
        items: [{ productId, quantity: 7 }],
        salesAgentId: null,
        cashierId: null,
      });
      await admin.transactions.checkout({
        saleId: sale.id,
        settlementMode: "full",
        payments: [{ method: "cash", amountCents: sale.totalCents }],
        salesAgentId: null,
        cashierId: null,
      });
      const lots = await (await realDb())
        .select()
        .from(stockLots)
        .where(eq(stockLots.productId, productId));
      // Les lots suivis (dates connues) partent avant le stock initial non suivi.
      expect(
        Object.fromEntries(lots.map(lot => [lot.lotNumber, lot.quantity]))
      ).toEqual({ "L-TOT": 0, "L-TARD": 3 });
      const expiring = await admin.warehouses.expiringLots({ days: 120 });
      expect(expiring.map(lot => lot.lotNumber)).toEqual(["L-TARD"]);
    });

    it("gère le stock par dépôt : transfert, refus de vendre au-delà du stock du dépôt, inventaire par dépôt", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      const { id: productId } = await admin.products.create({
        ...base,
        reference: "DEP-1",
        name: "Savon",
        purchasePriceCents: 100,
        quantity: 10,
        supplierId: null,
      });
      const [main] = await admin.warehouses.list();
      const { id: shop } = (await admin.warehouses.create({
        name: "Boutique",
      }))!;
      await admin.warehouses.transfer({
        productId,
        fromWarehouseId: main!.id,
        toWarehouseId: shop,
        quantity: 8,
      });
      const stock = (await admin.warehouses.stock({ productId }))[0]!.stocks;
      expect(
        Object.fromEntries(stock.map(item => [item.warehouseId, item.quantity]))
      ).toEqual({ [main!.id]: 2, [shop]: 8 });
      const sale = await admin.transactions.createDraft({
        channel: "pos",
        customerId: null,
        note: null,
        items: [{ productId, quantity: 3 }],
        salesAgentId: null,
        cashierId: null,
      });
      await expect(
        admin.transactions.checkout({
          saleId: sale.id,
          settlementMode: "full",
          payments: [{ method: "cash", amountCents: sale.totalCents }],
          salesAgentId: null,
          cashierId: null,
        })
      ).rejects.toThrow("stock insuffisant dans ce dépôt");
      await expect(
        admin.warehouses.transfer({
          productId,
          fromWarehouseId: main!.id,
          toWarehouseId: shop,
          quantity: 5,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const inventory = await admin.inventory.create({
        name: "Boutique",
        warehouseId: shop,
      });
      const line = (
        await admin.inventory.detail({ id: inventory.id })
      ).items.find(
        (item: { productId: number }) => item.productId === productId
      )!;
      await admin.inventory.count({ itemId: line.id, countedQuantity: 6 });
      await admin.inventory.validate({ id: inventory.id });
      const after = (await admin.warehouses.stock({ productId }))[0]!.stocks;
      expect(
        Object.fromEntries(after.map(item => [item.warehouseId, item.quantity]))
      ).toEqual({ [main!.id]: 2, [shop]: 6 });
      expect(
        (
          await (await realDb())
            .select()
            .from(products)
            .where(eq(products.id, productId))
        )[0]!.quantity
      ).toBe(8);
    });

    it("sauvegarde et restaure dépôts, stocks par dépôt et lots", async () => {
      const { admin, productId } = await received([
        { quantity: 4, lotNumber: "L-1", expiryDate: inDays(5) },
      ]);
      const archive = await createBackupSnapshot(
        a.admin.id,
        "manual",
        a.companyId
      );
      await admin.warehouses.create({ name: "Temporaire" });
      await restoreBackupPayload(archive.payload, a.admin.id, a.companyId);
      expect((await admin.warehouses.list()).map(item => item.name)).toEqual([
        "Dépôt principal",
      ]);
      expect(
        (
          await (await realDb())
            .select()
            .from(productStocks)
            .where(eq(productStocks.productId, productId))
        )[0]!.quantity
      ).toBe(14);
      expect(await (await realDb()).select().from(stockLots)).toHaveLength(1);
    });

    it("refuse le dépôt d'une autre entreprise", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      const { id: productId } = await admin.products.create({
        ...base,
        reference: "DEP-2",
        name: "Sel",
        purchasePriceCents: 100,
        quantity: 5,
        supplierId: null,
      });
      const b = await seedTenant("b");
      const [foreign] = await appRouter
        .createCaller(ctx(b.admin))
        .warehouses.list();
      const [main] = await admin.warehouses.list();
      await expect(
        admin.warehouses.transfer({
          productId,
          fromWarehouseId: main!.id,
          toWarehouseId: foreign!.id,
          quantity: 1,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  }
);
