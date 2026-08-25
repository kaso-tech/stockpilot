import { and, asc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auditLogs, products, stockTransfers, warehouseStocks, warehouses } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { companyScope } from "../companyScope";
import { getScopedWarehouse } from "../warehouseStock";

const warehouseInput = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, "Le code ne peut contenir que des lettres, chiffres, tirets et tirets bas."),
  address: z.string().trim().max(1000).nullable().optional(),
  isDefault: z.boolean().optional().default(false),
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

async function audit(tx: any, companyId: number | null, actorUserId: number, action: string, entityId: number, detail: string) {
  await tx.insert(auditLogs).values({ companyId, actorUserId, action, entityType: "Entrepôt", entityId: String(entityId), detail });
}

export const warehousesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const rows = await db.select({
      id: warehouses.id,
      name: warehouses.name,
      code: warehouses.code,
      address: warehouses.address,
      active: warehouses.active,
      isDefault: warehouses.isDefault,
      createdAt: warehouses.createdAt,
      updatedAt: warehouses.updatedAt,
      productCount: sql<number>`count(distinct ${warehouseStocks.productId})`,
      totalQuantity: sql<number>`coalesce(sum(${warehouseStocks.quantity}), 0)`,
    }).from(warehouses)
      .leftJoin(warehouseStocks, and(eq(warehouseStocks.warehouseId, warehouses.id), companyScope(warehouseStocks.companyId, ctx.user.companyId)))
      .where(companyScope(warehouses.companyId, ctx.user.companyId))
      .groupBy(warehouses.id, warehouses.name, warehouses.code, warehouses.address, warehouses.active, warehouses.isDefault, warehouses.createdAt, warehouses.updatedAt)
      .orderBy(asc(warehouses.isDefault), asc(warehouses.name));
    return rows.sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name));
  }),

  stocks: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const warehouse = await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId);
    const rows = await db.select({
      productId: products.id,
      reference: products.reference,
      name: products.name,
      unit: products.unit,
      minimumQuantity: products.minimumQuantity,
      quantity: sql<number>`coalesce(${warehouseStocks.quantity}, 0)`,
    }).from(products)
      .leftJoin(warehouseStocks, and(eq(warehouseStocks.productId, products.id), eq(warehouseStocks.warehouseId, warehouse.id), companyScope(warehouseStocks.companyId, ctx.user.companyId)))
      .where(companyScope(products.companyId, ctx.user.companyId))
      .orderBy(asc(products.name));
    return { warehouse, products: rows };
  }),

  create: adminProcedure.input(warehouseInput).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    try {
      const id = await db.transaction(async tx => {
        const existing = await tx.select({ id: warehouses.id }).from(warehouses).where(companyScope(warehouses.companyId, ctx.user.companyId)).limit(1);
        const shouldBeDefault = input.isDefault || existing.length === 0;
        if (shouldBeDefault) await tx.update(warehouses).set({ isDefault: false }).where(companyScope(warehouses.companyId, ctx.user.companyId));
        const result = await tx.insert(warehouses).values({ companyId: ctx.user.companyId, name: input.name, code: input.code.toUpperCase(), address: input.address?.trim() || null, isDefault: shouldBeDefault, createdByUserId: ctx.user.id });
        const warehouseId = Number(result[0].insertId);
        await audit(tx, ctx.user.companyId, ctx.user.id, "Création", warehouseId, `Entrepôt ${input.name} créé${shouldBeDefault ? " comme dépôt principal" : ""}.`);
        return warehouseId;
      });
      return { success: true, id };
    } catch (error) {
      throw new TRPCError({ code: "CONFLICT", message: "Ce code entrepôt est déjà utilisé dans votre entreprise.", cause: error });
    }
  }),

  update: adminProcedure.input(warehouseInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const { id, isDefault, ...values } = input;
    try {
      await db.transaction(async tx => {
        const current = await getScopedWarehouse(tx, ctx.user.companyId, id);
        if (isDefault && !current.active) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Réactivez l’entrepôt avant de le définir comme principal." });
        if (isDefault) await tx.update(warehouses).set({ isDefault: false }).where(companyScope(warehouses.companyId, ctx.user.companyId));
        await tx.update(warehouses).set({ name: values.name, code: values.code.toUpperCase(), address: values.address?.trim() || null, isDefault: isDefault || current.isDefault }).where(and(eq(warehouses.id, id), companyScope(warehouses.companyId, ctx.user.companyId)));
        await audit(tx, ctx.user.companyId, ctx.user.id, "Modification", id, `Entrepôt ${values.name} mis à jour.`);
      });
      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "CONFLICT", message: "Ce code entrepôt est déjà utilisé dans votre entreprise.", cause: error });
    }
  }),

  setDefault: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.transaction(async tx => {
      const warehouse = await getScopedWarehouse(tx, ctx.user.companyId, input.id, { requireActive: true });
      await tx.update(warehouses).set({ isDefault: false }).where(companyScope(warehouses.companyId, ctx.user.companyId));
      await tx.update(warehouses).set({ isDefault: true }).where(and(eq(warehouses.id, warehouse.id), companyScope(warehouses.companyId, ctx.user.companyId)));
      await audit(tx, ctx.user.companyId, ctx.user.id, "Entrepôt principal", warehouse.id, `${warehouse.name} est désormais l’entrepôt principal.`);
    });
    return { success: true };
  }),

  archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.transaction(async tx => {
      const warehouse = await getScopedWarehouse(tx, ctx.user.companyId, input.id);
      if (warehouse.isDefault) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Définissez un autre entrepôt principal avant de désactiver celui-ci." });
      const transfer = (await tx.select({ id: stockTransfers.id }).from(stockTransfers).where(and(companyScope(stockTransfers.companyId, ctx.user.companyId), eq(stockTransfers.status, "in_transit"), sql`(${stockTransfers.sourceWarehouseId} = ${warehouse.id} OR ${stockTransfers.destinationWarehouseId} = ${warehouse.id})`)).limit(1))[0];
      if (transfer) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cet entrepôt participe à un transfert en transit et ne peut pas être désactivé." });
      await tx.update(warehouses).set({ active: false }).where(and(eq(warehouses.id, warehouse.id), companyScope(warehouses.companyId, ctx.user.companyId)));
      await audit(tx, ctx.user.companyId, ctx.user.id, "Désactivation", warehouse.id, `Entrepôt ${warehouse.name} désactivé.`);
    });
    return { success: true };
  }),
});
