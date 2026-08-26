import { companySyncHealth } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { z } from "zod";

const reportInput = z.object({
  isOnline: z.boolean(),
  pendingOperations: z.number().int().min(0).max(10_000),
  failedOperations: z.number().int().min(0).max(10_000),
}).superRefine((input, context) => {
  if (input.failedOperations > input.pendingOperations) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["failedOperations"], message: "Le nombre d’échecs ne peut pas dépasser les opérations en attente." });
  }
});

export const syncHealthRouter = router({
  report: protectedProcedure.input(reportInput).mutation(async ({ ctx, input }) => {
    const companyId = ctx.user.companyId;
    if (!companyId) throw new Error("Entreprise active introuvable.");
    const db = await getDb();
    if (!db) throw new Error("Base de données indisponible.");

    const status = !input.isOnline ? "offline" : input.failedOperations > 0 ? "failed" : input.pendingOperations > 0 ? "pending" : "healthy";
    const now = new Date();
    const values = {
      companyId,
      status,
      pendingOperations: input.pendingOperations,
      failedOperations: input.failedOperations,
      reportedByUserId: ctx.user.id,
      ...(status === "healthy" ? { lastSyncedAt: now } : {}),
    } as const;

    await db.insert(companySyncHealth).values(values).onDuplicateKeyUpdate({
      set: {
        status,
        pendingOperations: input.pendingOperations,
        failedOperations: input.failedOperations,
        reportedByUserId: ctx.user.id,
        ...(status === "healthy" ? { lastSyncedAt: now } : {}),
      },
    });
    return { status } as const;
  }),
});
