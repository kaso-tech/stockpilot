export const expenseCategories = ["rent", "energy", "connection", "salary", "marketing", "supplies", "taxes", "other"] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export function expenseTotalCents(rows: Array<{ amountCents: number }>) {
  return rows.reduce((sum, row) => sum + row.amountCents, 0);
}

export function monthlyExpenseTotalCents(rows: Array<{ amountCents: number; spentAt: Date }>, yearMonth: string) {
  return expenseTotalCents(rows.filter(row => row.spentAt.toISOString().slice(0, 7) === yearMonth));
}

export function operatingNetProfitCents(grossMarginCents: number, expenseCents: number) {
  return grossMarginCents - expenseCents;
}
