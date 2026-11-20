export type WarehouseAlertUrgency = "critical" | "high" | "medium";

export function classifyWarehouseAlertUrgency(coverageDays: number | null, observedQuantity: number): WarehouseAlertUrgency {
  if (observedQuantity <= 0 || (coverageDays !== null && coverageDays <= 1)) return "critical";
  if (coverageDays !== null && coverageDays <= 3) return "high";
  return "medium";
}

export function normalizeCoverageDays(quantity: number, soldDuringPeriod: number, periodDays = 30) {
  if (quantity < 0 || soldDuringPeriod <= 0 || periodDays <= 0) return null;
  return Math.round((quantity / (soldDuringPeriod / periodDays)) * 10) / 10;
}
