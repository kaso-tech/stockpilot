/**
 * Règles de prix communes au client (affichage, mode hors connexion) et au serveur
 * (calcul faisant foi), afin que le montant affiché soit celui qui sera facturé (P9).
 */
export type QuantityPriceTier = { minQuantity: number; unitPriceCents: number };
export type DiscountType = "none" | "percent" | "fixed";

/** Palier applicable : le plus haut seuil atteint par la quantité. */
export function selectQuantityTier(
  basePriceCents: number,
  quantity: number,
  tiers: QuantityPriceTier[] | undefined
) {
  const selected = (tiers ?? [])
    .filter(tier => tier.minQuantity <= quantity)
    .sort((left, right) => right.minQuantity - left.minQuantity)[0];
  return {
    unitPriceCents: selected?.unitPriceCents ?? basePriceCents,
    tierMinQuantity: selected?.minQuantity ?? null,
  };
}

/** Montant de remise en centimes ; un pourcentage est exprimé en points de base (10 000 = 100 %). */
export function discountCents(
  subtotalCents: number,
  type: DiscountType,
  value: number
) {
  if (subtotalCents < 0 || value < 0)
    throw new Error("La remise doit être positive.");
  if (type === "none" || value === 0) return 0;
  if (type === "percent") {
    if (value > 10000)
      throw new Error("Le pourcentage de remise est invalide.");
    return Math.min(subtotalCents, Math.round((subtotalCents * value) / 10000));
  }
  return Math.min(subtotalCents, value);
}
