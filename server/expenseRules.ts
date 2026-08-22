export const expenseCategories = ["rent", "energy", "connection", "salary", "marketing", "supplies", "taxes", "other"] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export function expenseTotalCents(rows: Array<{ amountCents: number }>) {
  return rows.reduce((sum, row) => sum + row.amountCents, 0);
}

export function monthlyExpenseTotalCents(rows: Array<{ amountCents: number; spentAt: Date }>, yearMonth: string) {
  return expenseTotalCents(rows.filter(row => row.spentAt.toISOString().slice(0, 7) === yearMonth));
}

export function expenseBreakdownByCategory(rows: Array<{ category: string; amountCents: number; spentAt: Date }>, yearMonth: string) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.spentAt.toISOString().slice(0, 7) !== yearMonth) continue;
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amountCents);
  }
  return Array.from(totals, ([category, amountCents]) => ({ category, amountCents })).sort((a, b) => b.amountCents - a.amountCents);
}

export function operatingNetProfitCents(grossMarginCents: number, expenseCents: number) {
  return grossMarginCents - expenseCents;
}
