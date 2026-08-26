import { and, desc, eq, inArray, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auditLogs, stockMovements, stockTransferItems, stockTransfers, warehouses } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { companyScope } from "../companyScope";
import { creditWarehouseStock, debitWarehouseStock, getScopedProduct, getScopedWarehouse, transferNumber } from "../warehouseStock";
import { assertSellerWarehouseAccess } from "../sellerWarehouseAccess";
import { assignedWarehouseIds } from "../sellerWarehouseAccess";

const transferLineInput = z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive().max(1_000_000) });

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

async function findTransfer(tx: any, companyId: number | null, id: number) {
  const transfer = (await tx.select().from(stockTransfers).where(and(eq(stockTransfers.id, id), companyScope(stockTransfers.companyId, companyId))).limit(1))[0];
  if (!transfer) throw new TRPCError({ code: "NOT_FOUND", message: "Transfert introuvable." });
  return transfer;
}

async function transferLines(tx: any, transferId: number) {
  const lines = await tx.select().from(stockTransferItems).where(eq(stockTransferItems.stockTransferId, transferId));
  if (!lines.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce transfert ne contient aucune ligne." });
  return lines;
}

async function audit(tx: any, companyId: number | null, actorUserId: number, action: string, transferId: number, detail: string) {
  await tx.insert(auditLogs).values({ companyId, actorUserId, action, entityType: "Transfert de stock", entityId: String(transferId), detail });
}

function affectedRows(result: unknown) {
  return Number((result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
}

export const stockTransfersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const allowedWarehouseIds = await assignedWarehouseIds(db, ctx.user);
    const scope = allowedWarehouseIds === null ? companyScope(stockTransfers.companyId, ctx.user.companyId) : allowedWarehouseIds.length ? and(companyScope(stockTransfers.companyId, ctx.user.companyId), or(inArray(stockTransfers.sourceWarehouseId, allowedWarehouseIds), inArray(stockTransfers.destinationWarehouseId, allowedWarehouseIds))) : and(companyScope(stockTransfers.companyId, ctx.user.companyId), eq(stockTransfers.id, 0));
    const transfers = await db.select().from(stockTransfers).where(scope).orderBy(desc(stockTransfers.createdAt)).limit(200);
    if (!transfers.length) return [];
    const [warehouseRows, lineRows] = await Promise.all([
      db.select().from(warehouses).where(companyScope(warehouses.companyId, ctx.user.companyId)),
      db.select().from(stockTransferItems).where(inArray(stockTransferItems.stockTransferId, transfers.map(transfer => transfer.id))),
    ]);
    return transfers.map(transfer => ({
      ...transfer,
      sourceWarehouse: warehouseRows.find(warehouse => warehouse.id === transfer.sourceWarehouseId) ?? null,
      destinationWarehouse: warehouseRows.find(warehouse => warehouse.id === transfer.destinationWarehouseId) ?? null,
      items: lineRows.filter(line => line.stockTransferId === transfer.id),
    }));
  }),

  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const transfer = await findTransfer(db, ctx.user.companyId, input.id);
    await Promise.any([
      assertSellerWarehouseAccess(db, ctx.user, transfer.sourceWarehouseId, { permission: "view_stock" }),
      assertSellerWarehouseAccess(db, ctx.user, transfer.destinationWarehouseId, { permission: "view_stock" }),
    ]).catch(() => { throw new TRPCError({ code: "FORBIDDEN", message: "Ce transfert ne concerne aucun de vos entrepôts." }); });
    const [sourceWarehouse, destinationWarehouse, items] = await Promise.all([
      getScopedWarehouse(db, ctx.user.companyId, transfer.sourceWarehouseId),
      getScopedWarehouse(db, ctx.user.companyId, transfer.destinationWarehouseId),
      transferLines(db, transfer.id),
    ]);
    return { ...transfer, sourceWarehouse, destinationWarehouse, items };
  }),

  create: protectedProcedure.input(z.object({
    sourceWarehouseId: z.number().int().positive(),
    destinationWarehouseId: z.number().int().positive(),
    notes: z.string().trim().max(2000).nullable().optional(),
    items: z.array(transferLineInput).min(1).max(100),
  })).mutation(async ({ ctx, input }) => {
    if (input.sourceWarehouseId === input.destinationWarehouseId) throw new TRPCError({ code: "BAD_REQUEST", message: "La source et la destination doivent être différentes." });
    if (new Set(input.items.map(item => item.productId)).size !== input.items.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Un produit ne peut apparaître qu’une fois dans un transfert." });
    const db = await dbOrThrow();
    const created = await db.transaction(async tx => {
      const [sourceWarehouse, destinationWarehouse] = await Promise.all([
        assertSellerWarehouseAccess(tx, ctx.user, input.sourceWarehouseId, { requireActive: true, permission: "manage_transfers" }),
        assertSellerWarehouseAccess(tx, ctx.user, input.destinationWarehouseId, { requireActive: true, permission: "view_stock" }),
      ]);
      const products = await Promise.all(input.items.map(item => getScopedProduct(tx, ctx.user.companyId, item.productId)));
      const number = transferNumber();
      const result = await tx.insert(stockTransfers).values({ companyId: ctx.user.companyId, transferNumber: number, sourceWarehouseId: sourceWarehouse.id, destinationWarehouseId: destinationWarehouse.id, notes: input.notes?.trim() || null, createdByUserId: ctx.user.id });
      const id = Number(result[0].insertId);
      await tx.insert(stockTransferItems).values(input.items.map(item => {
        const product = products.find(value => value.id === item.productId)!;
        return { stockTransferId: id, productId: product.id, productName: product.name, productReference: product.reference, unit: product.unit, quantity: item.quantity };
      }));
      await audit(tx, ctx.user.companyId, ctx.user.id, "Création", id, `${number} créé de ${sourceWarehouse.name} vers ${destinationWarehouse.name}.`);
      return { id, transferNumber: number };
    });
    return { success: true, ...created };
  }),

  dispatch: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.transaction(async tx => {
      const transfer = await findTransfer(tx, ctx.user.companyId, input.id);
      if (transfer.status === "in_transit") return { success: true, alreadyDispatched: true, status: "in_transit" as const };
      if (transfer.status !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seul un transfert brouillon peut être expédié." });
      const [sourceWarehouse, destinationWarehouse, items] = await Promise.all([
        assertSellerWarehouseAccess(tx, ctx.user, transfer.sourceWarehouseId, { requireActive: true, permission: "manage_transfers" }),
        assertSellerWarehouseAccess(tx, ctx.user, transfer.destinationWarehouseId, { requireActive: true, permission: "view_stock" }),
        transferLines(tx, transfer.id),
      ]);
      const lock = await tx.update(stockTransfers).set({ status: "in_transit", dispatchedAt: new Date(), dispatchedByUserId: ctx.user.id }).where(and(eq(stockTransfers.id, transfer.id), companyScope(stockTransfers.companyId, ctx.user.companyId), eq(stockTransfers.status, "draft")));
      if (!affectedRows(lock)) throw new TRPCError({ code: "CONFLICT", message: "Ce transfert a été modifié. Actualisez la page avant de poursuivre." });
      for (const item of items) {
        const product = await getScopedProduct(tx, ctx.user.companyId, item.productId);
        const movement = await debitWarehouseStock(tx, ctx.user.companyId, sourceWarehouse.id, product.id, item.quantity);
        await tx.insert(stockMovements).values({ companyId: ctx.user.companyId, productId: product.id, warehouseId: sourceWarehouse.id, type: "exit", quantity: -item.quantity, previousQuantity: movement.previousQuantity, resultingQuantity: movement.resultingQuantity, reason: `Expédition transfert ${transfer.transferNumber} vers ${destinationWarehouse.code}`, createdByUserId: ctx.user.id });
      }
      await audit(tx, ctx.user.companyId, ctx.user.id, "Expédition", transfer.id, `${transfer.transferNumber} expédié de ${sourceWarehouse.name} vers ${destinationWarehouse.name}.`);
      return { success: true, alreadyDispatched: false, status: "in_transit" as const };
    });
  }),

  receive: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.transaction(async tx => {
      const transfer = await findTransfer(tx, ctx.user.companyId, input.id);
      if (transfer.status === "received") return { success: true, alreadyReceived: true, status: "received" as const };
      if (transfer.status !== "in_transit") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seul un transfert en transit peut être réceptionné." });
      const [sourceWarehouse, destinationWarehouse, items] = await Promise.all([
        assertSellerWarehouseAccess(tx, ctx.user, transfer.sourceWarehouseId, { permission: "view_stock" }),
        assertSellerWarehouseAccess(tx, ctx.user, transfer.destinationWarehouseId, { requireActive: true, permission: "manage_transfers" }),
        transferLines(tx, transfer.id),
      ]);
      const lock = await tx.update(stockTransfers).set({ status: "received", receivedAt: new Date(), receivedByUserId: ctx.user.id }).where(and(eq(stockTransfers.id, transfer.id), companyScope(stockTransfers.companyId, ctx.user.companyId), eq(stockTransfers.status, "in_transit")));
      if (!affectedRows(lock)) throw new TRPCError({ code: "CONFLICT", message: "Ce transfert a été modifié. Actualisez la page avant de poursuivre." });
      for (const item of items) {
        const product = await getScopedProduct(tx, ctx.user.companyId, item.productId);
        const movement = await creditWarehouseStock(tx, ctx.user.companyId, destinationWarehouse.id, product.id, item.quantity);
        await tx.insert(stockMovements).values({ companyId: ctx.user.companyId, productId: product.id, warehouseId: destinationWarehouse.id, type: "entry", quantity: item.quantity, previousQuantity: movement.previousQuantity, resultingQuantity: movement.resultingQuantity, reason: `Réception transfert ${transfer.transferNumber} depuis ${sourceWarehouse.code}`, createdByUserId: ctx.user.id });
      }
      await audit(tx, ctx.user.companyId, ctx.user.id, "Réception", transfer.id, `${transfer.transferNumber} réceptionné dans ${destinationWarehouse.name}.`);
      return { success: true, alreadyReceived: false, status: "received" as const };
    });
  }),

  cancel: protectedProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.transaction(async tx => {
      const transfer = await findTransfer(tx, ctx.user.companyId, input.id);
      if (transfer.status === "cancelled") return { success: true, alreadyCancelled: true, status: "cancelled" as const };
      if (transfer.status === "received") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Un transfert réceptionné ne peut pas être annulé." });
      const wasInTransit = transfer.status === "in_transit";
      const lock = await tx.update(stockTransfers).set({ status: "cancelled", cancellationReason: input.reason, cancelledAt: new Date(), cancelledByUserId: ctx.user.id }).where(and(eq(stockTransfers.id, transfer.id), companyScope(stockTransfers.companyId, ctx.user.companyId), eq(stockTransfers.status, transfer.status)));
      if (!affectedRows(lock)) throw new TRPCError({ code: "CONFLICT", message: "Ce transfert a été modifié. Actualisez la page avant de poursuivre." });
      const sourceWarehouse = await assertSellerWarehouseAccess(tx, ctx.user, transfer.sourceWarehouseId, { permission: "manage_transfers" });
      if (wasInTransit) {
        const items = await transferLines(tx, transfer.id);
        for (const item of items) {
          const product = await getScopedProduct(tx, ctx.user.companyId, item.productId);
          const movement = await creditWarehouseStock(tx, ctx.user.companyId, sourceWarehouse.id, product.id, item.quantity);
          await tx.insert(stockMovements).values({ companyId: ctx.user.companyId, productId: product.id, warehouseId: sourceWarehouse.id, type: "entry", quantity: item.quantity, previousQuantity: movement.previousQuantity, resultingQuantity: movement.resultingQuantity, reason: `Annulation transfert ${transfer.transferNumber}`, createdByUserId: ctx.user.id });
        }
      }
      await audit(tx, ctx.user.companyId, ctx.user.id, "Annulation", transfer.id, `${transfer.transferNumber} annulé : ${input.reason}`);
      return { success: true, alreadyCancelled: false, status: "cancelled" as const };
    });
  }),
});
