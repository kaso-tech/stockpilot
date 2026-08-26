import { describe, expect, it } from "vitest";
import { matchesSellerAssignmentSearch, normalizeSellerWarehouseIds } from "./sellerAssignments";

describe("normalizeSellerWarehouseIds", () => {
  it("retourne une sélection stable et dédoublonnée pour la fenêtre d’affectation", () => {
    expect(normalizeSellerWarehouseIds([{ warehouseId: 4 }, { warehouseId: 2 }, { warehouseId: 4 }])).toEqual([4, 2]);
  });

  it("gère une absence d’affectation sans produire de nouvelle mutation métier", () => {
    expect(normalizeSellerWarehouseIds([])).toEqual([]);
  });

  it("retrouve un vendeur par son nom, identifiant interne ou e-mail", () => {
    const seller = { name: "Aïcha Diallo", username: "aicha.vente", email: "aicha@example.test" };
    expect(matchesSellerAssignmentSearch(seller, "diallo")).toBe(true);
    expect(matchesSellerAssignmentSearch(seller, "vente")).toBe(true);
    expect(matchesSellerAssignmentSearch(seller, "example")).toBe(true);
    expect(matchesSellerAssignmentSearch(seller, "inconnu")).toBe(false);
  });
});
