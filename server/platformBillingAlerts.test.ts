import { describe, expect, it } from "vitest";
import { buildPlatformBillingAlerts } from "./platformBillingAlerts";

describe("buildPlatformBillingAlerts", () => {
  const now = new Date("2026-08-27T10:00:00.000Z");
  it("retains only actionable active-company subscription metadata", () => {
    const alerts = buildPlatformBillingAlerts([
      { companyId: 1, companyName: "Entreprise A", platformStatus: "active", subscriptionStatus: "past_due", trialEndsAt: null, currentPeriodEndsAt: new Date("2026-08-20T00:00:00.000Z"), graceEndsAt: null },
      { companyId: 2, companyName: "Entreprise B", platformStatus: "active", subscriptionStatus: "active", trialEndsAt: null, currentPeriodEndsAt: new Date("2026-09-03T00:00:00.000Z"), graceEndsAt: null },
      { companyId: 3, companyName: "Entreprise C", platformStatus: "suspended", subscriptionStatus: "past_due", trialEndsAt: null, currentPeriodEndsAt: null, graceEndsAt: null },
    ], now);
    expect(alerts.map(alert => ({ key: alert.key, priority: alert.priority }))).toEqual([
      { key: "subscription:1:past_due", priority: "critical" },
      { key: "subscription:2:period_end", priority: "info" },
    ]);
    expect(alerts.every(alert => alert.section === "subscriptions" && !Object.hasOwn(alert, "ownerEmail"))).toBe(true);
  });
});
