import { describe, expect, it } from "vitest";
import { expenseTotalCents, monthlyExpenseTotalCents, operatingNetProfitCents } from "./expenseRules";

describe("expense rules", () => {
  it("adds operating expenses and deducts them from the gross margin", () => {
    expect(expenseTotalCents([{ amountCents: 12_500 }, { amountCents: 7_500 }])).toBe(20_000);
    expect(operatingNetProfitCents(85_000, 20_000)).toBe(65_000);
  });

  it("keeps only expenses belonging to the selected month", () => {
    const rows = [{ amountCents: 12_500, spentAt: new Date("2026-08-03T12:00:00Z") }, { amountCents: 7_500, spentAt: new Date("2026-08-22T12:00:00Z") }, { amountCents: 9_000, spentAt: new Date("2026-07-31T12:00:00Z") }];
    expect(monthlyExpenseTotalCents(rows, "2026-08")).toBe(20_000);
  });
});
