import { describe, expect, it } from "vitest";
import { commissionBalance, commissionReportPeriod } from "./commissionReportRules";

describe("commissionReportRules", () => {
  it("ne déduit que les paiements de commission et ne produit pas de solde négatif", () => {
    expect(commissionBalance(45_000, 20_000)).toBe(25_000);
    expect(commissionBalance(45_000, 60_000)).toBe(0);
  });

  it("détermine une période financière UTC stable", () => {
    expect(commissionReportPeriod(new Date("2026-08-26T12:00:00.000Z"))).toBe("2026-08");
  });
});
