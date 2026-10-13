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
import { auditLogs, saleSettings } from "../../drizzle/schema";

const product = (overrides: Record<string, unknown> = {}) => ({
  reference: `REF-${Math.random().toString(36).slice(2, 8)}`,
  name: "Produit test",
  description: null,
  category: "Divers",
  unit: "pièce",
  purchasePriceCents: 100,
  retailPriceCents: 200,
  wholesalePriceCents: 150,
  quantity: 10,
  minimumQuantity: 1,
  supplierId: null,
  ...overrides,
});

describe.skipIf(!realDbUrl)(
  "Lot 1 — isolation multi-entreprise (MySQL réel)",
  () => {
    let a: SeededTenant;
    let b: SeededTenant;

    beforeEach(async () => {
      await resetDatabase();
      a = await seedTenant("a");
      b = await seedTenant("b");
    });

    it("S2 — refuse de rattacher un produit au fournisseur d'une autre entreprise", async () => {
      const supplierB = await appRouter
        .createCaller(ctx(b.admin))
        .suppliers.create({
          name: "Fournisseur B",
          otherReference: null,
          address: "Adresse secrète",
          email: null,
          phone: null,
          taxNumber: null,
          notes: null,
        });
      const callerA = appRouter.createCaller(ctx(a.admin));
      await expect(
        callerA.products.create(product({ supplierId: supplierB.id }))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const created = await callerA.products.create(product());
      await expect(
        callerA.products.update({
          id: created.id,
          ...product({ supplierId: supplierB.id }),
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("S3 — l'autorisation vendeur sur le coût d'achat dépend des réglages de sa propre entreprise", async () => {
      const db = await realDb();
      await db
        .update(saleSettings)
        .set({ sellerCanEditPurchasePrice: true })
        .where(eq(saleSettings.companyId, a.companyId));
      await db
        .update(saleSettings)
        .set({ sellerCanEditPurchasePrice: false })
        .where(eq(saleSettings.companyId, b.companyId));
      const productB = await appRouter
        .createCaller(ctx(b.admin))
        .products.create(product());
      await expect(
        appRouter.createCaller(ctx(b.seller)).products.updatePurchasePrice({
          id: productB.id,
          purchasePriceCents: 1,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("S4 — les entrées d'audit sont rattachées à l'entreprise de l'acteur", async () => {
      await appRouter.createCaller(ctx(a.admin)).products.create(product());
      await appRouter.createCaller(ctx(a.admin)).commerce.customers.create({
        name: "Client A",
        otherReference: null,
        type: "ordinary",
        email: null,
        phone: null,
        address: null,
        taxNumber: null,
        notes: null,
      });
      const db = await realDb();
      const orphan = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.actorUserId, a.admin.id)));
      expect(orphan.length).toBeGreaterThanOrEqual(2);
      expect(orphan.every(row => row.companyId === a.companyId)).toBe(true);
      expect(
        await appRouter.createCaller(ctx(b.admin)).audit.list()
      ).toHaveLength(0);
      expect(
        (await appRouter.createCaller(ctx(a.admin)).audit.list()).length
      ).toBe(orphan.length);
    });

    it("S7 — un paiement de paie ne peut viser qu'un bénéficiaire de l'entreprise", async () => {
      await expect(
        appRouter.createCaller(ctx(a.admin)).payroll.pay({
          beneficiaryType: "user",
          beneficiaryId: b.seller.id,
          amountCents: 1000,
          note: null,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        appRouter.createCaller(ctx(a.admin)).payroll.pay({
          beneficiaryType: "user",
          beneficiaryId: a.seller.id,
          amountCents: 1000,
          note: null,
        })
      ).resolves.toHaveProperty("id");
    });

    it("B1 — un vendeur ne peut pas lancer de sauvegarde", async () => {
      await expect(
        appRouter.createCaller(ctx(a.seller)).backups.runNow()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("E11 — un doublon de référence est signalé comme conflit", async () => {
      await expect(
        appRouter
          .createCaller(ctx(a.admin))
          .products.create(product({ reference: "DUP-1" }))
      ).resolves.toHaveProperty("id");
      await expect(
        appRouter
          .createCaller(ctx(a.admin))
          .products.create(product({ reference: "DUP-1" }))
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  }
);
