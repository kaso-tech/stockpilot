import { describe, expect, it } from "vitest";
import { normalizeSellerWarehouseIds } from "./sellerAssignments";

describe("normalizeSellerWarehouseIds", () => {
  it("retourne une sélection stable et dédoublonnée pour la fenêtre d’affectation", () => {
    expect(normalizeSellerWarehouseIds([{ warehouseId: 4 }, { warehouseId: 2 }, { warehouseId: 4 }])).toEqual([4, 2]);
  });

  it("gère une absence d’affectation sans produire de nouvelle mutation métier", () => {
    expect(normalizeSellerWarehouseIds([])).toEqual([]);
  });
});
