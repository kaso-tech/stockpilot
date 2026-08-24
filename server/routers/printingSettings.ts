import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, saleSettings } from "../../drizzle/schema";
import { companyScope } from "../companyScope";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const printingSettingsInput = z.object({
  ticketHeader: z.string().trim().min(2).max(160),
  ticketFooter: z.string().trim().min(2).max(240),
  ticketWidthMm: z.enum(["58", "80"]),
  printerName: z.string().trim().min(2).max(120),
  printerType: z.enum(["browser", "thermal"]),
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  return db;
}

function defaults(settings: typeof saleSettings.$inferSelect | undefined) {
  return {
    ticketHeader: settings?.ticketHeader ?? "Merci de votre achat",
    ticketFooter: settings?.ticketFooter ?? "À bientôt",
    ticketWidthMm: settings?.ticketWidthMm ?? "80",
    printerName: settings?.printerName ?? "Imprimante système",
    printerType: settings?.printerType ?? "browser",
  };
}

export const printingSettingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const settings = (await db.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
    return defaults(settings);
  }),
  save: adminProcedure.input(printingSettingsInput).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const current = (await db.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
    const values = { ...input, companyId: ctx.user.companyId, updatedByUserId: ctx.user.id };

    if (current) {
      await db.update(saleSettings).set(values).where(and(eq(saleSettings.id, current.id), companyScope(saleSettings.companyId, ctx.user.companyId)));
    } else {
      await db.insert(saleSettings).values(values);
    }

    await db.insert(auditLogs).values({
      companyId: ctx.user.companyId,
      actorUserId: ctx.user.id,
      action: "Paramètres d’impression mis à jour",
      entityType: "Impression",
      entityId: null,
      detail: `Imprimante ${input.printerName} configurée`,
    });
    return { success: true } as const;
  }),
});
