export type SellerPricePermissions = {
  sellerCanOverridePrice: boolean;
  sellerCanSellBelowPrice: boolean;
  sellerMaxDiscountPercent: number;
  sellerCanLineDiscount?: boolean;
  sellerMaxLineDiscountPercent?: number;
  sellerCanInvoiceDiscount?: boolean;
  sellerMaxInvoiceDiscountPercent?: number;
  sellerCanCartDiscount?: boolean;
  sellerMaxCartDiscountPercent?: number;
};

export function assertSellerUnitPrice(permissions: SellerPricePermissions, tariffCents: number, proposedCents: number) {
  if (proposedCents < tariffCents) {
    if (!permissions.sellerCanSellBelowPrice) throw new Error("Un prix inférieur au tarif n’est pas autorisé pour ce vendeur.");
    return;
  }
  if (proposedCents !== tariffCents && !permissions.sellerCanOverridePrice) throw new Error("La modification du prix de vente n’est pas autorisée pour ce vendeur.");
}

export function assertSellerDiscount(permissions: SellerPricePermissions, context: "line" | "invoice" | "cart", baseCents: number, discountCents: number) {
  if (baseCents <= 0 || discountCents <= 0) return;
  const rules = context === "line"
    ? { allowed: permissions.sellerCanLineDiscount ?? false, maximum: permissions.sellerMaxLineDiscountPercent ?? 0 }
    : context === "cart"
      ? { allowed: permissions.sellerCanCartDiscount ?? false, maximum: permissions.sellerMaxCartDiscountPercent ?? 0 }
      : { allowed: permissions.sellerCanInvoiceDiscount ?? false, maximum: permissions.sellerMaxInvoiceDiscountPercent ?? 0 };
  if (!rules.allowed) throw new Error("Cette remise n’est pas autorisée pour ce vendeur.");
  if (discountCents * 100 > baseCents * rules.maximum) throw new Error(`La remise dépasse le seuil vendeur autorisé de ${rules.maximum} %.`);
}
