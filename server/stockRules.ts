import { MAX_QUANTITY } from "./numericLimits";

export type StockMovementType = "entry" | "exit" | "adjustment";

export function signedMovementQuantity(type: StockMovementType, quantity: number) {
  if (!Number.isInteger(quantity) || quantity === 0 || Math.abs(quantity) > MAX_QUANTITY) throw new Error("La quantité doit être un entier non nul et rester dans les limites autorisées.");
  if (type === "entry") return Math.abs(quantity);
  if (type === "exit") return -Math.abs(quantity);
  return quantity;
}

export function resultingStock(previousQuantity: number, type: StockMovementType, quantity: number) {
  if (!Number.isInteger(previousQuantity) || previousQuantity < 0 || previousQuantity > MAX_QUANTITY) throw new Error("Le stock initial est invalide.");
  const result = previousQuantity + signedMovementQuantity(type, quantity);
  if (result < 0) throw new Error("Le mouvement créerait un stock négatif.");
  if (result > MAX_QUANTITY) throw new Error("Le mouvement créerait un stock hors limites.");
  return result;
}

export function isBelowMinimum(quantity: number, minimumQuantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY || !Number.isInteger(minimumQuantity) || minimumQuantity < 0 || minimumQuantity > MAX_QUANTITY) throw new Error("Les paramètres de seuil de stock sont invalides.");
  return quantity <= minimumQuantity;
}
