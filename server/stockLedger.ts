import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { products, stockAlerts, stockMovements } from "../drizzle/schema";
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
};

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

  async apply(productId: number, change: StockChange) {
    const product = this.product(productId);
    const previousQuantity = this.current.get(productId)!;
    let resultingQuantity: number;
    try {
      resultingQuantity = resultingStock(
        previousQuantity,
        change.type,
        change.quantity
      );
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${product.name} : ${error instanceof Error ? error.message : "mouvement invalide."}`,
      });
    }
    await this.tx
      .update(products)
      .set({ quantity: resultingQuantity })
      .where(
        and(
          eq(products.id, productId),
          companyScope(products.companyId, this.companyId)
        )
      );
    await this.tx.insert(stockMovements).values({
      companyId: this.companyId,
      productId,
      supplierId: change.supplierId ?? null,
      type: change.type,
      quantity: signedMovementQuantity(change.type, change.quantity),
      previousQuantity,
      resultingQuantity,
      reason: change.reason,
      createdByUserId: change.createdByUserId,
    });
    this.current.set(productId, resultingQuantity);
    await syncAlert(this.tx, this.companyId, product, resultingQuantity);
    return { previousQuantity, resultingQuantity };
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
