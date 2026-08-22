export const dashboardPreferenceKeys = ["hero", "metrics", "expenses", "budget", "salesTrend", "priorities", "recentSales", "lowStock"] as const;
export type DashboardPreferenceKey = (typeof dashboardPreferenceKeys)[number];
export type DashboardPreferences = Record<DashboardPreferenceKey, boolean>;
export const defaultDashboardPreferences: DashboardPreferences = { hero: true, metrics: true, expenses: true, budget: true, salesTrend: true, priorities: true, recentSales: true, lowStock: true };
export const dashboardPreferenceLabels: Record<DashboardPreferenceKey, string> = { hero: "Performance du mois", metrics: "Indicateurs principaux", expenses: "Répartition des dépenses", budget: "Suivi du budget", salesTrend: "Dynamique des ventes", priorities: "Priorités opérationnelles", recentSales: "Dernières factures", lowStock: "Disponibilité critique" };
const storageKey = "stockpilot_dashboard_preferences";

export function readDashboardPreferences(storage: Storage | undefined = typeof window === "undefined" ? undefined : localStorage): DashboardPreferences {
  if (!storage) return defaultDashboardPreferences;
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) || "{}") as Partial<DashboardPreferences>;
    return dashboardPreferenceKeys.reduce((result, key) => ({ ...result, [key]: typeof parsed[key] === "boolean" ? parsed[key] : true }), {} as DashboardPreferences);
  } catch { return defaultDashboardPreferences; }
}
export function writeDashboardPreferences(preferences: DashboardPreferences, storage: Storage | undefined = typeof window === "undefined" ? undefined : localStorage) { storage?.setItem(storageKey, JSON.stringify(preferences)); }
