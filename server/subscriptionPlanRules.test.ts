import { describe, expect, it } from "vitest";
import { subscriptionBillingIntervalLabel, subscriptionPlanPricingInput } from "./subscriptionPlanRules";

describe("tarification des offres SaaS", () => {
  it("accepte les modalités mensuelle, annuelle et à vie en XOF", () => {
    expect(subscriptionPlanPricingInput.parse({ priceCents: 1000, billingInterval: "monthly" })).toMatchObject({ currency: "XOF", billingInterval: "monthly" });
    expect(subscriptionPlanPricingInput.parse({ priceCents: 12000, billingInterval: "annual" }).billingInterval).toBe("annual");
    expect(subscriptionPlanPricingInput.parse({ priceCents: 25000, billingInterval: "lifetime" }).billingInterval).toBe("lifetime");
  });

  it("refuse une devise, un montant ou une modalité non autorisés", () => {
    expect(() => subscriptionPlanPricingInput.parse({ priceCents: -1, billingInterval: "monthly" })).toThrow();
    expect(() => subscriptionPlanPricingInput.parse({ priceCents: 1000, currency: "EUR", billingInterval: "monthly" })).toThrow();
    expect(() => subscriptionPlanPricingInput.parse({ priceCents: 1000, billingInterval: "weekly" })).toThrow();
  });

  it("présente les libellés français stables", () => {
    expect(subscriptionBillingIntervalLabel("monthly")).toBe("Mensuel");
    expect(subscriptionBillingIntervalLabel("annual")).toBe("Annuel");
    expect(subscriptionBillingIntervalLabel("lifetime")).toBe("À vie");
  });
});
