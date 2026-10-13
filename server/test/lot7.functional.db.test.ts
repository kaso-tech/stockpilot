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
  remunerationProfiles,
  saleCommissions,
  salePayments,
  sales,
  saleSettings,
} from "../../drizzle/schema";

const productInput = (overrides: Record<string, unknown> = {}) => ({
  reference: `REF-${Math.random().toString(36).slice(2, 8)}`,
  name: "Produit",
  description: null,
  category: "Divers",
  unit: "pièce",
  purchasePriceCents: 400,
  retailPriceCents: 1000,
  wholesalePriceCents: 800,
  quantity: 100,
  minimumQuantity: 0,
  supplierId: null,
  ...overrides,
});
const noAgents = { salesAgentId: null, cashierId: null };
const year = new Date().getUTCFullYear();

async function posSale(tenant: SeededTenant, productId: number, quantity = 1) {
  return appRouter.createCaller(ctx(tenant.admin)).transactions.createDraft({
    channel: "pos",
    customerId: null,
    note: null,
    items: [{ productId, quantity }],
    ...noAgents,
  });
}

describe.skipIf(!realDbUrl)(
  "Lot 7 — corrections fonctionnelles (MySQL réel)",
  () => {
    let a: SeededTenant;
    let b: SeededTenant;

    beforeEach(async () => {
      await resetDatabase();
      a = await seedTenant("a");
      b = await seedTenant("b");
    });

    it("E5 — numérotation continue par entreprise, sans collision même en parallèle", async () => {
      const { id: productA } = await appRouter
        .createCaller(ctx(a.admin))
        .products.create(productInput());
      const { id: productB } = await appRouter
        .createCaller(ctx(b.admin))
        .products.create(productInput());
      const created = await Promise.all(
        Array.from({ length: 8 }, () => posSale(a, productA))
      );
      const numbers = created.map(sale => sale.invoiceNumber).sort();
      expect(numbers).toEqual(
        Array.from(
          { length: 8 },
          (_, index) => `POS-${year}-${String(index + 1).padStart(6, "0")}`
        )
      );
      expect((await posSale(b, productB)).invoiceNumber).toBe(
        `POS-${year}-000001`
      );
    });

    it("E5 — une facture non encaissée est annulée (jamais supprimée) pour préserver la numérotation", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      const { id: productId } = await admin.products.create(productInput());
      const customer = await admin.commerce.customers.create({
        name: "Client",
        otherReference: null,
        type: "ordinary",
        email: null,
        phone: null,
        address: null,
        taxNumber: null,
        notes: null,
      });
      const invoice = await admin.transactions.createDraft({
        channel: "invoice",
        customerId: customer.id,
        note: null,
        items: [{ productId, quantity: 1 }],
        ...noAgents,
        salesAgentSelectionMade: true,
        cashierSelectionMade: true,
      });
      expect(invoice.invoiceNumber).toBe(`FAC-${year}-000001`);
      await admin.transactions.removeDraft({ saleId: invoice.id });
      const db = await realDb();
      expect(
        (await db.select().from(sales).where(eq(sales.id, invoice.id)))[0]
          ?.status
      ).toBe("void");
    });

    it("E8/E10 — commissions au prorata des encaissements, remboursement avec avoir, paiement négatif et contrepassation", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      const db = await realDb();
      await db.insert(remunerationProfiles).values({
        companyId: a.companyId,
        beneficiaryType: "user",
        beneficiaryId: a.admin.id,
        remunerationMode: "commission",
        fixedMonthlyCents: 0,
        commissionBasis: "revenue",
        rateBasisPoints: 1000,
        active: true,
      });
      const { id: productId } = await admin.products.create(productInput());
      const customer = await admin.commerce.customers.create({
        name: "Client",
        otherReference: null,
        type: "ordinary",
        email: null,
        phone: null,
        address: null,
        taxNumber: null,
        notes: null,
      });
      const invoice = await admin.transactions.createDraft({
        channel: "invoice",
        customerId: customer.id,
        note: null,
        items: [{ productId, quantity: 10 }],
        ...noAgents,
        salesAgentSelectionMade: true,
        cashierSelectionMade: true,
      });
      await admin.transactions.checkout({
        saleId: invoice.id,
        settlementMode: "partial",
        payments: [{ method: "cash", amountCents: 4000 }],
        ...noAgents,
      });
      const afterDeposit = await db
        .select()
        .from(saleCommissions)
        .where(eq(saleCommissions.saleId, invoice.id));
      expect(
        afterDeposit.reduce((sum, row) => sum + row.commissionCents, 0)
      ).toBe(400);
      await admin.transactions.checkout({
        saleId: invoice.id,
        settlementMode: "full",
        payments: [{ method: "cash", amountCents: invoice.totalCents - 4000 }],
        ...noAgents,
      });
      expect(
        (
          await db
            .select()
            .from(saleCommissions)
            .where(eq(saleCommissions.saleId, invoice.id))
        ).reduce((sum, row) => sum + row.commissionCents, 0)
      ).toBe(Math.round(invoice.totalCents / 10));
      const refund = await admin.transactions.refund({ saleId: invoice.id });
      expect(refund.creditNoteNumber).toBe(`AV-${year}-000001`);
      expect(
        (
          await db
            .select()
            .from(saleCommissions)
            .where(eq(saleCommissions.saleId, invoice.id))
        ).reduce((sum, row) => sum + row.commissionCents, 0)
      ).toBe(0);
      const payments = await db
        .select()
        .from(salePayments)
        .where(eq(salePayments.saleId, invoice.id));
      expect(payments.reduce((sum, row) => sum + row.amountCents, 0)).toBe(0);
      expect(
        (await db.select().from(sales).where(eq(sales.id, invoice.id)))[0]
      ).toMatchObject({
        status: "void",
        creditNoteNumber: refund.creditNoteNumber,
      });
    });

    it("E4 — le tableau de bord d'une entreprise SaaS compte ses commissions dans la paie due", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      const db = await realDb();
      await db.insert(remunerationProfiles).values({
        companyId: a.companyId,
        beneficiaryType: "user",
        beneficiaryId: a.admin.id,
        remunerationMode: "commission",
        fixedMonthlyCents: 0,
        commissionBasis: "revenue",
        rateBasisPoints: 1000,
        active: true,
      });
      const { id: productId } = await admin.products.create(productInput());
      const sale = await posSale(a, productId, 2);
      await admin.transactions.checkout({
        saleId: sale.id,
        settlementMode: "full",
        payments: [{ method: "cash", amountCents: sale.totalCents }],
        ...noAgents,
      });
      const dashboard = await admin.dashboard.get();
      expect(dashboard.summary.duePayrollCents).toBe(
        Math.round(sale.totalCents / 10)
      );
      expect(dashboard.summary.todayRevenueCents).toBe(sale.totalCents);
    });

    it("E6 — le fuseau horaire est réglable et validé", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      const base = {
        defaultSalesAgentId: null,
        defaultCashierId: null,
        requireSalesAgent: false,
        requireCashier: false,
      };
      await admin.commerce.settings.save({ ...base, timezone: "Africa/Lagos" });
      const db = await realDb();
      expect(
        (
          await db
            .select()
            .from(saleSettings)
            .where(and(eq(saleSettings.companyId, a.companyId)))
        )[0]?.timezone
      ).toBe("Africa/Lagos");
      await expect(
        admin.commerce.settings.save({ ...base, timezone: "Mars/Olympus" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("E12 — la liste filtre par canal et accepte une limite étendue", async () => {
      const admin = appRouter.createCaller(ctx(a.admin));
      const { id: productId } = await admin.products.create(productInput());
      for (let index = 0; index < 3; index += 1) await posSale(a, productId);
      const customer = await admin.commerce.customers.create({
        name: "Client",
        otherReference: null,
        type: "ordinary",
        email: null,
        phone: null,
        address: null,
        taxNumber: null,
        notes: null,
      });
      await admin.transactions.createDraft({
        channel: "quote",
        customerId: customer.id,
        note: null,
        items: [{ productId, quantity: 1 }],
        ...noAgents,
        salesAgentSelectionMade: true,
        cashierSelectionMade: true,
      });
      expect(
        await admin.transactions.list({ channel: "quote", limit: 1 })
      ).toHaveLength(1);
      expect(
        await admin.transactions.list({ channel: "pos", limit: 2 })
      ).toHaveLength(2);
      expect(await admin.transactions.list({ channel: "pos" })).toHaveLength(3);
    });
  }
);
