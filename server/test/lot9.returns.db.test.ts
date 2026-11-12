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
import {
  products,
  remunerationProfiles,
  saleCommissions,
  salePayments,
  sales,
} from "../../drizzle/schema";

const year = new Date().getUTCFullYear();
const noAgents = { salesAgentId: null, cashierId: null };

describe.skipIf(!realDbUrl)("Lot 9.2 — retours partiels (MySQL réel)", () => {
  let a: SeededTenant;
  beforeEach(async () => {
    await resetDatabase();
    a = await seedTenant("a");
  });

  async function paidSale() {
    const admin = appRouter.createCaller(ctx(a.admin));
    const db = await realDb();
    await db
      .insert(remunerationProfiles)
      .values({
        companyId: a.companyId,
        beneficiaryType: "user",
        beneficiaryId: a.admin.id,
        remunerationMode: "commission",
        fixedMonthlyCents: 0,
        commissionBasis: "revenue",
        rateBasisPoints: 1000,
        active: true,
      });
    const p1 = await admin.products.create({
      reference: "ART-A",
      name: "Article A",
      description: null,
      category: "Divers",
      unit: "pièce",
      purchasePriceCents: 400,
      retailPriceCents: 1000,
      wholesalePriceCents: 800,
      quantity: 20,
      minimumQuantity: 0,
      supplierId: null,
    });
    const p2 = await admin.products.create({
      reference: "ART-B",
      name: "Article B",
      description: null,
      category: "Divers",
      unit: "pièce",
      purchasePriceCents: 1000,
      retailPriceCents: 3000,
      wholesalePriceCents: 2500,
      quantity: 20,
      minimumQuantity: 0,
      supplierId: null,
    });
    const sale = await admin.transactions.createDraft({
      channel: "pos",
      customerId: null,
      note: null,
      items: [
        { productId: p1.id, quantity: 4 },
        { productId: p2.id, quantity: 2 },
      ],
      ...noAgents,
    });
    await admin.transactions.checkout({
      saleId: sale.id,
      settlementMode: "full",
      payments: [{ method: "cash", amountCents: sale.totalCents }],
      ...noAgents,
    });
    const detail = await admin.commerce.sales.detail({ id: sale.id });
    return { admin, sale, detail, p1: p1.id, p2: p2.id };
  }
  const stock = async (id: number) =>
    (
      await (await realDb()).select().from(products).where(eq(products.id, id))
    )[0]!.quantity;

  it("rembourse au prorata, remet en stock, émet un avoir et contrepasse les commissions", async () => {
    const { admin, sale, detail, p1, p2 } = await paidSale();
    expect(sale.totalCents).toBe(10000);
    const lineA = detail.items.find(item => item.productId === p1)!;
    const lineB = detail.items.find(item => item.productId === p2)!;
    const result = await admin.transactions.returnItems({
      saleId: sale.id,
      lines: [
        { saleItemId: lineA.id, quantity: 1, restock: true },
        { saleItemId: lineB.id, quantity: 1, restock: false },
      ],
      reason: "Défaut",
    });
    expect(result).toEqual({
      creditNoteNumber: `AV-${year}-000001`,
      refundCents: 4000,
      fullyReturned: false,
    });
    expect(await stock(p1)).toBe(17);
    expect(await stock(p2)).toBe(18);
    const db = await realDb();
    expect(
      (
        await db
          .select()
          .from(salePayments)
          .where(eq(salePayments.saleId, sale.id))
      ).reduce((sum, row) => sum + row.amountCents, 0)
    ).toBe(6000);
    expect(
      (
        await db
          .select()
          .from(saleCommissions)
          .where(eq(saleCommissions.saleId, sale.id))
      ).reduce((sum, row) => sum + row.commissionCents, 0)
    ).toBe(600);
    expect(
      (await db.select().from(sales).where(eq(sales.id, sale.id)))[0]
    ).toMatchObject({
      status: "paid",
      amountPaidCents: 6000,
      returnedCents: 4000,
    });
    expect((await admin.dashboard.get()).summary.todayRevenueCents).toBe(6000);
  });

  it("refuse de rendre plus que la quantité restante puis clôture la vente quand tout est rendu", async () => {
    const { admin, sale, detail, p1 } = await paidSale();
    const lineA = detail.items.find(item => item.productId === p1)!;
    await admin.transactions.returnItems({
      saleId: sale.id,
      lines: [{ saleItemId: lineA.id, quantity: 3, restock: true }],
    });
    await expect(
      admin.transactions.returnItems({
        saleId: sale.id,
        lines: [{ saleItemId: lineA.id, quantity: 2, restock: true }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const result = await admin.transactions.returnItems({
      saleId: sale.id,
      lines: detail.items.map(item => ({
        saleItemId: item.id,
        quantity: item.productId === p1 ? 1 : item.quantity,
        restock: true,
      })),
    });
    expect(result.fullyReturned).toBe(true);
    expect(
      (
        await (await realDb()).select().from(sales).where(eq(sales.id, sale.id))
      )[0]
    ).toMatchObject({
      status: "void",
      amountPaidCents: 0,
      returnedCents: 10000,
    });
  });

  it("le remboursement total après un retour partiel ne remet en stock que le reste", async () => {
    const { admin, sale, detail, p1 } = await paidSale();
    const lineA = detail.items.find(item => item.productId === p1)!;
    await admin.transactions.returnItems({
      saleId: sale.id,
      lines: [{ saleItemId: lineA.id, quantity: 1, restock: true }],
    });
    await admin.transactions.refund({ saleId: sale.id });
    expect(await stock(p1)).toBe(20);
    expect(
      (
        await (await realDb())
          .select()
          .from(salePayments)
          .where(eq(salePayments.saleId, sale.id))
      ).reduce((sum, row) => sum + row.amountCents, 0)
    ).toBe(0);
  });

  it("refuse un retour sur la vente d'une autre entreprise", async () => {
    const { sale, detail } = await paidSale();
    const b = await seedTenant("b");
    await expect(
      appRouter
        .createCaller(ctx(b.admin))
        .transactions.returnItems({
          saleId: sale.id,
          lines: [
            { saleItemId: detail.items[0]!.id, quantity: 1, restock: true },
          ],
        })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
