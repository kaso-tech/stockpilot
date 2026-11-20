import { describe, expect, it } from "vitest";
import { getPasswordStrength } from "./passwordStrength";

describe("getPasswordStrength", () => {
  it("distingue les mots de passe faibles, moyens et forts", () => {
    expect(getPasswordStrength("bonjour")).toMatchObject({ score: 1, label: "Faible" });
    expect(getPasswordStrength("Bonjour2026")).toMatchObject({ score: 4, label: "Moyen" });
    expect(getPasswordStrength("Bonjour!2026")).toMatchObject({ score: 5, label: "Fort" });
  });
});
