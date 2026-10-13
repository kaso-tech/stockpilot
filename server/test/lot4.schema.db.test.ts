import { beforeEach, describe, expect, it } from "vitest";
import {
  ctx,
  realDb,
  realDbUrl,
  resetDatabase,
  seedTenant,
  type SeededTenant,
} from "./realDb";
import { appRouter } from "../routers";
import { users } from "../../drizzle/schema";

const product = {
  reference: "P-001",
  name: "Produit",
  description: null,
  category: "Divers",
  unit: "pièce",
  purchasePriceCents: 100,
  retailPriceCents: 200,
  wholesalePriceCents: 150,
  quantity: 1,
  minimumQuantity: 0,
  supplierId: null,
};
const supplier = {
  name: "Grossiste Central",
  otherReference: null,
  address: null,
  email: null,
  phone: null,
  taxNumber: null,
  notes: null,
};

describe.skipIf(!realDbUrl)(
  "Lot 4 — unicité par entreprise (MySQL réel)",
  () => {
    let a: SeededTenant;
    let b: SeededTenant;

    beforeEach(async () => {
      await resetDatabase();
      a = await seedTenant("a");
      b = await seedTenant("b");
    });

    it("S1 — deux entreprises peuvent utiliser les mêmes référence, fournisseur, catégorie, unité et mois de budget", async () => {
      for (const tenant of [a, b]) {
        const caller = appRouter.createCaller(ctx(tenant.admin));
        await expect(caller.products.create(product)).resolves.toHaveProperty(
          "id"
        );
        await expect(caller.suppliers.create(supplier)).resolves.toHaveProperty(
          "id"
        );
        await expect(
          caller.categories.create({ name: "Boissons" })
        ).resolves.toHaveProperty("id");
        await expect(
          caller.units.create({ name: "Carton" })
        ).resolves.toHaveProperty("id");
        await expect(
          caller.expenses.budget.save({
            yearMonth: "2026-10",
            amountCents: 100_000,
            warningPercent: 80,
          })
        ).resolves.toBeTruthy();
      }
    });

    it("S1 — l'unicité reste garantie à l'intérieur d'une entreprise", async () => {
      const caller = appRouter.createCaller(ctx(a.admin));
      await caller.products.create(product);
      await expect(caller.products.create(product)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await caller.categories.create({ name: "Boissons" });
      await expect(
        caller.categories.create({ name: "Boissons" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("A8 — la base refuse deux comptes avec le même e-mail, casse ignorée", async () => {
      const db = await realDb();
      await expect(
        db.insert(users).values({
          openId: "dup-1",
          email: "ADMIN@A.TEST",
          role: "admin",
          companyId: a.companyId,
        })
      ).rejects.toThrow();
    });

    it("S5 — un compte sans entreprise n'accède à aucune donnée", async () => {
      await expect(
        appRouter
          .createCaller(ctx({ ...a.admin, companyId: null }))
          .products.list()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  }
);
