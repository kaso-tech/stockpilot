export type SettlementMode = "full" | "partial";
export type PaymentMethod = "cash" | "card" | "mobile_money" | "bank_transfer" | "credit";
export type PaymentMethodSettings = { paymentCashEnabled?: boolean; paymentCardEnabled?: boolean; paymentMobileMoneyEnabled?: boolean; paymentBankTransferEnabled?: boolean; paymentCreditEnabled?: boolean };

const paymentSettingKey: Record<PaymentMethod, keyof PaymentMethodSettings> = { cash: "paymentCashEnabled", card: "paymentCardEnabled", mobile_money: "paymentMobileMoneyEnabled", bank_transfer: "paymentBankTransferEnabled", credit: "paymentCreditEnabled" };

export function assertPaymentMethodsEnabled(methods: PaymentMethod[], settings: PaymentMethodSettings | null | undefined) {
  if (methods.some(method => settings?.[paymentSettingKey[method]] === false)) throw new Error("Un moyen de paiement sélectionné est désactivé dans les réglages.");
}

import { MAX_CENTS } from "./numericLimits";

export function settlementResult(remainingCents: number, mode: SettlementMode, paymentAmounts: number[]) {
  if (!Number.isSafeInteger(remainingCents) || remainingCents <= 0 || remainingCents > MAX_CENTS) throw new Error("Le solde à encaisser est invalide.");
  if (!paymentAmounts.length || paymentAmounts.some(amount => !Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_CENTS)) throw new Error("Le règlement contient un montant invalide.");
  const paidCents = paymentAmounts.reduce((sum, amount) => sum + amount, 0);
  if (remainingCents <= 0) throw new Error("Cette vente est déjà intégralement encaissée.");
  if (paidCents <= 0) throw new Error("Le règlement doit comporter un montant positif.");
  if (paidCents > MAX_CENTS || paidCents > remainingCents) throw new Error("Le montant saisi dépasse le solde à encaisser.");
  if (mode === "full" && paidCents !== remainingCents) throw new Error("Le règlement intégral doit couvrir la totalité du solde.");
  if (mode === "partial" && paidCents >= remainingCents) throw new Error("Pour un règlement partiel, saisissez un montant inférieur au solde.");
  return { paidCents, balanceCents: remainingCents - paidCents, status: paidCents === remainingCents ? "paid" as const : "partial" as const };
}
