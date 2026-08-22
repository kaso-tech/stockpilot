import { describe, expect, it } from "vitest";

const unitPattern = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s'-]+$/;

describe("unit input validation", () => {
  it("accepts practical unit names and rejects unsafe characters", () => {
    expect(unitPattern.test("Pièce")).toBe(true);
    expect(unitPattern.test("Boîte 12")).toBe(true);
    expect(unitPattern.test("mètre-carré")).toBe(true);
    expect(unitPattern.test("<script>")).toBe(false);
  });
});
