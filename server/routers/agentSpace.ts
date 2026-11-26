import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { agentPayments, agents, customers, remunerationProfiles, saleCommissions, sales } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { companyScope } from "../companyScope";
import { fixedRemunerationCents } from "../commerceRules";
import { getDb } from "../db";

async function dbOrThrow() { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); return db; }

/** Fiche d'agent liée au compte connecté (rôle Agent commercial). */
async function linkedAgent(db: Awaited<ReturnType<typeof dbOrThrow>>, user: { id: number; role: string; companyId: number | null }) {
  if (user.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "Cet espace est réservé aux agents commerciaux." });
  const agent = (await db.select().from(agents).where(and(eq(agents.userId, user.id), companyScope(agents.companyId, user.companyId))).limit(1))[0];
  if (!agent || !agent.active) throw new TRPCError({ code: "FORBIDDEN", message: "Votre fiche d’agent n’est plus active. Contactez votre administrateur." });
  return agent;
}

const periodInput = z.object({ periodLabel: z.string().regex(/^\d{4}-\d{2}$/).optional() }).optional();

/**
 * Espace de l'agent commercial : uniquement SES ventes attribuées, SES commissions et SES paiements.
 * Aucun prix d'achat ni marge n'est renvoyé.
 */
export const agentSpaceRouter = router({
  overview: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const agent = await linkedAgent(db, ctx.user);
    const periodLabel = input?.periodLabel ?? new Date().toISOString().slice(0, 7);
    const [profile, saleRows, commissionRows, paymentRows] = await Promise.all([
      db.select().from(remunerationProfiles).where(and(companyScope(remunerationProfiles.companyId, ctx.user.companyId), eq(remunerationProfiles.beneficiaryType, "agent"), eq(remunerationProfiles.beneficiaryId, agent.id))).limit(1),
      db.select({ id: sales.id, invoiceNumber: sales.invoiceNumber, channel: sales.channel, status: sales.status, totalCents: sales.totalCents, createdAt: sales.createdAt, customerId: sales.customerId }).from(sales).where(and(companyScope(sales.companyId, ctx.user.companyId), eq(sales.salesAgentId, agent.id))).orderBy(desc(sales.createdAt)),
      db.select({ saleId: saleCommissions.saleId, commissionCents: saleCommissions.commissionCents, createdAt: saleCommissions.createdAt }).from(saleCommissions).innerJoin(sales, eq(sales.id, saleCommissions.saleId)).where(and(companyScope(sales.companyId, ctx.user.companyId), eq(saleCommissions.beneficiaryType, "agent"), eq(saleCommissions.beneficiaryId, agent.id))),
      db.select({ amountCents: agentPayments.amountCents, paymentKind: agentPayments.paymentKind, periodLabel: agentPayments.periodLabel, paidAt: agentPayments.paidAt }).from(agentPayments).where(and(companyScope(agentPayments.companyId, ctx.user.companyId), eq(agentPayments.beneficiaryType, "agent"), eq(agentPayments.beneficiaryId, agent.id))).orderBy(desc(agentPayments.paidAt)),
    ]);
    const inPeriod = (date: Date) => date.toISOString().slice(0, 7) === periodLabel;
    const periodSales = saleRows.filter(sale => inPeriod(sale.createdAt) && sale.status !== "void");
    const commissionBySale = new Map<number, number>();
    for (const row of commissionRows) commissionBySale.set(row.saleId, (commissionBySale.get(row.saleId) ?? 0) + row.commissionCents);
    const commissionCents = commissionRows.filter(row => inPeriod(row.createdAt)).reduce((sum, row) => sum + row.commissionCents, 0);
    const remuneration = profile[0] ?? null;
    const fixedCents = remuneration ? fixedRemunerationCents(remuneration.remunerationMode, remuneration.fixedMonthlyCents) : 0;
    const periodPayments = paymentRows.filter(payment => payment.periodLabel === periodLabel && payment.paymentKind !== "food_allowance");
    const paidCents = periodPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const customerIds = Array.from(new Set(periodSales.slice(0, 100).map(sale => sale.customerId).filter((id): id is number => typeof id === "number")));
    const customerRows = customerIds.length ? await db.select({ id: customers.id, name: customers.name }).from(customers).where(and(companyScope(customers.companyId, ctx.user.companyId), inArray(customers.id, customerIds))) : [];
    const customerName = new Map(customerRows.map(row => [row.id, row.name]));
    const months = Array.from(new Set([periodLabel, new Date().toISOString().slice(0, 7), ...saleRows.map(sale => sale.createdAt.toISOString().slice(0, 7))])).sort().reverse().slice(0, 12);
    return {
      agent: { id: agent.id, name: agent.name, type: agent.type },
      periodLabel,
      months,
      remuneration: remuneration ? { mode: remuneration.remunerationMode, fixedMonthlyCents: remuneration.fixedMonthlyCents, commissionBasis: remuneration.commissionBasis, rateBasisPoints: remuneration.rateBasisPoints } : null,
      totals: {
        salesCount: periodSales.length,
        revenueCents: periodSales.filter(sale => sale.status === "paid" || sale.status === "partial").reduce((sum, sale) => sum + sale.totalCents, 0),
        fixedCents,
        commissionCents,
        paidCents,
        dueCents: Math.max(0, fixedCents + commissionCents - paidCents),
      },
      sales: periodSales.slice(0, 100).map(sale => ({ id: sale.id, invoiceNumber: sale.invoiceNumber, channel: sale.channel, status: sale.status, totalCents: sale.totalCents, createdAt: sale.createdAt, customerName: sale.customerId ? customerName.get(sale.customerId) ?? null : null, commissionCents: commissionBySale.get(sale.id) ?? 0 })),
      payments: periodPayments.map(payment => ({ amountCents: payment.amountCents, paymentKind: payment.paymentKind, paidAt: payment.paidAt })),
    };
  }),
});
