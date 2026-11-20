// Réinitialisation et suppression définitive d'un dépôt.
// Toutes les données propres au dépôt sont supprimées : stock par produit, lots,
// inventaires et historique des mouvements du dépôt. Le stock total des produits
// est diminué d'autant, avec un ajustement tracé hors dépôt pour que l'historique
// global de chaque produit reste cohérent.
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import {
  auditLogs,
  inventoryItems,
  inventorySessions,
  productStocks,
  products,
  stockLots,
  stockMovements,
  warehouses,
} from "../drizzle/schema";
import { companyScope } from "./companyScope";
import { syncAlert } from "./stockLedger";

type Tx = any;
type Warehouse = typeof warehouses.$inferSelect;

export type WarehouseImpact = {
  productsWithStock: number;
  units: number;
  lots: number;
  movements: number;
  inventories: number;
};

/** Ce que la réinitialisation supprimera, pour l'afficher avant confirmation. */
export async function warehouseImpact(
  db: Tx,
  companyId: number | null,
  warehouseId: number
): Promise<WarehouseImpact> {
  const [stock] = await db
    .select({
      products: sql<number>`count(*)`,
      units: sql<number>`coalesce(sum(${productStocks.quantity}), 0)`,
    })
    .from(productStocks)
    .innerJoin(products, eq(products.id, productStocks.productId))
    .where(
      and(
        eq(productStocks.warehouseId, warehouseId),
        ne(productStocks.quantity, 0),
        companyScope(products.companyId, companyId)
      )
    );
  const [lots] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockLots)
    .where(
      and(
        eq(stockLots.warehouseId, warehouseId),
        companyScope(stockLots.companyId, companyId)
      )
    );
  const [movements] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.warehouseId, warehouseId),
        companyScope(stockMovements.companyId, companyId)
      )
    );
  const [inventories] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventorySessions)
    .where(
      and(
        eq(inventorySessions.warehouseId, warehouseId),
        companyScope(inventorySessions.companyId, companyId)
      )
    );
  return {
    productsWithStock: Number(stock?.products ?? 0),
    units: Number(stock?.units ?? 0),
    lots: Number(lots?.count ?? 0),
    movements: Number(movements?.count ?? 0),
    inventories: Number(inventories?.count ?? 0),
  };
}

/** Vide le dépôt de toutes ses données, dans la transaction fournie. */
export async function resetWarehouseData(
  tx: Tx,
  companyId: number | null,
  warehouse: Warehouse,
  actorUserId: number
): Promise<WarehouseImpact> {
  const impact = await warehouseImpact(tx, companyId, warehouse.id);
  const stockRows: Array<typeof productStocks.$inferSelect> = await tx
    .select({
      id: productStocks.id,
      productId: productStocks.productId,
      warehouseId: productStocks.warehouseId,
      quantity: productStocks.quantity,
    })
    .from(productStocks)
    .innerJoin(products, eq(products.id, productStocks.productId))
    .where(
      and(
        eq(productStocks.warehouseId, warehouse.id),
        companyScope(products.companyId, companyId)
      )
    );
  const productIds = stockRows.map(row => row.productId);
  const productRows: Array<typeof products.$inferSelect> = productIds.length
    ? await tx
        .select()
        .from(products)
        .where(
          and(
            inArray(products.id, productIds),
            companyScope(products.companyId, companyId)
          )
        )
        .for("update")
    : [];
  const byId = new Map(productRows.map(product => [product.id, product]));

  // 1. Historique du dépôt, puis stock total de chaque produit diminué d'autant.
  await tx
    .delete(stockMovements)
    .where(
      and(
        eq(stockMovements.warehouseId, warehouse.id),
        companyScope(stockMovements.companyId, companyId)
      )
    );
  for (const row of stockRows) {
    const product = byId.get(row.productId);
    if (!product || row.quantity === 0) continue;
    const resulting = Math.max(0, product.quantity - row.quantity);
    const delta = resulting - product.quantity;
    await tx
      .update(products)
      .set({ quantity: resulting })
      .where(
        and(
          eq(products.id, product.id),
          companyScope(products.companyId, companyId)
        )
      );
    if (delta !== 0)
      await tx.insert(stockMovements).values({
        companyId,
        productId: product.id,
        type: "adjustment",
        quantity: delta,
        previousQuantity: product.quantity,
        resultingQuantity: resulting,
        reason: `Réinitialisation du dépôt ${warehouse.name}`,
        warehouseId: null,
        createdByUserId: actorUserId,
      });
    await syncAlert(tx, companyId, product, resulting);
  }

  // 2. Stock par produit, lots et inventaires du dépôt.
  await tx
    .delete(productStocks)
    .where(
      and(
        eq(productStocks.warehouseId, warehouse.id),
        productIds.length
          ? inArray(productStocks.productId, productIds)
          : sql`1 = 0`
      )
    );
  await tx
    .delete(stockLots)
    .where(
      and(
        eq(stockLots.warehouseId, warehouse.id),
        companyScope(stockLots.companyId, companyId)
      )
    );
  const sessions: Array<{ id: number }> = await tx
    .select({ id: inventorySessions.id })
    .from(inventorySessions)
    .where(
      and(
        eq(inventorySessions.warehouseId, warehouse.id),
        companyScope(inventorySessions.companyId, companyId)
      )
    );
  if (sessions.length) {
    const sessionIds = sessions.map(session => session.id);
    await tx
      .delete(inventoryItems)
      .where(inArray(inventoryItems.inventorySessionId, sessionIds));
    await tx
      .delete(inventorySessions)
      .where(
        and(
          inArray(inventorySessions.id, sessionIds),
          companyScope(inventorySessions.companyId, companyId)
        )
      );
  }

  await tx.insert(auditLogs).values({
    companyId,
    actorUserId,
    action: "Réinitialisation",
    entityType: "Dépôt",
    entityId: String(warehouse.id),
    detail: `Dépôt ${warehouse.name} réinitialisé : ${impact.units} unité(s) de ${impact.productsWithStock} produit(s), ${impact.lots} lot(s), ${impact.movements} mouvement(s) et ${impact.inventories} inventaire(s) supprimés`,
  });
  return impact;
}
