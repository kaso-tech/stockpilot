import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, inArray, isNotNull, lte } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  productStocks,
  products,
  stockLots,
  warehouses,
} from "../../drizzle/schema";
import { companyScope } from "../companyScope";
import { companyTimezone, dayKey } from "../companyTime";
import { getDb } from "../db";
import { conflictOr } from "../dbErrors";
import { MAX_QUANTITY } from "../numericLimits";
import { defaultWarehouseId, lockProducts } from "../stockLedger";
import { permissionProcedure, protectedProcedure, router } from "../_core/trpc";

async function dbOrThrow() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Base de données indisponible.",
    });
  return db;
}

async function ownedWarehouse(db: any, id: number, companyId: number | null) {
  const row = (
    await db
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, id),
          companyScope(warehouses.companyId, companyId)
        )
      )
      .limit(1)
  )[0];
  if (!row)
    throw new TRPCError({ code: "NOT_FOUND", message: "Dépôt introuvable." });
  return row as typeof warehouses.$inferSelect;
}

/** Dépôts, stock par dépôt, transferts et lots (9.7). */
export const warehousesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    await defaultWarehouseId(db, ctx.user.companyId);
    return db
      .select()
      .from(warehouses)
      .where(companyScope(warehouses.companyId, ctx.user.companyId))
      .orderBy(asc(warehouses.name));
  }),
  create: permissionProcedure("inventory.manage")
    .input(z.object({ name: z.string().trim().min(2).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      try {
        const result = await db
          .insert(warehouses)
          .values({ companyId: ctx.user.companyId, name: input.name });
        const id = Number(result[0].insertId);
        await db.insert(auditLogs).values({
          companyId: ctx.user.companyId,
          actorUserId: ctx.user.id,
          action: "Création",
          entityType: "Dépôt",
          entityId: String(id),
          detail: `Dépôt ${input.name} créé`,
        });
        return { id };
      } catch (error) {
        conflictOr(error, "Un dépôt porte déjà ce nom.");
      }
    }),
  update: permissionProcedure("inventory.manage")
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(2).max(120),
        active: z.boolean(),
        isDefault: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const current = await ownedWarehouse(db, input.id, ctx.user.companyId);
      if (current.isDefault && !input.isDefault)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Désignez un autre dépôt par défaut plutôt que de retirer ce statut.",
        });
      if (!input.active && (input.isDefault || current.isDefault))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Le dépôt par défaut ne peut pas être désactivé.",
        });
      if (!input.active) {
        const stocked = (
          await db
            .select({ id: productStocks.id })
            .from(productStocks)
            .where(
              and(
                eq(productStocks.warehouseId, input.id),
                gt(productStocks.quantity, 0)
              )
            )
            .limit(1)
        )[0];
        if (stocked)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Transférez d’abord le stock de ce dépôt.",
          });
      }
      try {
        await db.transaction(async tx => {
          if (input.isDefault && !current.isDefault)
            await tx
              .update(warehouses)
              .set({ isDefault: false })
              .where(companyScope(warehouses.companyId, ctx.user.companyId));
          await tx
            .update(warehouses)
            .set({
              name: input.name,
              active: input.active,
              isDefault: input.isDefault,
            })
            .where(
              and(
                eq(warehouses.id, input.id),
                companyScope(warehouses.companyId, ctx.user.companyId)
              )
            );
        });
      } catch (error) {
        conflictOr(error, "Un dépôt porte déjà ce nom.");
      }
      return { success: true } as const;
    }),
  /** Stock par dépôt pour un produit (ou tous les produits si omis). */
  stock: protectedProcedure
    .input(
      z.object({ productId: z.number().int().positive().optional() }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const productRows = await db
        .select({
          id: products.id,
          name: products.name,
          reference: products.reference,
          unit: products.unit,
        })
        .from(products)
        .where(
          input?.productId
            ? and(
                eq(products.id, input.productId),
                companyScope(products.companyId, ctx.user.companyId)
              )
            : companyScope(products.companyId, ctx.user.companyId)
        );
      if (!productRows.length) return [];
      const stocks = await db
        .select()
        .from(productStocks)
        .where(
          inArray(
            productStocks.productId,
            productRows.map(row => row.id)
          )
        );
      return productRows.map(product => ({
        ...product,
        stocks: stocks
          .filter(stock => stock.productId === product.id)
          .map(stock => ({
            warehouseId: stock.warehouseId,
            quantity: stock.quantity,
          })),
      }));
    }),
  transfer: permissionProcedure("inventory.manage")
    .input(
      z.object({
        productId: z.number().int().positive(),
        fromWarehouseId: z.number().int().positive(),
        toWarehouseId: z.number().int().positive(),
        quantity: z.number().int().positive().max(MAX_QUANTITY),
        reason: z.string().trim().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.transaction(async tx => {
        const ledger = await lockProducts(
          tx,
          [input.productId],
          ctx.user.companyId
        );
        const product = ledger.product(input.productId);
        await ledger.transfer(input.productId, {
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          quantity: input.quantity,
          reason: input.reason?.trim() || "Transfert entre dépôts",
          createdByUserId: ctx.user.id,
        });
        await tx.insert(auditLogs).values({
          companyId: ctx.user.companyId,
          actorUserId: ctx.user.id,
          action: "Transfert",
          entityType: "Dépôt",
          entityId: String(input.productId),
          detail: `${input.quantity} ${product.unit} de ${product.reference} transférés`,
        });
      });
      return { success: true } as const;
    }),
  /** Lots en stock arrivant à péremption dans `days` jours (ou déjà périmés). */
  expiringLots: protectedProcedure
    .input(
      z
        .object({ days: z.number().int().min(0).max(365).default(30) })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const timezone = await companyTimezone(db, ctx.user.companyId);
      const limit = dayKey(
        new Date(Date.now() + (input?.days ?? 30) * 86_400_000),
        timezone
      );
      const today = dayKey(new Date(), timezone);
      const rows = await db
        .select({
          id: stockLots.id,
          lotNumber: stockLots.lotNumber,
          expiryDate: stockLots.expiryDate,
          quantity: stockLots.quantity,
          warehouseId: stockLots.warehouseId,
          productId: products.id,
          productName: products.name,
          reference: products.reference,
          unit: products.unit,
        })
        .from(stockLots)
        .innerJoin(products, eq(stockLots.productId, products.id))
        .where(
          and(
            companyScope(stockLots.companyId, ctx.user.companyId),
            gt(stockLots.quantity, 0),
            isNotNull(stockLots.expiryDate),
            lte(stockLots.expiryDate, limit)
          )
        )
        .orderBy(asc(stockLots.expiryDate));
      return rows.map(row => ({
        ...row,
        expired: (row.expiryDate ?? "") < today,
      }));
    }),
});
