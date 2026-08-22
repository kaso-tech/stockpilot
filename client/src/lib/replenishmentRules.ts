export function recommendedRestockQuantity(currentQuantity: number, minimumQuantity: number) {
  return Math.max(1, minimumQuantity + 1 - currentQuantity);
}

export function restockEstimateCents(quantityToOrder: number, purchasePriceCents: number) {
  return Math.max(0, quantityToOrder * purchasePriceCents);
}
