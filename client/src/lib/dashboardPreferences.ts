/** Blocs de la vue d'ensemble, dans l'ordre d'affichage. */
export const dashboardPreferenceKeys = [
  "hero",
  "metrics",
  "salesTrend",
  "todo",
  "recentSales",
  "expenses",
] as const;
export type DashboardPreferenceKey = (typeof dashboardPreferenceKeys)[number];
export type DashboardPreferences = Record<DashboardPreferenceKey, boolean>;
export const defaultDashboardPreferences: DashboardPreferences = {
  hero: true,
  metrics: true,
  salesTrend: true,
  todo: true,
  recentSales: true,
  expenses: true,
};
export const dashboardPreferenceLabels: Record<DashboardPreferenceKey, string> =
  {
    hero: "Actions rapides",
    metrics: "Indicateurs du jour et du mois",
    salesTrend: "Ventes des 7 derniers jours",
    todo: "À traiter (stock bas, factures, inventaires, paie)",
    recentSales: "Dernières ventes",
    expenses: "Dépenses du mois et budget",
  };
export const sellerHiddenDashboardPreferenceKeys: DashboardPreferenceKey[] = [
  "expenses",
];
export const dashboardRolePresets: Record<
  "admin" | "seller",
  DashboardPreferences
> = {
  admin: defaultDashboardPreferences,
  seller: { ...defaultDashboardPreferences, expenses: false },
};
export function dashboardPreferencesForRole(
  role?: "admin" | "seller" | null
): DashboardPreferences {
  return { ...dashboardRolePresets[role === "seller" ? "seller" : "admin"] };
}

/**
 * Préférences enregistrées avant la réorganisation (9 blocs) : chaque nouveau
 * bloc reprend le choix des anciens blocs qu'il regroupe.
 */
const legacyKeys: Partial<Record<DashboardPreferenceKey, string[]>> = {
  todo: ["priorities", "lowStock", "unpaidInvoices"],
  expenses: ["expenses", "budget"],
};

export function normalizeDashboardPreferences(
  value: unknown,
  role?: "admin" | "seller" | null
): DashboardPreferences {
  const fallback = dashboardPreferencesForRole(role);
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Record<string, unknown>;
  const read = (key: DashboardPreferenceKey) => {
    if (typeof candidate[key] === "boolean" && key !== "expenses")
      return candidate[key] as boolean;
    const legacy = (legacyKeys[key] ?? [])
      .map(name => candidate[name])
      .filter((item): item is boolean => typeof item === "boolean");
    if (legacy.length) return legacy.some(Boolean);
    return typeof candidate[key] === "boolean"
      ? (candidate[key] as boolean)
      : fallback[key];
  };
  return dashboardPreferenceKeys.reduce(
    (result, key) => ({
      ...result,
      [key]:
        role === "seller" && sellerHiddenDashboardPreferenceKeys.includes(key)
          ? false
          : read(key),
    }),
    {} as DashboardPreferences
  );
}
