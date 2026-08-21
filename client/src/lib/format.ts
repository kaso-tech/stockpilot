let activeCurrency = (typeof window !== "undefined" ? localStorage.getItem("stockpilot_currency") : null) || "XOF";
export function setActiveCurrency(currency: "USD" | "EUR" | "XOF") { activeCurrency = currency; }
export function formatCurrency(cents: number) {
  if (activeCurrency === "XOF") return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(cents / 100)} FCFA`;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: activeCurrency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
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
