import { describe, expect, it } from "vitest";
import { informationPages } from "./informationPages";

describe("information pages", () => {
  it("référence les quatre pages d’information attendues", () => {
    expect(informationPages.map(page => page.path)).toEqual(["/aide", "/conditions-utilisation", "/politique-securite", "/contactez-nous"]);
  });
});
