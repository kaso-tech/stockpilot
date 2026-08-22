import { describe, expect, it } from "vitest";
import { customerCanBeRemoved } from "./customerRules";

describe("règles de suppression client", () => {
  it("préserve un client déjà utilisé dans une facture", () => {
    expect(customerCanBeRemoved(0)).toBe(true);
    expect(customerCanBeRemoved(1)).toBe(false);
  });
});
