import { describe, expect, it } from "vitest";
import { allocateFefo, isIsoDateOnly, weightedAverageCost } from "./lotRules";
describe("règles des lots et du CMUP", () => {
  it("sort d’abord le lot à l’échéance la plus proche et laisse les lots sans date en dernier", () => {
    const receivedAt = new Date("2026-11-12T00:00:00Z");
    expect(allocateFefo([{ id: 1, lotNumber: "A", expiryDate: null, quantity: 10, receivedAt }, { id: 2, lotNumber: "B", expiryDate: "2026-12-01", quantity: 2, receivedAt }, { id: 3, lotNumber: "C", expiryDate: "2027-01-01", quantity: 5, receivedAt }], 4)).toEqual([{ lotId: 2, lotNumber: "B", expiryDate: "2026-12-01", quantity: 2 }, { lotId: 3, lotNumber: "C", expiryDate: "2027-01-01", quantity: 2 }]);
  });
  it("refuse une allocation supérieure au stock des lots", () => {
    expect(() => allocateFefo([], 1)).toThrow(/dépasse/);
    expect(() => allocateFefo([], 0)).toThrow(/positif/);
  });
  it("calcule le coût moyen pondéré sans écraser le coût du stock existant", () => {
    expect(weightedAverageCost(10, 100, 10, 200)).toBe(150);
    expect(weightedAverageCost(0, 0, 5, 700)).toBe(700);
    expect(weightedAverageCost(3, 9000, 2, 9000)).toBe(9000);
  });
  it("valide les dates civiles au lieu de tolérer le dépassement du mois", () => {
    expect(isIsoDateOnly("2026-02-28")).toBe(true);
    expect(isIsoDateOnly("2026-02-30")).toBe(false);
    expect(isIsoDateOnly("2026-13-01")).toBe(false);
  });
});
