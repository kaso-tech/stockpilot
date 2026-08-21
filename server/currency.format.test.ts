import { describe, expect, it } from "vitest";
import { formatCurrency, setActiveCurrency } from "../client/src/lib/format";

describe("formatCurrency", () => {
  it("applique les trois devises disponibles", () => {
    setActiveCurrency("EUR");
    expect(formatCurrency(123456)).toContain("€");
    setActiveCurrency("USD");
    expect(formatCurrency(123456)).toMatch(/\$/);
    setActiveCurrency("XOF");
    expect(formatCurrency(123456)).toMatch(/FCFA/);
  });
});
