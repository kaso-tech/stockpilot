import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, saleSettings } from "../../drizzle/schema";
import { companyScope } from "../companyScope";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const input = z.object({
  sellerCanLineDiscount: z.boolean(),
  sellerMaxLineDiscountPercent: z.number().int().min(0).max(100),
  sellerCanInvoiceDiscount: z.boolean(),
  sellerMaxInvoiceDiscountPercent: z.number().int().min(0).max(100),
  sellerCanCartDiscount: z.boolean(),
  sellerMaxCartDiscountPercent: z.number().int().min(0).max(100),
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  return db;
}

export function normalizeSellerDiscountPermissions(value: z.infer<typeof input>) {
  return {
    sellerCanLineDiscount: value.sellerCanLineDiscount,
    sellerMaxLineDiscountPercent: value.sellerCanLineDiscount ? value.sellerMaxLineDiscountPercent : 0,
    sellerCanInvoiceDiscount: value.sellerCanInvoiceDiscount,
    sellerMaxInvoiceDiscountPercent: value.sellerCanInvoiceDiscount ? value.sellerMaxInvoiceDiscountPercent : 0,
    sellerCanCartDiscount: value.sellerCanCartDiscount,
    sellerMaxCartDiscountPercent: value.sellerCanCartDiscount ? value.sellerMaxCartDiscountPercent : 0,
  };
}

export const sellerDiscountPermissionsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const settings = (await db.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
    return normalizeSellerDiscountPermissions({
      sellerCanLineDiscount: settings?.sellerCanLineDiscount ?? false,
      sellerMaxLineDiscountPercent: settings?.sellerMaxLineDiscountPercent ?? 0,
      sellerCanInvoiceDiscount: settings?.sellerCanInvoiceDiscount ?? false,
      sellerMaxInvoiceDiscountPercent: settings?.sellerMaxInvoiceDiscountPercent ?? 0,
      sellerCanCartDiscount: settings?.sellerCanCartDiscount ?? false,
      sellerMaxCartDiscountPercent: settings?.sellerMaxCartDiscountPercent ?? 0,
    });
  }),
  save: adminProcedure.input(input).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const current = (await db.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
    const values = { ...normalizeSellerDiscountPermissions(input), companyId: ctx.user.companyId, updatedByUserId: ctx.user.id };
    if (current) await db.update(saleSettings).set(values).where(and(eq(saleSettings.id, current.id), companyScope(saleSettings.companyId, ctx.user.companyId)));
    else await db.insert(saleSettings).values(values);
    await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Autorisations de remise vendeur mises à jour", entityType: "Autorisations vendeur", entityId: null, detail: "Remises par produit, facture et panier configurées" });
    return { success: true } as const;
  }),
});
