import type { Request, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { paymentDueOccurrences, paymentDueReminderEvents, paymentDueReminderJobSettings, paymentDueSchedules } from "../drizzle/schema";
import { getDb } from "./db";
import { materializePaymentDueOccurrences } from "./routers/paymentDues";
import { normalizeReminderDays, reminderKindFor, resolvePaymentDueStatus } from "./paymentDueRules";
import { dailyPeriodKey, runObservedAutomation } from "./automationMonitoring";
import { sdk } from "./_core/sdk";

function dayKey(date: Date) { return date.toISOString().slice(0, 10); }

export async function processPaymentDueRemindersForCompany(db: any, companyId: number, now: Date) {
  const schedules = await db.select().from(paymentDueSchedules).where(and(eq(paymentDueSchedules.status, "active"), eq(paymentDueSchedules.companyId, companyId)));
  for (const schedule of schedules) await materializePaymentDueOccurrences(db, schedule, now);

  const rows = await db.select({ occurrence: paymentDueOccurrences, schedule: paymentDueSchedules }).from(paymentDueOccurrences).innerJoin(paymentDueSchedules, eq(paymentDueOccurrences.scheduleId, paymentDueSchedules.id)).where(and(eq(paymentDueOccurrences.companyId, companyId), eq(paymentDueSchedules.status, "active"), inArray(paymentDueOccurrences.status, ["upcoming", "due", "overdue", "partially_paid"])));
  let reminders = 0;
  for (const row of rows) {
    const status = resolvePaymentDueStatus({ dueAt: row.occurrence.dueAt, amountCents: row.occurrence.amountCents, paidCents: row.occurrence.paidCents }, now);
    if (status !== row.occurrence.status) await db.update(paymentDueOccurrences).set({ status }).where(eq(paymentDueOccurrences.id, row.occurrence.id));
    const reminderKind = reminderKindFor({ dueAt: row.occurrence.dueAt, status, reminderDays: normalizeReminderDays(JSON.parse(row.schedule.reminderDaysJson)) }, now);
    if (!reminderKind) continue;
    await db.insert(paymentDueReminderEvents).values({ occurrenceId: row.occurrence.id, companyId: row.occurrence.companyId, reminderKind, triggeredForDate: dayKey(now) }).onDuplicateKeyUpdate({ set: { reminderKind } }); // Rappel déjà noté ce jour : sans effet (une mise à jour vide est refusée).
    reminders += 1;
  }
  return { schedules: schedules.length, reminders };
}

export async function runPaymentDueReminderCompanies(options: {
  companyIds: number[];
  runCompany: (companyId: number) => Promise<{ status: "success" | "failed" | "skipped"; value?: { schedules: number; reminders: number } }>;
  onCompanyError?: (companyId: number, error: unknown) => void;
}) {
  let schedules = 0;
  let reminders = 0;
  let skippedCompanies = 0;
  let failedCompanies = 0;
  for (const companyId of options.companyIds) {
    try {
      const observed = await options.runCompany(companyId);
      if (observed.status === "skipped") { skippedCompanies += 1; continue; }
      if (observed.status === "failed") { failedCompanies += 1; continue; }
      schedules += observed.value?.schedules ?? 0;
      reminders += observed.value?.reminders ?? 0;
    } catch (error) {
      failedCompanies += 1;
      options.onCompanyError?.(companyId, error);
    }
  }
  return { schedules, reminders, skippedCompanies, failedCompanies };
}

export async function runScheduledPaymentDueReminders(req: Request, res: Response) {
  let caller;
  try { caller = await sdk.authenticateRequest(req); } catch { return res.status(401).json({ error: "unauthorized" }); }
  if (!caller.isCron || !caller.taskUid) return res.status(403).json({ error: "cron-only" });

  const correlationId = crypto.randomUUID();
  const now = new Date();
  let settingsId: number | null = null;
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "service-unavailable", correlationId });
    const settings = (await db.select().from(paymentDueReminderJobSettings).where(eq(paymentDueReminderJobSettings.scheduleCronTaskUid, caller.taskUid)).limit(1))[0];
    if (!settings || !settings.enabled) return res.json({ ok: true, skipped: "inactive-or-orphan" });
    settingsId = settings.id;
    const companyRows = await db.selectDistinct({ companyId: paymentDueSchedules.companyId }).from(paymentDueSchedules).where(eq(paymentDueSchedules.status, "active"));
    const summary = await runPaymentDueReminderCompanies({
      companyIds: companyRows.map(row => row.companyId),
      runCompany: companyId => runObservedAutomation({ db, companyId, jobType: "payment_due_reminders", periodKey: dailyPeriodKey(now), correlationId, execute: () => processPaymentDueRemindersForCompany(db, companyId, now) }),
      onCompanyError: (companyId, error) => console.error("[ScheduledPaymentDueReminders] company execution failed", { correlationId, companyId, error }),
    });
    const { schedules, reminders, skippedCompanies, failedCompanies } = summary;
    await db.update(paymentDueReminderJobSettings).set({ lastRunAt: now, lastRunStatus: failedCompanies ? "failed" : "success", lastRunError: failedCompanies ? `${failedCompanies} entreprise(s) en erreur` : null }).where(eq(paymentDueReminderJobSettings.id, settings.id));
    return res.json({ ok: true, status: failedCompanies ? "partial" : "success", companies: companyRows.length, schedules, reminders, skippedCompanies, failedCompanies, correlationId });
  } catch (error) {
    try {
      const db = await getDb();
      if (db && settingsId) await db.update(paymentDueReminderJobSettings).set({ lastRunAt: now, lastRunStatus: "failed", lastRunError: String(error).slice(0, 500) }).where(eq(paymentDueReminderJobSettings.id, settingsId));
    } catch { /* Preserve the original failure response. */ }
    console.error("[ScheduledPaymentDueReminders] execution failed", { correlationId, error });
    return res.status(500).json({ error: "payment-due-reminders-failed", correlationId, timestamp: now.toISOString() });
  }
}
