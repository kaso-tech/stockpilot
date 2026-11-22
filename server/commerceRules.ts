export type CustomerType = "ordinary" | "wholesale";
export type RemunerationMode = "fixed" | "commission" | "fixed_plus_commission";
export type CommissionBasis = "revenue" | "net_profit";

/** Type tarifaire effectif : un entrepôt sans vente en gros facture tout le monde au détail. */
export function effectiveCustomerType(customerType: CustomerType | null | undefined, warehouseWholesaleEnabled: boolean | null | undefined): CustomerType {
  return customerType === "wholesale" && warehouseWholesaleEnabled !== false ? "wholesale" : "ordinary";
}

/** Prix de base d’un client. Un prix grossiste à 0 signifie « non défini » : le grossiste paie alors le prix détail. */
export function priceForCustomer(customerType: CustomerType, retailPriceCents: number, wholesalePriceCents: number) {
  return customerType === "wholesale" && wholesalePriceCents > 0 ? wholesalePriceCents : retailPriceCents;
}

export function priceForQuantityTier(basePriceCents: number, quantity: number, tiers: Array<{ minQuantity: number; unitPriceCents: number }>) {
  const applicable = tiers.filter(tier => tier.minQuantity <= quantity).sort((left, right) => right.minQuantity - left.minQuantity)[0];
  return applicable?.unitPriceCents ?? basePriceCents;
}

export function commissionCents({
  remunerationMode,
  commissionBasis,
  rateBasisPoints,
  invoiceRevenueCents,
  invoiceNetProfitCents,
}: {
  remunerationMode: RemunerationMode;
  commissionBasis: CommissionBasis;
  rateBasisPoints: number;
  invoiceRevenueCents: number;
  invoiceNetProfitCents: number;
}) {
  if (remunerationMode === "fixed" || rateBasisPoints <= 0) return 0;
  const base = commissionBasis === "revenue" ? invoiceRevenueCents : Math.max(0, invoiceNetProfitCents);
  return Math.round((base * rateBasisPoints) / 10_000);
}

export function fixedRemunerationCents(remunerationMode: RemunerationMode, fixedMonthlyCents: number) {
  return remunerationMode === "commission" ? 0 : Math.max(0, fixedMonthlyCents);
}
