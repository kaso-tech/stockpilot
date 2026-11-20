/** Libellés des moyens de paiement, tels qu'affichés à l'écran et sur les documents. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  mobile_money: "Mobile money",
  bank_transfer: "Virement",
  credit: "Crédit client",
};

export function paymentMethodLabel(method: string | null | undefined) {
  return method ? (PAYMENT_METHOD_LABELS[method] ?? method) : "—";
}
