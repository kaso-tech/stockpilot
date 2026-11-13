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

export type VatLine = { netCents: number; vatRateBasisPoints: number };

/**
 * TVA par ligne (9.6) : la remise globale est répartie au prorata des lignes
 * (le reste d'arrondi sur la dernière), puis chaque ligne est taxée à son taux.
 */
export function computeVatBreakdown(
  lines: VatLine[],
  invoiceDiscountCents: number
) {
  const netTotal = lines.reduce((sum, line) => sum + line.netCents, 0);
  let allocated = 0;
  const perLine = lines.map((line, index) => {
    const share =
      index === lines.length - 1
        ? invoiceDiscountCents - allocated
        : netTotal > 0
          ? Math.round((invoiceDiscountCents * line.netCents) / netTotal)
          : 0;
    allocated += share;
    const taxableCents = Math.max(0, line.netCents - share);
    const vatCents = Math.round(
      (taxableCents * line.vatRateBasisPoints) / 10000
    );
    return {
      taxableCents,
      vatRateBasisPoints: line.vatRateBasisPoints,
      vatCents,
    };
  });
  const byRate = new Map<number, { taxableCents: number; vatCents: number }>();
  for (const line of perLine) {
    const current = byRate.get(line.vatRateBasisPoints) ?? {
      taxableCents: 0,
      vatCents: 0,
    };
    byRate.set(line.vatRateBasisPoints, {
      taxableCents: current.taxableCents + line.taxableCents,
      vatCents: current.vatCents + line.vatCents,
    });
  }
  return {
    perLine,
    taxableCents: perLine.reduce((sum, line) => sum + line.taxableCents, 0),
    vatCents: perLine.reduce((sum, line) => sum + line.vatCents, 0),
    byRate: Array.from(byRate, ([vatRateBasisPoints, totals]) => ({
      vatRateBasisPoints,
      ...totals,
    })).sort(
      (left, right) => left.vatRateBasisPoints - right.vatRateBasisPoints
    ),
  };
}

/** Libellé des taux de TVA appliqués, ex. « 5.50 % · 20.00 % ». */
export function vatRatesLabel(rates: number[]) {
  const distinct = Array.from(new Set(rates.filter(rate => rate > 0))).sort(
    (left, right) => left - right
  );
  return distinct.map(rate => `${(rate / 100).toFixed(2)} %`).join(" · ");
}
