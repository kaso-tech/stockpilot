import { describe, expect, it } from "vitest";
import { normalizeDashboardPreferences, readDashboardPreferences, writeDashboardPreferences } from "../client/src/lib/dashboardPreferences";

describe("préférences du tableau de bord", () => {
  it("conserve les sections non renseignées visibles par défaut", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 } as Storage;
    writeDashboardPreferences({ hero: false, metrics: true, expenses: true, budget: true, salesTrend: true, priorities: true, recentSales: true, lowStock: true }, storage);
    expect(readDashboardPreferences(storage)).toMatchObject({ hero: false, salesTrend: true, lowStock: true });
  });

  it("masque toujours les dépenses et le budget pour un vendeur", () => {
    expect(normalizeDashboardPreferences({ expenses: true, budget: true, hero: true }, "seller")).toMatchObject({ hero: true, expenses: false, budget: false });
  });
});
