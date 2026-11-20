export type CommissionReportPaymentKind = "commission" | "salary" | "mixed";

export function commissionBalance(generatedCents: number, commissionPaidCents: number) {
  return Math.max(0, generatedCents - commissionPaidCents);
}

export function commissionReportPeriod(date: Date) {
  return date.toISOString().slice(0, 7);
}
