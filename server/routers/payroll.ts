import { desc } from "drizzle-orm";
import { z } from "zod";
import { agentPayments, agents, remunerationProfiles, saleCommissions, users } from "../../drizzle/schema";
import { fixedRemunerationCents } from "../commerceRules";
import { getDb } from "../db";
import { adminProcedure, router } from "../_core/trpc";

async function dbOrThrow() { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); return db; }
function currentPeriodLabel() { return new Date().toISOString().slice(0, 7); }

export const payrollRouter = router({
  overview: adminProcedure.input(z.object({ periodLabel: z.string().regex(/^\d{4}-\d{2}$/).optional() }).optional()).query(async ({ input }) => {
    const db = await dbOrThrow(); const periodLabel = input?.periodLabel ?? currentPeriodLabel();
    const [agentRows, userRows, profiles, commissions, payments] = await Promise.all([db.select().from(agents).orderBy(agents.name), db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(users.name), db.select().from(remunerationProfiles), db.select().from(saleCommissions).orderBy(desc(saleCommissions.createdAt)), db.select().from(agentPayments).orderBy(desc(agentPayments.paidAt))]);
    const beneficiaries = [...userRows.filter(user => user.role === "seller").map(user => ({ beneficiaryType: "user" as const, beneficiaryId: user.id })), ...agentRows.map(agent => ({ beneficiaryType: "agent" as const, beneficiaryId: agent.id }))];
    const balances = beneficiaries.map(beneficiary => { const profile = profiles.find(item => item.beneficiaryType === beneficiary.beneficiaryType && item.beneficiaryId === beneficiary.beneficiaryId); const commissionCents = commissions.filter(item => item.beneficiaryType === beneficiary.beneficiaryType && item.beneficiaryId === beneficiary.beneficiaryId && item.createdAt.toISOString().slice(0, 7) === periodLabel).reduce((sum, item) => sum + item.commissionCents, 0); const fixedCents = profile ? fixedRemunerationCents(profile.remunerationMode, profile.fixedMonthlyCents) : 0; const paidCents = payments.filter(item => item.beneficiaryType === beneficiary.beneficiaryType && item.beneficiaryId === beneficiary.beneficiaryId && item.periodLabel === periodLabel).reduce((sum, item) => sum + item.amountCents, 0); return { ...beneficiary, fixedCents, commissionCents, paidCents, dueCents: fixedCents + commissionCents - paidCents }; });
    return { periodLabel, agents: agentRows, users: userRows.filter(user => user.role === "seller"), profiles, commissions, payments, balances };
  }),
  pay: adminProcedure.input(z.object({ beneficiaryType: z.enum(["user", "agent"]), beneficiaryId: z.number().int().positive(), amountCents: z.number().int().positive(), periodLabel: z.string().regex(/^\d{4}-\d{2}$/).optional(), note: z.string().trim().max(1000).nullable() })).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); const result = await db.insert(agentPayments).values({ ...input, periodLabel: input.periodLabel ?? currentPeriodLabel(), createdByUserId: ctx.user.id }); return { id: Number(result[0].insertId) }; }),
});
