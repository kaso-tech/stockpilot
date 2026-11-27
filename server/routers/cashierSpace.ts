import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { lockedByOther } from "../posQueueRules";
import { z } from "zod";
import { agents, customers, saleItems, sales, users } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { companyScope } from "../companyScope";
import { getDb } from "../db";
import { assertSellerWarehouseAccess } from "../sellerWarehouseAccess";
import { companySettings } from "./commerce";

async function dbOrThrow() { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); return db; }

/** Fiche de caissier liée au compte connecté. */
async function linkedCashier(db: Awaited<ReturnType<typeof dbOrThrow>>, user: { id: number; role: string; companyId: number | null }) {
  if (user.role !== "cashier") throw new TRPCError({ code: "FORBIDDEN", message: "Cet espace est réservé aux caissiers." });
  const cashier = (await db.select().from(agents).where(and(eq(agents.userId, user.id), companyScope(agents.companyId, user.companyId))).limit(1))[0];
  if (!cashier || !cashier.active) throw new TRPCError({ code: "FORBIDDEN", message: "Votre fiche de caissier n’est plus active. Contactez votre administrateur." });
  return cashier;
}

/** Espace caissier : tickets à encaisser de son entrepôt et réglages nécessaires à l'encaissement (sans coûts ni marges). */
export const cashierSpaceRouter = router({
  context: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const cashier = await linkedCashier(db, ctx.user);
    const [settings, agentRows] = await Promise.all([
      companySettings(db, ctx.user.companyId!),
      db.select({ id: agents.id, name: agents.name, type: agents.type, active: agents.active }).from(agents).where(and(companyScope(agents.companyId, ctx.user.companyId), eq(agents.active, true))).orderBy(agents.name),
    ]);
    const pick = settings as Record<string, unknown>;
    const keys = ["defaultSalesAgentId", "paymentCashEnabled", "paymentCardEnabled", "paymentMobileMoneyEnabled", "paymentBankTransferEnabled", "paymentCreditEnabled", "requireSalesAgent", "companyName", "companyLogoUrl", "companyAddress", "companyPhone", "companyEmail", "companyFooter", "ticketHeader", "ticketFooter", "ticketWidthMm", "currency"];
    return { cashier: { id: cashier.id, name: cashier.name }, agents: agentRows, settings: { ...Object.fromEntries(keys.map(key => [key, pick[key] ?? null])), defaultCashierId: cashier.id } };
  }),
  /** Tickets de caisse en attente de paiement (complet ou partiel) dans l'entrepôt. */
  queue: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await linkedCashier(db, ctx.user);
    await assertSellerWarehouseAccess(db, ctx.user, input.warehouseId, { permission: "checkout" });
    const rows = await db.select({ id: sales.id, invoiceNumber: sales.invoiceNumber, queueNumber: sales.queueNumber, holdLabel: sales.holdLabel, queuedAt: sales.queuedAt, checkoutLockedBy: sales.checkoutLockedBy, checkoutLockedAt: sales.checkoutLockedAt, status: sales.status, totalCents: sales.totalCents, amountPaidCents: sales.amountPaidCents, createdAt: sales.createdAt, customerId: sales.customerId, sellerUserId: sales.sellerUserId, salesAgentId: sales.salesAgentId, cashierId: sales.cashierId }).from(sales).where(and(companyScope(sales.companyId, ctx.user.companyId), eq(sales.channel, "pos"), eq(sales.warehouseId, input.warehouseId), inArray(sales.status, ["draft", "partial"]), eq(sales.posStage, "queued"))).orderBy(asc(sales.queuedAt), asc(sales.id)).limit(100);
    const ids = rows.map(row => row.id);
    const customerIds = Array.from(new Set(rows.map(row => row.customerId).filter((id): id is number => typeof id === "number")));
    const sellerIds = Array.from(new Set(rows.map(row => row.sellerUserId)));
    const [items, customerRows, sellerRows] = await Promise.all([
      ids.length ? db.select({ saleId: saleItems.saleId, productName: saleItems.productName, quantity: saleItems.quantity, lineTotalCents: saleItems.lineTotalCents }).from(saleItems).where(inArray(saleItems.saleId, ids)) : Promise.resolve([]),
      customerIds.length ? db.select({ id: customers.id, name: customers.name }).from(customers).where(and(companyScope(customers.companyId, ctx.user.companyId), inArray(customers.id, customerIds))) : Promise.resolve([]),
      sellerIds.length ? db.select({ id: users.id, name: users.name }).from(users).where(and(companyScope(users.companyId, ctx.user.companyId), inArray(users.id, sellerIds))) : Promise.resolve([]),
    ]);
    return rows.map(row => ({ ...row, beingCollectedElsewhere: lockedByOther(row.checkoutLockedBy, row.checkoutLockedAt, ctx.user.id), balanceCents: Math.max(0, row.totalCents - row.amountPaidCents), customerName: customerRows.find(item => item.id === row.customerId)?.name ?? null, sellerName: sellerRows.find(item => item.id === row.sellerUserId)?.name ?? null, items: items.filter(item => item.saleId === row.id) }));
  }),
});
