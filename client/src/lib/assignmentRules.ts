export function shouldPromptForAssignment(defaultAgentId: number | null | undefined) {
  return !defaultAgentId;
}

/** Rattachement de l’agent commercial : aucun, agent par défaut (modifiable) ou choix obligatoire à chaque vente. */
export type SalesAgentMode = "none" | "default" | "prompt";

type AssignmentSettings = { defaultSalesAgentId?: number | null; requireSalesAgent?: boolean | null; requireCashier?: boolean | null } | null | undefined;

export function salesAgentMode(settings: AssignmentSettings): SalesAgentMode {
  if (settings?.requireSalesAgent) return "prompt";
  if (settings?.defaultSalesAgentId) return "default";
  return "none";
}

/**
 * Champ « Agent commercial » à l’encaissement et sur les factures.
 * Sans agent commercial actif, le champ n’apparaît jamais ; en mode « aucun », il est masqué
 * (l’agent déjà porté par le ticket est conservé) ; seul le mode « à chaque vente » impose un choix.
 */
export function salesAgentField(settings: AssignmentSettings, activeSalesAgentCount: number) {
  const mode = salesAgentMode(settings);
  const show = activeSalesAgentCount > 0 && mode !== "none";
  return { mode, show, required: show && mode === "prompt" };
}

/**
 * Champ « Caissier » : le caissier connecté est enregistré automatiquement ; le champ ne sert
 * qu’en caisse partagée (un poste utilisé par plusieurs caissiers sans compte personnel).
 */
export function cashierField(settings: AssignmentSettings, activeCashierCount: number, isLoggedCashier = false) {
  const show = Boolean(settings?.requireCashier) && !isLoggedCashier && activeCashierCount > 0;
  return { show, required: show };
}
