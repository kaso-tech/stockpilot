import { describe, expect, it } from "vitest";
import { can, permissionsOf, ROLES } from "./permissions";
import { canOpenRoute } from "./routePermissions";
describe("rôles tenant et navigation", () => {
  it("accorde toutes les permissions à l’administrateur mais uniquement des lectures au lecteur", () => {
    expect(permissionsOf("admin").length).toBeGreaterThan(20);
    expect(permissionsOf("viewer")).toEqual(["sales.view", "customers.view", "catalog.view", "stock.view"]);
  });
  it("sépare le gérant, le comptable et le vendeur des fonctions de gestion des utilisateurs", () => {
    expect(can("manager", "catalog.manage")).toBe(true);
    expect(can("manager", "settings.manage")).toBe(false);
    expect(can("accountant", "expenses.manage")).toBe(true);
    expect(can("accountant", "sales.create")).toBe(false);
    expect(can("seller", "sales.create")).toBe(true);
    expect(can("seller", "users.manage")).toBe(false);
  });
  it("refuse les accès directs aux créations et paramètres sensibles pour le lecteur", () => {
    expect(canOpenRoute("viewer", "/factures")).toBe(true);
    expect(canOpenRoute("viewer", "/produits/42")).toBe(true);
    expect(canOpenRoute("viewer", "/factures/nouvelle?client=42")).toBe(false);
    expect(canOpenRoute("viewer", "/pos")).toBe(false);
    expect(canOpenRoute("viewer", "/parametres/utilisateurs")).toBe(false);
    expect(canOpenRoute("accountant", "/comptabilite")).toBe(true);
  });
  it("n’accorde aucun privilège plateforme par déduction", () => {
    expect(ROLES).toEqual(["admin", "manager", "seller", "accountant", "viewer", "agent", "cashier"]);
    expect(can("platform_admin", "users.manage")).toBe(false);
    expect(can(null, "sales.create")).toBe(false);
  });
  it("limite l’agent commercial à ses clients, au catalogue et à son espace", () => {
    expect(permissionsOf("agent")).toEqual(["customers.view", "customers.manage", "catalog.view", "stock.view"]);
    for (const path of ["/", "/mon-espace", "/clients", "/clients/4", "/produits", "/produits/2", "/parametres/securite"]) expect(canOpenRoute("agent", path)).toBe(true);
    for (const path of ["/pos", "/factures", "/devis/nouveau", "/agents", "/mouvements", "/entrepots", "/parametres/identite", "/comptabilite"]) expect(canOpenRoute("agent", path)).toBe(false);
  });
  it("limite le caissier à l’encaissement, à la caisse et aux clients", () => {
    expect(permissionsOf("cashier")).toEqual(["sales.create", "customers.view", "catalog.view", "stock.view", "cash.close"]);
    for (const path of ["/", "/caisse", "/pos", "/clients", "/parametres/securite"]) expect(canOpenRoute("cashier", path)).toBe(true);
    for (const path of ["/factures", "/devis/nouveau", "/produits", "/agents", "/mouvements", "/parametres/identite", "/comptabilite", "/tickets"]) expect(canOpenRoute("cashier", path)).toBe(false);
  });
});
