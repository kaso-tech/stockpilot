import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  ctx,
  realDb,
  realDbUrl,
  resetDatabase,
  seedTenant,
  type SeededTenant,
} from "./realDb";
import { appRouter } from "../routers";
import {
  auditLogs,
  inventorySessions,
  productStocks,
  products,
  stockMovements,
  warehouses,
} from "../../drizzle/schema";

const product = (reference: string, quantity: number) => ({
  reference,
  name: `Produit ${reference}`,
  description: null,
  category: "Divers",
  unit: "pièce",
  purchasePriceCents: 100,
  retailPriceCents: 200,
  wholesalePriceCents: 150,
  quantity,
  minimumQuantity: 0,
  supplierId: null,
});

describe.skipIf(!realDbUrl)(
  "Dépôts — réinitialisation et suppression définitive (MySQL réel)",
  () => {
    let a: SeededTenant;
    let b: SeededTenant;
    beforeEach(async () => {
      await resetDatabase();
      a = await seedTenant("a");
      b = await seedTenant("b");
    });

    /** Produit de 10 unités dont 8 transférées dans un second dépôt « Boutique ». */
    async function stockedShop() {
      const admin = appRouter.createCaller(ctx(a.admin));
      const { id: productId } = await admin.products.create(product("R-1", 10));
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
      await admin.inventory.create({
        name: "Comptage boutique",
        warehouseId: shop,
      });
      return { admin, productId, mainId: main!.id, shop };
    }

    it("réinitialise le dépôt : stock, mouvements et inventaires supprimés, stock total ajusté et tracé", async () => {
      const { admin, productId, mainId, shop } = await stockedShop();
      expect(await admin.warehouses.impact({ id: shop })).toMatchObject({
        productsWithStock: 1,
        units: 8,
        inventories: 1,
      });
      await expect(
        admin.warehouses.reset({ id: shop, confirmName: "boutique" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await admin.warehouses.reset({ id: shop, confirmName: "Boutique" });
      const db = await realDb();
      expect(
        (await db.select().from(products).where(eq(products.id, productId)))[0]
          ?.quantity
      ).toBe(2);
      expect(
        await db
          .select()
          .from(productStocks)
          .where(eq(productStocks.warehouseId, shop))
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.warehouseId, shop))
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(inventorySessions)
          .where(eq(inventorySessions.warehouseId, shop))
      ).toHaveLength(0);
      const adjustment = (
        await db
          .select()
          .from(stockMovements)
          .where(
            and(
              eq(stockMovements.productId, productId),
              eq(stockMovements.reason, "Réinitialisation du dépôt Boutique")
            )
          )
      )[0];
      expect(adjustment).toMatchObject({
        quantity: -8,
        previousQuantity: 10,
        resultingQuantity: 2,
        warehouseId: null,
      });
      // Le dépôt principal garde ses 2 unités ; le dépôt réinitialisé existe toujours.
      const stock = (await admin.warehouses.stock({ productId }))[0]!.stocks;
      expect(stock.find(item => item.warehouseId === mainId)?.quantity).toBe(2);
      expect(
        await db.select().from(warehouses).where(eq(warehouses.id, shop))
      ).toHaveLength(1);
      expect(
        (
          await db
            .select()
            .from(auditLogs)
            .where(eq(auditLogs.action, "Réinitialisation"))
        )[0]?.detail
      ).toContain("8 unité(s)");
    });

    it("supprime définitivement un dépôt, jamais le dépôt par défaut", async () => {
      const { admin, mainId, shop } = await stockedShop();
      await expect(
        admin.warehouses.remove({ id: mainId, confirmName: "Dépôt principal" })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      await admin.warehouses.remove({ id: shop, confirmName: "Boutique" });
      const db = await realDb();
      expect(
        await db.select().from(warehouses).where(eq(warehouses.id, shop))
      ).toHaveLength(0);
      expect((await admin.warehouses.list()).map(item => item.id)).toEqual([
        mainId,
      ]);
    });

    it("réserve ces actions aux administrateurs de l'entreprise propriétaire", async () => {
      const { shop } = await stockedShop();
      await expect(
        appRouter
          .createCaller(ctx(a.seller))
          .warehouses.reset({ id: shop, confirmName: "Boutique" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        appRouter
          .createCaller(ctx(b.admin))
          .warehouses.remove({ id: shop, confirmName: "Boutique" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  }
);
