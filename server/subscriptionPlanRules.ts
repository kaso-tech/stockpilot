import { z } from "zod";

export const subscriptionBillingIntervals = ["monthly", "annual", "lifetime"] as const;
export type SubscriptionBillingInterval = (typeof subscriptionBillingIntervals)[number];

export const subscriptionPlanPricingInput = z.object({
  priceCents: z.number().int().min(0).max(100_000_000),
  currency: z.literal("XOF").default("XOF"),
  billingInterval: z.enum(subscriptionBillingIntervals).default("monthly"),
});

export function subscriptionBillingIntervalLabel(interval: SubscriptionBillingInterval) {
  return interval === "monthly" ? "Mensuel" : interval === "annual" ? "Annuel" : "À vie";
}
