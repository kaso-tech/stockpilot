import { describe, expect, it } from "vitest";
import { defaultReminderDays, initialMonthlyDueAt, initialRecurringDueAt, materializationHorizonDays, monthlyDueDate, nextDueAt, nextMonthlyDueAt, normalizeReminderDays, reminderKindFor, resolvePaymentDueStatus } from "./paymentDueRules";

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

  it("conserve le jour mensuel demandé tout en adaptant février et les mois courts", () => {
    expect(monthlyDueDate(2028, 1, 31).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(monthlyDueDate(2027, 1, 31).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(initialMonthlyDueAt(5, new Date("2026-08-12T08:00:00Z")).toISOString().slice(0, 10)).toBe("2026-09-05");
  });
});

describe("échéances journalières et hebdomadaires", () => {
  const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
  it("journalière sauf dimanche : du samedi on passe au lundi", () => {
    expect(nextDueAt("daily", at("2026-11-21"), 6).toISOString().slice(0, 10)).toBe("2026-11-23");
    expect(nextDueAt("daily", at("2026-11-23"), 6).toISOString().slice(0, 10)).toBe("2026-11-24");
  });
  it("journalière tous les jours : le dimanche est inclus", () => {
    expect(nextDueAt("daily", at("2026-11-21"), 7).toISOString().slice(0, 10)).toBe("2026-11-22");
  });
  it("hebdomadaire : sept jours plus tard, première échéance au prochain jour choisi", () => {
    expect(nextDueAt("weekly", at("2026-11-20"), 5).toISOString().slice(0, 10)).toBe("2026-11-27");
    // Samedi 21 novembre, échéance le vendredi (5) → vendredi 27.
    expect(initialRecurringDueAt("weekly", 5, at("2026-11-21")).toISOString().slice(0, 10)).toBe("2026-11-27");
    // Le jour même compte.
    expect(initialRecurringDueAt("weekly", 6, at("2026-11-21")).toISOString().slice(0, 10)).toBe("2026-11-21");
  });
  it("journalière commencée un dimanche sans dimanche : premier jour au lundi", () => {
    expect(initialRecurringDueAt("daily", 6, at("2026-11-22")).toISOString().slice(0, 10)).toBe("2026-11-23");
  });
  it("mensuelle inchangée", () => {
    expect(nextDueAt("monthly", at("2026-01-31"), 31).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
  it("horizon et rappels adaptés au rythme", () => {
    expect(materializationHorizonDays("daily")).toBe(14);
    expect(materializationHorizonDays("weekly")).toBe(56);
    expect(defaultReminderDays("daily")).toEqual([0]);
    expect(defaultReminderDays("monthly")).toEqual([7, 3, 1]);
  });
});
