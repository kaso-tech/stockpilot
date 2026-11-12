import { beforeEach, describe, expect, it } from "vitest";
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
import { productCategories, products } from "../../drizzle/schema";

const product = {
  reference: "CAT-1",
  name: "Jus",
  description: null,
  category: "Boissons",
  unit: "Bouteille",
  purchasePriceCents: 100,
  retailPriceCents: 200,
  wholesalePriceCents: 150,
  quantity: 1,
  minimumQuantity: 0,
  supplierId: null,
};

describe.skipIf(!realDbUrl)(
  "Lot 9.4 — catégories et unités par identifiant (MySQL réel)",
  () => {
    let a: SeededTenant;
    beforeEach(async () => {
      await resetDatabase();
      a = await seedTenant("a");
    });

    it("rattache le produit au catalogue (en le complétant) et suit les renommages par identifiant", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      const { id } = await admin.products.create(product);
      const db = await realDb();
      const row = (
        await db.select().from(products).where(eq(products.id, id))
      )[0]!;
      expect(row.categoryId).toBeGreaterThan(0);
      expect(row.unitId).toBeGreaterThan(0);
      await admin.categories.update({
        id: row.categoryId!,
        name: "Boissons fraîches",
      });
      expect(
        (await db.select().from(products).where(eq(products.id, id)))[0]
      ).toMatchObject({
        category: "Boissons fraîches",
        categoryId: row.categoryId,
      });
      await expect(
        admin.categories.remove({ id: row.categoryId! })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      await expect(
        admin.units.remove({ id: row.unitId! })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });

    it("ne réutilise jamais la catégorie d'une autre entreprise", async () => {
      await appRouter.createCaller(ctx(a.admin)).products.create(product);
      const b = await seedTenant("b");
      const { id } = await appRouter
        .createCaller(ctx(b.admin))
        .products.create(product);
      const db = await realDb();
      const productB = (
        await db.select().from(products).where(eq(products.id, id))
      )[0]!;
      const category = (
        await db
          .select()
          .from(productCategories)
          .where(eq(productCategories.id, productB.categoryId!))
      )[0]!;
      expect(category.companyId).toBe(b.companyId);
    });
  }
);
