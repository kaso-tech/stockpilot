import { assertSellerSensitiveAction } from "./sellerActionRules";
import { describe, expect, it } from "vitest";

describe("protections des actions sensibles vendeur", () => {
  it.each([
    ["invoice_cancellation", "annulation de facture"],
    ["refund", "remboursement"],
    ["stock_correction", "correction de stock"],
    ["purchase_price", "coût d’achat"],
  ] as const)("refuse %s lorsque le droit n’est pas accordé", (action, message) => {
    expect(() => assertSellerSensitiveAction({}, action)).toThrow(message);
  });

  it("autorise séparément les droits explicitement accordés", () => {
    expect(() => assertSellerSensitiveAction({ sellerCanCancelInvoice: true }, "invoice_cancellation")).not.toThrow();
    expect(() => assertSellerSensitiveAction({ sellerCanRefund: true }, "refund")).not.toThrow();
    expect(() => assertSellerSensitiveAction({ sellerCanCorrectStock: true }, "stock_correction")).not.toThrow();
    expect(() => assertSellerSensitiveAction({ sellerCanEditPurchasePrice: true }, "purchase_price")).not.toThrow();
  });
});
