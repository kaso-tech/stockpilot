import { describe, expect, it } from "vitest";
import { isCheckoutShortcut, stockAfterCartSelection } from "../client/src/lib/posCartRules";

describe("raccourci d’encaissement POS", () => {
  it("autorise F9 hors des champs d’édition et protège la saisie", () => {
    expect(isCheckoutShortcut({ key: "F9", targetTag: "DIV" })).toBe(true);
    expect(isCheckoutShortcut({ key: "F9", targetTag: "INPUT" })).toBe(false);
    expect(isCheckoutShortcut({ key: "F9", targetTag: "TEXTAREA" })).toBe(false);
    expect(isCheckoutShortcut({ key: "F9", targetTag: "DIV", ctrlKey: true })).toBe(false);
  });
});

describe("alerte de stock faible du panier POS", () => {
  it("signale le passage au seuil après la sélection d’un article", () => {
    expect(stockAfterCartSelection(10, 4, 6)).toEqual({ remainingAfterSale: 6, isLowStock: true });
    expect(stockAfterCartSelection(10, 3, 6)).toEqual({ remainingAfterSale: 7, isLowStock: false });
    expect(stockAfterCartSelection(10, 10, 0)).toEqual({ remainingAfterSale: 0, isLowStock: false });
  });
});
