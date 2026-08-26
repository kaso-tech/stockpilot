import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auditLogs, products, sellerCredentials, sellerWarehouseAssignments, stockTransfers, userWarehousePreferences, users, warehouseReorderThresholds, warehouseStockAlerts, warehouseStocks, warehouses } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { companyScope } from "../companyScope";
import { getScopedWarehouse } from "../warehouseStock";
import { resolveActiveWarehouse } from "../activeWarehouseRules";
import { assignedWarehouseIds, assertSellerWarehouseAccess } from "../sellerWarehouseAccess";
import { warehouseAlertNotificationId, warehouseAlertNotificationTitle } from "../warehouseNotificationRules";

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
  active: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    if (ctx.user.companyId === null) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aucune entreprise active n’est associée à ce compte." });
    const [preference, fallback] = await Promise.all([
      db.select().from(userWarehousePreferences).where(and(eq(userWarehousePreferences.userId, ctx.user.id), eq(userWarehousePreferences.companyId, ctx.user.companyId))).limit(1),
      db.select().from(warehouses).where(and(companyScope(warehouses.companyId, ctx.user.companyId), eq(warehouses.active, true))).orderBy(asc(warehouses.isDefault), asc(warehouses.name)),
    ]);
    const preferredId = preference[0]?.warehouseId;
    const warehouse = resolveActiveWarehouse(preferredId, fallback);
    return { warehouseId: warehouse?.id ?? null, warehouse: warehouse ? { id: warehouse.id, name: warehouse.name, code: warehouse.code, isDefault: warehouse.isDefault } : null };
  }),

  setActive: adminProcedure.input(z.object({ warehouseId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (ctx.user.companyId === null) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aucune entreprise active n’est associée à ce compte." });
    const warehouse = await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
    const current = (await db.select().from(userWarehousePreferences).where(and(eq(userWarehousePreferences.userId, ctx.user.id), eq(userWarehousePreferences.companyId, ctx.user.companyId))).limit(1))[0];
    if (current) await db.update(userWarehousePreferences).set({ warehouseId: warehouse.id }).where(eq(userWarehousePreferences.id, current.id));
    else await db.insert(userWarehousePreferences).values({ userId: ctx.user.id, companyId: ctx.user.companyId, warehouseId: warehouse.id });
    await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Entrepôt actif modifié", entityType: "Préférence utilisateur", entityId: String(warehouse.id), detail: `Entrepôt actif défini sur ${warehouse.name} (${warehouse.code}).` });
    return { success: true, warehouseId: warehouse.id };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const assignedIds = await assignedWarehouseIds(db, ctx.user);
    const scope = assignedIds === null ? companyScope(warehouses.companyId, ctx.user.companyId) : assignedIds.length ? and(companyScope(warehouses.companyId, ctx.user.companyId), inArray(warehouses.id, assignedIds)) : and(companyScope(warehouses.companyId, ctx.user.companyId), sql`1 = 0`);
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
      .where(scope)
      .groupBy(warehouses.id, warehouses.name, warehouses.code, warehouses.address, warehouses.active, warehouses.isDefault, warehouses.createdAt, warehouses.updatedAt)
      .orderBy(asc(warehouses.isDefault), asc(warehouses.name));
    return rows.sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name));
  }),

  stocks: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const warehouse = await assertSellerWarehouseAccess(db, ctx.user, input.warehouseId);
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

  managerAlerts: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    if (ctx.user.companyId === null) return [];
    let warehouseIds: number[] | null = null;
    if (ctx.user.role === "seller") {
      const roles = await db.select({ warehouseId: sellerWarehouseAssignments.warehouseId }).from(sellerWarehouseAssignments).where(and(companyScope(sellerWarehouseAssignments.companyId, ctx.user.companyId), eq(sellerWarehouseAssignments.sellerUserId, ctx.user.id), eq(sellerWarehouseAssignments.warehouseRole, "manager")));
      warehouseIds = roles.map(role => role.warehouseId);
      if (!warehouseIds.length) return [];
    }
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
    const scope = warehouseIds ? and(companyScope(warehouseStockAlerts.companyId, ctx.user.companyId), inArray(warehouseStockAlerts.warehouseId, warehouseIds), sql`(${warehouseStockAlerts.status} = 'active' OR (${warehouseStockAlerts.status} = 'resolved' AND ${warehouseStockAlerts.updatedAt} >= ${cutoff}))`) : and(companyScope(warehouseStockAlerts.companyId, ctx.user.companyId), sql`(${warehouseStockAlerts.status} = 'active' OR (${warehouseStockAlerts.status} = 'resolved' AND ${warehouseStockAlerts.updatedAt} >= ${cutoff}))`);
    const rows = await db.select({ id: warehouseStockAlerts.id, warehouseId: warehouseStockAlerts.warehouseId, productId: warehouseStockAlerts.productId, status: warehouseStockAlerts.status, threshold: warehouseStockAlerts.threshold, observedQuantity: warehouseStockAlerts.observedQuantity, updatedAt: warehouseStockAlerts.updatedAt, warehouseName: warehouses.name, productName: products.name, productUnit: products.unit }).from(warehouseStockAlerts).innerJoin(warehouses, eq(warehouses.id, warehouseStockAlerts.warehouseId)).innerJoin(products, eq(products.id, warehouseStockAlerts.productId)).where(scope).orderBy(desc(warehouseStockAlerts.updatedAt)).limit(50);
    return rows.map(row => ({
      id: warehouseAlertNotificationId({ alertId: row.id, warehouseId: row.warehouseId, productId: row.productId, status: row.status, updatedAt: row.updatedAt }),
      title: warehouseAlertNotificationTitle(row.status),
      detail: row.status === "active" ? `${row.productName} : ${row.observedQuantity} ${row.productUnit} pour un seuil de ${row.threshold} · ${row.warehouseName}.` : `${row.productName} est repassé au-dessus du seuil dans ${row.warehouseName}.`,
      status: row.status,
      warehouseId: row.warehouseId,
    }));
  }),

  thresholds: router({
    list: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const warehouse = await assertSellerWarehouseAccess(db, ctx.user, input.warehouseId, { permission: "view_stock" });
      const [thresholds, alerts] = await Promise.all([
        db.select().from(warehouseReorderThresholds).where(and(companyScope(warehouseReorderThresholds.companyId, ctx.user.companyId), eq(warehouseReorderThresholds.warehouseId, warehouse.id))),
        db.select().from(warehouseStockAlerts).where(and(companyScope(warehouseStockAlerts.companyId, ctx.user.companyId), eq(warehouseStockAlerts.warehouseId, warehouse.id), eq(warehouseStockAlerts.status, "active"))),
      ]);
      const productsWithStock = await db.select({ productId: products.id, name: products.name, reference: products.reference, category: products.category, unit: products.unit, supplierId: products.supplierId, purchasePriceCents: products.purchasePriceCents, quantity: sql<number>`coalesce(${warehouseStocks.quantity}, 0)` }).from(products).leftJoin(warehouseStocks, and(eq(warehouseStocks.productId, products.id), eq(warehouseStocks.warehouseId, warehouse.id), companyScope(warehouseStocks.companyId, ctx.user.companyId))).where(companyScope(products.companyId, ctx.user.companyId)).orderBy(asc(products.name));
      return productsWithStock.map(product => ({ ...product, threshold: thresholds.find(item => item.productId === product.productId)?.threshold ?? 0, alert: alerts.find(item => item.productId === product.productId) ?? null }));
    }),
    set: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive(), productId: z.number().int().positive(), threshold: z.number().int().min(0).max(1_000_000) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.transaction(async tx => {
        const warehouse = await assertSellerWarehouseAccess(tx, ctx.user, input.warehouseId, { requireActive: true, permission: "manage_thresholds" });
        const product = (await tx.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), companyScope(products.companyId, ctx.user.companyId))).limit(1))[0];
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
        await tx.insert(warehouseReorderThresholds).values({ companyId: ctx.user.companyId!, warehouseId: warehouse.id, productId: product.id, threshold: input.threshold, updatedByUserId: ctx.user.id }).onDuplicateKeyUpdate({ set: { threshold: input.threshold, updatedByUserId: ctx.user.id } });
        const quantity = (await tx.select({ quantity: warehouseStocks.quantity }).from(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, ctx.user.companyId), eq(warehouseStocks.warehouseId, warehouse.id), eq(warehouseStocks.productId, product.id))).limit(1))[0]?.quantity ?? 0;
        if (input.threshold > 0 && quantity <= input.threshold) await tx.insert(warehouseStockAlerts).values({ companyId: ctx.user.companyId!, warehouseId: warehouse.id, productId: product.id, threshold: input.threshold, observedQuantity: quantity, status: "active" }).onDuplicateKeyUpdate({ set: { threshold: input.threshold, observedQuantity: quantity, status: "active", resolvedAt: null } });
        else await tx.update(warehouseStockAlerts).set({ threshold: input.threshold, observedQuantity: quantity, status: "resolved", resolvedAt: new Date() }).where(and(companyScope(warehouseStockAlerts.companyId, ctx.user.companyId), eq(warehouseStockAlerts.warehouseId, warehouse.id), eq(warehouseStockAlerts.productId, product.id), eq(warehouseStockAlerts.status, "active")));
        await audit(tx, ctx.user.companyId, ctx.user.id, "Seuil réapprovisionnement", warehouse.id, `Seuil du produit ${product.id} défini à ${input.threshold}.`);
      });
      return { success: true };
    }),
  }),

  team: router({
    list: adminProcedure.input(z.object({ warehouseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const warehouse = await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId);
      const [members, assignments] = await Promise.all([
        db.select({ id: users.id, name: users.name, email: users.email, username: sellerCredentials.username, active: users.active }).from(users).innerJoin(sellerCredentials, eq(sellerCredentials.userId, users.id)).where(and(eq(users.role, "seller"), companyScope(users.companyId, ctx.user.companyId))).orderBy(asc(users.name)),
        db.select({ sellerUserId: sellerWarehouseAssignments.sellerUserId, warehouseRole: sellerWarehouseAssignments.warehouseRole }).from(sellerWarehouseAssignments).where(and(companyScope(sellerWarehouseAssignments.companyId, ctx.user.companyId), eq(sellerWarehouseAssignments.warehouseId, warehouse.id))),
      ]);
      return members.map(member => ({ ...member, warehouseRole: assignments.find(assignment => assignment.sellerUserId === member.id)?.warehouseRole ?? null }));
    }),
    setRole: adminProcedure.input(z.object({ warehouseId: z.number().int().positive(), sellerUserId: z.number().int().positive(), warehouseRole: z.enum(["manager", "cashier", "seller"]) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.transaction(async tx => {
        const warehouse = await getScopedWarehouse(tx, ctx.user.companyId, input.warehouseId, { requireActive: true });
        const seller = (await tx.select({ id: users.id }).from(users).where(and(eq(users.id, input.sellerUserId), eq(users.role, "seller"), companyScope(users.companyId, ctx.user.companyId))).limit(1))[0];
        if (!seller) throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur opérationnel introuvable." });
        await tx.insert(sellerWarehouseAssignments).values({ companyId: ctx.user.companyId!, sellerUserId: seller.id, warehouseId: warehouse.id, warehouseRole: input.warehouseRole, createdByUserId: ctx.user.id }).onDuplicateKeyUpdate({ set: { warehouseRole: input.warehouseRole, createdByUserId: ctx.user.id } });
        await audit(tx, ctx.user.companyId, ctx.user.id, "Rôle entrepôt", warehouse.id, `Utilisateur ${seller.id} défini comme ${input.warehouseRole}.`);
      });
      return { success: true };
    }),
    remove: adminProcedure.input(z.object({ warehouseId: z.number().int().positive(), sellerUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.transaction(async tx => {
        const warehouse = await getScopedWarehouse(tx, ctx.user.companyId, input.warehouseId);
        await tx.delete(sellerWarehouseAssignments).where(and(companyScope(sellerWarehouseAssignments.companyId, ctx.user.companyId), eq(sellerWarehouseAssignments.warehouseId, warehouse.id), eq(sellerWarehouseAssignments.sellerUserId, input.sellerUserId)));
        await audit(tx, ctx.user.companyId, ctx.user.id, "Retrait rôle entrepôt", warehouse.id, `Utilisateur ${input.sellerUserId} retiré de l’équipe du dépôt.`);
      });
      return { success: true };
    }),
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
