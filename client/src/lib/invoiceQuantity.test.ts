import { describe, expect, it } from "vitest";
import { nextInvoiceQuantity } from "./invoiceQuantity";

describe("nextInvoiceQuantity", () => {
  it("borne les ajustements entre une unité et le stock disponible", () => {
    expect(nextInvoiceQuantity(2, 1, 5)).toBe(3);
    expect(nextInvoiceQuantity(1, -1, 5)).toBe(1);
    expect(nextInvoiceQuantity(5, 1, 5)).toBe(5);
  });
});
