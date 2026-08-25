import { describe, expect, it } from "vitest";
import { assertVatPresetSelection, normalizeVatPresetRates } from "./vatRateRules";

describe("taux TVA prédéfinis", () => {
  it("normalise les taux actifs, uniques et ordonnés", () => {
    expect(normalizeVatPresetRates([{ rateBasisPoints: 1800 }, { rateBasisPoints: 500 }, { rateBasisPoints: 1800 }, { rateBasisPoints: 1000, active: false }])).toEqual([500, 1800]);
  });
  it("refuse un taux qui n’appartient pas aux préréglages actifs", () => {
    expect(() => assertVatPresetSelection(1000, [{ rateBasisPoints: 500 }, { rateBasisPoints: 1800 }])).toThrow("n’est pas autorisé");
    expect(() => assertVatPresetSelection(1800, [{ rateBasisPoints: 500 }, { rateBasisPoints: 1800 }])).not.toThrow();
  });
});
