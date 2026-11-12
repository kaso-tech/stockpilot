import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import {
  productStocks,
  products,
  stockAlerts,
  stockLots,
  stockMovements,
  warehouses,
} from "../drizzle/schema";
import { companyScope } from "./companyScope";
import {
  resultingStock,
  signedMovementQuantity,
  type StockMovementType,
} from "./stockRules";

type Product = typeof products.$inferSelect;
// Transaction Drizzle MySQL (type volontairement large : les routeurs passent `tx`).
type Tx = any;

/**
 * Verrouille (SELECT … FOR UPDATE) les produits de l'entreprise pour la durée de
 * la transaction. Deux ventes simultanées sur un même produit sont ainsi
 * sérialisées : plus de mise à jour perdue.
 */
export async function lockProducts(
  tx: Tx,
  productIds: number[],
  companyId: number | null
): Promise<StockLedger> {
  const uniqueIds = Array.from(new Set(productIds));
  const rows: Product[] = uniqueIds.length
    ? await tx
        .select()
        .from(products)
        .where(
          and(
            inArray(products.id, uniqueIds),
            companyScope(products.companyId, companyId)
          )
        )
        .for("update")
    : [];
  return new StockLedger(tx, companyId, rows);
}

export type StockChange = {
  type: StockMovementType;
  quantity: number;
  reason: string;
  createdByUserId: number;
  supplierId?: number | null;
  /** Dépôt concerné ; à défaut, le dépôt par défaut de l'entreprise (9.7). */
  warehouseId?: number | null;
  /** Coût unitaire d'une entrée : met à jour le coût moyen pondéré (CMUP). */
  unitCostCents?: number | null;
  /** Lot reçu (numéro et date de péremption AAAA-MM-JJ). */
  lot?: { lotNumber: string; expiryDate: string | null } | null;
};

/** Dépôt par défaut de l'entreprise, créé à la volée s'il n'existe pas encore. */
export async function defaultWarehouseId(tx: Tx, companyId: number | null) {
  const existing = (
    await tx
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.isDefault, true),
          companyScope(warehouses.companyId, companyId)
        )
      )
      .limit(1)
  )[0];
  if (existing) return existing.id as number;
  const result = await tx
    .insert(warehouses)
    .values({ companyId, name: "Dépôt principal", isDefault: true });
  return Number(result[0].insertId);
}

/** Coût moyen unitaire pondéré après une entrée. */
export function weightedAverageCost(
  previousQuantity: number,
  previousCostCents: number,
  enteredQuantity: number,
  unitCostCents: number
) {
  const base = Math.max(0, previousQuantity);
  const total = base + enteredQuantity;
  if (total <= 0) return unitCostCents;
  return Math.round(
    (base * previousCostCents + enteredQuantity * unitCostCents) / total
  );
}

/** Suit la quantité courante de chaque produit verrouillé, y compris quand un même produit apparaît sur plusieurs lignes. */
export class StockLedger {
  private readonly current = new Map<number, number>();
  private readonly byId = new Map<number, Product>();

  constructor(
    private readonly tx: Tx,
    private readonly companyId: number | null,
    rows: Product[]
  ) {
    for (const row of rows) {
      this.byId.set(row.id, row);
      this.current.set(row.id, row.quantity);
    }
  }

  has(productId: number) {
    return this.byId.has(productId);
  }
  product(productId: number) {
    const product = this.byId.get(productId);
    if (!product)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Produit introuvable.",
      });
    return product;
  }
  quantity(productId: number) {
    this.product(productId);
    return this.current.get(productId)!;
  }
  /** Vérifie que tous les identifiants demandés existent dans l'entreprise. */
  assertAll(productIds: number[], message = "Un produit est introuvable.") {
    if (productIds.some(id => !this.byId.has(id)))
      throw new TRPCError({ code: "NOT_FOUND", message });
  }

  private warehouseCache: number | null = null;
  private async warehouse(change: { warehouseId?: number | null }) {
    if (change.warehouseId) {
      const row = (
        await this.tx
          .select({ id: warehouses.id })
          .from(warehouses)
          .where(
            and(
              eq(warehouses.id, change.warehouseId),
              eq(warehouses.active, true),
              companyScope(warehouses.companyId, this.companyId)
            )
          )
          .limit(1)
      )[0];
      if (!row)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Dépôt introuvable.",
        });
      return row.id as number;
    }
    this.warehouseCache ??= await defaultWarehouseId(this.tx, this.companyId);
    return this.warehouseCache;
  }

  /** Stock du produit dans le dépôt, verrouillé pour la transaction (ligne créée au besoin). */
  private async lockStock(productId: number, warehouseId: number) {
    await this.tx
      .insert(productStocks)
      .values({ productId, warehouseId, quantity: 0 })
      .onDuplicateKeyUpdate({
        set: { quantity: sql`${productStocks.quantity}` },
      });
    const row = (
      await this.tx
        .select()
        .from(productStocks)
        .where(
          and(
            eq(productStocks.productId, productId),
            eq(productStocks.warehouseId, warehouseId)
          )
        )
        .limit(1)
        .for("update")
    )[0];
    return row as typeof productStocks.$inferSelect;
  }

  /** Consomme les lots en premier expiré, premier sorti ; le stock non suivi par lot n'en consomme pas. */
  private async consumeLots(
    productId: number,
    warehouseId: number,
    quantity: number
  ) {
    const lots = await this.tx
      .select()
      .from(stockLots)
      .where(
        and(
          eq(stockLots.productId, productId),
          eq(stockLots.warehouseId, warehouseId),
          gt(stockLots.quantity, 0),
          companyScope(stockLots.companyId, this.companyId)
        )
      )
      .orderBy(
        sql`${stockLots.expiryDate} IS NULL`,
        asc(stockLots.expiryDate),
        asc(stockLots.receivedAt)
      )
      .for("update");
    const consumed: Array<{
      lotNumber: string;
      expiryDate: string | null;
      quantity: number;
    }> = [];
    let remaining = quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const taken = Math.min(lot.quantity, remaining);
      await this.tx
        .update(stockLots)
        .set({ quantity: lot.quantity - taken })
        .where(
          and(
            eq(stockLots.id, lot.id),
            companyScope(stockLots.companyId, this.companyId)
          )
        );
      consumed.push({
        lotNumber: lot.lotNumber,
        expiryDate: lot.expiryDate,
        quantity: taken,
      });
      remaining -= taken;
    }
    return consumed;
  }

  async apply(productId: number, change: StockChange) {
    const product = this.product(productId);
    const previousQuantity = this.current.get(productId)!;
    const warehouseId = await this.warehouse(change);
    let resultingQuantity: number;
    let signed: number;
    try {
      resultingQuantity = resultingStock(
        previousQuantity,
        change.type,
        change.quantity
      );
      signed = signedMovementQuantity(change.type, change.quantity);
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${product.name} : ${error instanceof Error ? error.message : "mouvement invalide."}`,
      });
    }
    const stock = await this.lockStock(productId, warehouseId);
    if (stock.quantity + signed < 0)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${product.name} : stock insuffisant dans ce dépôt (${stock.quantity} disponible).`,
      });
    const values: Partial<Product> = { quantity: resultingQuantity };
    if (
      signed > 0 &&
      change.unitCostCents !== undefined &&
      change.unitCostCents !== null
    ) {
      values.purchasePriceCents = weightedAverageCost(
        previousQuantity,
        product.purchasePriceCents,
        signed,
        change.unitCostCents
      );
      product.purchasePriceCents = values.purchasePriceCents;
    }
    await this.tx
      .update(products)
      .set(values)
      .where(
        and(
          eq(products.id, productId),
          companyScope(products.companyId, this.companyId)
        )
      );
    await this.tx
      .update(productStocks)
      .set({ quantity: stock.quantity + signed })
      .where(eq(productStocks.id, stock.id));
    if (signed > 0 && change.lot?.lotNumber)
      await this.tx.insert(stockLots).values({
        companyId: this.companyId,
        productId,
        warehouseId,
        lotNumber: change.lot.lotNumber,
        expiryDate: change.lot.expiryDate,
        quantity: signed,
      });
    if (signed < 0) await this.consumeLots(productId, warehouseId, -signed);
    await this.tx.insert(stockMovements).values({
      companyId: this.companyId,
      productId,
      supplierId: change.supplierId ?? null,
      type: change.type,
      quantity: signed,
      previousQuantity,
      resultingQuantity,
      reason: change.reason,
      warehouseId,
      unitCostCents: change.unitCostCents ?? null,
      createdByUserId: change.createdByUserId,
    });
    this.current.set(productId, resultingQuantity);
    await syncAlert(this.tx, this.companyId, product, resultingQuantity);
    return { previousQuantity, resultingQuantity };
  }

  /** Transfert entre dépôts : le stock total ne change pas ; les lots suivent la marchandise. */
  async transfer(
    productId: number,
    input: {
      fromWarehouseId: number;
      toWarehouseId: number;
      quantity: number;
      reason: string;
      createdByUserId: number;
    }
  ) {
    const product = this.product(productId);
    if (input.fromWarehouseId === input.toWarehouseId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Choisissez deux dépôts différents.",
      });
    const from = await this.warehouse({ warehouseId: input.fromWarehouseId });
    const to = await this.warehouse({ warehouseId: input.toWarehouseId });
    const source = await this.lockStock(productId, from);
    if (source.quantity < input.quantity)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${product.name} : stock insuffisant dans le dépôt d’origine (${source.quantity} disponible).`,
      });
    const target = await this.lockStock(productId, to);
    await this.tx
      .update(productStocks)
      .set({ quantity: source.quantity - input.quantity })
      .where(eq(productStocks.id, source.id));
    await this.tx
      .update(productStocks)
      .set({ quantity: target.quantity + input.quantity })
      .where(eq(productStocks.id, target.id));
    for (const lot of await this.consumeLots(productId, from, input.quantity))
      await this.tx.insert(stockLots).values({
        companyId: this.companyId,
        productId,
        warehouseId: to,
        lotNumber: lot.lotNumber,
        expiryDate: lot.expiryDate,
        quantity: lot.quantity,
      });
    const total = this.current.get(productId)!;
    for (const [warehouseId, quantity] of [
      [from, -input.quantity],
      [to, input.quantity],
    ] as const)
      await this.tx.insert(stockMovements).values({
        companyId: this.companyId,
        productId,
        type: "adjustment",
        quantity,
        previousQuantity: total,
        resultingQuantity: total,
        reason: input.reason,
        warehouseId,
        createdByUserId: input.createdByUserId,
      });
  }
}

/** Active ou résout l'alerte de stock d'un produit selon sa quantité. */
export async function syncAlert(
  tx: Tx,
  companyId: number | null,
  product: Pick<Product, "id" | "minimumQuantity">,
  quantity: number
) {
  if (quantity <= product.minimumQuantity) {
    await tx
      .insert(stockAlerts)
      .values({
        companyId,
        productId: product.id,
        threshold: product.minimumQuantity,
        observedQuantity: quantity,
        status: "active",
      })
      .onDuplicateKeyUpdate({
        set: {
          observedQuantity: quantity,
          threshold: product.minimumQuantity,
          status: "active",
          resolvedAt: null,
        },
      });
  } else {
    await tx
      .update(stockAlerts)
      .set({
        observedQuantity: quantity,
        status: "resolved",
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(stockAlerts.productId, product.id),
          eq(stockAlerts.status, "active"),
          companyScope(stockAlerts.companyId, companyId)
        )
      );
  }
}
