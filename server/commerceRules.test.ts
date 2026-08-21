import { describe, expect, it } from "vitest";
import { commissionCents, fixedRemunerationCents, priceForCustomer } from "./commerceRules";

describe("règles commerciales", () => {
  it("applique automatiquement le tarif correspondant au type de client", () => {
    expect(priceForCustomer("ordinary", 1250, 900)).toBe(1250);
    expect(priceForCustomer("wholesale", 1250, 900)).toBe(900);
  });

  it("calcule une commission sur chiffre d’affaires ou sur bénéfice net", () => {
    expect(commissionCents({ remunerationMode: "commission", commissionBasis: "revenue", rateBasisPoints: 500, invoiceRevenueCents: 100_000, invoiceNetProfitCents: 30_000 })).toBe(5_000);
    expect(commissionCents({ remunerationMode: "commission", commissionBasis: "net_profit", rateBasisPoints: 1000, invoiceRevenueCents: 100_000, invoiceNetProfitCents: 30_000 })).toBe(3_000);
  });

  it("ne verse pas de commission sur une vente déficitaire et respecte le salaire fixe", () => {
    expect(commissionCents({ remunerationMode: "fixed_plus_commission", commissionBasis: "net_profit", rateBasisPoints: 1000, invoiceRevenueCents: 10_000, invoiceNetProfitCents: -500 })).toBe(0);
    expect(fixedRemunerationCents("fixed_plus_commission", 150_000)).toBe(150_000);
    expect(fixedRemunerationCents("commission", 150_000)).toBe(0);
  });
});
