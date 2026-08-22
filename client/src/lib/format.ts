let activeCurrency = (typeof window !== "undefined" ? localStorage.getItem("stockpilot_currency") : null) || "XOF";
export type PriceGrouping = "space" | "comma" | "none";
export type PriceRounding = "none" | "unit" | "ten" | "hundred" | "thousand";
let activePriceGrouping: PriceGrouping = "space";
let activePriceRounding: PriceRounding = "none";
export function setActiveCurrency(currency: "USD" | "EUR" | "XOF") { activeCurrency = currency; }
export function setActivePriceFormat(grouping: PriceGrouping, rounding: PriceRounding) { activePriceGrouping = grouping; activePriceRounding = rounding; }
export function formatCurrency(cents: number) {
  const steps: Record<PriceRounding, number> = { none: 0, unit: 1, ten: 10, hundred: 100, thousand: 1000 };
  const rawAmount = cents / 100; const step = steps[activePriceRounding]; const amount = step ? Math.round(rawAmount / step) * step : rawAmount;
  const locale = activePriceGrouping === "comma" ? "en-US" : "fr-FR";
  const useGrouping = activePriceGrouping !== "none";
  const digits = activeCurrency === "XOF" || step ? 0 : 2;
  if (activeCurrency === "XOF") return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits, useGrouping }).format(amount)} FCFA`;
  return new Intl.NumberFormat(locale, { style: "currency", currency: activeCurrency, maximumFractionDigits: digits, minimumFractionDigits: digits, useGrouping }).format(amount);
}

export function displayCurrencyLabel(value: string | null | undefined) {
  return (value || "").replace(/\bXOF\b/g, "FCFA");
}

export function formatDate(value: Date | string | number | null | undefined, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export function formatSignedQuantity(quantity: number) {
  return `${quantity > 0 ? "+" : ""}${quantity}`;
}

export const movementLabels = {
  entry: "Entrée",
  exit: "Sortie",
  adjustment: "Ajustement",
} as const;
