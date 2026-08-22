export type SellerSensitiveAction = "invoice_cancellation" | "refund" | "stock_correction" | "purchase_price";

export type SellerSensitivePermissions = {
  sellerCanCancelInvoice?: boolean;
  sellerCanRefund?: boolean;
  sellerCanCorrectStock?: boolean;
  sellerCanEditPurchasePrice?: boolean;
};

const messages: Record<SellerSensitiveAction, string> = {
  invoice_cancellation: "L’annulation de facture n’est pas autorisée pour les vendeurs.",
  refund: "Le remboursement n’est pas autorisé pour les vendeurs.",
  stock_correction: "La correction de stock n’est pas autorisée pour les vendeurs.",
  purchase_price: "La modification du coût d’achat n’est pas autorisée pour les vendeurs.",
};

export function assertSellerSensitiveAction(permissions: SellerSensitivePermissions | null | undefined, action: SellerSensitiveAction) {
  const permitted = action === "invoice_cancellation"
    ? permissions?.sellerCanCancelInvoice
    : action === "refund"
    ? permissions?.sellerCanRefund
    : action === "stock_correction"
      ? permissions?.sellerCanCorrectStock
      : permissions?.sellerCanEditPurchasePrice;
  if (!permitted) throw new Error(messages[action]);
}
