import { describe, expect, it } from "vitest";
import { buildPaymentDueForecast, paymentDueForecastMonths } from "./paymentDueForecast";

describe("prévision de trésorerie des échéances", () => {
  it("répartit les dépenses, salaires, règlements et soldes par mois sans inclure les annulations", () => {
    const result = buildPaymentDueForecast([
      { dueAt: new Date("2026-08-05T00:00:00Z"), amountCents: 100_000, paidCents: 20_000, status: "partially_paid", scheduleType: "expense" },
      { dueAt: new Date("2026-08-18T00:00:00Z"), amountCents: 50_000, paidCents: 0, status: "upcoming", scheduleType: "salary" },
      { dueAt: new Date("2026-09-02T00:00:00Z"), amountCents: 40_000, paidCents: 40_000, status: "paid", scheduleType: "salary" },
      { dueAt: new Date("2026-09-11T00:00:00Z"), amountCents: 10_000, paidCents: 0, status: "cancelled", scheduleType: "expense" },
    ], "2026-08", 2, new Date("2026-08-12T00:00:00Z"));
    expect(result).toEqual([
      { yearMonth: "2026-08", expenseCommittedCents: 100_000, salaryCommittedCents: 50_000, paidCents: 20_000, outstandingCents: 130_000, overdueOutstandingCents: 80_000 },
      { yearMonth: "2026-09", expenseCommittedCents: 0, salaryCommittedCents: 40_000, paidCents: 40_000, outstandingCents: 0, overdueOutstandingCents: 0 },
    ]);
  });

  it("génère une série continue de mois UTC", () => {
    expect(paymentDueForecastMonths("2026-11", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});
