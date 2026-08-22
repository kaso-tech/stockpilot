export type CheckoutPaymentMethod = "cash" | "card" | "mobile_money" | "bank_transfer" | "credit";
export type CheckoutAmounts = Record<CheckoutPaymentMethod, string>;

export const blankCheckoutAmounts: CheckoutAmounts = { cash: "", card: "", mobile_money: "", bank_transfer: "", credit: "" };
export const checkoutAmountToCents = (value: string) => Math.max(0, Math.round(Number(value.replace(",", ".") || 0) * 100));
export const checkoutAmountFromCents = (value: number) => value ? String(value / 100) : "";
export const isPosCheckout = (sale: { channel?: "pos" | "invoice"; invoiceNumber?: string } | null) => sale?.channel === "pos" || sale?.invoiceNumber?.startsWith("POS-") === true;

export function distributeIntegralPayment(selection: CheckoutPaymentMethod[], current: CheckoutAmounts, remainingCents: number): CheckoutAmounts {
  let balance = remainingCents; const next = { ...blankCheckoutAmounts, ...current };
  selection.forEach(method => { const requested = checkoutAmountToCents(next[method]); const amount = requested > 0 ? Math.min(requested, balance) : balance; next[method] = checkoutAmountFromCents(amount); balance -= amount; });
  return next;
}

export function updateIntegralPayment(selection: CheckoutPaymentMethod[], current: CheckoutAmounts, changedMethod: CheckoutPaymentMethod, value: string, remainingCents: number): CheckoutAmounts {
  const next = { ...current, [changedMethod]: value }; const changedAt = selection.indexOf(changedMethod); let balance = remainingCents;
  selection.forEach((method, index) => { if (index <= changedAt) { const amount = Math.min(checkoutAmountToCents(next[method]), balance); next[method] = checkoutAmountFromCents(amount); balance -= amount; } else { next[method] = index === changedAt + 1 ? checkoutAmountFromCents(balance) : ""; balance = 0; } });
  return next;
}

export function isExactIntegralPayment(selection: CheckoutPaymentMethod[], amounts: CheckoutAmounts, remainingCents: number) { return selection.length > 0 && selection.reduce((sum, method) => sum + checkoutAmountToCents(amounts[method]), 0) === remainingCents; }
