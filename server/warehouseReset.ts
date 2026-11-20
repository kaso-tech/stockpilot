// Réinitialisation et suppression définitive d'un entrepôt.
// Réinitialiser efface toutes les données de stock propres à l'entrepôt : stock par produit,
// lots, seuils, alertes, inventaires, historique des mouvements et transferts en brouillon.
// Le stock total des produits est diminué d'autant, avec un ajustement tracé hors entrepôt.
// Les documents commerciaux et comptables (ventes, retours, dépenses, clôtures…) ne sont
// jamais effacés : la numérotation et la comptabilité restent intactes.
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import {
  agentPayments, auditLogs, cashClosures, expenseBudgets, expenses, inventoryItems, inventorySessions, paymentDueBeneficiaryGroups, paymentDueOccurrences, paymentDueSchedules, paymentDueTemplates, products, purchaseOrders, saleReturns, sales, salesAgentWarehouseAssignments, sellerWarehouseAssignments, stockAlerts, stockLots, stockMovements, stockTransferItems, stockTransfers, supportRequests, userWarehousePreferences, warehouseReorderThresholds, warehouseStockAlerts, warehouseStocks, warehouses,
} from "../drizzle/schema";
import { companyScope } from "./companyScope";

type Tx = any;
type Warehouse = typeof warehouses.$inferSelect;

export type WarehouseImpact = {
  productsWithStock: number;
  units: number;
  lots: number;
  movements: number;
  inventories: number;
  /** Documents conservés, détachés de l'entrepôt s'il est supprimé. */
  sales: number;
  expenses: number;
  /** Ce qui empêche la suppression définitive (la réinitialisation reste possible). */
  removalBlockers: string[];
  /** Transfert en transit : ni réinitialisation ni suppression tant qu'il n'est pas reçu ou annulé. */
  transfersInTransit: number;
};

const count = async (db: Tx, table: any, where: any) => Number((await db.select({ value: sql<number>`count(*)` }).from(table).where(where))[0]?.value ?? 0);
const involves = (warehouseId: number) => or(eq(stockTransfers.sourceWarehouseId, warehouseId), eq(stockTransfers.destinationWarehouseId, warehouseId));

/** Ce que la réinitialisation ou la suppression toucheront, affiché avant confirmation. */
export async function warehouseImpact(db: Tx, companyId: number | null, warehouseId: number): Promise<WarehouseImpact> {
  const [stock] = await db.select({ products: sql<number>`count(*)`, units: sql<number>`coalesce(sum(${warehouseStocks.quantity}), 0)` }).from(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, warehouseId), ne(warehouseStocks.quantity, 0)));
  const [lots, movements, inventories, salesCount, expensesCount, returnsCount, closuresCount, transfersInTransit] = await Promise.all([
    count(db, stockLots, and(companyScope(stockLots.companyId, companyId), eq(stockLots.warehouseId, warehouseId))),
    count(db, stockMovements, and(companyScope(stockMovements.companyId, companyId), eq(stockMovements.warehouseId, warehouseId))),
    count(db, inventorySessions, and(companyScope(inventorySessions.companyId, companyId), eq(inventorySessions.warehouseId, warehouseId))),
    count(db, sales, and(companyScope(sales.companyId, companyId), eq(sales.warehouseId, warehouseId))),
    count(db, expenses, and(companyScope(expenses.companyId, companyId), eq(expenses.warehouseId, warehouseId))),
    count(db, saleReturns, and(companyScope(saleReturns.companyId, companyId), eq(saleReturns.warehouseId, warehouseId))),
    count(db, cashClosures, and(companyScope(cashClosures.companyId, companyId), eq(cashClosures.warehouseId, warehouseId))),
    count(db, stockTransfers, and(companyScope(stockTransfers.companyId, companyId), eq(stockTransfers.status, "in_transit"), involves(warehouseId))),
  ]);
  const removalBlockers: string[] = [];
  if (returnsCount) removalBlockers.push(`${returnsCount} retour(s) client enregistré(s) dans cet entrepôt`);
  if (closuresCount) removalBlockers.push(`${closuresCount} clôture(s) de caisse de cet entrepôt`);
  return { productsWithStock: Number(stock?.products ?? 0), units: Number(stock?.units ?? 0), lots, movements, inventories, sales: salesCount, expenses: expensesCount, removalBlockers, transfersInTransit };
}

export function assertNoTransferInTransit(impact: WarehouseImpact) {
  if (impact.transfersInTransit) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Un transfert en transit concerne cet entrepôt : réceptionnez-le ou annulez-le d’abord." });
}

/** Vide l'entrepôt de toutes ses données de stock, dans la transaction fournie. */
export async function resetWarehouseData(tx: Tx, companyId: number | null, warehouse: Warehouse, actorUserId: number, options: { audit?: boolean } = {}): Promise<WarehouseImpact> {
  const impact = await warehouseImpact(tx, companyId, warehouse.id);
  assertNoTransferInTransit(impact);
  const stockRows: Array<{ productId: number; quantity: number }> = await tx.select({ productId: warehouseStocks.productId, quantity: warehouseStocks.quantity }).from(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, warehouse.id)));
  const productIds = stockRows.filter(row => row.quantity !== 0).map(row => row.productId);
  const productRows: Array<typeof products.$inferSelect> = productIds.length ? await tx.select().from(products).where(and(inArray(products.id, productIds), companyScope(products.companyId, companyId))).for("update") : [];
  const byId = new Map(productRows.map(product => [product.id, product]));

  // 1. Historique du dépôt, puis stock total de chaque produit diminué d'autant (ajustement tracé hors entrepôt).
  await tx.delete(stockMovements).where(and(companyScope(stockMovements.companyId, companyId), eq(stockMovements.warehouseId, warehouse.id)));
  for (const row of stockRows) {
    const product = byId.get(row.productId);
    if (!product || row.quantity === 0) continue;
    const resulting = Math.max(0, product.quantity - row.quantity);
    const delta = resulting - product.quantity;
    await tx.update(products).set({ quantity: resulting }).where(and(eq(products.id, product.id), companyScope(products.companyId, companyId)));
    if (delta !== 0) await tx.insert(stockMovements).values({ companyId, productId: product.id, warehouseId: null, type: "adjustment", quantity: delta, previousQuantity: product.quantity, resultingQuantity: resulting, reason: `Réinitialisation de l’entrepôt ${warehouse.name}`, createdByUserId: actorUserId });
    if (resulting <= product.minimumQuantity) await tx.insert(stockAlerts).values({ companyId, productId: product.id, threshold: product.minimumQuantity, observedQuantity: resulting, status: "active" }).onDuplicateKeyUpdate({ set: { observedQuantity: resulting, threshold: product.minimumQuantity, status: "active", resolvedAt: null } });
  }

  // 2. Stock, lots, seuils, alertes et inventaires de l'entrepôt ; transferts encore en brouillon.
  await tx.delete(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, warehouse.id)));
  await tx.delete(stockLots).where(and(companyScope(stockLots.companyId, companyId), eq(stockLots.warehouseId, warehouse.id)));
  await tx.delete(warehouseReorderThresholds).where(and(companyScope(warehouseReorderThresholds.companyId, companyId), eq(warehouseReorderThresholds.warehouseId, warehouse.id)));
  await tx.delete(warehouseStockAlerts).where(and(companyScope(warehouseStockAlerts.companyId, companyId), eq(warehouseStockAlerts.warehouseId, warehouse.id)));
  const sessions: Array<{ id: number }> = await tx.select({ id: inventorySessions.id }).from(inventorySessions).where(and(companyScope(inventorySessions.companyId, companyId), eq(inventorySessions.warehouseId, warehouse.id)));
  if (sessions.length) {
    const ids = sessions.map(session => session.id);
    await tx.delete(inventoryItems).where(inArray(inventoryItems.inventorySessionId, ids));
    await tx.delete(inventorySessions).where(and(companyScope(inventorySessions.companyId, companyId), inArray(inventorySessions.id, ids)));
  }
  await deleteTransfers(tx, companyId, warehouse.id, "draft");

  if (options.audit !== false) await tx.insert(auditLogs).values({ companyId, actorUserId, action: "Réinitialisation", entityType: "Entrepôt", entityId: String(warehouse.id), detail: `Entrepôt ${warehouse.name} réinitialisé : ${impact.units} unité(s) de ${impact.productsWithStock} produit(s), ${impact.lots} lot(s), ${impact.movements} mouvement(s) et ${impact.inventories} inventaire(s) supprimés` });
  return impact;
}

async function deleteTransfers(tx: Tx, companyId: number | null, warehouseId: number, onlyStatus?: "draft") {
  const rows: Array<{ id: number }> = await tx.select({ id: stockTransfers.id }).from(stockTransfers).where(and(companyScope(stockTransfers.companyId, companyId), involves(warehouseId), onlyStatus ? eq(stockTransfers.status, onlyStatus) : ne(stockTransfers.status, "in_transit")));
  if (!rows.length) return;
  const ids = rows.map(row => row.id);
  await tx.delete(stockTransferItems).where(inArray(stockTransferItems.stockTransferId, ids));
  await tx.delete(stockTransfers).where(and(companyScope(stockTransfers.companyId, companyId), inArray(stockTransfers.id, ids)));
}

/**
 * Suppression définitive : réinitialisation, puis effacement des réglages propres à
 * l'entrepôt. Les documents commerciaux sont conservés et détachés de l'entrepôt.
 */
export async function removeWarehouse(tx: Tx, companyId: number | null, warehouse: Warehouse, actorUserId: number): Promise<WarehouseImpact> {
  if (warehouse.isDefault) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "L’entrepôt principal ne peut pas être supprimé : désignez d’abord un autre entrepôt principal." });
  const before = await warehouseImpact(tx, companyId, warehouse.id);
  assertNoTransferInTransit(before);
  if (before.removalBlockers.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Suppression impossible : ${before.removalBlockers.join(" et ")}. Ces pièces comptables doivent être conservées ; réinitialisez puis désactivez l’entrepôt.` });
  const impact = await resetWarehouseData(tx, companyId, warehouse, actorUserId, { audit: false });
  await deleteTransfers(tx, companyId, warehouse.id);
  const id = warehouse.id;
  await tx.delete(sellerWarehouseAssignments).where(and(companyScope(sellerWarehouseAssignments.companyId, companyId), eq(sellerWarehouseAssignments.warehouseId, id)));
  await tx.delete(salesAgentWarehouseAssignments).where(and(companyScope(salesAgentWarehouseAssignments.companyId, companyId), eq(salesAgentWarehouseAssignments.warehouseId, id)));
  await tx.delete(userWarehousePreferences).where(and(companyScope(userWarehousePreferences.companyId, companyId), eq(userWarehousePreferences.warehouseId, id)));
  await tx.delete(expenseBudgets).where(and(companyScope(expenseBudgets.companyId, companyId), eq(expenseBudgets.warehouseId, id)));
  for (const table of [sales, expenses, purchaseOrders, agentPayments, supportRequests, paymentDueSchedules, paymentDueTemplates, paymentDueBeneficiaryGroups, paymentDueOccurrences] as any[])
    await tx.update(table).set({ warehouseId: null }).where(and(companyScope(table.companyId, companyId), eq(table.warehouseId, id)));
  await tx.delete(warehouses).where(and(eq(warehouses.id, id), companyScope(warehouses.companyId, companyId)));
  await tx.insert(auditLogs).values({ companyId, actorUserId, action: "Suppression", entityType: "Entrepôt", entityId: String(id), detail: `Entrepôt ${warehouse.name} supprimé définitivement : ${impact.units} unité(s) de ${impact.productsWithStock} produit(s), ${impact.lots} lot(s), ${impact.movements} mouvement(s) et ${impact.inventories} inventaire(s) effacés${impact.sales ? ` · ${impact.sales} vente(s) conservée(s) sans entrepôt` : ""}` });
  return impact;
}
