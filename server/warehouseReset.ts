// Réinitialisation et suppression définitive d'un entrepôt.
//
// Réinitialiser remet l'entrepôt dans l'état de sa création : tout ce qui y a été fait est effacé
// (stock, lots, mouvements, inventaires, transferts, ventes, tickets, factures, devis, retours,
// paiements, dépenses, budgets, échéances, paie des agents, clôtures de caisse, bons de commande,
// seuils et alertes), et les agents rattachés uniquement à cet entrepôt sont supprimés.
// Restent : le catalogue produits et les clients (communs à l'entreprise), les comptes
// utilisateurs et leur accès à l'entrepôt, et le journal d'activité (trace de l'opération).
// Le stock total des produits est diminué du stock effacé, avec un ajustement tracé hors entrepôt.
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import {
  agentPayments, agents, auditLogs, cashClosures, expenseBudgets, expenses, inventoryItems, inventorySessions,
  paymentDueBeneficiaryGroupMembers, paymentDueBeneficiaryGroups, paymentDueOccurrences, paymentDueReminderEvents, paymentDueSchedules, paymentDueSettlements, paymentDueTemplates,
  products, purchaseOrderItems, purchaseOrders, remunerationProfiles, saleCommissions, saleItems, salePayments, saleReturnItems, saleReturns, sales,
  salesAgentWarehouseAssignments, sellerWarehouseAssignments, stockAlerts, stockLots, stockMovements, stockTransferItems, stockTransfers, supportRequests,
  userWarehousePreferences, warehouseReorderThresholds, warehouseStockAlerts, warehouseStocks, warehouses,
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
  /** Tickets, factures et devis de l'entrepôt. */
  sales: number;
  returns: number;
  expenses: number;
  agentPayments: number;
  paymentDues: number;
  cashClosures: number;
  purchaseOrders: number;
  transfers: number;
  /** Agents rattachés uniquement à cet entrepôt (supprimés). */
  agents: number;
  /** Transfert en transit : à réceptionner ou annuler d'abord (la marchandise est en route). */
  transfersInTransit: number;
};

const count = async (db: Tx, table: any, where: any) => Number((await db.select({ value: sql<number>`count(*)` }).from(table).where(where))[0]?.value ?? 0);
const involves = (warehouseId: number) => or(eq(stockTransfers.sourceWarehouseId, warehouseId), eq(stockTransfers.destinationWarehouseId, warehouseId));
const ids = (rows: Array<{ id: number }>) => rows.map(row => row.id);

/** Agents rattachés à cet entrepôt et à aucun autre, et qui n'apparaissent dans aucune vente d'un autre entrepôt. */
async function exclusiveAgentIds(db: Tx, companyId: number | null, warehouseId: number): Promise<number[]> {
  const here: Array<{ agentId: number }> = await db.select({ agentId: salesAgentWarehouseAssignments.agentId }).from(salesAgentWarehouseAssignments).where(and(companyScope(salesAgentWarehouseAssignments.companyId, companyId), eq(salesAgentWarehouseAssignments.warehouseId, warehouseId)));
  const candidates = here.map(row => row.agentId);
  if (!candidates.length) return [];
  const elsewhere: Array<{ agentId: number }> = await db.select({ agentId: salesAgentWarehouseAssignments.agentId }).from(salesAgentWarehouseAssignments).where(and(companyScope(salesAgentWarehouseAssignments.companyId, companyId), inArray(salesAgentWarehouseAssignments.agentId, candidates), ne(salesAgentWarehouseAssignments.warehouseId, warehouseId)));
  const used: Array<{ salesAgentId: number | null; cashierId: number | null }> = await db.select({ salesAgentId: sales.salesAgentId, cashierId: sales.cashierId }).from(sales).where(and(companyScope(sales.companyId, companyId), or(ne(sales.warehouseId, warehouseId), sql`${sales.warehouseId} IS NULL`), or(inArray(sales.salesAgentId, candidates), inArray(sales.cashierId, candidates))));
  const blocked = new Set([...elsewhere.map(row => row.agentId), ...used.flatMap(row => [row.salesAgentId, row.cashierId]).filter((id): id is number => id !== null)]);
  return candidates.filter(id => !blocked.has(id));
}

/** Ce que la réinitialisation effacera, affiché avant confirmation. */
export async function warehouseImpact(db: Tx, companyId: number | null, warehouseId: number): Promise<WarehouseImpact> {
  const [stock] = await db.select({ products: sql<number>`count(*)`, units: sql<number>`coalesce(sum(${warehouseStocks.quantity}), 0)` }).from(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, warehouseId), ne(warehouseStocks.quantity, 0)));
  const [lots, movements, inventories, salesCount, returns, expensesCount, payments, dues, closures, orders, transfers, transfersInTransit, agentIds] = await Promise.all([
    count(db, stockLots, and(companyScope(stockLots.companyId, companyId), eq(stockLots.warehouseId, warehouseId))),
    count(db, stockMovements, and(companyScope(stockMovements.companyId, companyId), eq(stockMovements.warehouseId, warehouseId))),
    count(db, inventorySessions, and(companyScope(inventorySessions.companyId, companyId), eq(inventorySessions.warehouseId, warehouseId))),
    count(db, sales, and(companyScope(sales.companyId, companyId), eq(sales.warehouseId, warehouseId))),
    count(db, saleReturns, and(companyScope(saleReturns.companyId, companyId), eq(saleReturns.warehouseId, warehouseId))),
    count(db, expenses, and(companyScope(expenses.companyId, companyId), eq(expenses.warehouseId, warehouseId))),
    count(db, agentPayments, and(companyScope(agentPayments.companyId, companyId), eq(agentPayments.warehouseId, warehouseId))),
    count(db, paymentDueSchedules, and(companyScope(paymentDueSchedules.companyId, companyId), eq(paymentDueSchedules.warehouseId, warehouseId))),
    count(db, cashClosures, and(companyScope(cashClosures.companyId, companyId), eq(cashClosures.warehouseId, warehouseId))),
    count(db, purchaseOrders, and(companyScope(purchaseOrders.companyId, companyId), eq(purchaseOrders.warehouseId, warehouseId))),
    count(db, stockTransfers, and(companyScope(stockTransfers.companyId, companyId), involves(warehouseId))),
    count(db, stockTransfers, and(companyScope(stockTransfers.companyId, companyId), eq(stockTransfers.status, "in_transit"), involves(warehouseId))),
    exclusiveAgentIds(db, companyId, warehouseId),
  ]);
  return { productsWithStock: Number(stock?.products ?? 0), units: Number(stock?.units ?? 0), lots, movements, inventories, sales: salesCount, returns, expenses: expensesCount, agentPayments: payments, paymentDues: dues, cashClosures: closures, purchaseOrders: orders, transfers, agents: agentIds.length, transfersInTransit };
}

export function assertNoTransferInTransit(impact: WarehouseImpact) {
  if (impact.transfersInTransit) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Un transfert en transit concerne cet entrepôt : réceptionnez-le ou annulez-le d’abord." });
}

/** Remet l'entrepôt dans l'état de sa création, dans la transaction fournie. */
export async function resetWarehouseData(tx: Tx, companyId: number | null, warehouse: Warehouse, actorUserId: number, options: { audit?: boolean } = {}): Promise<WarehouseImpact> {
  const impact = await warehouseImpact(tx, companyId, warehouse.id);
  assertNoTransferInTransit(impact);
  const id = warehouse.id;

  // 1. Stock : total des produits diminué du stock de l'entrepôt (ajustement tracé hors entrepôt).
  const stockRows: Array<{ productId: number; quantity: number }> = await tx.select({ productId: warehouseStocks.productId, quantity: warehouseStocks.quantity }).from(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, id)));
  const productIds = stockRows.filter(row => row.quantity !== 0).map(row => row.productId);
  const productRows: Array<typeof products.$inferSelect> = productIds.length ? await tx.select().from(products).where(and(inArray(products.id, productIds), companyScope(products.companyId, companyId))).for("update") : [];
  const byId = new Map(productRows.map(product => [product.id, product]));
  // Mouvements de l'entrepôt ; pour l'entrepôt principal, aussi les mouvements anciens sans entrepôt (antérieurs au multi-entrepôts) et les traces des réinitialisations précédentes.
  await tx.delete(stockMovements).where(and(companyScope(stockMovements.companyId, companyId), warehouse.isDefault ? or(eq(stockMovements.warehouseId, id), isNull(stockMovements.warehouseId)) : eq(stockMovements.warehouseId, id)));
  for (const row of stockRows) {
    const product = byId.get(row.productId);
    if (!product || row.quantity === 0) continue;
    const resulting = Math.max(0, product.quantity - row.quantity);
    await tx.update(products).set({ quantity: resulting }).where(and(eq(products.id, product.id), companyScope(products.companyId, companyId)));
    // Pas de mouvement de trace : il bloquerait la suppression du produit ; la réinitialisation figure au journal d'audit.
    if (resulting <= product.minimumQuantity) await tx.insert(stockAlerts).values({ companyId, productId: product.id, threshold: product.minimumQuantity, observedQuantity: resulting, status: "active" }).onDuplicateKeyUpdate({ set: { observedQuantity: resulting, threshold: product.minimumQuantity, status: "active", resolvedAt: null } });
  }
  await tx.delete(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, id)));
  await tx.delete(stockLots).where(and(companyScope(stockLots.companyId, companyId), eq(stockLots.warehouseId, id)));
  await tx.delete(warehouseReorderThresholds).where(and(companyScope(warehouseReorderThresholds.companyId, companyId), eq(warehouseReorderThresholds.warehouseId, id)));
  await tx.delete(warehouseStockAlerts).where(and(companyScope(warehouseStockAlerts.companyId, companyId), eq(warehouseStockAlerts.warehouseId, id)));
  const sessionIds = ids(await tx.select({ id: inventorySessions.id }).from(inventorySessions).where(and(companyScope(inventorySessions.companyId, companyId), eq(inventorySessions.warehouseId, id))));
  if (sessionIds.length) { await tx.delete(inventoryItems).where(inArray(inventoryItems.inventorySessionId, sessionIds)); await tx.delete(inventorySessions).where(and(companyScope(inventorySessions.companyId, companyId), inArray(inventorySessions.id, sessionIds))); }
  const transferIds = ids(await tx.select({ id: stockTransfers.id }).from(stockTransfers).where(and(companyScope(stockTransfers.companyId, companyId), involves(id))));
  if (transferIds.length) { await tx.delete(stockTransferItems).where(inArray(stockTransferItems.stockTransferId, transferIds)); await tx.delete(stockTransfers).where(and(companyScope(stockTransfers.companyId, companyId), inArray(stockTransfers.id, transferIds))); }

  // 2. Ventes (tickets, factures, devis) avec leurs lignes, paiements, commissions et retours.
  const saleIds = ids(await tx.select({ id: sales.id }).from(sales).where(and(companyScope(sales.companyId, companyId), eq(sales.warehouseId, id))));
  const returnIds = ids(await tx.select({ id: saleReturns.id }).from(saleReturns).where(and(companyScope(saleReturns.companyId, companyId), saleIds.length ? or(eq(saleReturns.warehouseId, id), inArray(saleReturns.saleId, saleIds)) : eq(saleReturns.warehouseId, id))));
  if (returnIds.length) { await tx.delete(saleReturnItems).where(inArray(saleReturnItems.returnId, returnIds)); await tx.delete(saleReturns).where(and(companyScope(saleReturns.companyId, companyId), inArray(saleReturns.id, returnIds))); }
  if (saleIds.length) {
    await tx.delete(saleCommissions).where(inArray(saleCommissions.saleId, saleIds));
    await tx.delete(salePayments).where(inArray(salePayments.saleId, saleIds));
    await tx.delete(saleItems).where(inArray(saleItems.saleId, saleIds));
    await tx.delete(sales).where(and(companyScope(sales.companyId, companyId), inArray(sales.id, saleIds)));
  }

  // 3. Dépenses, budgets, échéances, paie, clôtures de caisse, bons de commande.
  const scheduleIds = ids(await tx.select({ id: paymentDueSchedules.id }).from(paymentDueSchedules).where(and(companyScope(paymentDueSchedules.companyId, companyId), eq(paymentDueSchedules.warehouseId, id))));
  const occurrenceIds = ids(await tx.select({ id: paymentDueOccurrences.id }).from(paymentDueOccurrences).where(and(companyScope(paymentDueOccurrences.companyId, companyId), scheduleIds.length ? or(eq(paymentDueOccurrences.warehouseId, id), inArray(paymentDueOccurrences.scheduleId, scheduleIds)) : eq(paymentDueOccurrences.warehouseId, id))));
  if (occurrenceIds.length) {
    await tx.delete(paymentDueReminderEvents).where(inArray(paymentDueReminderEvents.occurrenceId, occurrenceIds));
    await tx.delete(paymentDueSettlements).where(inArray(paymentDueSettlements.occurrenceId, occurrenceIds));
    await tx.delete(paymentDueOccurrences).where(and(companyScope(paymentDueOccurrences.companyId, companyId), inArray(paymentDueOccurrences.id, occurrenceIds)));
  }
  if (scheduleIds.length) await tx.delete(paymentDueSchedules).where(and(companyScope(paymentDueSchedules.companyId, companyId), inArray(paymentDueSchedules.id, scheduleIds)));
  await tx.delete(paymentDueTemplates).where(and(companyScope(paymentDueTemplates.companyId, companyId), eq(paymentDueTemplates.warehouseId, id)));
  const groupIds = ids(await tx.select({ id: paymentDueBeneficiaryGroups.id }).from(paymentDueBeneficiaryGroups).where(and(companyScope(paymentDueBeneficiaryGroups.companyId, companyId), eq(paymentDueBeneficiaryGroups.warehouseId, id))));
  if (groupIds.length) { await tx.delete(paymentDueBeneficiaryGroupMembers).where(inArray(paymentDueBeneficiaryGroupMembers.groupId, groupIds)); await tx.delete(paymentDueBeneficiaryGroups).where(and(companyScope(paymentDueBeneficiaryGroups.companyId, companyId), inArray(paymentDueBeneficiaryGroups.id, groupIds))); }
  await tx.delete(expenses).where(and(companyScope(expenses.companyId, companyId), eq(expenses.warehouseId, id)));
  await tx.delete(expenseBudgets).where(and(companyScope(expenseBudgets.companyId, companyId), eq(expenseBudgets.warehouseId, id)));
  await tx.delete(agentPayments).where(and(companyScope(agentPayments.companyId, companyId), eq(agentPayments.warehouseId, id)));
  await tx.delete(cashClosures).where(and(companyScope(cashClosures.companyId, companyId), eq(cashClosures.warehouseId, id)));
  const orderIds = ids(await tx.select({ id: purchaseOrders.id }).from(purchaseOrders).where(and(companyScope(purchaseOrders.companyId, companyId), eq(purchaseOrders.warehouseId, id))));
  if (orderIds.length) { await tx.delete(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, orderIds)); await tx.delete(purchaseOrders).where(and(companyScope(purchaseOrders.companyId, companyId), inArray(purchaseOrders.id, orderIds))); }

  // 4. Agents rattachés uniquement à cet entrepôt (avec leur rémunération et leurs paiements restants).
  const agentIds = await exclusiveAgentIds(tx, companyId, id);
  await tx.delete(salesAgentWarehouseAssignments).where(and(companyScope(salesAgentWarehouseAssignments.companyId, companyId), eq(salesAgentWarehouseAssignments.warehouseId, id)));
  if (agentIds.length) {
    await tx.delete(saleCommissions).where(and(eq(saleCommissions.beneficiaryType, "agent"), inArray(saleCommissions.beneficiaryId, agentIds)));
    await tx.delete(agentPayments).where(and(companyScope(agentPayments.companyId, companyId), eq(agentPayments.beneficiaryType, "agent"), inArray(agentPayments.beneficiaryId, agentIds)));
    await tx.delete(remunerationProfiles).where(and(companyScope(remunerationProfiles.companyId, companyId), eq(remunerationProfiles.beneficiaryType, "agent"), inArray(remunerationProfiles.beneficiaryId, agentIds)));
    await tx.delete(paymentDueBeneficiaryGroupMembers).where(and(eq(paymentDueBeneficiaryGroupMembers.beneficiaryType, "agent"), inArray(paymentDueBeneficiaryGroupMembers.beneficiaryId, agentIds)));
    await tx.delete(agents).where(and(companyScope(agents.companyId, companyId), inArray(agents.id, agentIds)));
  }

  if (options.audit !== false) await tx.insert(auditLogs).values({ companyId, actorUserId, action: "Réinitialisation", entityType: "Entrepôt", entityId: String(id), detail: `Entrepôt ${warehouse.name} remis à zéro : ${impact.units} unité(s) de stock, ${impact.sales} vente(s), ${impact.returns} retour(s), ${impact.expenses} dépense(s), ${impact.agentPayments} paiement(s) d’agents, ${impact.paymentDues} échéancier(s), ${impact.cashClosures} clôture(s) de caisse, ${impact.purchaseOrders} bon(s) de commande, ${impact.transfers} transfert(s), ${impact.inventories} inventaire(s), ${impact.agents} agent(s) supprimés` });
  return impact;
}

/** Suppression définitive : remise à zéro complète, puis suppression de l'entrepôt et de ses réglages. */
export async function removeWarehouse(tx: Tx, companyId: number | null, warehouse: Warehouse, actorUserId: number): Promise<WarehouseImpact> {
  if (warehouse.isDefault) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "L’entrepôt principal ne peut pas être supprimé : désignez d’abord un autre entrepôt principal." });
  const impact = await resetWarehouseData(tx, companyId, warehouse, actorUserId, { audit: false });
  const id = warehouse.id;
  await tx.delete(sellerWarehouseAssignments).where(and(companyScope(sellerWarehouseAssignments.companyId, companyId), eq(sellerWarehouseAssignments.warehouseId, id)));
  await tx.delete(userWarehousePreferences).where(and(companyScope(userWarehousePreferences.companyId, companyId), eq(userWarehousePreferences.warehouseId, id)));
  await tx.update(supportRequests).set({ warehouseId: null }).where(and(companyScope(supportRequests.companyId, companyId), eq(supportRequests.warehouseId, id)));
  await tx.delete(warehouses).where(and(eq(warehouses.id, id), companyScope(warehouses.companyId, companyId)));
  await tx.insert(auditLogs).values({ companyId, actorUserId, action: "Suppression", entityType: "Entrepôt", entityId: String(id), detail: `Entrepôt ${warehouse.name} supprimé définitivement avec toutes ses données : ${impact.units} unité(s) de stock, ${impact.sales} vente(s), ${impact.expenses} dépense(s), ${impact.agentPayments} paiement(s) d’agents, ${impact.paymentDues} échéancier(s), ${impact.cashClosures} clôture(s) de caisse, ${impact.agents} agent(s)` });
  return impact;
}
