import { describe, expect, it } from "vitest";
import { filterSettingsSections } from "./SettingsIndex";

describe("filterSettingsSections", () => {
  it("retourne le sous-réglage paiement dans sa section", () => {
    const result = filterSettingsSections("mobile money");
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe("Vente et caisse");
    expect(result[0]?.links.map(link => link.label)).toEqual(["Moyens de paiement"]);
  });

  it("retourne tous les liens quand la recherche correspond au nom de section", () => {
    const result = filterSettingsSections("sécurité et traçabilité");
    expect(result).toHaveLength(1);
    expect(result[0]?.links.map(link => link.label)).toEqual(["Sécurité du compte", "Historique des paramètres"]);
  });

  it("retourne le lien indépendant Impression et imprimante", () => {
    const result = filterSettingsSections("imprimante");
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe("Impression et périphériques");
    expect(result[0]?.links.map(link => link.href)).toEqual(["/parametres/impression"]);
  });

  it("ne retourne aucun résultat pour une recherche inconnue", () => {
    expect(filterSettingsSections("paramètre introuvable")).toEqual([]);
  });
});
