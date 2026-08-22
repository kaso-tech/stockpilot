import { describe, expect, it } from "vitest";
import { assertExplicitInvoiceAgentChoice } from "./agentSelectionRules";

describe("choix explicite des agents en facture", () => {
  it("autorise l’option Aucun lorsqu’elle est sélectionnée explicitement", () => {
    expect(() => assertExplicitInvoiceAgentChoice({ requiresSalesAgentChoice: true, requiresCashierChoice: true, salesAgentSelectionMade: true, cashierSelectionMade: true })).not.toThrow();
  });
  it("refuse un sélecteur d’agent laissé intact", () => {
    expect(() => assertExplicitInvoiceAgentChoice({ requiresSalesAgentChoice: true, requiresCashierChoice: false, salesAgentSelectionMade: false, cashierSelectionMade: true })).toThrow("Sélectionnez explicitement");
  });
});
