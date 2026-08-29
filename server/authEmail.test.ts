import { describe, expect, it } from "vitest";
import { normalizeAuthEmail } from "./authEmail";

describe("normalizeAuthEmail", () => {
  it("normalise la casse et les espaces sans modifier les données affichées", () => {
    expect(normalizeAuthEmail("  Administrateur@Exemple.Test ")).toBe("administrateur@exemple.test");
  });

  it("retourne null pour une valeur absente ou vide", () => {
    expect(normalizeAuthEmail(null)).toBeNull();
    expect(normalizeAuthEmail("   ")).toBeNull();
  });
});
