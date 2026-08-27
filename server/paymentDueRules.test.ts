import { describe, expect, it } from "vitest";
import { nextMonthlyDueAt, normalizeReminderDays, reminderKindFor, resolvePaymentDueStatus } from "./paymentDueRules";

describe("payment due rules", () => {
  it("normalise les délais de rappel sans valeurs dangereuses", () => {
    expect(normalizeReminderDays([7, 3, 3, -1, 120, 1])).toEqual([7, 3, 1]);
  });

  it("détermine le statut sans compter deux fois un règlement partiel", () => {
    const now = new Date("2026-08-27T10:00:00Z");
    expect(resolvePaymentDueStatus({ dueAt: new Date("2026-08-26T12:00:00Z"), amountCents: 1000, paidCents: 0 }, now)).toBe("overdue");
    expect(resolvePaymentDueStatus({ dueAt: new Date("2026-08-26T12:00:00Z"), amountCents: 1000, paidCents: 400 }, now)).toBe("partially_paid");
    expect(resolvePaymentDueStatus({ dueAt: new Date("2026-08-26T12:00:00Z"), amountCents: 1000, paidCents: 1000 }, now)).toBe("paid");
  });

  it("calcule les rappels et les échéances mensuelles en fin de mois", () => {
    const dueAt = new Date("2026-09-03T12:00:00Z");
    expect(reminderKindFor({ dueAt, status: "upcoming", reminderDays: [7, 3, 1] }, new Date("2026-08-27T08:00:00Z"))).toBe("upcoming");
    expect(nextMonthlyDueAt(new Date("2026-01-31T12:00:00Z")).toISOString()).toBe("2026-02-28T12:00:00.000Z");
  });
});
