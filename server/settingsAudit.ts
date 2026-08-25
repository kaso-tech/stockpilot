type SettingsAuditEntry = {
  action: string;
  entityType: string;
};

const settingsEntityTypes = new Set(["Entreprise", "POS", "Impression", "Apparence", "Fiscalité", "Sécurité"]);

export function isSettingsAuditEntry(entry: SettingsAuditEntry) {
  return settingsEntityTypes.has(entry.entityType) || entry.action.startsWith("Paramètres");
}

export function filterSettingsAuditLogs<T extends SettingsAuditEntry>(entries: T[]) {
  return entries.filter(isSettingsAuditEntry);
}
