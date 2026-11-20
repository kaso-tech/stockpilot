import { describe, expect, it } from "vitest";
import { blankCheckoutAmounts, distributeIntegralPayment, isExactIntegralPayment, isPosCheckout, updateIntegralPayment } from "../client/src/lib/checkoutRules";

describe("règles d’encaissement de l’interface", () => {
  it("reconnaît un ticket POS et réserve le mode partiel aux factures", () => {
    expect(isPosCheckout({ invoiceNumber: "POS-20260822-001" })).toBe(true);
    expect(isPosCheckout({ channel: "invoice", invoiceNumber: "FAC-20260822-001" })).toBe(false);
  });
  it("ne préremplit rien avant la sélection d’un moyen", () => expect(blankCheckoutAmounts).toEqual({ cash: "", card: "", mobile_money: "", bank_transfer: "", credit: "" }));
  it("préremplit le premier moyen sélectionné avec le montant intégral", () => {
    expect(distributeIntegralPayment(["cash"], blankCheckoutAmounts, 10000).cash).toBe("100");
  });
  it("répartit automatiquement le reste sur le moyen suivant et bloque les totaux incohérents", () => {
    const initial = distributeIntegralPayment(["cash", "mobile_money"], blankCheckoutAmounts, 10000);
    const split = updateIntegralPayment(["cash", "mobile_money"], initial, "cash", "75", 10000);
    expect(split).toMatchObject({ cash: "75", mobile_money: "25" });
    expect(isExactIntegralPayment(["cash", "mobile_money"], split, 10000)).toBe(true);
    expect(isExactIntegralPayment(["cash"], { ...blankCheckoutAmounts, cash: "99" }, 10000)).toBe(false);
  });
});
