import { describe, expect, it } from "vitest";
import { discountCents } from "./discountRules";

describe("discountCents", () => {
  it("calcule une remise en pourcentage", () => expect(discountCents(100000, "percent", 1500)).toBe(15000));
  it("plafonne une remise fixe au sous-total", () => expect(discountCents(100000, "fixed", 120000)).toBe(100000));
  it("rejette un taux impossible", () => expect(() => discountCents(100000, "percent", 10001)).toThrow("invalide"));
});
