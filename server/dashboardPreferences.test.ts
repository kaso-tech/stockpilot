import { describe, expect, it } from "vitest";
import {
  dashboardPreferencesForRole,
  normalizeDashboardPreferences,
} from "../client/src/lib/dashboardPreferences";

describe("préférences du tableau de bord", () => {
  it("conserve les sections non renseignées visibles par défaut", () => {
    expect(normalizeDashboardPreferences({ hero: false })).toMatchObject({
      hero: false,
      salesTrend: true,
      todo: true,
    });
  });

  it("masque toujours les dépenses pour un vendeur", () => {
    expect(
      normalizeDashboardPreferences({ expenses: true, hero: true }, "seller")
    ).toMatchObject({ hero: true, expenses: false });
  });

  it("reprend les choix enregistrés avant la réorganisation", () => {
    expect(
      normalizeDashboardPreferences({
        priorities: false,
        lowStock: false,
        unpaidInvoices: true,
        expenses: false,
        budget: false,
      })
    ).toMatchObject({ todo: true, expenses: false });
    expect(
      normalizeDashboardPreferences({
        priorities: false,
        lowStock: false,
        unpaidInvoices: false,
        expenses: false,
        budget: true,
      })
    ).toMatchObject({ todo: false, expenses: true });
  });

  it("fournit un preset indépendant par rôle", () => {
    expect(dashboardPreferencesForRole("admin")).not.toBe(
      dashboardPreferencesForRole("admin")
    );
  });
});
