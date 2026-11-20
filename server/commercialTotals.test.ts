import { describe, expect, it } from "vitest";
import { calculateCommercialTotals } from "./commercialTotals";

describe("commercialTotals", () => {
  it("calcule la TVA et la livraison sur la base taxable", () => {
    expect(calculateCommercialTotals({ subtotalCents: 10000, vatRateBasisPoints: 1800, deliveryFeeCents: 1500 })).toEqual({
      subtotalCents: 10000,
      vatRateBasisPoints: 1800,
      vatCents: 1800,
      deliveryFeeCents: 1500,
      totalCents: 13300,
    });
  });

  it("arrondit la TVA au centime et refuse les valeurs invalides", () => {
    expect(calculateCommercialTotals({ subtotalCents: 999, vatRateBasisPoints: 1750, deliveryFeeCents: 0 }).vatCents).toBe(175);
    expect(() => calculateCommercialTotals({ subtotalCents: -1, vatRateBasisPoints: 0, deliveryFeeCents: 0 })).toThrow();
    expect(() => calculateCommercialTotals({ subtotalCents: 1000, vatRateBasisPoints: 10001, deliveryFeeCents: 0 })).toThrow();
  });

  it("préserve un snapshot de taux nul lorsque la TVA est désactivée", () => {
    expect(calculateCommercialTotals({ subtotalCents: 2500, vatRateBasisPoints: 0, deliveryFeeCents: 300 })).toMatchObject({ vatRateBasisPoints: 0, vatCents: 0, totalCents: 2800 });
  });
});
