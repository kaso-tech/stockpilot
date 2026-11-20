import { describe, expect, it } from "vitest";
import { dashboardPreferencesForRole, normalizeDashboardPreferences } from "../client/src/lib/dashboardPreferences";

describe("préférences du tableau de bord", () => {
  it("conserve les sections non renseignées visibles par défaut", () => {
    expect(normalizeDashboardPreferences({ hero: false })).toMatchObject({ hero: false, salesTrend: true, lowStock: true, todo: true });
  });

  it("masque toujours les dépenses et le budget pour un vendeur", () => {
    expect(normalizeDashboardPreferences({ expenses: true, budget: true, hero: true }, "seller")).toMatchObject({ hero: true, expenses: false, budget: false });
  });

  it("fournit un preset indépendant par rôle", () => {
    expect(dashboardPreferencesForRole("admin")).not.toBe(dashboardPreferencesForRole("admin"));
  });
  it("agrège les anciens choix de priorités, factures et stock sans supprimer leurs clés", () => {
    expect(normalizeDashboardPreferences({ priorities: false, unpaidInvoices: false, lowStock: false })).toMatchObject({ todo: false, priorities: false, unpaidInvoices: false, lowStock: false });
    expect(normalizeDashboardPreferences({ priorities: false, unpaidInvoices: true, lowStock: false })).toMatchObject({ todo: true, priorities: false, unpaidInvoices: true, lowStock: false });
  });
  it("privilégie le choix explicite de la nouvelle préférence et masque le financier aux vendeurs", () => {
    expect(normalizeDashboardPreferences({ todo: false, priorities: true, expenses: true, budget: true }, "seller")).toMatchObject({ todo: false, priorities: true, expenses: false, budget: false });
  });
});
