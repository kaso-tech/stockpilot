import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearch } from "./search";

describe("recherche sans accents", () => {
  it("ignore accents, casse et ligatures", () => {
    expect(matchesSearch("television", "Télévision Samsung")).toBe(true);
    expect(matchesSearch("TELEVISION", "télévision")).toBe(true);
    expect(matchesSearch("télé", "Television")).toBe(true);
    expect(matchesSearch("oeuf", "Œufs frais")).toBe(true);
    expect(matchesSearch("cafe moulu", "Café moulu 250 g")).toBe(true);
    expect(normalizeSearch("L’huile")).toBe("l'huile");
  });
  it("cherche chaque mot dans l'ensemble des champs", () => {
    expect(matchesSearch("huile 5", "Huile végétale 5 L", "HUI-5")).toBe(true);
    expect(matchesSearch("huile riz", "Huile végétale 5 L")).toBe(false);
    expect(matchesSearch("", "n'importe quoi")).toBe(true);
    expect(matchesSearch("  ", null, undefined)).toBe(true);
  });
});
