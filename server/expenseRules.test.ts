import { describe, expect, it } from "vitest";
import { budgetComparison, expenseBreakdownByCategory, expenseTotalCents, monthlyExpenseTotalCents, operatingNetProfitCents } from "./expenseRules";

describe("expense rules", () => {
  it("adds operating expenses and deducts them from the gross margin", () => {
    expect(expenseTotalCents([{ amountCents: 12_500 }, { amountCents: 7_500 }])).toBe(20_000);
    expect(operatingNetProfitCents(85_000, 20_000)).toBe(65_000);
  });

  it("keeps only expenses belonging to the selected month", () => {
    const rows = [{ amountCents: 12_500, spentAt: new Date("2026-08-03T12:00:00Z") }, { amountCents: 7_500, spentAt: new Date("2026-08-22T12:00:00Z") }, { amountCents: 9_000, spentAt: new Date("2026-07-31T12:00:00Z") }];
    expect(monthlyExpenseTotalCents(rows, "2026-08")).toBe(20_000);
  });

  it("groups current-month expenses by category for the dashboard chart", () => {
    const rows = [{ category: "rent", amountCents: 30_000, spentAt: new Date("2026-08-01T12:00:00Z") }, { category: "energy", amountCents: 8_000, spentAt: new Date("2026-08-10T12:00:00Z") }, { category: "rent", amountCents: 5_000, spentAt: new Date("2026-08-20T12:00:00Z") }, { category: "rent", amountCents: 99_000, spentAt: new Date("2026-07-20T12:00:00Z") }];
    expect(expenseBreakdownByCategory(rows, "2026-08")).toEqual([{ category: "rent", amountCents: 35_000 }, { category: "energy", amountCents: 8_000 }]);
  });

  it("reports budget consumption, remaining amount and overrun", () => {
    expect(budgetComparison(100_000, 70_000)).toMatchObject({ configured: true, remainingCents: 30_000, percentUsed: 70, exceeded: false });
    expect(budgetComparison(100_000, 125_000)).toMatchObject({ remainingCents: -25_000, percentUsed: 125, exceeded: true });
  });
});
