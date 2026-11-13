import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("../storage", () => ({
  storagePut: async (key: string) => ({ key, url: `/manus-storage/${key}` }),
  storageGetSignedUrl: async (key: string) => `memory://${key}`,
  storageDelete: async () => true,
}));

import {
  ctx,
  realDb,
  realDbUrl,
  resetDatabase,
  seedTenant,
  type SeededTenant,
} from "./realDb";
import { appRouter } from "../routers";
import { createBackupSnapshot } from "../backups";
import { companies, products, sales, users } from "../../drizzle/schema";

const product = (reference: string) => ({
  reference,
  name: "Produit",
  description: null,
  category: "Divers",
  unit: "pièce",
  purchasePriceCents: 100,
  retailPriceCents: 200,
  wholesalePriceCents: 150,
  quantity: 5,
  minimumQuantity: 0,
  supplierId: null,
});
const remuneration = {
  remunerationMode: "fixed" as const,
  fixedMonthlyCents: 0,
  commissionBasis: "revenue" as const,
  rateBasisPoints: 0,
  active: true,
};

describe.skipIf(!realDbUrl)(
  "Lot 9.8 — abonnements, plateforme, RGPD (MySQL réel)",
  () => {
    let a: SeededTenant;
    beforeEach(async () => {
      await resetDatabase();
      a = await seedTenant("a");
      delete process.env.PLATFORM_ADMIN_EMAILS;
    });
    const setCompany = async (values: Partial<typeof companies.$inferInsert>) =>
      (await realDb())
        .update(companies)
        .set(values)
        .where(eq(companies.id, a.companyId));

    it("applique les limites du plan", async () => {
      await setCompany({ plan: "trial" });
      const admin = appRouter.createCaller(ctx(a.admin));
      // Essai : 3 utilisateurs maximum (administrateur et vendeur de départ inclus).
      await admin.commerce.sellers.create({
        name: "Trois",
        email: "trois@a.test",
        username: "trois.a",
        password: "Vendeur!2026",
        remuneration,
      });
      await expect(
        admin.commerce.sellers.create({
          name: "Quatre",
          email: "quatre@a.test",
          username: "quatre.a",
          password: "Vendeur!2026",
          remuneration,
        })
      ).rejects.toThrow("limitée à 3 utilisateurs");
      await expect(
        admin.warehouses.create({ name: "Deuxième dépôt" })
      ).rejects.toThrow("limitée à 1 dépôts");
      await setCompany({ plan: "pro" });
      await expect(
        admin.warehouses.create({ name: "Deuxième dépôt" })
      ).resolves.toHaveProperty("id");
    });

    it("bloque les écritures après l'essai ou en cas de suspension, sans bloquer la lecture ni l'export", async () => {
      await setCompany({
        plan: "trial",
        trialEndsAt: new Date(Date.now() - 1000),
      });
      const admin = appRouter.createCaller(ctx(a.admin));
      await expect(admin.products.create(product("EXP-1"))).rejects.toThrow(
        "période d’essai est terminée"
      );
      await expect(admin.products.list()).resolves.toEqual([]);
      await expect(admin.company.exportData()).resolves.toHaveProperty(
        "filename"
      );
      expect((await admin.company.subscription()).reason).toBe("trial_expired");
      await setCompany({
        plan: "pro",
        status: "suspended",
        suspendedReason: "Impayé",
      });
      await expect(admin.products.create(product("EXP-2"))).rejects.toThrow(
        "Impayé"
      );
    });

    it("console plateforme réservée aux adresses autorisées", async () => {
      await expect(
        appRouter.createCaller(ctx(a.admin)).platform.companies()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      process.env.PLATFORM_ADMIN_EMAILS = `autre@x.test, ${a.admin.email!.toUpperCase()}`;
      const platform = appRouter.createCaller(ctx(a.admin));
      const list = await platform.platform.companies();
      expect(list.find(item => item.id === a.companyId)).toMatchObject({
        users: 2,
      });
      await platform.platform.updateCompany({
        companyId: a.companyId,
        plan: "starter",
        status: "active",
      });
      expect(
        (
          await (await realDb())
            .select()
            .from(companies)
            .where(eq(companies.id, a.companyId))
        )[0]!.plan
      ).toBe("starter");
    });

    it("supprime définitivement toutes les données de l'entreprise, sans toucher aux autres", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      const { id: productId } = await admin.products.create(product("DEL-1"));
      const sale = await admin.transactions.createDraft({
        channel: "pos",
        customerId: null,
        note: null,
        items: [{ productId, quantity: 1 }],
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
      await createBackupSnapshot(a.admin.id, "manual", a.companyId);
      const b = await seedTenant("b");
      await appRouter
        .createCaller(ctx(b.admin))
        .products.create(product("KEEP-1"));
      const name = (await admin.company.subscription()).name;
      await expect(
        admin.company.delete({ confirmationName: "mauvais nom" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await admin.company.delete({ confirmationName: name });
      const db = await realDb();
      expect(
        await db.select().from(companies).where(eq(companies.id, a.companyId))
      ).toHaveLength(0);
      expect(
        await db.select().from(users).where(eq(users.companyId, a.companyId))
      ).toHaveLength(0);
      expect(
        await db.select().from(sales).where(eq(sales.companyId, a.companyId))
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(products)
          .where(eq(products.companyId, b.companyId))
      ).toHaveLength(1);
    });

    it("l'export RGPD ne contient pas les empreintes de mot de passe", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      await admin.commerce.sellers.create({
        name: "Awa",
        email: "awa@a.test",
        username: "awa.a",
        password: "Vendeuse!2026",
        remuneration,
      });
      const file = await admin.company.exportData();
      expect(file.content).toContain("awa@a.test");
      expect(file.content).not.toContain("passwordHash");
    });
  }
);
