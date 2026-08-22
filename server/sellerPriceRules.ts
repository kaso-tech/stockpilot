export type SellerPricePermissions = {
  sellerCanOverridePrice: boolean;
  sellerCanSellBelowPrice: boolean;
  sellerMaxDiscountPercent: number;
};

export function assertSellerUnitPrice(permissions: SellerPricePermissions, tariffCents: number, proposedCents: number) {
  if (proposedCents !== tariffCents && !permissions.sellerCanOverridePrice) throw new Error("La modification du prix de vente n’est pas autorisée pour ce vendeur.");
  if (proposedCents < tariffCents && !permissions.sellerCanSellBelowPrice) throw new Error("Un prix inférieur au tarif n’est pas autorisé pour ce vendeur.");
}

export function assertSellerDiscount(permissions: SellerPricePermissions, baseCents: number, discountCents: number) {
  if (baseCents <= 0 || discountCents <= 0) return;
  if (discountCents * 100 > baseCents * permissions.sellerMaxDiscountPercent) throw new Error(`La remise dépasse le seuil vendeur autorisé de ${permissions.sellerMaxDiscountPercent} %.`);
}
