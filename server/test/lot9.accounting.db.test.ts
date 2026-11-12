import { beforeEach, describe, expect, it } from "vitest";
import {
  ctx,
  realDbUrl,
  resetDatabase,
  seedTenant,
  type SeededTenant,
} from "./realDb";
import { appRouter } from "../routers";

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });
const parse = (value: string) =>
  Math.round(Number(value.replace(",", ".")) * 100);

describe.skipIf(!realDbUrl)(
  "Lot 9.5 — comptabilité et clôture de caisse (MySQL réel)",
  () => {
    let a: SeededTenant;
    beforeEach(async () => {
      await resetDatabase();
      a = await seedTenant("a");
    });

    async function activity() {
      const admin = appRouter.createCaller(ctx(a.admin));
      const product = await admin.products.create({
        reference: "ACC-1",
        name: "Article",
        description: null,
        category: "Divers",
        unit: "pièce",
        purchasePriceCents: 100,
        retailPriceCents: 1000,
        wholesalePriceCents: 900,
        quantity: 50,
        minimumQuantity: 0,
        supplierId: null,
      });
      const pos = await admin.transactions.createDraft({
        channel: "pos",
        customerId: null,
        note: null,
        items: [{ productId: product.id, quantity: 3 }],
        salesAgentId: null,
        cashierId: null,
      });
      await admin.transactions.checkout({
        saleId: pos.id,
        settlementMode: "full",
        payments: [
          { method: "cash", amountCents: 2000 },
          { method: "card", amountCents: 1000 },
        ],
        salesAgentId: null,
        cashierId: null,
      });
      const detail = await admin.commerce.sales.detail({ id: pos.id });
      await admin.transactions.returnItems({
        saleId: pos.id,
        lines: [
          { saleItemId: detail.items[0]!.id, quantity: 1, restock: true },
        ],
        method: "cash",
      });
      const second = await admin.transactions.createDraft({
        channel: "pos",
        customerId: null,
        note: null,
        items: [{ productId: product.id, quantity: 1 }],
        salesAgentId: null,
        cashierId: null,
      });
      await admin.transactions.checkout({
        saleId: second.id,
        settlementMode: "full",
        payments: [{ method: "mobile_money", amountCents: 1000 }],
        salesAgentId: null,
        cashierId: null,
      });
      await admin.transactions.refund({ saleId: second.id });
      return admin;
    }

    it("produit un FEC équilibré (ventes, avoirs, encaissements) selon le plan choisi", async () => {
      const admin = await activity();
      const file = await admin.accounting.export({
        from: today(),
        to: today(),
        format: "fec",
        referential: "syscohada",
      });
      const lines = file.content.trim().split("\r\n");
      expect(lines[0]!.split("\t")).toHaveLength(18);
      const rows = lines.slice(1).map(line => line.split("\t"));
      expect(
        rows.reduce((sum, row) => sum + parse(row[11]!) - parse(row[12]!), 0)
      ).toBe(0);
      expect(rows.some(row => row[4] === "571100")).toBe(true);
      expect(rows.some(row => row[4] === "701100")).toBe(true);
      expect(
        rows.filter(row => row[10]!.startsWith("Avoir")).length
      ).toBeGreaterThan(0);
      const pcg = await admin.accounting.export({
        from: today(),
        to: today(),
        format: "fec",
        referential: "pcg",
      });
      expect(pcg.content).toContain("707000");
    });

    it("exporte les journaux CSV des ventes et des encaissements", async () => {
      const admin = await activity();
      const salesCsv = await admin.accounting.export({
        from: today(),
        to: today(),
        format: "sales_csv",
      });
      expect(salesCsv.content.split("\r\n")[0]).toContain("Numéro;Type;Client");
      expect(salesCsv.content).toContain("POS-");
      const payments = await admin.accounting.export({
        from: today(),
        to: today(),
        format: "payments_csv",
      });
      expect(payments.content).toContain("Remboursement");
    });

    it("clôture la caisse avec l'écart et refuse une seconde clôture", async () => {
      const admin = await activity();
      const summary = await admin.accounting.cash.summary({
        businessDay: today(),
      });
      expect(summary.totals.cash).toBe(2000 - 1000);
      expect(summary.totals.mobile_money).toBe(0);
      const closed = await admin.accounting.cash.close({
        businessDay: today(),
        openingFloatCents: 5000,
        countedCashCents: 5900,
      });
      expect(closed).toEqual({
        expectedCashCents: 6000,
        differenceCents: -100,
      });
      await expect(
        admin.accounting.cash.close({
          businessDay: today(),
          openingFloatCents: 0,
          countedCashCents: 0,
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await admin.accounting.cash.summary({ businessDay: today() })).closure
      ).not.toBeNull();
    });

    it("réserve l'export au rôle autorisé", async () => {
      await expect(
        appRouter
          .createCaller(ctx(a.seller))
          .accounting.export({ from: today(), to: today(), format: "fec" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  }
);
