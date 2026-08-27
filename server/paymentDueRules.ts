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

export function nextMonthlyDueAt(previousDueAt: Date): Date {
  const next = new Date(previousDueAt);
  const expectedDay = previousDueAt.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(expectedDay, lastDay));
  return next;
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
