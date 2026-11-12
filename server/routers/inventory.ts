import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  inventoryItems,
  inventorySessions,
  productStocks,
  products,
  warehouses,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router, permissionProcedure } from "../_core/trpc";
import { inventoryDifference } from "../inventoryRules";
import { defaultWarehouseId, lockProducts } from "../stockLedger";
import { MAX_QUANTITY } from "../numericLimits";
import { companyScope } from "../companyScope";

async function resolveWarehouse(
  db: any,
  companyId: number | null,
  warehouseId?: number
) {
  if (!warehouseId) return defaultWarehouseId(db, companyId);
  const row = (
    await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, warehouseId),
          eq(warehouses.active, true),
          companyScope(warehouses.companyId, companyId)
        )
      )
      .limit(1)
  )[0];
  if (!row)
    throw new TRPCError({ code: "NOT_FOUND", message: "Dépôt introuvable." });
  return row.id as number;
}

/** Quantités d'un dépôt pour une liste de produits (les produits du dépôt sont déjà vérifiés). */
async function warehouseStocks(
  db: any,
  warehouseId: number,
  productIds: number[]
) {
  if (!productIds.length) return new Map<number, number>();
  const rows = await db
    .select()
    .from(productStocks)
    .where(
      and(
        eq(productStocks.warehouseId, warehouseId),
        inArray(productStocks.productId, productIds)
      )
    );
  return new Map<number, number>(
    rows.map((row: { productId: number; quantity: number }) => [
      row.productId,
      row.quantity,
    ])
  );
}

async function dbOrThrow() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Base de données indisponible.",
    });
  return db;
}

export const inventoryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) =>
    (await dbOrThrow())
      .select()
      .from(inventorySessions)
      .where(companyScope(inventorySessions.companyId, ctx.user.companyId))
      .orderBy(desc(inventorySessions.createdAt))
  ),
  detail: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const session = (
        await db
          .select()
          .from(inventorySessions)
          .where(
            and(
              eq(inventorySessions.id, input.id),
              companyScope(inventorySessions.companyId, ctx.user.companyId)
            )
          )
          .limit(1)
      )[0];
      if (!session)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inventaire introuvable.",
        });
      const items = await db
        .select({
          id: inventoryItems.id,
          productId: products.id,
          productName: products.name,
          reference: products.reference,
          expectedQuantity: inventoryItems.expectedQuantity,
          countedQuantity: inventoryItems.countedQuantity,
        })
        .from(inventoryItems)
        .innerJoin(products, eq(inventoryItems.productId, products.id))
        .where(eq(inventoryItems.inventorySessionId, session.id));
      return { session, items };
    }),
  create: permissionProcedure("inventory.manage")
    .input(
      z.object({
        name: z.string().trim().min(2).max(160),
        /** Dépôt inventorié ; à défaut, le dépôt par défaut (9.7). */
        warehouseId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const warehouseId = await resolveWarehouse(
        db,
        ctx.user.companyId,
        input.warehouseId
      );
      const productRows = await db
        .select()
        .from(products)
        .where(companyScope(products.companyId, ctx.user.companyId))
        .orderBy(products.name);
      const stocks = await warehouseStocks(
        db,
        warehouseId,
        productRows.map(product => product.id)
      );
      const result = await db.insert(inventorySessions).values({
        name: input.name,
        companyId: ctx.user.companyId,
        warehouseId,
        createdByUserId: ctx.user.id,
      });
      const id = Number(result[0].insertId);
      if (productRows.length)
        await db.insert(inventoryItems).values(
          productRows.map(product => ({
            inventorySessionId: id,
            productId: product.id,
            expectedQuantity: stocks.get(product.id) ?? 0,
          }))
        );
      await db.insert(auditLogs).values({
        companyId: ctx.user.companyId,
        actorUserId: ctx.user.id,
        action: "Inventaire créé",
        entityType: "Inventaire",
        entityId: String(id),
        detail: input.name,
      });
      return { id };
    }),
  count: permissionProcedure("inventory.manage")
    .input(
      z.object({
        itemId: z.number().int().positive(),
        countedQuantity: z.number().int().min(0).max(MAX_QUANTITY),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const item = (
        await db
          .select({
            id: inventoryItems.id,
            productId: inventoryItems.productId,
            status: inventorySessions.status,
            warehouseId: inventorySessions.warehouseId,
          })
          .from(inventoryItems)
          .innerJoin(
            inventorySessions,
            eq(inventoryItems.inventorySessionId, inventorySessions.id)
          )
          .where(
            and(
              eq(inventoryItems.id, input.itemId),
              companyScope(inventorySessions.companyId, ctx.user.companyId)
            )
          )
          .limit(1)
      )[0];
      if (!item)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ligne d’inventaire introuvable.",
        });
      if (item.status === "validated")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cet inventaire est déjà validé.",
        });
      const product = (
        await db
          .select({ quantity: products.quantity })
          .from(products)
          .where(
            and(
              eq(products.id, item.productId),
              companyScope(products.companyId, ctx.user.companyId)
            )
          )
          .limit(1)
      )[0];
      if (!product)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit introuvable.",
        });
      // Le stock théorique est figé au moment du comptage : les ventes faites entre
      // le comptage et la validation ne faussent plus l'écart appliqué.
      await db
        .update(inventoryItems)
        .set({
          countedQuantity: input.countedQuantity,
          expectedQuantity: item.warehouseId
            ? ((
                await warehouseStocks(db, item.warehouseId, [item.productId])
              ).get(item.productId) ?? 0)
            : product.quantity,
        })
        .where(eq(inventoryItems.id, input.itemId));
      return { success: true };
    }),
  validate: permissionProcedure("inventory.manage")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.transaction(async tx => {
        const session = (
          await tx
            .select()
            .from(inventorySessions)
            .where(
              and(
                eq(inventorySessions.id, input.id),
                companyScope(inventorySessions.companyId, ctx.user.companyId)
              )
            )
            .limit(1)
            .for("update")
        )[0];
        if (!session || session.status === "validated")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Inventaire non disponible.",
          });
        const items = (
          await tx
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.inventorySessionId, input.id))
        ).filter(item => item.countedQuantity !== null);
        const ledger = await lockProducts(
          tx,
          items.map(item => item.productId),
          ctx.user.companyId
        );
        for (const item of items) {
          if (!ledger.has(item.productId)) continue;
          const difference = inventoryDifference(
            item.expectedQuantity,
            item.countedQuantity!
          );
          if (difference !== 0)
            await ledger.apply(item.productId, {
              type: "adjustment",
              quantity: difference,
              reason: `Inventaire ${session.name}`,
              createdByUserId: ctx.user.id,
              warehouseId: session.warehouseId,
            });
        }
        await tx
          .update(inventorySessions)
          .set({
            status: "validated",
            validatedByUserId: ctx.user.id,
            validatedAt: new Date(),
          })
          .where(
            and(
              eq(inventorySessions.id, input.id),
              companyScope(inventorySessions.companyId, ctx.user.companyId)
            )
          );
        await tx.insert(auditLogs).values({
          companyId: ctx.user.companyId,
          actorUserId: ctx.user.id,
          action: "Inventaire validé",
          entityType: "Inventaire",
          entityId: String(input.id),
          detail: session.name,
        });
      });
      return { success: true };
    }),
});
