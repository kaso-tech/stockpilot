import { describe, expect, it } from "vitest";
import { hasValidSupportImageSignature, normalizeSupportFilename } from "./supportRequestRules";

describe("support request image rules", () => {
  it("accepte uniquement une signature PNG cohérente avec le type annoncé", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(hasValidSupportImageSignature("image/png", png)).toBe(true);
    expect(hasValidSupportImageSignature("image/jpeg", png)).toBe(false);
  });

  it("neutralise les séparateurs dans le nom de la pièce jointe", () => {
    expect(normalizeSupportFilename(" ../incident/écran.png ")).toBe(".._incident_écran.png");
  });
});
