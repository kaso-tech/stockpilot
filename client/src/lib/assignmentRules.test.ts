import { describe, expect, it } from "vitest";
import { cashierField, salesAgentField, salesAgentMode } from "./assignmentRules";

describe("rattachement agent commercial / caissier", () => {
  it("déduit le mode agent des réglages", () => {
    expect(salesAgentMode(undefined)).toBe("none");
    expect(salesAgentMode({ defaultSalesAgentId: 3 })).toBe("default");
    expect(salesAgentMode({ defaultSalesAgentId: null, requireSalesAgent: true })).toBe("prompt");
  });
  it("masque l’agent sans agent actif ou en mode aucun, l’exige seulement à chaque vente", () => {
    expect(salesAgentField({ requireSalesAgent: true }, 0)).toMatchObject({ show: false, required: false });
    expect(salesAgentField({}, 2)).toMatchObject({ show: false, required: false });
    expect(salesAgentField({ defaultSalesAgentId: 3 }, 2)).toMatchObject({ show: true, required: false });
    expect(salesAgentField({ requireSalesAgent: true }, 2)).toMatchObject({ show: true, required: true });
  });
  it("ne demande le caissier qu’en caisse partagée, jamais au caissier connecté", () => {
    expect(cashierField({}, 2).show).toBe(false);
    expect(cashierField({ requireCashier: true }, 2)).toEqual({ show: true, required: true });
    expect(cashierField({ requireCashier: true }, 2, true).show).toBe(false);
    expect(cashierField({ requireCashier: true }, 0).show).toBe(false);
  });
});
