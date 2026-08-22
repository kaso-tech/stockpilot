export type SettlementMode = "full" | "partial";

export function settlementResult(remainingCents: number, mode: SettlementMode, paymentAmounts: number[]) {
  const paidCents = paymentAmounts.reduce((sum, amount) => sum + Math.max(0, amount), 0);
  if (remainingCents <= 0) throw new Error("Cette vente est déjà intégralement encaissée.");
  if (paidCents <= 0) throw new Error("Le règlement doit comporter un montant positif.");
  if (paidCents > remainingCents) throw new Error("Le montant saisi dépasse le solde à encaisser.");
  if (mode === "full" && paidCents !== remainingCents) throw new Error("Le règlement intégral doit couvrir la totalité du solde.");
  if (mode === "partial" && paidCents >= remainingCents) throw new Error("Pour un règlement partiel, saisissez un montant inférieur au solde.");
  return { paidCents, balanceCents: remainingCents - paidCents, status: paidCents === remainingCents ? "paid" as const : "partial" as const };
}
