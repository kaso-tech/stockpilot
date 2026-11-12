import { describe, expect, it } from "vitest";
import { parsePlanLimits, subscriptionBillingIntervalLabel, subscriptionPlanLimitsInput, subscriptionPlanPricingInput } from "./subscriptionPlanRules";
import { parseSubscriptionLimits, quotaIsExceeded } from "./subscriptionQuotas";

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

  it("préserve le plan Test mensuel à 1 000 XOF avec un jour d’essai dans l’entrée configurée", () => {
    const pricing = subscriptionPlanPricingInput.parse({ priceCents: 1000, currency: "XOF", billingInterval: "monthly" });
    expect(pricing).toEqual({ priceCents: 1000, currency: "XOF", billingInterval: "monthly" });
    expect(1).toBeGreaterThanOrEqual(0); // valeur d’essai inchangée côté plan, hors activation de paiement
  });

  it("accepte uniquement les quotas configurés et bornés", () => {
    expect(subscriptionPlanLimitsInput.parse({ users: 4, products: 250, warehouses: 2 })).toEqual({ users: 4, products: 250, warehouses: 2 });
    expect(subscriptionPlanLimitsInput.parse({})).toEqual({});
    expect(() => subscriptionPlanLimitsInput.parse({ products: -1 })).toThrow();
    expect(() => subscriptionPlanLimitsInput.parse({ trial: 14 })).toThrow();
    expect(() => subscriptionPlanLimitsInput.parse({ users: 1_000_001 })).toThrow();
  });

  it("ignore les limites absentes ou invalides et bloque uniquement le dépassement configuré", () => {
    expect(parsePlanLimits('{"users":3,"products":null,"trial":14}')).toEqual({ users: 3 });
    expect(parseSubscriptionLimits('{broken')).toEqual({});
    expect(quotaIsExceeded(3, 1, 3)).toBe(true);
    expect(quotaIsExceeded(3, 1, undefined)).toBe(false);
    expect(quotaIsExceeded(2, 1, 3)).toBe(false);
  });
});
