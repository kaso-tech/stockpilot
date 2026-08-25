export type SellerPricePermissions = {
  sellerCanOverridePrice?: boolean;
  sellerCanSellBelowPrice?: boolean;
  sellerMaxDiscountPercent?: number;
  sellerCanLineDiscount?: boolean;
  sellerMaxLineDiscountPercent?: number;
  sellerCanInvoiceDiscount?: boolean;
  sellerMaxInvoiceDiscountPercent?: number;
  sellerCanCartDiscount?: boolean;
  sellerMaxCartDiscountPercent?: number;
  sellerCanEditInvoiceItemPrice?: boolean;
  sellerMaxInvoiceItemPriceChangePercent?: number;
  sellerCanEditCartItemPrice?: boolean;
  sellerMaxCartItemPriceChangePercent?: number;
};

export type SellerPermissionContext = "invoice" | "cart";
export type SellerDiscountContext = "line" | "invoice" | "cart";

function pricePermission(permissions: SellerPricePermissions, context: SellerPermissionContext) {
  if (context === "cart") return { allowed: permissions.sellerCanEditCartItemPrice ?? permissions.sellerCanOverridePrice ?? false, maximum: permissions.sellerMaxCartItemPriceChangePercent ?? 0 };
  return { allowed: permissions.sellerCanEditInvoiceItemPrice ?? permissions.sellerCanOverridePrice ?? false, maximum: permissions.sellerMaxInvoiceItemPriceChangePercent ?? 0 };
}

function discountPermission(permissions: SellerPricePermissions, context: SellerDiscountContext) {
  if (context === "line") return { allowed: permissions.sellerCanLineDiscount ?? false, maximum: permissions.sellerMaxLineDiscountPercent ?? 0 };
  if (context === "cart") return { allowed: permissions.sellerCanCartDiscount ?? false, maximum: permissions.sellerMaxCartDiscountPercent ?? 0 };
  return { allowed: permissions.sellerCanInvoiceDiscount ?? false, maximum: permissions.sellerMaxInvoiceDiscountPercent ?? permissions.sellerMaxDiscountPercent ?? 0 };
}

export function assertSellerUnitPrice(permissions: SellerPricePermissions, tariffCents: number, proposedCents: number, context: SellerPermissionContext = "invoice") {
  if (proposedCents === tariffCents) return;
  const permission = pricePermission(permissions, context);
  if (!permission.allowed) throw new Error("La modification du prix de vente n’est pas autorisée pour ce vendeur.");
  const variationPercent = Math.round((Math.abs(proposedCents - tariffCents) * 10000) / Math.max(1, tariffCents)) / 100;
  if (variationPercent > permission.maximum) throw new Error(`La modification de prix dépasse le seuil vendeur autorisé de ${permission.maximum} %.`);
}

export function assertSellerDiscount(permissions: SellerPricePermissions, baseCents: number, discountCents: number, context: SellerDiscountContext = "invoice") {
  if (baseCents <= 0 || discountCents <= 0) return;
  const permission = discountPermission(permissions, context);
  if (!permission.allowed) throw new Error("La remise n’est pas autorisée pour ce vendeur.");
  if (discountCents * 100 > baseCents * permission.maximum) throw new Error(`La remise dépasse le seuil vendeur autorisé de ${permission.maximum} %.`);
}

export function assertSellerVatSelection(permissions: { sellerCanToggleVat?: boolean }, defaultApplied: boolean, requestedApplied: boolean) {
  if (requestedApplied !== defaultApplied && !permissions.sellerCanToggleVat) throw new Error("La modification de TVA n’est pas autorisée pour ce vendeur.");
}
