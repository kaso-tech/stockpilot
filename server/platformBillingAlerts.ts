export type PlatformBillingAlertSource = {
  companyId: number;
  companyName: string;
  platformStatus: "active" | "suspended";
  subscriptionStatus: "trial" | "active" | "past_due" | "suspended" | "cancelled" | "manual" | null;
  trialEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  graceEndsAt: Date | null;
};

export type PlatformBillingAlert = {
  key: string;
  companyId: number;
  title: string;
  detail: string;
  dueAt: Date;
  priority: "critical" | "warning" | "info";
  section: "subscriptions";
};

function daysUntil(date: Date, now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((target - today) / 86_400_000);
}

export function buildPlatformBillingAlerts(rows: PlatformBillingAlertSource[], now = new Date()): PlatformBillingAlert[] {
  const alerts: PlatformBillingAlert[] = [];
  for (const row of rows) {
    if (row.platformStatus !== "active" || !row.subscriptionStatus || row.subscriptionStatus === "cancelled" || row.subscriptionStatus === "manual") continue;
    if (row.subscriptionStatus === "past_due") {
      const dueAt = row.graceEndsAt ?? row.currentPeriodEndsAt ?? now;
      alerts.push({ key: `subscription:${row.companyId}:past_due`, companyId: row.companyId, title: "Paiement à régulariser", detail: `${row.companyName} est en attente de règlement.`, dueAt, priority: "critical", section: "subscriptions" });
    }
    if (row.graceEndsAt && daysUntil(row.graceEndsAt, now) <= 7 && daysUntil(row.graceEndsAt, now) >= -14) {
      alerts.push({ key: `subscription:${row.companyId}:grace_end`, companyId: row.companyId, title: "Fin de délai de grâce", detail: `${row.companyName} atteint la fin de son délai de grâce.`, dueAt: row.graceEndsAt, priority: daysUntil(row.graceEndsAt, now) < 0 ? "critical" : "warning", section: "subscriptions" });
    } else if (row.subscriptionStatus === "trial" && row.trialEndsAt && daysUntil(row.trialEndsAt, now) <= 7 && daysUntil(row.trialEndsAt, now) >= 0) {
      alerts.push({ key: `subscription:${row.companyId}:trial_end`, companyId: row.companyId, title: "Fin d’essai proche", detail: `${row.companyName} arrive à la fin de son essai.`, dueAt: row.trialEndsAt, priority: "info", section: "subscriptions" });
    } else if (row.currentPeriodEndsAt && daysUntil(row.currentPeriodEndsAt, now) <= 14 && daysUntil(row.currentPeriodEndsAt, now) >= 0) {
      alerts.push({ key: `subscription:${row.companyId}:period_end`, companyId: row.companyId, title: "Échéance de souscription proche", detail: `${row.companyName} arrive à échéance.`, dueAt: row.currentPeriodEndsAt, priority: daysUntil(row.currentPeriodEndsAt, now) <= 3 ? "warning" : "info", section: "subscriptions" });
    }
  }
  const priorityOrder = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.dueAt.getTime() - b.dueAt.getTime());
}
