import { describe, expect, it } from "vitest";
import { canCoordinateSaleFromWarehouse, hasValidCommercialScopeSelection } from "./salesAgentWarehouseScope";

describe("salesAgentWarehouseScope", () => {
  it("autorise les portées globales et d’attribution seule sur chaque dépôt", () => {
    expect(canCoordinateSaleFromWarehouse("all", [], 12)).toBe(true);
    expect(canCoordinateSaleFromWarehouse("attribution_only", [], 12)).toBe(true);
  });

  it("limite une portée sélectionnée aux dépôts attribués", () => {
    expect(canCoordinateSaleFromWarehouse("selected", [2, 7], 7)).toBe(true);
    expect(canCoordinateSaleFromWarehouse("selected", [2, 7], 3)).toBe(false);
    expect(hasValidCommercialScopeSelection("selected", [])).toBe(false);
    expect(hasValidCommercialScopeSelection("selected", [2])).toBe(true);
  });
});
