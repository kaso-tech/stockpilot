import { describe, expect, it } from "vitest";
import { moneyLabel } from "./moneyLabel";

describe("montant du journal", () => {
  it("affiche les FCFA, jamais les centimes", () => {
    expect(moneyLabel(250000)).toBe("2 500 FCFA");
    expect(moneyLabel(12345600)).toBe("123 456 FCFA");
  });
});
