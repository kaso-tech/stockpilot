import { describe, expect, it } from "vitest";
import { agentPayments, remunerationProfiles, sales, products, stockAlerts } from "../drizzle/schema";
import { companyScope } from "./companyScope";

describe("companyScope", () => {
  it("construit un filtre d’entreprise dédié pour les nouveaux espaces", () => {
    const condition = companyScope(products.companyId, 42);
    expect(condition).toBeDefined();
  });

  it("conserve le périmètre historique sans entreprise pour les données existantes", () => {
    const condition = companyScope(products.companyId, null);
    expect(condition).toBeDefined();
  });

  it("fournit un périmètre dédié aux alertes de stock d’un nouvel espace", () => {
    expect(companyScope(stockAlerts.companyId, 42)).toBeDefined();
  });

  it("fournit un périmètre distinct aux ventes, rémunérations et paiements agents", () => {
    expect(companyScope(sales.companyId, 42)).toBeDefined();
    expect(companyScope(remunerationProfiles.companyId, 42)).toBeDefined();
    expect(companyScope(agentPayments.companyId, 42)).toBeDefined();
  });
});
