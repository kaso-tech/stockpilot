import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { agentPayments, auditLogs, expenseBudgets, expenses } from "../../drizzle/schema";
import { expenseCategories } from "../expenseRules";
import { agentPaymentExpenseRows, expenseBreakdownByCategory, expenseTotalCents } from "../expenseRules";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { storagePut } from "../storage";
import { companyScope } from "../companyScope";
import { getDefaultWarehouse, getScopedWarehouse } from "../warehouseStock";

const expenseInput = z.object({
  warehouseId: z.number().int().positive().optional(),
  category: z.enum(expenseCategories),
  description: z.string().trim().min(2).max(300),
  amountCents: z.number().int().positive(),
  spentAt: z.date(),
  receiptUrl: z.string().max(1024).nullable().optional(),
  receiptName: z.string().trim().max(180).nullable().optional(),
  receiptMimeType: z.string().trim().max(80).nullable().optional(),
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

export const expensesRouter = router({
  budget: router({
    get: permissionProcedure("expenses.manage").input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/), warehouseId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      if (input.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
      return (await db.select().from(expenseBudgets).where(and(eq(expenseBudgets.yearMonth, input.yearMonth), companyScope(expenseBudgets.companyId, ctx.user.companyId), ...(input.warehouseId ? [eq(expenseBudgets.warehouseId, input.warehouseId)] : []))).limit(1))[0] ?? null;
    }),
    save: permissionProcedure("expenses.manage").input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/), amountCents: z.number().int().min(0), warningPercent: z.number().int().min(50).max(100), warehouseId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const warehouse = input.warehouseId ? await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true }) : await getDefaultWarehouse(db, ctx.user.companyId);
      const current = (await db.select().from(expenseBudgets).where(and(eq(expenseBudgets.yearMonth, input.yearMonth), eq(expenseBudgets.warehouseId, warehouse.id), companyScope(expenseBudgets.companyId, ctx.user.companyId))).limit(1))[0];
      if (current) await db.update(expenseBudgets).set({ amountCents: input.amountCents, warningPercent: input.warningPercent, updatedByUserId: ctx.user.id }).where(eq(expenseBudgets.id, current.id));
      else await db.insert(expenseBudgets).values({ yearMonth: input.yearMonth, amountCents: input.amountCents, warningPercent: input.warningPercent, warehouseId: warehouse.id, companyId: ctx.user.companyId, updatedByUserId: ctx.user.id });
      await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Budget dépenses", entityType: "Budget", entityId: input.yearMonth, detail: `Budget mensuel fixé à ${input.amountCents} centimes` });
      return { success: true };
    }),
  }),
  report: permissionProcedure("expenses.manage").input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/), warehouseId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow(); if (input.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true }); const [rows, payments] = await Promise.all([db.select().from(expenses).where(input.warehouseId ? and(companyScope(expenses.companyId, ctx.user.companyId), eq(expenses.warehouseId, input.warehouseId)) : companyScope(expenses.companyId, ctx.user.companyId)).orderBy(desc(expenses.spentAt)), db.select().from(agentPayments).where(input.warehouseId ? and(companyScope(agentPayments.companyId, ctx.user.companyId), eq(agentPayments.warehouseId, input.warehouseId)) : companyScope(agentPayments.companyId, ctx.user.companyId)).orderBy(desc(agentPayments.paidAt))]); const agentRows = agentPaymentExpenseRows(payments); const breakdown = expenseBreakdownByCategory([...rows, ...agentRows], input.yearMonth); const agentPaymentCents = expenseTotalCents(agentRows.filter(row => row.spentAt.toISOString().slice(0, 7) === input.yearMonth));
    return { yearMonth: input.yearMonth, totalCents: expenseTotalCents(breakdown), breakdown, count: rows.filter(row => row.spentAt.toISOString().slice(0, 7) === input.yearMonth).length + agentRows.filter(row => row.spentAt.toISOString().slice(0, 7) === input.yearMonth).length, agentPaymentCents, agentPaymentCount: agentRows.filter(row => row.spentAt.toISOString().slice(0, 7) === input.yearMonth).length };
  }),
  uploadReceipt: permissionProcedure("expenses.manage").input(z.object({ dataUrl: z.string().min(30).max(7_000_000), filename: z.string().trim().min(1).max(180) })).mutation(async ({ ctx, input }) => {
    const match = input.dataUrl.match(/^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/); if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Le justificatif doit être un PDF, PNG, JPEG ou WEBP." });
    const mimeType = match[1]; const buffer = Buffer.from(match[2], "base64"); if (buffer.byteLength > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Le justificatif ne doit pas dépasser 5 Mo." });
    const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]; const { url } = await storagePut(`company/${ctx.user.companyId ?? "legacy"}/expenses/${randomUUID()}.${extension}`, buffer, mimeType);
    return { url, filename: input.filename, mimeType };
  }),
  list: permissionProcedure("expenses.manage").input(z.object({ warehouseId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
    return db.select().from(expenses).where(input?.warehouseId ? and(companyScope(expenses.companyId, ctx.user.companyId), eq(expenses.warehouseId, input.warehouseId)) : companyScope(expenses.companyId, ctx.user.companyId)).orderBy(desc(expenses.spentAt), desc(expenses.id));
  }),
  create: permissionProcedure("expenses.manage").input(expenseInput).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { warehouseId, ...expense } = input; const warehouse = warehouseId ? await getScopedWarehouse(db, ctx.user.companyId, warehouseId, { requireActive: true }) : await getDefaultWarehouse(db, ctx.user.companyId);
    const result = await db.insert(expenses).values({ ...expense, warehouseId: warehouse.id, companyId: ctx.user.companyId, createdByUserId: ctx.user.id });
    const id = Number(result[0].insertId);
    await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Création", entityType: "Dépense", entityId: String(id), detail: `Dépense ${input.category} de ${input.amountCents} centimes créée` });
    return { id };
  }),
  update: permissionProcedure("expenses.manage").input(expenseInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, warehouseId, ...data } = input; if (warehouseId) await getScopedWarehouse(db, ctx.user.companyId, warehouseId, { requireActive: true });
    await db.update(expenses).set({ ...data, ...(warehouseId ? { warehouseId } : {}) }).where(and(eq(expenses.id, id), companyScope(expenses.companyId, ctx.user.companyId)));
    await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Modification", entityType: "Dépense", entityId: String(id), detail: `Dépense ${data.category} de ${data.amountCents} centimes modifiée` });
    return { success: true };
  }),
  remove: permissionProcedure("expenses.manage").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(expenses).where(and(eq(expenses.id, input.id), companyScope(expenses.companyId, ctx.user.companyId)));
    await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Suppression", entityType: "Dépense", entityId: String(input.id), detail: "Dépense supprimée" });
    return { success: true };
  }),
});
