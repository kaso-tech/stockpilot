import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { agentPayments, agents, auditLogs, expenses, paymentDueOccurrences, paymentDueReminderEvents, paymentDueSchedules, paymentDueSettlements, sellerWarehouseAssignments, users, warehouses } from "../../drizzle/schema";
import { companyScope } from "../companyScope";
import { getDb } from "../db";
import { nextMonthlyDueAt, normalizeReminderDays, resolvePaymentDueStatus } from "../paymentDueRules";
import { getDefaultWarehouse, getScopedWarehouse } from "../warehouseStock";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const expenseCategories = ["rent", "energy", "connection", "salary", "marketing", "supplies", "taxes", "other"] as const;
const occurrenceStatuses = ["upcoming", "due", "overdue", "partially_paid", "paid", "cancelled"] as const;

const scheduleInput = z.object({
  id: z.number().int().positive().optional(),
  scheduleType: z.enum(["expense", "salary"]),
  title: z.string().trim().min(2).max(180),
  expenseCategory: z.enum(expenseCategories).nullable().optional(),
  beneficiaryType: z.enum(["user", "agent"]).nullable().optional(),
  beneficiaryId: z.number().int().positive().nullable().optional(),
  amountCents: z.number().int().positive().max(1_000_000_000),
  warehouseId: z.number().int().positive().optional(),
  recurrence: z.enum(["once", "monthly"]),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  reminderDays: z.array(z.number().int().min(0).max(90)).max(8).default([7, 3, 1]),
  responsibleUserId: z.number().int().positive().nullable().optional(),
}).superRefine((input, validation) => {
  if (input.scheduleType === "expense" && !input.expenseCategory) validation.addIssue({ code: z.ZodIssueCode.custom, message: "Une catégorie est requise pour une dépense." });
  if (input.scheduleType === "salary" && (!input.beneficiaryType || !input.beneficiaryId)) validation.addIssue({ code: z.ZodIssueCode.custom, message: "Un bénéficiaire est requis pour un salaire." });
  if (input.endsAt && input.endsAt < input.startsAt) validation.addIssue({ code: z.ZodIssueCode.custom, message: "La fin ne peut pas précéder la première échéance." });
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

function periodLabelFor(date: Date) { return date.toISOString().slice(0, 7); }

export async function materializePaymentDueOccurrences(db: any, schedule: typeof paymentDueSchedules.$inferSelect, now = new Date()) {
  if (schedule.status !== "active") return 0;
  const horizon = new Date(now); horizon.setUTCDate(horizon.getUTCDate() + 120);
  let dueAt = new Date(schedule.startsAt);
  let created = 0;
  while (dueAt <= horizon && (!schedule.endsAt || dueAt <= schedule.endsAt)) {
    const status = resolvePaymentDueStatus({ dueAt, amountCents: schedule.amountCents, paidCents: 0 }, now);
    await db.insert(paymentDueOccurrences).values({ scheduleId: schedule.id, companyId: schedule.companyId, warehouseId: schedule.warehouseId, dueAt, periodLabel: periodLabelFor(dueAt), amountCents: schedule.amountCents, status }).onDuplicateKeyUpdate({ set: {} });
    created += 1;
    if (schedule.recurrence === "once") break;
    dueAt = nextMonthlyDueAt(dueAt);
  }
  return created;
}

async function assertScheduleReferences(db: any, companyId: number | null, input: z.infer<typeof scheduleInput>) {
  const warehouse = input.warehouseId ? await getScopedWarehouse(db, companyId, input.warehouseId, { requireActive: true }) : await getDefaultWarehouse(db, companyId);
  if (input.responsibleUserId) {
    const responsible = (await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.responsibleUserId), companyScope(users.companyId, companyId), eq(users.active, true))).limit(1))[0];
    if (!responsible) throw new TRPCError({ code: "BAD_REQUEST", message: "Le responsable sélectionné n’appartient pas à cette entreprise." });
  }
  if (input.scheduleType === "salary" && input.beneficiaryId && input.beneficiaryType) {
    const beneficiary = input.beneficiaryType === "agent"
      ? (await db.select({ id: agents.id }).from(agents).where(and(eq(agents.id, input.beneficiaryId), companyScope(agents.companyId, companyId))).limit(1))[0]
      : (await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.beneficiaryId), companyScope(users.companyId, companyId))).limit(1))[0];
    if (!beneficiary) throw new TRPCError({ code: "BAD_REQUEST", message: "Le bénéficiaire n’appartient pas à cette entreprise." });
  }
  return warehouse;
}

export const paymentDuesRouter = router({
  list: adminProcedure.input(z.object({ warehouseId: z.number().int().positive().optional(), status: z.enum(occurrenceStatuses).optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
    const conditions = [companyScope(paymentDueOccurrences.companyId, ctx.user.companyId)];
    if (input?.warehouseId) conditions.push(eq(paymentDueOccurrences.warehouseId, input.warehouseId));
    if (input?.status) conditions.push(eq(paymentDueOccurrences.status, input.status));
    const rows = await db.select({ occurrence: paymentDueOccurrences, schedule: paymentDueSchedules, warehouseName: warehouses.name }).from(paymentDueOccurrences).innerJoin(paymentDueSchedules, eq(paymentDueOccurrences.scheduleId, paymentDueSchedules.id)).leftJoin(warehouses, eq(paymentDueOccurrences.warehouseId, warehouses.id)).where(and(...conditions)).orderBy(paymentDueOccurrences.dueAt).limit(300);
    const now = new Date();
    return rows.map(row => ({ ...row.occurrence, title: row.schedule.title, scheduleType: row.schedule.scheduleType, recurrence: row.schedule.recurrence, expenseCategory: row.schedule.expenseCategory, beneficiaryType: row.schedule.beneficiaryType, beneficiaryId: row.schedule.beneficiaryId, responsibleUserId: row.schedule.responsibleUserId, warehouseName: row.warehouseName, computedStatus: resolvePaymentDueStatus({ dueAt: row.occurrence.dueAt, amountCents: row.occurrence.amountCents, paidCents: row.occurrence.paidCents, cancelled: row.occurrence.status === "cancelled" }, now) }));
  }),
  schedules: router({
    list: adminProcedure.input(z.object({ warehouseId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
      return db.select({ schedule: paymentDueSchedules, warehouseName: warehouses.name, responsibleName: users.name }).from(paymentDueSchedules).leftJoin(warehouses, eq(paymentDueSchedules.warehouseId, warehouses.id)).leftJoin(users, eq(paymentDueSchedules.responsibleUserId, users.id)).where(input?.warehouseId ? and(companyScope(paymentDueSchedules.companyId, ctx.user.companyId), eq(paymentDueSchedules.warehouseId, input.warehouseId)) : companyScope(paymentDueSchedules.companyId, ctx.user.companyId)).orderBy(desc(paymentDueSchedules.updatedAt));
    }),
    save: adminProcedure.input(scheduleInput).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const warehouse = await assertScheduleReferences(db, ctx.user.companyId, input);
      const values = { companyId: ctx.user.companyId!, warehouseId: warehouse.id, scheduleType: input.scheduleType, title: input.title, expenseCategory: input.scheduleType === "expense" ? input.expenseCategory ?? "other" : null, beneficiaryType: input.scheduleType === "salary" ? input.beneficiaryType ?? null : null, beneficiaryId: input.scheduleType === "salary" ? input.beneficiaryId ?? null : null, amountCents: input.amountCents, recurrence: input.recurrence, dueDay: input.startsAt.getUTCDate(), startsAt: input.startsAt, endsAt: input.endsAt ?? null, reminderDaysJson: JSON.stringify(normalizeReminderDays(input.reminderDays)), responsibleUserId: input.responsibleUserId ?? null };
      if (input.id) {
        const existing = (await db.select().from(paymentDueSchedules).where(and(eq(paymentDueSchedules.id, input.id), companyScope(paymentDueSchedules.companyId, ctx.user.companyId))).limit(1))[0];
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Échéancier introuvable." });
        await db.update(paymentDueSchedules).set(values).where(eq(paymentDueSchedules.id, existing.id));
        const schedule = { ...existing, ...values } as typeof paymentDueSchedules.$inferSelect;
        await materializePaymentDueOccurrences(db, schedule);
        await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Échéancier modifié", entityType: "Échéance", entityId: String(existing.id), detail: `Échéancier « ${input.title} » mis à jour.` });
        return { id: existing.id };
      }
      const result = await db.insert(paymentDueSchedules).values({ ...values, createdByUserId: ctx.user.id });
      const id = Number(result[0].insertId);
      const schedule = (await db.select().from(paymentDueSchedules).where(eq(paymentDueSchedules.id, id)).limit(1))[0]!;
      await materializePaymentDueOccurrences(db, schedule);
      await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Échéancier créé", entityType: "Échéance", entityId: String(id), detail: `Échéancier « ${input.title} » créé.` });
      return { id };
    }),
    setStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "paused", "archived"]) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const current = (await db.select({ id: paymentDueSchedules.id }).from(paymentDueSchedules).where(and(eq(paymentDueSchedules.id, input.id), companyScope(paymentDueSchedules.companyId, ctx.user.companyId))).limit(1))[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Échéancier introuvable." });
      await db.update(paymentDueSchedules).set({ status: input.status }).where(eq(paymentDueSchedules.id, current.id));
      await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Échéancier modifié", entityType: "Échéance", entityId: String(current.id), detail: `Statut défini sur ${input.status}.` });
      return { success: true };
    }),
  }),
  settle: adminProcedure.input(z.object({ occurrenceId: z.number().int().positive(), amountCents: z.number().int().positive(), settledAt: z.coerce.date(), note: z.string().trim().max(1000).nullable().optional() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.transaction(async tx => {
      const row = (await tx.select({ occurrence: paymentDueOccurrences, schedule: paymentDueSchedules }).from(paymentDueOccurrences).innerJoin(paymentDueSchedules, eq(paymentDueOccurrences.scheduleId, paymentDueSchedules.id)).where(and(eq(paymentDueOccurrences.id, input.occurrenceId), companyScope(paymentDueOccurrences.companyId, ctx.user.companyId))).limit(1))[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Échéance introuvable." });
      if (["paid", "cancelled"].includes(row.occurrence.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cette échéance ne peut plus être réglée." });
      const remainingCents = row.occurrence.amountCents - row.occurrence.paidCents;
      if (input.amountCents > remainingCents) throw new TRPCError({ code: "BAD_REQUEST", message: "Le règlement dépasse le solde de l’échéance." });
      const warehouse = row.occurrence.warehouseId ? await getScopedWarehouse(tx, ctx.user.companyId, row.occurrence.warehouseId, { requireActive: false }) : await getDefaultWarehouse(tx, ctx.user.companyId);
      let expenseId: number | null = null;
      let agentPaymentId: number | null = null;
      if (row.schedule.scheduleType === "expense") {
        const result = await tx.insert(expenses).values({ companyId: ctx.user.companyId, warehouseId: warehouse.id, category: row.schedule.expenseCategory ?? "other", description: row.schedule.title, amountCents: input.amountCents, spentAt: input.settledAt, createdByUserId: ctx.user.id });
        expenseId = Number(result[0].insertId);
      } else {
        if (!row.schedule.beneficiaryType || !row.schedule.beneficiaryId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Le bénéficiaire de salaire est incomplet." });
        const result = await tx.insert(agentPayments).values({ companyId: ctx.user.companyId, warehouseId: warehouse.id, beneficiaryType: row.schedule.beneficiaryType, beneficiaryId: row.schedule.beneficiaryId, paymentKind: "salary", amountCents: input.amountCents, paidAt: input.settledAt, periodLabel: row.occurrence.periodLabel, note: input.note ?? null, createdByUserId: ctx.user.id });
        agentPaymentId = Number(result[0].insertId);
      }
      const paidCents = row.occurrence.paidCents + input.amountCents;
      const status = resolvePaymentDueStatus({ dueAt: row.occurrence.dueAt, amountCents: row.occurrence.amountCents, paidCents });
      await tx.insert(paymentDueSettlements).values({ occurrenceId: row.occurrence.id, companyId: ctx.user.companyId!, amountCents: input.amountCents, expenseId, agentPaymentId, settledByUserId: ctx.user.id, settledAt: input.settledAt });
      await tx.update(paymentDueOccurrences).set({ paidCents, status, resolvedAt: status === "paid" ? input.settledAt : null }).where(eq(paymentDueOccurrences.id, row.occurrence.id));
      await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Échéance réglée", entityType: "Échéance", entityId: String(row.occurrence.id), detail: `Règlement de ${input.amountCents} centimes enregistré sans double comptage.` });
      return { success: true, expenseId, agentPaymentId, status, paidCents };
    });
  }),
  notifications: protectedProcedure.query(async ({ ctx }) => {
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
