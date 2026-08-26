import { describe, expect, it } from "vitest";
import { informationPages } from "./informationPages";

describe("information pages", () => {
  it("référence les pages d’information et de tarification attendues", () => {
    expect(informationPages.map(page => page.path)).toEqual(["/tarifs", "/aide", "/conditions-utilisation", "/politique-securite", "/contactez-nous"]);
  });
});
