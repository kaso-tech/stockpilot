import { moneyLabel } from "../moneyLabel";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { agentPayments, agents, auditLogs, expenses, paymentDueBeneficiaryGroupMembers, paymentDueBeneficiaryGroups, paymentDueOccurrences, paymentDueReminderEvents, paymentDueSchedules, paymentDueSettlements, paymentDueTemplates, sellerWarehouseAssignments, users, warehouses } from "../../drizzle/schema";
import { companyScope } from "../companyScope";
import { getDb } from "../db";
import { defaultReminderDays, initialMonthlyDueAt, initialRecurringDueAt, materializationHorizonDays, nextDueAt, normalizeReminderDays, resolvePaymentDueStatus } from "../paymentDueRules";
import { buildPaymentDueForecast, paymentDueForecastMonths } from "../paymentDueForecast";
import { isPaymentDueReceiptKeyInScope } from "../paymentReceiptRules";
import { getDefaultWarehouse, getScopedWarehouse } from "../warehouseStock";
import { storagePut } from "../storage";
import { permissionProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const expenseCategories = ["rent", "energy", "connection", "salary", "marketing", "supplies", "taxes", "other", "food"] as const;
const scheduleTypes = ["expense", "salary", "food_allowance"] as const;
const recurrences = ["once", "monthly", "daily", "weekly"] as const;
/** Salaire et prime d'alimentation sont versés à un agent ou un vendeur. */
const paidToBeneficiary = (type: string) => type === "salary" || type === "food_allowance";
/** Règles de date communes aux échéances et aux modèles. */
function validateRecurrence(input: { recurrence: (typeof recurrences)[number]; dueDay?: number | null }, validation: z.RefinementCtx) {
  if (input.recurrence === "monthly" && !input.dueDay) validation.addIssue({ code: z.ZodIssueCode.custom, message: "Le jour du mois est requis pour une échéance mensuelle." });
  if (input.recurrence === "weekly" && (!input.dueDay || input.dueDay > 7)) validation.addIssue({ code: z.ZodIssueCode.custom, message: "Le jour de la semaine est requis pour une échéance hebdomadaire." });
  if (input.recurrence === "daily" && input.dueDay != null && input.dueDay !== 6 && input.dueDay !== 7) validation.addIssue({ code: z.ZodIssueCode.custom, message: "Pour une échéance journalière, indiquez 6 (sauf dimanche) ou 7 (tous les jours)." });
}
const occurrenceStatuses = ["upcoming", "due", "overdue", "partially_paid", "paid", "cancelled"] as const;
const settlementReceiptInput = z.object({ receiptKey: z.string().trim().max(720).nullable().optional(), receiptName: z.string().trim().max(180).nullable().optional(), receiptMimeType: z.string().trim().max(80).nullable().optional() }).superRefine((input, validation) => {
  const present = [input.receiptKey, input.receiptName, input.receiptMimeType].filter(Boolean).length;
  if (present > 0 && present < 3) validation.addIssue({ code: z.ZodIssueCode.custom, message: "Le justificatif de règlement est incomplet." });
});
export const paymentDueSettlementInput = z.object({ occurrenceId: z.number().int().positive(), operationId: z.string().trim().min(16).max(80), amountCents: z.number().int().positive(), settledAt: z.coerce.date(), note: z.string().trim().max(1000).nullable().optional() }).merge(settlementReceiptInput);

const scheduleInput = z.object({
  id: z.number().int().positive().optional(),
  scheduleType: z.enum(scheduleTypes),
  title: z.string().trim().min(2).max(180),
  expenseCategory: z.enum(expenseCategories).nullable().optional(),
  beneficiaryType: z.enum(["user", "agent"]).nullable().optional(),
  beneficiaryId: z.number().int().positive().nullable().optional(),
  beneficiaryGroupId: z.number().int().positive().nullable().optional(),
  templateId: z.number().int().positive().nullable().optional(),
  amountCents: z.number().int().positive().max(1_000_000_000),
  warehouseId: z.number().int().positive().optional(),
  recurrence: z.enum(recurrences),
  startsAt: z.coerce.date().nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  reminderDays: z.array(z.number().int().min(0).max(90)).max(8).optional(),
  responsibleUserId: z.number().int().positive().nullable().optional(),
}).superRefine((input, validation) => {
  if (input.scheduleType === "expense" && !input.expenseCategory) validation.addIssue({ code: z.ZodIssueCode.custom, message: "Une catégorie est requise pour une dépense." });
  if (paidToBeneficiary(input.scheduleType) && ((!input.beneficiaryType || !input.beneficiaryId) && !input.beneficiaryGroupId)) validation.addIssue({ code: z.ZodIssueCode.custom, message: input.scheduleType === "food_allowance" ? "Un agent ou un groupe est requis pour une prime d’alimentation." : "Un bénéficiaire ou groupe est requis pour un salaire." });
  if (input.beneficiaryGroupId && (input.beneficiaryType || input.beneficiaryId)) validation.addIssue({ code: z.ZodIssueCode.custom, message: "Choisissez un bénéficiaire individuel ou un groupe, pas les deux." });
  validateRecurrence(input, validation);
  if (input.recurrence === "once" && !input.startsAt) validation.addIssue({ code: z.ZodIssueCode.custom, message: "La date est requise pour une échéance ponctuelle." });
  if (input.endsAt && input.startsAt && input.endsAt < input.startsAt) validation.addIssue({ code: z.ZodIssueCode.custom, message: "La fin ne peut pas précéder la première échéance." });
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

function periodLabelFor(date: Date) { return date.toISOString().slice(0, 7); }

export async function materializePaymentDueOccurrences(db: any, schedule: typeof paymentDueSchedules.$inferSelect, now = new Date()) {
  if (schedule.status !== "active") return 0;
  const horizon = new Date(now); horizon.setUTCDate(horizon.getUTCDate() + materializationHorizonDays(schedule.recurrence));
  let dueAt = new Date(schedule.startsAt);
  let created = 0;
  while (dueAt <= horizon && (!schedule.endsAt || dueAt <= schedule.endsAt)) {
    const status = resolvePaymentDueStatus({ dueAt, amountCents: schedule.amountCents, paidCents: 0 }, now);
    await db.insert(paymentDueOccurrences).values({ scheduleId: schedule.id, companyId: schedule.companyId, warehouseId: schedule.warehouseId, dueAt, periodLabel: periodLabelFor(dueAt), amountCents: schedule.amountCents, status }).onDuplicateKeyUpdate({ set: { scheduleId: schedule.id } }); // Déjà générée : on n’y touche pas (mise à jour sans effet, une mise à jour vide est refusée).
    created += 1;
    if (schedule.recurrence === "once") break;
    dueAt = nextDueAt(schedule.recurrence, dueAt, schedule.dueDay);
  }
  return created;
}

async function assertScheduleReferences(db: any, companyId: number | null, input: z.infer<typeof scheduleInput>) {
  const warehouse = input.warehouseId ? await getScopedWarehouse(db, companyId, input.warehouseId, { requireActive: true }) : await getDefaultWarehouse(db, companyId);
  if (input.responsibleUserId) {
    const responsible = (await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.responsibleUserId), companyScope(users.companyId, companyId), eq(users.active, true))).limit(1))[0];
    if (!responsible) throw new TRPCError({ code: "BAD_REQUEST", message: "Le responsable sélectionné n’appartient pas à cette entreprise." });
  }
  if (paidToBeneficiary(input.scheduleType) && input.beneficiaryId && input.beneficiaryType) {
    const beneficiary = input.beneficiaryType === "agent"
      ? (await db.select({ id: agents.id }).from(agents).where(and(eq(agents.id, input.beneficiaryId), companyScope(agents.companyId, companyId))).limit(1))[0]
      : (await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.beneficiaryId), companyScope(users.companyId, companyId))).limit(1))[0];
    if (!beneficiary) throw new TRPCError({ code: "BAD_REQUEST", message: "Le bénéficiaire n’appartient pas à cette entreprise." });
  }
  if (paidToBeneficiary(input.scheduleType) && input.beneficiaryGroupId) {
    const group = (await db.select({ id: paymentDueBeneficiaryGroups.id, warehouseId: paymentDueBeneficiaryGroups.warehouseId }).from(paymentDueBeneficiaryGroups).where(and(eq(paymentDueBeneficiaryGroups.id, input.beneficiaryGroupId), companyScope(paymentDueBeneficiaryGroups.companyId, companyId), eq(paymentDueBeneficiaryGroups.active, true))).limit(1))[0];
    if (!group) throw new TRPCError({ code: "BAD_REQUEST", message: "Le groupe sélectionné n’appartient pas à cette entreprise ou est inactif." });
    if (group.warehouseId && group.warehouseId !== warehouse.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Le groupe doit appartenir à l’entrepôt sélectionné." });
  }
  if (input.templateId) {
    const template = (await db.select({ id: paymentDueTemplates.id, warehouseId: paymentDueTemplates.warehouseId, scheduleType: paymentDueTemplates.scheduleType }).from(paymentDueTemplates).where(and(eq(paymentDueTemplates.id, input.templateId), companyScope(paymentDueTemplates.companyId, companyId), eq(paymentDueTemplates.active, true))).limit(1))[0];
    if (!template || template.scheduleType !== input.scheduleType) throw new TRPCError({ code: "BAD_REQUEST", message: "Le modèle sélectionné n’est pas disponible pour cette échéance." });
    if (template.warehouseId && template.warehouseId !== warehouse.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Le modèle doit appartenir à l’entrepôt sélectionné." });
  }
  return warehouse;
}

function scheduleValues(input: z.infer<typeof scheduleInput>, companyId: number, warehouseId: number) {
  const dueDay = input.recurrence === "monthly" || input.recurrence === "weekly" ? input.dueDay! : input.recurrence === "daily" ? input.dueDay ?? 6 : input.startsAt!.getUTCDate();
  const startsAt = input.recurrence === "monthly" ? initialMonthlyDueAt(dueDay) : input.recurrence === "once" ? input.startsAt! : initialRecurringDueAt(input.recurrence, dueDay, input.startsAt && input.startsAt > new Date() ? input.startsAt : new Date());
  const beneficiary = paidToBeneficiary(input.scheduleType);
  return { companyId, warehouseId, scheduleType: input.scheduleType, title: input.title, expenseCategory: input.scheduleType === "expense" ? input.expenseCategory ?? "other" : null, beneficiaryType: beneficiary ? input.beneficiaryType ?? null : null, beneficiaryId: beneficiary ? input.beneficiaryId ?? null : null, beneficiaryGroupId: beneficiary ? input.beneficiaryGroupId ?? null : null, templateId: input.templateId ?? null, amountCents: input.amountCents, recurrence: input.recurrence, dueDay, startsAt, endsAt: input.endsAt ?? null, reminderDaysJson: JSON.stringify(normalizeReminderDays(input.reminderDays ?? defaultReminderDays(input.recurrence))), responsibleUserId: input.responsibleUserId ?? null };
}

/** Règle une échéance dans la transaction fournie (règlement unitaire ou primes du jour). */
async function settleOccurrenceInTx(tx: any, ctx: { user: { id: number; companyId: number | null } }, input: z.infer<typeof paymentDueSettlementInput>) {
  const row = (await tx.select({ occurrence: paymentDueOccurrences, schedule: paymentDueSchedules }).from(paymentDueOccurrences).innerJoin(paymentDueSchedules, eq(paymentDueOccurrences.scheduleId, paymentDueSchedules.id)).where(and(eq(paymentDueOccurrences.id, input.occurrenceId), companyScope(paymentDueOccurrences.companyId, ctx.user.companyId))).limit(1))[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Échéance introuvable." });
  const existing = (await tx.select().from(paymentDueSettlements).where(and(companyScope(paymentDueSettlements.companyId, ctx.user.companyId), eq(paymentDueSettlements.operationId, input.operationId))).limit(1))[0];
  if (existing) {
    if (existing.occurrenceId !== row.occurrence.id) throw new TRPCError({ code: "CONFLICT", message: "Cette demande est déjà associée à une autre échéance." });
    return { success: true, expenseId: existing.expenseId, agentPaymentId: existing.agentPaymentId, status: row.occurrence.status, paidCents: row.occurrence.paidCents, alreadySettled: true };
  }
  if (["paid", "cancelled"].includes(row.occurrence.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cette échéance ne peut plus être réglée." });
  const remainingCents = row.occurrence.amountCents - row.occurrence.paidCents;
  if (input.amountCents > remainingCents) throw new TRPCError({ code: "BAD_REQUEST", message: "Le règlement dépasse le solde de l’échéance." });
  const receiptUrl = input.receiptKey ? `/manus-storage/${input.receiptKey}` : null;
  if (input.receiptKey && !isPaymentDueReceiptKeyInScope(input.receiptKey, ctx.user.companyId!, row.occurrence.id)) throw new TRPCError({ code: "BAD_REQUEST", message: "Le justificatif de règlement n’est pas autorisé." });
  const warehouse = row.occurrence.warehouseId ? await getScopedWarehouse(tx, ctx.user.companyId, row.occurrence.warehouseId, { requireActive: false }) : await getDefaultWarehouse(tx, ctx.user.companyId);
  let expenseId: number | null = null;
  let agentPaymentId: number | null = null;
  if (row.schedule.scheduleType === "expense") {
    const result = await tx.insert(expenses).values({ companyId: ctx.user.companyId, warehouseId: warehouse.id, category: row.schedule.expenseCategory ?? "other", description: row.schedule.title, amountCents: input.amountCents, spentAt: input.settledAt, createdByUserId: ctx.user.id });
    expenseId = Number(result[0].insertId);
  } else {
    if (!row.schedule.beneficiaryType || !row.schedule.beneficiaryId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Le bénéficiaire de salaire est incomplet." });
    const result = await tx.insert(agentPayments).values({ companyId: ctx.user.companyId, warehouseId: warehouse.id, beneficiaryType: row.schedule.beneficiaryType, beneficiaryId: row.schedule.beneficiaryId, paymentKind: row.schedule.scheduleType === "food_allowance" ? "food_allowance" : "salary", amountCents: input.amountCents, paidAt: input.settledAt, periodLabel: row.occurrence.periodLabel, note: input.note ?? null, createdByUserId: ctx.user.id });
    agentPaymentId = Number(result[0].insertId);
  }
  const paidCents = row.occurrence.paidCents + input.amountCents;
  const status = resolvePaymentDueStatus({ dueAt: row.occurrence.dueAt, amountCents: row.occurrence.amountCents, paidCents });
  const occurrenceUpdate = await tx.update(paymentDueOccurrences).set({ paidCents, status, resolvedAt: status === "paid" ? input.settledAt : null }).where(and(eq(paymentDueOccurrences.id, row.occurrence.id), eq(paymentDueOccurrences.paidCents, row.occurrence.paidCents), eq(paymentDueOccurrences.status, row.occurrence.status)));
  if (Number((occurrenceUpdate as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: "Cette échéance a été modifiée. Actualisez avant de recommencer." });
  await tx.insert(paymentDueSettlements).values({ occurrenceId: row.occurrence.id, companyId: ctx.user.companyId!, operationId: input.operationId, amountCents: input.amountCents, expenseId, agentPaymentId, receiptUrl, receiptName: input.receiptName ?? null, receiptMimeType: input.receiptMimeType ?? null, settledByUserId: ctx.user.id, settledAt: input.settledAt });
  await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Échéance réglée", entityType: "Échéance", entityId: String(row.occurrence.id), detail: `Règlement de ${moneyLabel(input.amountCents)} enregistré sans double comptage.` });
  return { success: true, expenseId, agentPaymentId, status, paidCents };
}

export const paymentDuesRouter = router({
  forecast: permissionProcedure("payroll.manage").input(z.object({ warehouseId: z.number().int().positive().optional(), fromYearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(), months: z.number().int().min(1).max(12).default(6) }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow(); const fromYearMonth = input?.fromYearMonth ?? new Date().toISOString().slice(0, 7); const months = input?.months ?? 6;
    if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
    const periodKeys = paymentDueForecastMonths(fromYearMonth, months); const start = new Date(`${periodKeys[0]}-01T00:00:00.000Z`); const [lastYear, lastMonth] = periodKeys.at(-1)!.split("-").map(Number); const end = new Date(Date.UTC(lastYear, lastMonth, 1));
    const rows = await db.select({ dueAt: paymentDueOccurrences.dueAt, amountCents: paymentDueOccurrences.amountCents, paidCents: paymentDueOccurrences.paidCents, status: paymentDueOccurrences.status, scheduleType: paymentDueSchedules.scheduleType }).from(paymentDueOccurrences).innerJoin(paymentDueSchedules, eq(paymentDueOccurrences.scheduleId, paymentDueSchedules.id)).where(and(companyScope(paymentDueOccurrences.companyId, ctx.user.companyId), gte(paymentDueOccurrences.dueAt, start), lt(paymentDueOccurrences.dueAt, end), ...(input?.warehouseId ? [eq(paymentDueOccurrences.warehouseId, input.warehouseId)] : [])));
    const monthsData = buildPaymentDueForecast(rows, fromYearMonth, months); return { fromYearMonth, months: monthsData, totalCommittedCents: monthsData.reduce((total, month) => total + month.expenseCommittedCents + month.salaryCommittedCents, 0), totalOutstandingCents: monthsData.reduce((total, month) => total + month.outstandingCents, 0) };
  }),
  list: permissionProcedure("payroll.manage").input(z.object({ warehouseId: z.number().int().positive().optional(), status: z.enum(occurrenceStatuses).optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
    const conditions = [companyScope(paymentDueOccurrences.companyId, ctx.user.companyId)];
    if (input?.warehouseId) conditions.push(eq(paymentDueOccurrences.warehouseId, input.warehouseId));
    if (input?.status) conditions.push(eq(paymentDueOccurrences.status, input.status));
    const rows = await db.select({ occurrence: paymentDueOccurrences, schedule: paymentDueSchedules, warehouseName: warehouses.name }).from(paymentDueOccurrences).innerJoin(paymentDueSchedules, eq(paymentDueOccurrences.scheduleId, paymentDueSchedules.id)).leftJoin(warehouses, eq(paymentDueOccurrences.warehouseId, warehouses.id)).where(and(...conditions)).orderBy(paymentDueOccurrences.dueAt).limit(300);
    const now = new Date();
    // Nom du bénéficiaire (salaire, prime d'alimentation) pour distinguer les échéances d'un même groupe.
    const agentIds = Array.from(new Set(rows.filter(row => row.schedule.beneficiaryType === "agent" && row.schedule.beneficiaryId).map(row => row.schedule.beneficiaryId!)));
    const userIds = Array.from(new Set(rows.filter(row => row.schedule.beneficiaryType === "user" && row.schedule.beneficiaryId).map(row => row.schedule.beneficiaryId!)));
    const [agentNames, userNames] = await Promise.all([
      agentIds.length ? db.select({ id: agents.id, name: agents.name }).from(agents).where(and(companyScope(agents.companyId, ctx.user.companyId), inArray(agents.id, agentIds))) : Promise.resolve([]),
      userIds.length ? db.select({ id: users.id, name: users.name }).from(users).where(and(companyScope(users.companyId, ctx.user.companyId), inArray(users.id, userIds))) : Promise.resolve([]),
    ]);
    const names = new Map<string, string>([...agentNames.map(item => [`agent:${item.id}`, item.name] as [string, string]), ...userNames.map(item => [`user:${item.id}`, item.name ?? "Vendeur"] as [string, string])]);
    return rows.map(row => ({ ...row.occurrence, title: row.schedule.title, beneficiaryName: row.schedule.beneficiaryId ? names.get(`${row.schedule.beneficiaryType}:${row.schedule.beneficiaryId}`) ?? null : null, scheduleType: row.schedule.scheduleType, recurrence: row.schedule.recurrence, dueDay: row.schedule.dueDay, expenseCategory: row.schedule.expenseCategory, beneficiaryType: row.schedule.beneficiaryType, beneficiaryId: row.schedule.beneficiaryId, beneficiaryGroupId: row.schedule.beneficiaryGroupId, templateId: row.schedule.templateId, responsibleUserId: row.schedule.responsibleUserId, warehouseName: row.warehouseName, computedStatus: resolvePaymentDueStatus({ dueAt: row.occurrence.dueAt, amountCents: row.occurrence.amountCents, paidCents: row.occurrence.paidCents, cancelled: row.occurrence.status === "cancelled" }, now) }));
  }),
  schedules: router({
    list: permissionProcedure("payroll.manage").input(z.object({ warehouseId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
      return db.select({ schedule: paymentDueSchedules, warehouseName: warehouses.name, responsibleName: users.name }).from(paymentDueSchedules).leftJoin(warehouses, eq(paymentDueSchedules.warehouseId, warehouses.id)).leftJoin(users, eq(paymentDueSchedules.responsibleUserId, users.id)).where(input?.warehouseId ? and(companyScope(paymentDueSchedules.companyId, ctx.user.companyId), eq(paymentDueSchedules.warehouseId, input.warehouseId)) : companyScope(paymentDueSchedules.companyId, ctx.user.companyId)).orderBy(desc(paymentDueSchedules.updatedAt));
    }),
    save: permissionProcedure("payroll.manage").input(scheduleInput).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const warehouse = await assertScheduleReferences(db, ctx.user.companyId, input);
      const values = scheduleValues(input, ctx.user.companyId!, warehouse.id);
      if (input.id) {
        const existing = (await db.select().from(paymentDueSchedules).where(and(eq(paymentDueSchedules.id, input.id), companyScope(paymentDueSchedules.companyId, ctx.user.companyId))).limit(1))[0];
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Échéancier introuvable." });
        await db.update(paymentDueSchedules).set(values).where(eq(paymentDueSchedules.id, existing.id));
        const schedule = { ...existing, ...values } as typeof paymentDueSchedules.$inferSelect;
        await materializePaymentDueOccurrences(db, schedule);
        await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Échéancier modifié", entityType: "Échéance", entityId: String(existing.id), detail: `Échéancier « ${input.title} » mis à jour.` });
        return { id: existing.id, created: 1 };
      }
      if (input.beneficiaryGroupId) {
        const members = await db.select({ beneficiaryType: paymentDueBeneficiaryGroupMembers.beneficiaryType, beneficiaryId: paymentDueBeneficiaryGroupMembers.beneficiaryId }).from(paymentDueBeneficiaryGroupMembers).where(and(eq(paymentDueBeneficiaryGroupMembers.groupId, input.beneficiaryGroupId), companyScope(paymentDueBeneficiaryGroupMembers.companyId, ctx.user.companyId)));
        if (!members.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Ce groupe ne contient aucun bénéficiaire." });
        const scheduleIds = await Promise.all(members.map(async member => { const result = await db.insert(paymentDueSchedules).values({ ...values, beneficiaryType: member.beneficiaryType, beneficiaryId: member.beneficiaryId, createdByUserId: ctx.user.id }); const scheduleId = Number(result[0].insertId); const schedule = (await db.select().from(paymentDueSchedules).where(eq(paymentDueSchedules.id, scheduleId)).limit(1))[0]!; await materializePaymentDueOccurrences(db, schedule); return scheduleId; }));
        await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Échéancier de groupe créé", entityType: "Groupe échéance", entityId: String(input.beneficiaryGroupId), detail: `${scheduleIds.length} échéancier(s) « ${input.title} » créés pour le groupe.` });
        return { id: scheduleIds[0], created: scheduleIds.length };
      }
      const result = await db.insert(paymentDueSchedules).values({ ...values, createdByUserId: ctx.user.id });
      const id = Number(result[0].insertId);
      const schedule = (await db.select().from(paymentDueSchedules).where(eq(paymentDueSchedules.id, id)).limit(1))[0]!;
      await materializePaymentDueOccurrences(db, schedule);
      await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Échéancier créé", entityType: "Échéance", entityId: String(id), detail: `Échéancier « ${input.title} » créé.` });
      return { id, created: 1 };
    }),
    setStatus: permissionProcedure("payroll.manage").input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "paused", "archived"]) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const current = (await db.select({ id: paymentDueSchedules.id }).from(paymentDueSchedules).where(and(eq(paymentDueSchedules.id, input.id), companyScope(paymentDueSchedules.companyId, ctx.user.companyId))).limit(1))[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Échéancier introuvable." });
      await db.update(paymentDueSchedules).set({ status: input.status }).where(eq(paymentDueSchedules.id, current.id));
      await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Échéancier modifié", entityType: "Échéance", entityId: String(current.id), detail: `Statut défini sur ${input.status}.` });
      return { success: true };
    }),
  }),
  templates: router({
    list: permissionProcedure("payroll.manage").input(z.object({ scheduleType: z.enum(scheduleTypes).optional(), warehouseId: z.number().int().positive().optional(), includeInactive: z.boolean().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
      const conditions = [companyScope(paymentDueTemplates.companyId, ctx.user.companyId), ...(input?.includeInactive ? [] : [eq(paymentDueTemplates.active, true)])];
      if (input?.scheduleType) conditions.push(eq(paymentDueTemplates.scheduleType, input.scheduleType));
      if (input?.warehouseId) conditions.push(eq(paymentDueTemplates.warehouseId, input.warehouseId));
      return db.select().from(paymentDueTemplates).where(and(...conditions)).orderBy(paymentDueTemplates.name);
    }),
    save: permissionProcedure("payroll.manage").input(z.object({ name: z.string().trim().min(2).max(120), scheduleType: z.enum(scheduleTypes), expenseCategory: z.enum(expenseCategories).nullable().optional(), amountCents: z.number().int().positive(), recurrence: z.enum(recurrences), dueDay: z.number().int().min(1).max(31).nullable().optional(), reminderDays: z.array(z.number().int().min(0).max(90)).max(8).optional(), warehouseId: z.number().int().positive().optional(), responsibleUserId: z.number().int().positive().nullable().optional() }).superRefine((input, validation) => { if (input.scheduleType === "expense" && !input.expenseCategory) validation.addIssue({ code: z.ZodIssueCode.custom, message: "Une catégorie est requise pour un modèle de dépense." }); validateRecurrence(input, validation); })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow(); const warehouse = input.warehouseId ? await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true }) : await getDefaultWarehouse(db, ctx.user.companyId);
      const result = await db.insert(paymentDueTemplates).values({ companyId: ctx.user.companyId!, warehouseId: warehouse.id, name: input.name, scheduleType: input.scheduleType, expenseCategory: input.scheduleType === "expense" ? input.expenseCategory ?? "other" : null, amountCents: input.amountCents, recurrence: input.recurrence, dueDay: input.recurrence === "once" ? null : input.recurrence === "daily" ? input.dueDay ?? 6 : input.dueDay, reminderDaysJson: JSON.stringify(normalizeReminderDays(input.reminderDays ?? defaultReminderDays(input.recurrence))), responsibleUserId: input.responsibleUserId ?? null, createdByUserId: ctx.user.id });
      const id = Number(result[0].insertId); await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Modèle d’échéance créé", entityType: "Modèle échéance", entityId: String(id), detail: `Modèle « ${input.name} » créé.` }); return { id };
    }),
    update: permissionProcedure("payroll.manage").input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(120), scheduleType: z.enum(scheduleTypes), expenseCategory: z.enum(expenseCategories).nullable().optional(), amountCents: z.number().int().positive(), recurrence: z.enum(recurrences), dueDay: z.number().int().min(1).max(31).nullable().optional(), reminderDays: z.array(z.number().int().min(0).max(90)).max(8).optional(), warehouseId: z.number().int().positive().optional(), responsibleUserId: z.number().int().positive().nullable().optional() }).superRefine((input, validation) => { if (input.scheduleType === "expense" && !input.expenseCategory) validation.addIssue({ code: z.ZodIssueCode.custom, message: "Une catégorie est requise pour un modèle de dépense." }); validateRecurrence(input, validation); })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow(); const existing = (await db.select({ id: paymentDueTemplates.id }).from(paymentDueTemplates).where(and(eq(paymentDueTemplates.id, input.id), companyScope(paymentDueTemplates.companyId, ctx.user.companyId))).limit(1))[0]; if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Modèle introuvable." });
      const warehouse = input.warehouseId ? await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true }) : await getDefaultWarehouse(db, ctx.user.companyId);
      await db.update(paymentDueTemplates).set({ warehouseId: warehouse.id, name: input.name, scheduleType: input.scheduleType, expenseCategory: input.scheduleType === "expense" ? input.expenseCategory ?? "other" : null, amountCents: input.amountCents, recurrence: input.recurrence, dueDay: input.recurrence === "once" ? null : input.recurrence === "daily" ? input.dueDay ?? 6 : input.dueDay, reminderDaysJson: JSON.stringify(normalizeReminderDays(input.reminderDays ?? defaultReminderDays(input.recurrence))), responsibleUserId: input.responsibleUserId ?? null }).where(eq(paymentDueTemplates.id, existing.id));
      await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Modèle d’échéance modifié", entityType: "Modèle échéance", entityId: String(existing.id), detail: `Modèle « ${input.name} » mis à jour.` }); return { success: true };
    }),
    setActive: permissionProcedure("payroll.manage").input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow(); const existing = (await db.select({ id: paymentDueTemplates.id, name: paymentDueTemplates.name }).from(paymentDueTemplates).where(and(eq(paymentDueTemplates.id, input.id), companyScope(paymentDueTemplates.companyId, ctx.user.companyId))).limit(1))[0]; if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Modèle introuvable." });
      await db.update(paymentDueTemplates).set({ active: input.active }).where(eq(paymentDueTemplates.id, existing.id)); await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: input.active ? "Modèle d’échéance réactivé" : "Modèle d’échéance archivé", entityType: "Modèle échéance", entityId: String(existing.id), detail: `Modèle « ${existing.name} » ${input.active ? "réactivé" : "archivé"}.` }); return { success: true };
    }),
  }),
  groups: router({
    list: permissionProcedure("payroll.manage").input(z.object({ warehouseId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await dbOrThrow(); if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
      const rows = await db.select({ group: paymentDueBeneficiaryGroups, member: paymentDueBeneficiaryGroupMembers }).from(paymentDueBeneficiaryGroups).leftJoin(paymentDueBeneficiaryGroupMembers, eq(paymentDueBeneficiaryGroupMembers.groupId, paymentDueBeneficiaryGroups.id)).where(input?.warehouseId ? and(companyScope(paymentDueBeneficiaryGroups.companyId, ctx.user.companyId), eq(paymentDueBeneficiaryGroups.warehouseId, input.warehouseId)) : companyScope(paymentDueBeneficiaryGroups.companyId, ctx.user.companyId)).orderBy(paymentDueBeneficiaryGroups.name);
      const grouped = new Map<number, { id: number; name: string; warehouseId: number | null; active: boolean; members: Array<{ beneficiaryType: "user" | "agent"; beneficiaryId: number }> }>();
      for (const row of rows) { const entry = grouped.get(row.group.id) ?? { id: row.group.id, name: row.group.name, warehouseId: row.group.warehouseId, active: row.group.active, members: [] }; if (row.member) entry.members.push({ beneficiaryType: row.member.beneficiaryType, beneficiaryId: row.member.beneficiaryId }); grouped.set(row.group.id, entry); }
      return Array.from(grouped.values());
    }),
    save: permissionProcedure("payroll.manage").input(z.object({ name: z.string().trim().min(2).max(120), warehouseId: z.number().int().positive().optional(), members: z.array(z.object({ beneficiaryType: z.enum(["user", "agent"]), beneficiaryId: z.number().int().positive() })).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow(); const warehouse = input.warehouseId ? await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true }) : await getDefaultWarehouse(db, ctx.user.companyId);
      const uniqueMembers = input.members.filter((member, index, values) => values.findIndex(value => value.beneficiaryType === member.beneficiaryType && value.beneficiaryId === member.beneficiaryId) === index);
      for (const member of uniqueMembers) { const source = member.beneficiaryType === "agent" ? (await db.select({ id: agents.id }).from(agents).where(and(eq(agents.id, member.beneficiaryId), companyScope(agents.companyId, ctx.user.companyId), eq(agents.active, true))).limit(1))[0] : (await db.select({ id: users.id }).from(users).where(and(eq(users.id, member.beneficiaryId), companyScope(users.companyId, ctx.user.companyId), eq(users.active, true))).limit(1))[0]; if (!source) throw new TRPCError({ code: "BAD_REQUEST", message: "Un membre ne fait pas partie des bénéficiaires actifs de cette entreprise." }); }
      return db.transaction(async tx => { const result = await tx.insert(paymentDueBeneficiaryGroups).values({ companyId: ctx.user.companyId!, warehouseId: warehouse.id, name: input.name, createdByUserId: ctx.user.id }); const id = Number(result[0].insertId); await tx.insert(paymentDueBeneficiaryGroupMembers).values(uniqueMembers.map(member => ({ companyId: ctx.user.companyId!, groupId: id, ...member }))); await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Groupe d’échéance créé", entityType: "Groupe échéance", entityId: String(id), detail: `Groupe « ${input.name} » créé avec ${uniqueMembers.length} membre(s).` }); return { id }; });
    }),
    update: permissionProcedure("payroll.manage").input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(120), warehouseId: z.number().int().positive().optional(), members: z.array(z.object({ beneficiaryType: z.enum(["user", "agent"]), beneficiaryId: z.number().int().positive() })).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow(); const existing = (await db.select({ id: paymentDueBeneficiaryGroups.id }).from(paymentDueBeneficiaryGroups).where(and(eq(paymentDueBeneficiaryGroups.id, input.id), companyScope(paymentDueBeneficiaryGroups.companyId, ctx.user.companyId))).limit(1))[0]; if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Groupe introuvable." });
      const warehouse = input.warehouseId ? await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true }) : await getDefaultWarehouse(db, ctx.user.companyId); const uniqueMembers = input.members.filter((member, index, values) => values.findIndex(value => value.beneficiaryType === member.beneficiaryType && value.beneficiaryId === member.beneficiaryId) === index);
      for (const member of uniqueMembers) { const source = member.beneficiaryType === "agent" ? (await db.select({ id: agents.id }).from(agents).where(and(eq(agents.id, member.beneficiaryId), companyScope(agents.companyId, ctx.user.companyId), eq(agents.active, true))).limit(1))[0] : (await db.select({ id: users.id }).from(users).where(and(eq(users.id, member.beneficiaryId), companyScope(users.companyId, ctx.user.companyId), eq(users.active, true))).limit(1))[0]; if (!source) throw new TRPCError({ code: "BAD_REQUEST", message: "Un membre ne fait pas partie des bénéficiaires actifs de cette entreprise." }); }
      await db.transaction(async tx => { await tx.update(paymentDueBeneficiaryGroups).set({ warehouseId: warehouse.id, name: input.name }).where(eq(paymentDueBeneficiaryGroups.id, existing.id)); await tx.delete(paymentDueBeneficiaryGroupMembers).where(and(eq(paymentDueBeneficiaryGroupMembers.groupId, existing.id), companyScope(paymentDueBeneficiaryGroupMembers.companyId, ctx.user.companyId))); await tx.insert(paymentDueBeneficiaryGroupMembers).values(uniqueMembers.map(member => ({ companyId: ctx.user.companyId!, groupId: existing.id, ...member }))); });
      await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Groupe d’échéance modifié", entityType: "Groupe échéance", entityId: String(existing.id), detail: `Groupe « ${input.name} » mis à jour avec ${uniqueMembers.length} membre(s).` }); return { success: true };
    }),
    setActive: permissionProcedure("payroll.manage").input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow(); const existing = (await db.select({ id: paymentDueBeneficiaryGroups.id, name: paymentDueBeneficiaryGroups.name }).from(paymentDueBeneficiaryGroups).where(and(eq(paymentDueBeneficiaryGroups.id, input.id), companyScope(paymentDueBeneficiaryGroups.companyId, ctx.user.companyId))).limit(1))[0]; if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Groupe introuvable." });
      await db.update(paymentDueBeneficiaryGroups).set({ active: input.active }).where(eq(paymentDueBeneficiaryGroups.id, existing.id)); await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: input.active ? "Groupe d’échéance réactivé" : "Groupe d’échéance archivé", entityType: "Groupe échéance", entityId: String(existing.id), detail: `Groupe « ${existing.name} » ${input.active ? "réactivé" : "archivé"}.` }); return { success: true };
    }),
  }),
  uploadSettlementReceipt: permissionProcedure("payroll.manage").input(z.object({ occurrenceId: z.number().int().positive(), dataUrl: z.string().min(30).max(7_000_000), filename: z.string().trim().min(1).max(180) })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow(); const occurrence = (await db.select({ id: paymentDueOccurrences.id }).from(paymentDueOccurrences).where(and(eq(paymentDueOccurrences.id, input.occurrenceId), companyScope(paymentDueOccurrences.companyId, ctx.user.companyId))).limit(1))[0]; if (!occurrence) throw new TRPCError({ code: "NOT_FOUND", message: "Échéance introuvable." });
    const match = input.dataUrl.match(/^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/); if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Le justificatif doit être un PDF, PNG, JPEG ou WEBP." });
    const mimeType = match[1]; const buffer = Buffer.from(match[2], "base64"); if (buffer.byteLength > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Le justificatif ne doit pas dépasser 5 Mo." });
    const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]; const attachment = await storagePut(`company/${ctx.user.companyId}/payment-due-settlements/${input.occurrenceId}/${randomUUID()}.${extension}`, buffer, mimeType);
    return { key: attachment.key, filename: input.filename, mimeType };
  }),
  settle: permissionProcedure("payroll.manage").input(paymentDueSettlementInput).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.transaction(async tx => settleOccurrenceInTx(tx, ctx, input));
  }),
  /**
   * Règle en une fois toutes les primes d'alimentation non soldées d'une journée (entrepôt actif),
   * chacune pour son solde. Tout ou rien : une erreur annule l'ensemble. Rejouable sans double paiement.
   */
  settleFoodAllowancesForDay: permissionProcedure("payroll.manage").input(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), warehouseId: z.number().int().positive().optional(), operationId: z.string().trim().min(16).max(60), settledAt: z.coerce.date() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: false });
    const dayStart = new Date(`${input.day}T00:00:00.000Z`); const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    return db.transaction(async tx => {
      const rows = await tx.select({ id: paymentDueOccurrences.id, amountCents: paymentDueOccurrences.amountCents, paidCents: paymentDueOccurrences.paidCents }).from(paymentDueOccurrences).innerJoin(paymentDueSchedules, eq(paymentDueOccurrences.scheduleId, paymentDueSchedules.id)).where(and(companyScope(paymentDueOccurrences.companyId, ctx.user.companyId), eq(paymentDueSchedules.scheduleType, "food_allowance"), gte(paymentDueOccurrences.dueAt, dayStart), lt(paymentDueOccurrences.dueAt, dayEnd), inArray(paymentDueOccurrences.status, ["upcoming", "due", "overdue", "partially_paid"]), ...(input.warehouseId ? [eq(paymentDueOccurrences.warehouseId, input.warehouseId)] : [])));
      let settled = 0; let totalCents = 0;
      for (const row of rows) {
        const remaining = row.amountCents - row.paidCents;
        if (remaining <= 0) continue;
        await settleOccurrenceInTx(tx, ctx, { occurrenceId: row.id, operationId: `${input.operationId}:${row.id}`, amountCents: remaining, settledAt: input.settledAt, note: "Primes d’alimentation du jour" });
        settled += 1; totalCents += remaining;
      }
      if (settled) await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Primes du jour réglées", entityType: "Échéance", entityId: input.day, detail: `${settled} prime(s) d’alimentation du ${input.day} réglée(s) pour ${moneyLabel(totalCents)}.` });
      return { settled, totalCents };
    });
  }),
  notifications: permissionProcedure("finance.notifications").query(async ({ ctx }) => {
    const db = await dbOrThrow();
    if (ctx.user.companyId === null) return [];
    let allowedWarehouseIds: number[] | null = null;
    if (ctx.user.role !== "admin") {
      allowedWarehouseIds = (await db.select({ warehouseId: sellerWarehouseAssignments.warehouseId }).from(sellerWarehouseAssignments).where(and(companyScope(sellerWarehouseAssignments.companyId, ctx.user.companyId), eq(sellerWarehouseAssignments.sellerUserId, ctx.user.id), eq(sellerWarehouseAssignments.warehouseRole, "manager")))).map(row => row.warehouseId);
      if (!allowedWarehouseIds.length) return [];
    }
    const recent = new Date(); recent.setDate(recent.getDate() - 14);
    const rows = await db.select({ id: paymentDueReminderEvents.id, reminderKind: paymentDueReminderEvents.reminderKind, createdAt: paymentDueReminderEvents.createdAt, occurrenceId: paymentDueOccurrences.id, dueAt: paymentDueOccurrences.dueAt, status: paymentDueOccurrences.status, title: paymentDueSchedules.title, warehouseId: paymentDueOccurrences.warehouseId, warehouseName: warehouses.name }).from(paymentDueReminderEvents).innerJoin(paymentDueOccurrences, eq(paymentDueReminderEvents.occurrenceId, paymentDueOccurrences.id)).innerJoin(paymentDueSchedules, eq(paymentDueOccurrences.scheduleId, paymentDueSchedules.id)).leftJoin(warehouses, eq(paymentDueOccurrences.warehouseId, warehouses.id)).where(and(companyScope(paymentDueReminderEvents.companyId, ctx.user.companyId), gte(paymentDueReminderEvents.createdAt, recent), ...(allowedWarehouseIds ? [inArray(paymentDueOccurrences.warehouseId, allowedWarehouseIds)] : []))).orderBy(desc(paymentDueReminderEvents.createdAt)).limit(50);
    return rows.filter(row => !["paid", "cancelled"].includes(row.status)).map(row => ({ id: `payment-due:${row.id}`, title: row.reminderKind === "overdue" ? "Échéance en retard" : row.reminderKind === "due" ? "Échéance à régler aujourd’hui" : "Échéance à venir", detail: `${row.title} · ${row.warehouseName ?? "Entrepôt"} · échéance ${row.dueAt.toLocaleDateString("fr-FR")}`, tone: row.reminderKind === "overdue" ? "rose" as const : row.reminderKind === "due" ? "amber" as const : "violet" as const, path: "/echeances" }));
  }),
});
