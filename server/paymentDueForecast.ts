export type ForecastOccurrence = {
  dueAt: Date;
  amountCents: number;
  paidCents: number;
  status: "upcoming" | "due" | "overdue" | "partially_paid" | "paid" | "cancelled";
  /** La prime d’alimentation est comptée avec les rémunérations. */
  scheduleType: "expense" | "salary" | "food_allowance";
};

export type MonthlyPaymentDueForecast = {
  yearMonth: string;
  expenseCommittedCents: number;
  salaryCommittedCents: number;
  paidCents: number;
  outstandingCents: number;
  overdueOutstandingCents: number;
};

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

export function paymentDueForecastMonths(fromYearMonth: string, months: number) {
  const [year, month] = fromYearMonth.split("-").map(Number);
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

export function buildPaymentDueForecast(rows: ForecastOccurrence[], fromYearMonth: string, months: number, now = new Date()): MonthlyPaymentDueForecast[] {
  const keys = paymentDueForecastMonths(fromYearMonth, months);
  const forecast = new Map(keys.map(yearMonth => [yearMonth, { yearMonth, expenseCommittedCents: 0, salaryCommittedCents: 0, paidCents: 0, outstandingCents: 0, overdueOutstandingCents: 0 }]));
  for (const row of rows) {
    if (row.status === "cancelled") continue;
    const entry = forecast.get(monthKey(row.dueAt));
    if (!entry) continue;
    const outstanding = Math.max(0, row.amountCents - row.paidCents);
    if (row.scheduleType === "expense") entry.expenseCommittedCents += row.amountCents;
    else entry.salaryCommittedCents += row.amountCents;
    entry.paidCents += Math.min(row.amountCents, row.paidCents);
    entry.outstandingCents += outstanding;
    if (outstanding > 0 && row.dueAt < now) entry.overdueOutstandingCents += outstanding;
  }
  return keys.map(key => forecast.get(key)!);
}
