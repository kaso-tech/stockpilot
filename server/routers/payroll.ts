import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { agentPayments, agents, auditLogs, remunerationProfiles, saleCommissions, sales, users, warehouses as warehouseTable } from "../../drizzle/schema";
import { fixedRemunerationCents } from "../commerceRules";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { storagePut } from "../storage";
import { companyScope } from "../companyScope";
import { getDefaultWarehouse, getScopedWarehouse } from "../warehouseStock";
import { commissionBalance, commissionReportPeriod } from "../commissionReportRules";

async function dbOrThrow() { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); return db; }
function currentPeriodLabel() { return new Date().toISOString().slice(0, 7); }
export const payrollPaymentInput = z.object({ beneficiaryType: z.enum(["user", "agent"]), beneficiaryId: z.number().int().positive(), operationId: z.string().trim().min(16).max(80), amountCents: z.number().int().positive(), paymentKind: z.enum(["commission", "salary", "mixed"]).default("mixed"), periodLabel: z.string().regex(/^\d{4}-\d{2}$/).optional(), note: z.string().trim().max(1000).nullable(), receiptUrl: z.string().max(1024).nullable().optional(), receiptName: z.string().trim().max(180).nullable().optional(), receiptMimeType: z.string().trim().max(80).nullable().optional() });

/**
 * Soldes de paie de la période (page Agents et bloc « Paie à régler » de l'accueil) : uniquement les
 * agents et vendeurs existants ; pour un entrepôt, commissions et paiements de cet entrepôt.
 */
export async function loadPayrollOverview(db: Awaited<ReturnType<typeof dbOrThrow>>, companyId: number | null, periodLabel: string, warehouseId?: number) {
    const [agentRows, userRows, profiles, commissions, payments] = await Promise.all([db.select().from(agents).where(companyScope(agents.companyId, companyId)).orderBy(agents.name), db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(companyScope(users.companyId, companyId)).orderBy(users.name), db.select().from(remunerationProfiles).where(companyScope(remunerationProfiles.companyId, companyId)), db.select().from(saleCommissions).innerJoin(sales, eq(saleCommissions.saleId, sales.id)).where(warehouseId ? and(companyScope(sales.companyId, companyId), eq(sales.warehouseId, warehouseId)) : companyScope(sales.companyId, companyId)).orderBy(desc(saleCommissions.createdAt)), db.select().from(agentPayments).where(warehouseId ? and(companyScope(agentPayments.companyId, companyId), eq(agentPayments.warehouseId, warehouseId)) : companyScope(agentPayments.companyId, companyId)).orderBy(desc(agentPayments.paidAt))]);
    const scopedCommissions = commissions.map(row => row.saleCommissions);
    const beneficiaries = [...userRows.filter(user => user.role === "seller").map(user => ({ beneficiaryType: "user" as const, beneficiaryId: user.id })), ...agentRows.map(agent => ({ beneficiaryType: "agent" as const, beneficiaryId: agent.id }))];
    const balances = beneficiaries.map(beneficiary => { const profile = profiles.find(item => item.beneficiaryType === beneficiary.beneficiaryType && item.beneficiaryId === beneficiary.beneficiaryId); const commissionCents = scopedCommissions.filter(item => item.beneficiaryType === beneficiary.beneficiaryType && item.beneficiaryId === beneficiary.beneficiaryId && item.createdAt.toISOString().slice(0, 7) === periodLabel).reduce((sum, item) => sum + item.commissionCents, 0); const fixedCents = !warehouseId && profile ? fixedRemunerationCents(profile.remunerationMode, profile.fixedMonthlyCents) : 0; const paidCents = payments.filter(item => item.beneficiaryType === beneficiary.beneficiaryType && item.beneficiaryId === beneficiary.beneficiaryId && item.periodLabel === periodLabel).reduce((sum, item) => sum + item.amountCents, 0); return { ...beneficiary, fixedCents, commissionCents, paidCents, dueCents: fixedCents + commissionCents - paidCents }; });
    return { periodLabel, agents: agentRows, users: userRows.filter(user => user.role === "seller"), profiles, commissions: scopedCommissions, payments, balances };
}

export const payrollRouter = router({
  overview: permissionProcedure("payroll.manage").input(z.object({ periodLabel: z.string().regex(/^\d{4}-\d{2}$/).optional(), warehouseId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow(); const periodLabel = input?.periodLabel ?? currentPeriodLabel();
    if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
    return loadPayrollOverview(db, ctx.user.companyId, periodLabel, input?.warehouseId);
  }),
  commissionReport: permissionProcedure("payroll.manage").input(z.object({ periodLabel: z.string().regex(/^\d{4}-\d{2}$/).optional(), warehouseId: z.number().int().positive().optional(), beneficiaryKey: z.string().regex(/^(all|agent:\d+|user:\d+)$/).optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const periodLabel = input?.periodLabel ?? currentPeriodLabel();
    if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
    const [warehouseRows, agentRows, sellerRows, commissionRows, paymentRows] = await Promise.all([
      db.select().from(warehouseTable).where(companyScope(warehouseTable.companyId, ctx.user.companyId)),
      db.select({ id: agents.id, name: agents.name, active: agents.active }).from(agents).where(companyScope(agents.companyId, ctx.user.companyId)),
      db.select({ id: users.id, name: users.name, active: users.active }).from(users).where(and(eq(users.role, "seller"), companyScope(users.companyId, ctx.user.companyId))),
      db.select({ commission: saleCommissions, warehouseId: sales.warehouseId }).from(saleCommissions).innerJoin(sales, eq(saleCommissions.saleId, sales.id)).where(input?.warehouseId ? and(companyScope(sales.companyId, ctx.user.companyId), eq(sales.warehouseId, input.warehouseId)) : companyScope(sales.companyId, ctx.user.companyId)),
      db.select().from(agentPayments).where(input?.warehouseId ? and(companyScope(agentPayments.companyId, ctx.user.companyId), eq(agentPayments.warehouseId, input.warehouseId)) : companyScope(agentPayments.companyId, ctx.user.companyId)),
    ]);
    const beneficiaries = new Map<string, { name: string; active: boolean }>();
    agentRows.forEach(agent => beneficiaries.set(`agent:${agent.id}`, { name: agent.name, active: agent.active }));
    sellerRows.forEach(seller => beneficiaries.set(`user:${seller.id}`, { name: seller.name || "Vendeur", active: seller.active }));
    const rows = new Map<string, { beneficiaryType: "agent" | "user"; beneficiaryId: number; warehouseId: number; generatedCents: number; commissionPaidCents: number; salaryPaidCents: number; mixedPaidCents: number; saleCount: number; lastCommissionAt: Date | null }>();
    for (const row of commissionRows) {
      const commission = row.commission;
      if (commissionReportPeriod(commission.createdAt) !== periodLabel || row.warehouseId === null) continue;
      const key = `${commission.beneficiaryType}:${commission.beneficiaryId}:${row.warehouseId}`;
      const current = rows.get(key) ?? { beneficiaryType: commission.beneficiaryType, beneficiaryId: commission.beneficiaryId, warehouseId: row.warehouseId, generatedCents: 0, commissionPaidCents: 0, salaryPaidCents: 0, mixedPaidCents: 0, saleCount: 0, lastCommissionAt: null };
      current.generatedCents += commission.commissionCents;
      current.saleCount += 1;
      if (!current.lastCommissionAt || commission.createdAt > current.lastCommissionAt) current.lastCommissionAt = commission.createdAt;
      rows.set(key, current);
    }
    for (const payment of paymentRows) {
      // La prime d'alimentation n'entre pas dans le solde de paie (salaire et commissions).
      if (payment.periodLabel !== periodLabel || payment.warehouseId === null || payment.paymentKind === "food_allowance") continue;
      const key = `${payment.beneficiaryType}:${payment.beneficiaryId}:${payment.warehouseId}`;
      const current = rows.get(key) ?? { beneficiaryType: payment.beneficiaryType, beneficiaryId: payment.beneficiaryId, warehouseId: payment.warehouseId, generatedCents: 0, commissionPaidCents: 0, salaryPaidCents: 0, mixedPaidCents: 0, saleCount: 0, lastCommissionAt: null };
      if (payment.paymentKind === "commission") current.commissionPaidCents += payment.amountCents;
      else if (payment.paymentKind === "salary") current.salaryPaidCents += payment.amountCents;
      else current.mixedPaidCents += payment.amountCents;
      rows.set(key, current);
    }
    const filteredRows = Array.from(rows.values()).filter(row => !input?.beneficiaryKey || input.beneficiaryKey === "all" || input.beneficiaryKey === `${row.beneficiaryType}:${row.beneficiaryId}`).map(row => ({ ...row, beneficiaryName: beneficiaries.get(`${row.beneficiaryType}:${row.beneficiaryId}`)?.name ?? "Bénéficiaire archivé", beneficiaryActive: beneficiaries.get(`${row.beneficiaryType}:${row.beneficiaryId}`)?.active ?? false, warehouseName: warehouseRows.find(warehouse => warehouse.id === row.warehouseId)?.name ?? "Entrepôt archivé", dueCents: commissionBalance(row.generatedCents, row.commissionPaidCents) })).sort((left, right) => right.dueCents - left.dueCents || right.generatedCents - left.generatedCents || left.beneficiaryName.localeCompare(right.beneficiaryName));
    return { periodLabel, rows: filteredRows, summary: { generatedCents: filteredRows.reduce((sum, row) => sum + row.generatedCents, 0), commissionPaidCents: filteredRows.reduce((sum, row) => sum + row.commissionPaidCents, 0), dueCents: filteredRows.reduce((sum, row) => sum + row.dueCents, 0), mixedPaidCents: filteredRows.reduce((sum, row) => sum + row.mixedPaidCents, 0) } };
  }),
  uploadReceipt: permissionProcedure("payroll.manage").input(z.object({ dataUrl: z.string().min(30).max(7_000_000), filename: z.string().trim().min(1).max(180) })).mutation(async ({ ctx, input }) => { const match = input.dataUrl.match(/^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/); if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Le reçu doit être un PDF, PNG, JPEG ou WEBP." }); const mimeType = match[1]; const buffer = Buffer.from(match[2], "base64"); if (buffer.byteLength > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Le reçu ne doit pas dépasser 5 Mo." }); const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]; const { url } = await storagePut(`company/${ctx.user.companyId ?? "legacy"}/payroll/${randomUUID()}.${extension}`, buffer, mimeType); return { url, filename: input.filename, mimeType }; }),
  pay: permissionProcedure("payroll.manage").input(payrollPaymentInput.extend({ warehouseId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); const { warehouseId, ...payment } = input; const existing = (await db.select({ id: agentPayments.id }).from(agentPayments).where(and(companyScope(agentPayments.companyId, ctx.user.companyId), eq(agentPayments.operationId, payment.operationId))).limit(1))[0]; if (existing) return { id: existing.id, alreadyPaid: true }; const beneficiary = payment.beneficiaryType === "agent" ? (await db.select({ id: agents.id }).from(agents).where(and(eq(agents.id, payment.beneficiaryId), companyScope(agents.companyId, ctx.user.companyId), eq(agents.active, true))).limit(1))[0] : (await db.select({ id: users.id }).from(users).where(and(eq(users.id, payment.beneficiaryId), companyScope(users.companyId, ctx.user.companyId), eq(users.active, true), eq(users.role, "seller"))).limit(1))[0]; if (!beneficiary) throw new TRPCError({ code: "BAD_REQUEST", message: "Le bénéficiaire actif n’appartient pas à cette entreprise." }); const warehouse = warehouseId ? await getScopedWarehouse(db, ctx.user.companyId, warehouseId, { requireActive: true }) : await getDefaultWarehouse(db, ctx.user.companyId); try { return await db.transaction(async tx => { const result = await tx.insert(agentPayments).values({ ...payment, warehouseId: warehouse.id, companyId: ctx.user.companyId, periodLabel: payment.periodLabel ?? currentPeriodLabel(), createdByUserId: ctx.user.id }); const id = Number(result[0].insertId); await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Paiement agent", entityType: "Paiement agent", entityId: String(id), detail: `Paiement ${payment.paymentKind} enregistré pour le bénéficiaire sélectionné.` }); return { id, alreadyPaid: false }; }); } catch (error) { const duplicate = (await db.select({ id: agentPayments.id }).from(agentPayments).where(and(companyScope(agentPayments.companyId, ctx.user.companyId), eq(agentPayments.operationId, payment.operationId))).limit(1))[0]; if (duplicate) return { id: duplicate.id, alreadyPaid: true }; throw error; } }),
});
