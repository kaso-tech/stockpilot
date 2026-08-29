import { describe, expect, it } from "vitest";
import { isPaymentDueReceiptKeyInScope } from "./paymentReceiptRules";

describe("isPaymentDueReceiptKeyInScope", () => {
  it("accepte une clé de justificatif créée pour la bonne entreprise et occurrence", () => {
    expect(isPaymentDueReceiptKeyInScope("company/11/payment-due-settlements/29/af4d9c3e-1e6a-4ab0-8d00-79c2f0a86b27.pdf", 11, 29)).toBe(true);
  });

  it("refuse une clé d’une autre entreprise, occurrence ou un chemin ambigu", () => {
    expect(isPaymentDueReceiptKeyInScope("company/12/payment-due-settlements/29/fichier.pdf", 11, 29)).toBe(false);
    expect(isPaymentDueReceiptKeyInScope("company/11/payment-due-settlements/30/fichier.pdf", 11, 29)).toBe(false);
    expect(isPaymentDueReceiptKeyInScope("company/11/payment-due-settlements/29/../fichier.pdf", 11, 29)).toBe(false);
  });
});
