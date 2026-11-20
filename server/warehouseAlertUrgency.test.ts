import { describe, expect, it } from "vitest";
import { classifyWarehouseAlertUrgency, normalizeCoverageDays } from "./warehouseAlertUrgency";

describe("warehouse alert urgency", () => {
  it("classe l’urgence selon la couverture et la rupture effective", () => {
    expect(classifyWarehouseAlertUrgency(0.8, 4)).toBe("critical");
    expect(classifyWarehouseAlertUrgency(2.5, 4)).toBe("high");
    expect(classifyWarehouseAlertUrgency(7, 4)).toBe("medium");
    expect(classifyWarehouseAlertUrgency(null, 0)).toBe("critical");
  });

  it("estime une couverture sur la consommation récente", () => {
    expect(normalizeCoverageDays(20, 40)).toBe(15);
    expect(normalizeCoverageDays(20, 0)).toBeNull();
  });
});
