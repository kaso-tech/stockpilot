const settingsEntityTypes = new Set(["Entreprise", "POS", "Fiscalité", "Impression", "Apparence", "Sécurité"]);

export function isSettingsAuditEntry(entry: { action: string; entityType: string }) {
  return settingsEntityTypes.has(entry.entityType) || entry.action.includes("Paramètres") || entry.action.includes("TVA") || entry.action.includes("imprimante") || entry.action.includes("Autorisation");
}
