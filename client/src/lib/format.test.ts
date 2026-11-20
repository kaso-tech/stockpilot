import { describe, expect, it } from "vitest";
import { formatCurrency, setActiveCurrency, setActivePriceFormat } from "./format";

describe("formatCurrency", () => {
  it("applique les trois devises disponibles", () => {
    setActivePriceFormat("space", "none");
    setActiveCurrency("EUR");
    expect(formatCurrency(123456)).toContain("€");
    setActiveCurrency("USD");
    expect(formatCurrency(123456)).toMatch(/\$/);
    setActiveCurrency("XOF");
    expect(formatCurrency(123456)).toMatch(/CFA|F\s?CFA/);
  });

  it("applique les séparateurs et l’arrondi configurés", () => {
    setActiveCurrency("XOF");
    setActivePriceFormat("comma", "hundred");
    expect(formatCurrency(2568730)).toContain("25,700");
    setActivePriceFormat("none", "none");
    expect(formatCurrency(2568730)).toContain("25687");
    setActivePriceFormat("space", "none");
  });
});
