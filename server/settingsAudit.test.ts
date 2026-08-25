import { describe, expect, it } from "vitest";
import { isSettingsAuditEntry } from "./settingsAudit";

describe("isSettingsAuditEntry", () => {
  it("retient les événements de paramètres et écarte les événements métier", () => {
    expect(isSettingsAuditEntry({ action: "Autorisation vendeur mise à jour", entityType: "Vente" })).toBe(true);
    expect(isSettingsAuditEntry({ action: "Mouvement enregistré", entityType: "Mouvement de stock" })).toBe(false);
  });
});
