import { describe, expect, it, vi } from "vitest";
import { runPaymentDueReminderCompanies } from "./scheduledPaymentDueReminders";

describe("orchestration des rappels planifiés", () => {
  it("isole l’échec d’une entreprise et poursuit les autres périmètres", async () => {
    const runCompany = vi.fn(async (companyId: number) => {
      if (companyId === 2) throw new Error("échec local");
      return { status: "success" as const, value: { schedules: 1, reminders: companyId } };
    });
    const onCompanyError = vi.fn();

    await expect(runPaymentDueReminderCompanies({ companyIds: [1, 2, 3], runCompany, onCompanyError })).resolves.toEqual({ schedules: 2, reminders: 4, skippedCompanies: 0, failedCompanies: 1 });
    expect(runCompany).toHaveBeenCalledTimes(3);
    expect(onCompanyError).toHaveBeenCalledWith(2, expect.any(Error));
  });

  it("distingue une période déjà traitée d’une erreur", async () => {
    const runCompany = vi.fn(async (companyId: number) => companyId === 1 ? { status: "skipped" as const } : { status: "success" as const, value: { schedules: 2, reminders: 3 } });
    await expect(runPaymentDueReminderCompanies({ companyIds: [1, 2], runCompany })).resolves.toEqual({ schedules: 2, reminders: 3, skippedCompanies: 1, failedCompanies: 0 });
  });
});
