import { and, eq } from "drizzle-orm";
import { automationJobRuns } from "../drizzle/schema";

export type AutomationJobType = "backup" | "payment_due_reminders";
export type AutomationRunStatus = "success" | "failed" | "skipped";

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ER_DUP_ENTRY";
}

function normalizedErrorCode(error: unknown) {
  if (error instanceof Error && error.name) return error.name.slice(0, 80);
  return "automation-error";
}

export function hourlyPeriodKey(date: Date, intervalHours: number) {
  const interval = Math.max(1, Math.min(168, Math.floor(intervalHours)));
  const bucketHour = Math.floor(date.getUTCHours() / interval) * interval;
  return `${date.toISOString().slice(0, 10)}T${String(bucketHour).padStart(2, "0")}:00Z/${interval}h`;
}

export function dailyPeriodKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function runObservedAutomation<T>(options: {
  db: any;
  companyId: number;
  jobType: AutomationJobType;
  periodKey: string;
  correlationId: string;
  execute: () => Promise<T>;
}): Promise<{ status: AutomationRunStatus; value?: T }> {
  const startedAt = new Date();
  try {
    await options.db.insert(automationJobRuns).values({
      companyId: options.companyId,
      jobType: options.jobType,
      periodKey: options.periodKey,
      correlationId: options.correlationId,
      status: "running",
      startedAt,
    });
  } catch (error) {
    if (isDuplicateKey(error)) return { status: "skipped" };
    throw error;
  }

  try {
    const value = await options.execute();
    await finalizeAutomationRun(options, "success", startedAt);
    return { status: "success", value };
  } catch (error) {
    await finalizeAutomationRun(options, "failed", startedAt, normalizedErrorCode(error)).catch(() => undefined);
    throw error;
  }
}

async function finalizeAutomationRun(options: Pick<Parameters<typeof runObservedAutomation>[0], "db" | "companyId" | "jobType" | "periodKey">, status: Exclude<AutomationRunStatus, "skipped">, startedAt: Date, errorCode: string | null = null) {
  const completedAt = new Date();
  await options.db.update(automationJobRuns).set({
    status,
    completedAt,
    durationMs: Math.min(Math.max(completedAt.getTime() - startedAt.getTime(), 0), 120_000),
    errorCode,
  }).where(and(
    eq(automationJobRuns.companyId, options.companyId),
    eq(automationJobRuns.jobType, options.jobType),
    eq(automationJobRuns.periodKey, options.periodKey),
  ));
}
