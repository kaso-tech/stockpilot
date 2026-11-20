export type PaymentDueStatus = "upcoming" | "due" | "overdue" | "partially_paid" | "paid" | "cancelled";

export function normalizeReminderDays(values: unknown): number[] {
  if (!Array.isArray(values)) return [7, 3, 1];
  const normalized = values.filter((value): value is number => Number.isInteger(value) && value >= 0 && value <= 90);
  return Array.from(new Set(normalized)).sort((left, right) => right - left).slice(0, 8);
}

export function resolvePaymentDueStatus(input: { dueAt: Date; amountCents: number; paidCents: number; cancelled?: boolean }, now = new Date()): PaymentDueStatus {
  if (input.cancelled) return "cancelled";
  if (input.paidCents >= input.amountCents) return "paid";
  if (input.paidCents > 0) return "partially_paid";
  const due = new Date(input.dueAt); due.setHours(0, 0, 0, 0);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return due < today ? "overdue" : due.getTime() === today.getTime() ? "due" : "upcoming";
}

export function monthlyDueDate(year: number, monthIndex: number, requestedDay: number): Date {
  const safeDay = Math.min(31, Math.max(1, Math.trunc(requestedDay)));
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(safeDay, lastDay), 12));
}

export function initialMonthlyDueAt(dueDay: number, now = new Date()): Date {
  const current = monthlyDueDate(now.getUTCFullYear(), now.getUTCMonth(), dueDay);
  return current.getTime() >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) ? current : monthlyDueDate(now.getUTCFullYear(), now.getUTCMonth() + 1, dueDay);
}

export function nextMonthlyDueAt(previousDueAt: Date, dueDay = previousDueAt.getUTCDate()): Date {
  return monthlyDueDate(previousDueAt.getUTCFullYear(), previousDueAt.getUTCMonth() + 1, dueDay);
}

export function reminderKindFor(input: { dueAt: Date; status: PaymentDueStatus; reminderDays: number[] }, now = new Date()): "upcoming" | "due" | "overdue" | null {
  if (["paid", "cancelled"].includes(input.status)) return null;
  if (input.status === "overdue") return "overdue";
  if (input.status === "due") return "due";
  const midnightNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const midnightDue = Date.UTC(input.dueAt.getUTCFullYear(), input.dueAt.getUTCMonth(), input.dueAt.getUTCDate());
  const daysUntilDue = Math.round((midnightDue - midnightNow) / 86_400_000);
  return input.reminderDays.includes(daysUntilDue) ? "upcoming" : null;
}
