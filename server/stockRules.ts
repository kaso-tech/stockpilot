export type StockMovementType = "entry" | "exit" | "adjustment";

export function signedMovementQuantity(type: StockMovementType, quantity: number) {
  if (!Number.isInteger(quantity) || quantity === 0) throw new Error("La quantité doit être un entier non nul.");
  if (type === "entry") return Math.abs(quantity);
  if (type === "exit") return -Math.abs(quantity);
  return quantity;
}

export function resultingStock(previousQuantity: number, type: StockMovementType, quantity: number) {
  if (!Number.isInteger(previousQuantity) || previousQuantity < 0) throw new Error("Le stock initial est invalide.");
  const result = previousQuantity + signedMovementQuantity(type, quantity);
  if (result < 0) throw new Error("Le mouvement créerait un stock négatif.");
  return result;
}

export function isBelowMinimum(quantity: number, minimumQuantity: number) {
  return quantity <= minimumQuantity;
}
