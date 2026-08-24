import { describe, expect, it } from "vitest";
import { settlementResult } from "./transactionRules";
import { resultingStock, signedMovementQuantity } from "./stockRules";
import { MAX_CENTS, MAX_QUANTITY } from "./numericLimits";

describe("limites d’intégrité métier", () => {
  it("refuse les quantités hors limite et les stocks négatifs", () => {
    expect(() => signedMovementQuantity("entry", MAX_QUANTITY + 1)).toThrow();
    expect(() => resultingStock(1, "exit", 2)).toThrow();
  });

  it("refuse les montants non sûrs ou hors capacité", () => {
    expect(() => settlementResult(MAX_CENTS + 1, "full", [MAX_CENTS + 1])).toThrow();
    expect(() => settlementResult(100, "full", [Number.MAX_SAFE_INTEGER])).toThrow();
  });

  it("conserve les invariants d’un règlement intégral valide", () => {
    expect(settlementResult(1_000, "full", [600, 400])).toEqual({ paidCents: 1_000, balanceCents: 0, status: "paid" });
  });
});
