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
import { saleItems, saleSettings } from "../../drizzle/schema";
import { computeVatBreakdown } from "@shared/pricing";

describe("computeVatBreakdown", () => {
  it("répartit la remise globale au prorata puis applique chaque taux", () => {
    const result = computeVatBreakdown(
      [
        { netCents: 10000, vatRateBasisPoints: 2000 },
        { netCents: 5000, vatRateBasisPoints: 550 },
      ],
      1500
    );
    expect(result.perLine).toEqual([
      { taxableCents: 9000, vatRateBasisPoints: 2000, vatCents: 1800 },
      { taxableCents: 4500, vatRateBasisPoints: 550, vatCents: 248 },
    ]);
    expect(result).toMatchObject({ taxableCents: 13500, vatCents: 2048 });
  });
});

describe.skipIf(!realDbUrl)("Lot 9.6 — TVA par produit (MySQL réel)", () => {
  let a: SeededTenant;
  beforeEach(async () => {
    await resetDatabase();
    a = await seedTenant("a");
    await (await realDb())
      .update(saleSettings)
      .set({ vatEnabled: true, vatRateBasisPoints: 2000 })
      .where(eq(saleSettings.companyId, a.companyId));
  });

  it("applique le taux du produit, sinon celui de l'entreprise, avec la remise globale répartie", async () => {
    const admin = appRouter.createCaller(ctx(a.admin));
    const base = {
      description: null,
      category: "Divers",
      unit: "pièce",
      purchasePriceCents: 100,
      wholesalePriceCents: 100,
      quantity: 10,
      minimumQuantity: 0,
      supplierId: null,
    };
    const standard = await admin.products.create({
      ...base,
      reference: "STD-1",
      name: "Standard",
      retailPriceCents: 10000,
    });
    const reduced = await admin.products.create({
      ...base,
      reference: "RED-1",
      name: "Taux réduit",
      retailPriceCents: 5000,
      vatRateBasisPoints: 550,
    });
    const sale = await admin.transactions.createDraft({
      channel: "pos",
      customerId: null,
      note: null,
      items: [
        { productId: standard.id, quantity: 1 },
        { productId: reduced.id, quantity: 1 },
      ],
      invoiceDiscount: { type: "percent", value: 1000 },
      salesAgentId: null,
      cashierId: null,
    });
    expect(sale.totalCents).toBe(13500 + 2048);
    const lines = await (await realDb())
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, sale.id));
    expect(
      lines.map(line => [line.vatRateBasisPoints, line.vatCents]).sort()
    ).toEqual(
      [
        [2000, 1800],
        [550, 248],
      ].sort()
    );
  });
});
