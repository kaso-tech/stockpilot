import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, expenseBudgets, expenses } from "../../drizzle/schema";
import { expenseCategories } from "../expenseRules";
import { getDb } from "../db";
import { adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const expenseInput = z.object({
  category: z.enum(expenseCategories),
  description: z.string().trim().min(2).max(300),
  amountCents: z.number().int().positive(),
  spentAt: z.date(),
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

export const expensesRouter = router({
  budget: router({
    get: adminProcedure.input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ input }) => {
      const db = await dbOrThrow();
      return (await db.select().from(expenseBudgets).where(eq(expenseBudgets.yearMonth, input.yearMonth)).limit(1))[0] ?? null;
    }),
    save: adminProcedure.input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/), amountCents: z.number().int().min(0) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const current = (await db.select().from(expenseBudgets).where(eq(expenseBudgets.yearMonth, input.yearMonth)).limit(1))[0];
      if (current) await db.update(expenseBudgets).set({ amountCents: input.amountCents, updatedByUserId: ctx.user.id }).where(eq(expenseBudgets.id, current.id));
      else await db.insert(expenseBudgets).values({ ...input, updatedByUserId: ctx.user.id });
      await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Budget dépenses", entityType: "Budget", entityId: input.yearMonth, detail: `Budget mensuel fixé à ${input.amountCents} centimes` });
      return { success: true };
    }),
  }),
  list: adminProcedure.query(async () => {
    const db = await dbOrThrow();
    return db.select().from(expenses).orderBy(desc(expenses.spentAt), desc(expenses.id));
  }),
  create: adminProcedure.input(expenseInput).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const result = await db.insert(expenses).values({ ...input, createdByUserId: ctx.user.id });
    const id = Number(result[0].insertId);
    await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Création", entityType: "Dépense", entityId: String(id), detail: `Dépense ${input.category} de ${input.amountCents} centimes créée` });
    return { id };
  }),
  update: adminProcedure.input(expenseInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, ...data } = input;
    await db.update(expenses).set(data).where(eq(expenses.id, id));
    await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Modification", entityType: "Dépense", entityId: String(id), detail: `Dépense ${data.category} de ${data.amountCents} centimes modifiée` });
    return { success: true };
  }),
  remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.delete(expenses).where(eq(expenses.id, input.id));
    await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Suppression", entityType: "Dépense", entityId: String(input.id), detail: "Dépense supprimée" });
    return { success: true };
  }),
});
