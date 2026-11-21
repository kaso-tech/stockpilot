export const dashboardPreferenceKeys = ["hero", "metrics", "expenses", "budget", "salesTrend", "priorities", "unpaidInvoices", "recentSales", "lowStock", "todo"] as const;
export type DashboardPreferenceKey = (typeof dashboardPreferenceKeys)[number];
export type DashboardPreferences = Record<DashboardPreferenceKey, boolean>;
export const defaultDashboardPreferences: DashboardPreferences = { hero: true, metrics: true, expenses: true, budget: true, salesTrend: true, priorities: true, unpaidInvoices: true, recentSales: true, lowStock: true, todo: true };
export const dashboardPreferenceLabels: Record<DashboardPreferenceKey, string> = { hero: "Actions rapides", metrics: "Indicateurs principaux", expenses: "Répartition des dépenses", budget: "Suivi du budget", salesTrend: "Ventes des 30 derniers jours", priorities: "Priorités opérationnelles", unpaidInvoices: "Factures impayées", recentSales: "Dernières ventes", lowStock: "Stock à réapprovisionner", todo: "À traiter (factures, stock, échéances, paie, inventaires, budget)" };
/** Zones de l'accueil réglables. Dépenses et budget sont sur la page Dépenses ; les anciennes priorités sont regroupées dans « À traiter ». */
export const homeDashboardPreferenceKeys: DashboardPreferenceKey[] = ["hero", "metrics", "salesTrend", "todo", "recentSales", "lowStock"];
export const sellerHiddenDashboardPreferenceKeys: DashboardPreferenceKey[] = ["expenses", "budget"];
export const dashboardRolePresets: Record<"admin" | "seller", DashboardPreferences> = { admin: defaultDashboardPreferences, seller: { hero: true, metrics: true, expenses: false, budget: false, salesTrend: true, priorities: true, unpaidInvoices: true, recentSales: true, lowStock: true, todo: true } };
export function dashboardPreferencesForRole(role?: "admin" | "seller" | null): DashboardPreferences { return { ...(dashboardRolePresets[role === "seller" ? "seller" : "admin"]) }; }
export function normalizeDashboardPreferences(value: unknown, role?: "admin" | "seller" | null): DashboardPreferences {
  const fallback = dashboardPreferencesForRole(role);
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Record<string, unknown>;
  const legacyTodoKeys = ["priorities", "unpaidInvoices", "lowStock"];
  return dashboardPreferenceKeys.reduce((result, key) => {
    const legacyTodoValues = legacyTodoKeys.map(legacyKey => candidate[legacyKey]).filter((item): item is boolean => typeof item === "boolean");
    const valueForKey = key === "todo" && typeof candidate.todo !== "boolean" && legacyTodoValues.length
      ? legacyTodoValues.some(Boolean)
      : typeof candidate[key] === "boolean"
        ? candidate[key] as boolean
        : fallback[key];
    return { ...result, [key]: role === "seller" && sellerHiddenDashboardPreferenceKeys.includes(key) ? false : valueForKey };
  }, {} as DashboardPreferences);
}
