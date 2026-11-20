export type QuantityPriceTier = { minQuantity: number; unitPriceCents: number };

export function priceForQuantityTier(basePriceCents: number, quantity: number, tiers: QuantityPriceTier[] | undefined) {
  const selected = (tiers ?? []).filter(tier => tier.minQuantity <= quantity).sort((left, right) => right.minQuantity - left.minQuantity)[0];
  return { unitPriceCents: selected?.unitPriceCents ?? basePriceCents, tierMinQuantity: selected?.minQuantity ?? null };
}
