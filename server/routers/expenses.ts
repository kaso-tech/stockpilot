import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { agentPayments, auditLogs, expenseBudgets, expenses } from "../../drizzle/schema";
import { expenseCategories } from "../expenseRules";
import { agentPaymentExpenseRows, expenseBreakdownByCategory, expenseTotalCents } from "../expenseRules";
import { getDb } from "../db";
import { adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { storagePut } from "../storage";
import { companyScope } from "../companyScope";

const expenseInput = z.object({
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
    get: adminProcedure.input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      return (await db.select().from(expenseBudgets).where(and(eq(expenseBudgets.yearMonth, input.yearMonth), companyScope(expenseBudgets.companyId, ctx.user.companyId))).limit(1))[0] ?? null;
    }),
    save: adminProcedure.input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/), amountCents: z.number().int().min(0), warningPercent: z.number().int().min(50).max(100) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const current = (await db.select().from(expenseBudgets).where(and(eq(expenseBudgets.yearMonth, input.yearMonth), companyScope(expenseBudgets.companyId, ctx.user.companyId))).limit(1))[0];
      if (current) await db.update(expenseBudgets).set({ amountCents: input.amountCents, warningPercent: input.warningPercent, updatedByUserId: ctx.user.id }).where(eq(expenseBudgets.id, current.id));
      else await db.insert(expenseBudgets).values({ ...input, companyId: ctx.user.companyId, updatedByUserId: ctx.user.id });
      await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Budget dépenses", entityType: "Budget", entityId: input.yearMonth, detail: `Budget mensuel fixé à ${input.amountCents} centimes` });
      return { success: true };
    }),
  }),
  report: adminProcedure.input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow(); const [rows, payments] = await Promise.all([db.select().from(expenses).where(companyScope(expenses.companyId, ctx.user.companyId)).orderBy(desc(expenses.spentAt)), db.select().from(agentPayments).where(companyScope(agentPayments.companyId, ctx.user.companyId)).orderBy(desc(agentPayments.paidAt))]); const agentRows = agentPaymentExpenseRows(payments); const breakdown = expenseBreakdownByCategory([...rows, ...agentRows], input.yearMonth); const agentPaymentCents = expenseTotalCents(agentRows.filter(row => row.spentAt.toISOString().slice(0, 7) === input.yearMonth));
    return { yearMonth: input.yearMonth, totalCents: expenseTotalCents(breakdown), breakdown, count: rows.filter(row => row.spentAt.toISOString().slice(0, 7) === input.yearMonth).length + agentRows.filter(row => row.spentAt.toISOString().slice(0, 7) === input.yearMonth).length, agentPaymentCents, agentPaymentCount: agentRows.filter(row => row.spentAt.toISOString().slice(0, 7) === input.yearMonth).length };
  }),
  uploadReceipt: adminProcedure.input(z.object({ dataUrl: z.string().min(30).max(7_000_000), filename: z.string().trim().min(1).max(180) })).mutation(async ({ ctx, input }) => {
    const match = input.dataUrl.match(/^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/); if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Le justificatif doit être un PDF, PNG, JPEG ou WEBP." });
    const mimeType = match[1]; const buffer = Buffer.from(match[2], "base64"); if (buffer.byteLength > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Le justificatif ne doit pas dépasser 5 Mo." });
    const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]; const { url } = await storagePut(`company/${ctx.user.companyId ?? "legacy"}/expenses/${randomUUID()}.${extension}`, buffer, mimeType);
    return { url, filename: input.filename, mimeType };
  }),
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(expenses).where(companyScope(expenses.companyId, ctx.user.companyId)).orderBy(desc(expenses.spentAt), desc(expenses.id));
  }),
  create: adminProcedure.input(expenseInput).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const result = await db.insert(expenses).values({ ...input, companyId: ctx.user.companyId, createdByUserId: ctx.user.id });
    const id = Number(result[0].insertId);
    await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Création", entityType: "Dépense", entityId: String(id), detail: `Dépense ${input.category} de ${input.amountCents} centimes créée` });
    return { id };
  }),
  update: adminProcedure.input(expenseInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...data } = input;
    await db.update(expenses).set(data).where(and(eq(expenses.id, id), companyScope(expenses.companyId, ctx.user.companyId)));
    await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Modification", entityType: "Dépense", entityId: String(id), detail: `Dépense ${data.category} de ${data.amountCents} centimes modifiée` });
    return { success: true };
  }),
  remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(expenses).where(and(eq(expenses.id, input.id), companyScope(expenses.companyId, ctx.user.companyId)));
    await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Suppression", entityType: "Dépense", entityId: String(input.id), detail: "Dépense supprimée" });
    return { success: true };
  }),
});
