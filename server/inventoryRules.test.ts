import { describe, expect, it } from "vitest";
import { inventoryDifference, shouldCreateAdjustment } from "./inventoryRules";

describe("règles métier d’inventaire", () => {
  it("calcule les écarts de comptage à appliquer au stock", () => {
    expect(inventoryDifference(12, 15)).toBe(3);
    expect(inventoryDifference(12, 9)).toBe(-3);
    expect(inventoryDifference(12, 12)).toBe(0);
  });

  it("ne crée un ajustement que lorsqu’un écart est constaté", () => {
    expect(shouldCreateAdjustment(10, 10)).toBe(false);
    expect(shouldCreateAdjustment(10, 8)).toBe(true);
  });

  it("refuse un comptage invalide", () => {
    expect(() => inventoryDifference(-1, 2)).toThrow("quantités d’inventaire");
  });
});
