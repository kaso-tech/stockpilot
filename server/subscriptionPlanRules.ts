import { z } from "zod";

export const subscriptionBillingIntervals = ["monthly", "annual", "lifetime"] as const;
export type SubscriptionBillingInterval = (typeof subscriptionBillingIntervals)[number];

export const subscriptionPlanPricingInput = z.object({
  priceCents: z.number().int().min(0).max(100_000_000),
  currency: z.literal("XOF").default("XOF"),
  billingInterval: z.enum(subscriptionBillingIntervals).default("monthly"),
});

export const subscriptionLimitKeys = ["users", "products", "warehouses"] as const;
export const subscriptionPlanLimitsInput = z.object({
  users: z.number().int().min(0).max(1_000_000).optional(),
  products: z.number().int().min(0).max(1_000_000).optional(),
  warehouses: z.number().int().min(0).max(1_000_000).optional(),
}).strict().superRefine((limits, ctx) => {
  if (Buffer.byteLength(JSON.stringify(limits), "utf8") > 3500) {
    ctx.addIssue({ code: "custom", message: "Les limites configurées dépassent la taille maximale autorisée." });
  }
});

export function parsePlanLimits(value: unknown): Record<string, number> {
  let candidate = value;
  if (typeof value === "string") {
    try { candidate = JSON.parse(value); } catch { return {}; }
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return {};
  const limits: Record<string, number> = {};
  for (const key of subscriptionLimitKeys) {
    const limit = (candidate as Record<string, unknown>)[key];
    if (typeof limit === "number" && Number.isSafeInteger(limit) && limit >= 0 && limit <= 1_000_000) limits[key] = limit;
  }
  return limits;
}

export function subscriptionBillingIntervalLabel(interval: SubscriptionBillingInterval) {
  return interval === "monthly" ? "Mensuel" : interval === "annual" ? "Annuel" : "À vie";
}
