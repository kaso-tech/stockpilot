import { describe, expect, it } from "vitest";
import { computeVatBreakdown } from "./pricing";
describe("TVA par ligne et remises", () => {
  it("calcule les taux distincts et l’exonération indépendamment", () => {
    const result = computeVatBreakdown([{ netCents: 10000, vatRateBasisPoints: 2000 }, { netCents: 10000, vatRateBasisPoints: 500 }, { netCents: 10000, vatRateBasisPoints: 0 }], 3000);
    expect(result.taxableCents).toBe(27000);
    expect(result.vatCents).toBe(2250);
    expect(result.byRate).toHaveLength(3);
    expect(result.perLine.map(line => line.allocatedDiscountCents)).toEqual([1000, 1000, 1000]);
  });
  it("répartit exactement un centime de remise avec un résultat stable", () => {
    const result = computeVatBreakdown([{ netCents: 100, vatRateBasisPoints: 0 }, { netCents: 100, vatRateBasisPoints: 0 }], 1);
    expect(result.perLine.map(line => line.allocatedDiscountCents)).toEqual([1, 0]);
    expect(result.taxableCents).toBe(199);
  });
  it("refuse les taux invalides et une remise dépassant les lignes", () => {
    expect(() => computeVatBreakdown([{ netCents: 100, vatRateBasisPoints: -1 }], 0)).toThrow();
    expect(() => computeVatBreakdown([{ netCents: 100, vatRateBasisPoints: 0 }], 101)).toThrow();
  });
});
