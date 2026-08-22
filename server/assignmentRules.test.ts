import { describe, expect, it } from "vitest";
import { shouldPromptForAssignment } from "../client/src/lib/assignmentRules";

describe("rattachement des ventes", () => {
  it("affiche le sélecteur uniquement lorsqu’aucun compte par défaut n’est configuré", () => {
    expect(shouldPromptForAssignment(null)).toBe(true);
    expect(shouldPromptForAssignment(undefined)).toBe(true);
    expect(shouldPromptForAssignment(12)).toBe(false);
  });
});
