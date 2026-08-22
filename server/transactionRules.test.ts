import { describe, expect, it } from "vitest";
import { settlementResult } from "./transactionRules";

describe("settlementResult", () => {
  it("valide un règlement intégral avec plusieurs moyens", () => {
    expect(settlementResult(12500, "full", [5000, 7500])).toEqual({ paidCents: 12500, balanceCents: 0, status: "paid" });
  });
  it("calcule le solde d’un règlement partiel", () => {
    expect(settlementResult(12500, "partial", [3500])).toEqual({ paidCents: 3500, balanceCents: 9000, status: "partial" });
  });
  it("rejette un règlement intégral incomplet et un dépassement", () => {
    expect(() => settlementResult(12500, "full", [12000])).toThrow("totalité");
    expect(() => settlementResult(12500, "partial", [13000])).toThrow("dépasse");
  });
});
