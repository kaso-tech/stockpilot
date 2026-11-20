import { describe, expect, it } from "vitest";
import { invoiceEmailMessage, invoiceEmailSubject } from "./invoiceShare";

describe("invoiceShare", () => {
  it("prépare l’objet et le corps d’un e-mail de facture", () => {
    expect(invoiceEmailSubject("FAC-42")).toBe("Facture FAC-42");
    expect(invoiceEmailMessage({ customerName: "Komi", invoiceNumber: "FAC-42", total: "15 000 FCFA" })).toContain("Komi");
    expect(invoiceEmailMessage({ customerName: "Komi", invoiceNumber: "FAC-42", total: "15 000 FCFA" })).toContain("15 000 FCFA");
  });
});
