import { describe, expect, it } from "vitest";
import { invoiceCustomerPrefill } from "./invoicePrefill";

describe("invoiceCustomerPrefill", () => {
  it("retourne un identifiant client valide depuis l’URL", () => {
    expect(invoiceCustomerPrefill("?client=42")).toBe("42");
  });
  it("ignore les identifiants absents ou invalides", () => {
    expect(invoiceCustomerPrefill("")).toBeNull();
    expect(invoiceCustomerPrefill("?client=0")).toBeNull();
    expect(invoiceCustomerPrefill("?client=abc")).toBeNull();
  });
});
