import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { products, saleItems, sales, stockLots, warehouseReorderThresholds, warehouseStockAlerts, warehouseStocks, warehouses } from "../drizzle/schema";
import { companyScope } from "./companyScope";
import { classifyWarehouseAlertUrgency, normalizeCoverageDays } from "./warehouseAlertUrgency";
import { allocateFefo, weightedAverageCost } from "./lotRules";

type DbTransaction = any;

export async function getScopedWarehouse(tx: DbTransaction, companyId: number | null, warehouseId: number, options?: { requireActive?: boolean }) {
  const warehouse = (await tx.select().from(warehouses).where(and(eq(warehouses.id, warehouseId), companyScope(warehouses.companyId, companyId))).limit(1))[0];
  if (!warehouse) throw new TRPCError({ code: "NOT_FOUND", message: "Entrepôt introuvable." });
  if (options?.requireActive && !warehouse.active) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cet entrepôt est inactif." });
  return warehouse;
}

export async function getDefaultWarehouse(tx: DbTransaction, companyId: number | null) {
  const warehouse = (await tx.select().from(warehouses).where(and(companyScope(warehouses.companyId, companyId), eq(warehouses.isDefault, true), eq(warehouses.active, true))).limit(1))[0];
  if (!warehouse) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aucun entrepôt principal actif n’est configuré pour cette entreprise." });
  return warehouse;
}

export async function getScopedProduct(tx: DbTransaction, companyId: number | null, productId: number) {
  const product = (await tx.select().from(products).where(and(eq(products.id, productId), companyScope(products.companyId, companyId))).limit(1))[0];
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
  return product;
}

export async function warehouseStockQuantity(tx: DbTransaction, companyId: number | null, warehouseId: number, productId: number) {
  const row = (await tx.select({ quantity: warehouseStocks.quantity }).from(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, warehouseId), eq(warehouseStocks.productId, productId))).limit(1))[0];
  return row?.quantity ?? 0;
}

async function warehouseCoverageDays(tx: DbTransaction, companyId: number | null, warehouseId: number, productId: number, quantity: number) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const sold = (await tx.select({ quantity: sql<number>`coalesce(sum(${saleItems.quantity}), 0)` }).from(saleItems).innerJoin(sales, eq(sales.id, saleItems.saleId)).where(and(companyScope(sales.companyId, companyId), eq(sales.warehouseId, warehouseId), eq(saleItems.productId, productId), inArray(sales.status, ["paid", "partial"]), gte(sales.createdAt, since))))[0];
  return normalizeCoverageDays(quantity, Number(sold?.quantity ?? 0));
}

export async function syncWarehouseStockAlert(tx: DbTransaction, companyId: number | null, warehouseId: number, productId: number, observedQuantity?: number) {
  const quantity = observedQuantity ?? await warehouseStockQuantity(tx, companyId, warehouseId, productId);
  const thresholdRow = (await tx.select({ threshold: warehouseReorderThresholds.threshold }).from(warehouseReorderThresholds).where(and(companyScope(warehouseReorderThresholds.companyId, companyId), eq(warehouseReorderThresholds.warehouseId, warehouseId), eq(warehouseReorderThresholds.productId, productId))).limit(1))[0];
  const threshold = thresholdRow?.threshold ?? 0;
  if (threshold > 0 && quantity <= threshold) {
    const coverageDays = await warehouseCoverageDays(tx, companyId, warehouseId, productId, quantity);
    const urgency = classifyWarehouseAlertUrgency(coverageDays, quantity);
    const existing = (await tx.select({ status: warehouseStockAlerts.status }).from(warehouseStockAlerts).where(and(companyScope(warehouseStockAlerts.companyId, companyId), eq(warehouseStockAlerts.warehouseId, warehouseId), eq(warehouseStockAlerts.productId, productId))).limit(1))[0];
    const reactivated = existing?.status === "resolved";
    const update: Record<string, unknown> = { threshold, observedQuantity: quantity, coverageDays: coverageDays === null ? null : String(coverageDays), urgency, status: "active", resolvedAt: null, updatedAt: new Date() };
    if (reactivated) Object.assign(update, { triggeredAt: new Date(), acknowledgedAt: null, acknowledgedByUserId: null });
    await tx.insert(warehouseStockAlerts).values({ companyId: companyId!, warehouseId, productId, threshold, observedQuantity: quantity, coverageDays: coverageDays === null ? null : String(coverageDays), urgency, status: "active" }).onDuplicateKeyUpdate({ set: update });
  } else {
    await tx.update(warehouseStockAlerts).set({ observedQuantity: quantity, threshold, status: "resolved", resolvedAt: new Date(), updatedAt: new Date() }).where(and(companyScope(warehouseStockAlerts.companyId, companyId), eq(warehouseStockAlerts.warehouseId, warehouseId), eq(warehouseStockAlerts.productId, productId), eq(warehouseStockAlerts.status, "active")));
  }
  return { quantity, threshold, active: threshold > 0 && quantity <= threshold };
}

/** Débite le stock avec une clause conditionnelle pour bloquer les sorties concurrentes insuffisantes. */
export async function debitWarehouseStock(tx: DbTransaction, companyId: number | null, warehouseId: number, productId: number, quantity: number) {
  const lots = await tx.select().from(stockLots).where(and(companyScope(stockLots.companyId, companyId), eq(stockLots.warehouseId, warehouseId), eq(stockLots.productId, productId), gte(stockLots.quantity, 1))).orderBy(sql`${stockLots.expiryDate} IS NULL`, sql`${stockLots.expiryDate} ASC`, stockLots.receivedAt).for("update");
  const sourceStock = (await tx.select().from(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, warehouseId), eq(warehouseStocks.productId, productId))).limit(1))[0];
  const trackedQuantity = lots.reduce((sum: number, lot: { quantity: number }) => sum + lot.quantity, 0);
  const trackedToConsume = Math.min(quantity, trackedQuantity);
  const lotAllocations: Array<{ lotNumber: string; expiryDate: string | null; quantity: number; unitCostCents: number }> = [];
  if (trackedToConsume > 0) {
    const allocations = allocateFefo(lots, trackedToConsume);
    for (const allocation of allocations) {
      const lot = lots.find((candidate: { id: number }) => candidate.id === allocation.lotId);
      if (!lot) continue;
      lotAllocations.push({ lotNumber: lot.lotNumber, expiryDate: lot.expiryDate, quantity: allocation.quantity, unitCostCents: lot.unitCostCents });
      const changed = await tx.update(stockLots).set({ quantity: lot.quantity - allocation.quantity }).where(and(eq(stockLots.id, lot.id), companyScope(stockLots.companyId, companyId), gte(stockLots.quantity, allocation.quantity)));
      const lotAffected = Number((changed as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
      if (!lotAffected) throw new TRPCError({ code: "CONFLICT", message: "Un lot a changé pendant la sortie. Réessayez." });
    }
  }
  const result = await tx.update(warehouseStocks)
    .set({ quantity: sql`${warehouseStocks.quantity} - ${quantity}` })
    .where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, warehouseId), eq(warehouseStocks.productId, productId), gte(warehouseStocks.quantity, quantity)));
  const affected = Number((result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
  if (!affected) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stock insuffisant dans l’entrepôt source." });
  const resultingQuantity = await warehouseStockQuantity(tx, companyId, warehouseId, productId);
  await syncWarehouseStockAlert(tx, companyId, warehouseId, productId, resultingQuantity);
  return { previousQuantity: resultingQuantity + quantity, resultingQuantity, lotAllocations, unitCostCents: Number(sourceStock?.averageCostCents ?? 0) };
}

/** Crédit atomiquement une ligne de stock, en la créant au besoin. */
export async function creditWarehouseStock(tx: DbTransaction, companyId: number | null, warehouseId: number, productId: number, quantity: number, unitCostCents?: number) {
  await tx.select({ id: products.id }).from(products).where(and(eq(products.id, productId), companyScope(products.companyId, companyId))).limit(1).for("update");
  const current = (await tx.select({ quantity: warehouseStocks.quantity, averageCostCents: warehouseStocks.averageCostCents }).from(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, warehouseId), eq(warehouseStocks.productId, productId))).limit(1))[0];
  const averageCostCents = unitCostCents === undefined ? current?.averageCostCents ?? 0 : weightedAverageCost(current?.quantity ?? 0, current?.averageCostCents ?? 0, quantity, unitCostCents);
  await tx.insert(warehouseStocks).values({ companyId, warehouseId, productId, quantity, averageCostCents })
    .onDuplicateKeyUpdate({ set: { quantity: sql`${warehouseStocks.quantity} + ${quantity}`, averageCostCents } });
  const resultingQuantity = await warehouseStockQuantity(tx, companyId, warehouseId, productId);
  await syncWarehouseStockAlert(tx, companyId, warehouseId, productId, resultingQuantity);
  return { previousQuantity: resultingQuantity - quantity, resultingQuantity };
}

export function transferNumber() {
  return `TRF-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
