let activeCurrency = (typeof window !== "undefined" ? localStorage.getItem("stockpilot_currency") : null) || "XOF";
export function setActiveCurrency(currency: "USD" | "EUR" | "XOF") { activeCurrency = currency; }
export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: activeCurrency,
    maximumFractionDigits: activeCurrency === "XOF" ? 0 : 2,
  }).format(cents / 100);
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
