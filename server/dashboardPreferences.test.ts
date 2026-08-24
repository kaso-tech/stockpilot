import { describe, expect, it } from "vitest";
import { dashboardPreferencesForRole, normalizeDashboardPreferences } from "../client/src/lib/dashboardPreferences";

describe("préférences du tableau de bord", () => {
  it("conserve les sections non renseignées visibles par défaut", () => {
    expect(normalizeDashboardPreferences({ hero: false })).toMatchObject({ hero: false, salesTrend: true, lowStock: true });
  });

  it("masque toujours les dépenses et le budget pour un vendeur", () => {
    expect(normalizeDashboardPreferences({ expenses: true, budget: true, hero: true }, "seller")).toMatchObject({ hero: true, expenses: false, budget: false });
  });

  it("fournit un preset indépendant par rôle", () => {
    expect(dashboardPreferencesForRole("admin")).not.toBe(dashboardPreferencesForRole("admin"));
  });
});
