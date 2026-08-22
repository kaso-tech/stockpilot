import { describe, expect, it } from "vitest";
import { recommendedRestockQuantity, restockEstimateCents } from "../client/src/lib/replenishmentRules";

describe("liste d’achats fournisseur", () => {
  it("propose une quantité qui fait sortir le produit du seuil d’alerte", () => {
    expect(recommendedRestockQuantity(4, 8)).toBe(5);
    expect(recommendedRestockQuantity(8, 8)).toBe(1);
    expect(restockEstimateCents(5, 2_500)).toBe(12_500);
  });
});
