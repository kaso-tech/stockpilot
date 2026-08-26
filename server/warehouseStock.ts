import { and, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { products, warehouseReorderThresholds, warehouseStockAlerts, warehouseStocks, warehouses } from "../drizzle/schema";
import { companyScope } from "./companyScope";

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

export async function syncWarehouseStockAlert(tx: DbTransaction, companyId: number | null, warehouseId: number, productId: number, observedQuantity?: number) {
  const quantity = observedQuantity ?? await warehouseStockQuantity(tx, companyId, warehouseId, productId);
  const thresholdRow = (await tx.select({ threshold: warehouseReorderThresholds.threshold }).from(warehouseReorderThresholds).where(and(companyScope(warehouseReorderThresholds.companyId, companyId), eq(warehouseReorderThresholds.warehouseId, warehouseId), eq(warehouseReorderThresholds.productId, productId))).limit(1))[0];
  const threshold = thresholdRow?.threshold ?? 0;
  if (threshold > 0 && quantity <= threshold) {
    await tx.insert(warehouseStockAlerts).values({ companyId: companyId!, warehouseId, productId, threshold, observedQuantity: quantity, status: "active" }).onDuplicateKeyUpdate({ set: { threshold, observedQuantity: quantity, status: "active", resolvedAt: null, updatedAt: new Date() } });
  } else {
    await tx.update(warehouseStockAlerts).set({ observedQuantity: quantity, threshold, status: "resolved", resolvedAt: new Date(), updatedAt: new Date() }).where(and(companyScope(warehouseStockAlerts.companyId, companyId), eq(warehouseStockAlerts.warehouseId, warehouseId), eq(warehouseStockAlerts.productId, productId), eq(warehouseStockAlerts.status, "active")));
  }
  return { quantity, threshold, active: threshold > 0 && quantity <= threshold };
}

/** Débite le stock avec une clause conditionnelle pour bloquer les sorties concurrentes insuffisantes. */
export async function debitWarehouseStock(tx: DbTransaction, companyId: number | null, warehouseId: number, productId: number, quantity: number) {
  const result = await tx.update(warehouseStocks)
    .set({ quantity: sql`${warehouseStocks.quantity} - ${quantity}` })
    .where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, warehouseId), eq(warehouseStocks.productId, productId), gte(warehouseStocks.quantity, quantity)));
  const affected = Number((result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
  if (!affected) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stock insuffisant dans l’entrepôt source." });
  const resultingQuantity = await warehouseStockQuantity(tx, companyId, warehouseId, productId);
  await syncWarehouseStockAlert(tx, companyId, warehouseId, productId, resultingQuantity);
  return { previousQuantity: resultingQuantity + quantity, resultingQuantity };
}

/** Crédit atomiquement une ligne de stock, en la créant au besoin. */
export async function creditWarehouseStock(tx: DbTransaction, companyId: number | null, warehouseId: number, productId: number, quantity: number) {
  await tx.insert(warehouseStocks).values({ companyId, warehouseId, productId, quantity })
    .onDuplicateKeyUpdate({ set: { quantity: sql`${warehouseStocks.quantity} + ${quantity}` } });
  const resultingQuantity = await warehouseStockQuantity(tx, companyId, warehouseId, productId);
  await syncWarehouseStockAlert(tx, companyId, warehouseId, productId, resultingQuantity);
  return { previousQuantity: resultingQuantity - quantity, resultingQuantity };
}

export function transferNumber() {
  return `TRF-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
