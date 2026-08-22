import { describe, expect, it } from "vitest";
import { categoryCanBeRemoved } from "./categoryRules";

describe("règles de catégories", () => {
  it("empêche la suppression d’une catégorie encore utilisée par un produit", () => {
    expect(categoryCanBeRemoved(0)).toBe(true);
    expect(categoryCanBeRemoved(1)).toBe(false);
  });
});
