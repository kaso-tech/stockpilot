import { describe, expect, it } from "vitest";
import { isBelowMinimum, resultingStock, signedMovementQuantity } from "./stockRules";

describe("règles métier des stocks", () => {
  it("normalise les entrées et sorties avec le bon signe", () => {
    expect(signedMovementQuantity("entry", -8)).toBe(8);
    expect(signedMovementQuantity("exit", 8)).toBe(-8);
    expect(signedMovementQuantity("adjustment", -3)).toBe(-3);
  });

  it("calcule le stock résultant pour une entrée, une sortie et un ajustement", () => {
    expect(resultingStock(10, "entry", 5)).toBe(15);
    expect(resultingStock(10, "exit", 4)).toBe(6);
    expect(resultingStock(10, "adjustment", -2)).toBe(8);
  });

  it("refuse toute opération qui créerait un stock négatif", () => {
    expect(() => resultingStock(3, "exit", 4)).toThrow("stock négatif");
  });

  it("active l’alerte lorsque le stock atteint ou descend sous le seuil", () => {
    expect(isBelowMinimum(5, 5)).toBe(true);
    expect(isBelowMinimum(2, 5)).toBe(true);
    expect(isBelowMinimum(6, 5)).toBe(false);
  });
});
