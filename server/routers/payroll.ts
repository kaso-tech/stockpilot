import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { agentPayments, agents, remunerationProfiles, saleCommissions, users } from "../../drizzle/schema";
import { fixedRemunerationCents } from "../commerceRules";
import { getDb } from "../db";
import { adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { storagePut } from "../storage";

async function dbOrThrow() { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); return db; }
function currentPeriodLabel() { return new Date().toISOString().slice(0, 7); }
export const payrollPaymentInput = z.object({ beneficiaryType: z.enum(["user", "agent"]), beneficiaryId: z.number().int().positive(), amountCents: z.number().int().positive(), periodLabel: z.string().regex(/^\d{4}-\d{2}$/).optional(), note: z.string().trim().max(1000).nullable(), receiptUrl: z.string().max(1024).nullable().optional(), receiptName: z.string().trim().max(180).nullable().optional(), receiptMimeType: z.string().trim().max(80).nullable().optional() });

export const payrollRouter = router({
  overview: adminProcedure.input(z.object({ periodLabel: z.string().regex(/^\d{4}-\d{2}$/).optional() }).optional()).query(async ({ input }) => {
    const db = await dbOrThrow(); const periodLabel = input?.periodLabel ?? currentPeriodLabel();
    const [agentRows, userRows, profiles, commissions, payments] = await Promise.all([db.select().from(agents).orderBy(agents.name), db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(users.name), db.select().from(remunerationProfiles), db.select().from(saleCommissions).orderBy(desc(saleCommissions.createdAt)), db.select().from(agentPayments).orderBy(desc(agentPayments.paidAt))]);
    const beneficiaries = [...userRows.filter(user => user.role === "seller").map(user => ({ beneficiaryType: "user" as const, beneficiaryId: user.id })), ...agentRows.map(agent => ({ beneficiaryType: "agent" as const, beneficiaryId: agent.id }))];
    const balances = beneficiaries.map(beneficiary => { const profile = profiles.find(item => item.beneficiaryType === beneficiary.beneficiaryType && item.beneficiaryId === beneficiary.beneficiaryId); const commissionCents = commissions.filter(item => item.beneficiaryType === beneficiary.beneficiaryType && item.beneficiaryId === beneficiary.beneficiaryId && item.createdAt.toISOString().slice(0, 7) === periodLabel).reduce((sum, item) => sum + item.commissionCents, 0); const fixedCents = profile ? fixedRemunerationCents(profile.remunerationMode, profile.fixedMonthlyCents) : 0; const paidCents = payments.filter(item => item.beneficiaryType === beneficiary.beneficiaryType && item.beneficiaryId === beneficiary.beneficiaryId && item.periodLabel === periodLabel).reduce((sum, item) => sum + item.amountCents, 0); return { ...beneficiary, fixedCents, commissionCents, paidCents, dueCents: fixedCents + commissionCents - paidCents }; });
    return { periodLabel, agents: agentRows, users: userRows.filter(user => user.role === "seller"), profiles, commissions, payments, balances };
  }),
  uploadReceipt: adminProcedure.input(z.object({ dataUrl: z.string().min(30).max(7_000_000), filename: z.string().trim().min(1).max(180) })).mutation(async ({ ctx, input }) => { const match = input.dataUrl.match(/^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/); if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Le reçu doit être un PDF, PNG, JPEG ou WEBP." }); const mimeType = match[1]; const buffer = Buffer.from(match[2], "base64"); if (buffer.byteLength > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Le reçu ne doit pas dépasser 5 Mo." }); const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]; const { url } = await storagePut(`payroll/${ctx.user.id}/${randomUUID()}.${extension}`, buffer, mimeType); return { url, filename: input.filename, mimeType }; }),
  pay: adminProcedure.input(payrollPaymentInput).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); const result = await db.insert(agentPayments).values({ ...input, periodLabel: input.periodLabel ?? currentPeriodLabel(), createdByUserId: ctx.user.id }); return { id: Number(result[0].insertId) }; }),
});
