import { can, type Permission } from "./permissions";

export function routePermission(path: string): Permission | null {
  const pathname = path.split("?")[0]!.replace(/\/$/, "") || "/";
  if (/^\/(factures\/nouvelle|devis\/nouveau|pos)(\/|$)/.test(pathname)) return "sales.create";
  if (/^\/(factures|devis|tickets)(\/|$)/.test(pathname)) return "sales.view";
  if (/^\/clients(\/|$)/.test(pathname)) return "customers.view";
  if (/^\/produits(\/|$)/.test(pathname)) return "catalog.view";
  if (/^\/(categories|unites|fournisseurs|bons-commande)(\/|$)/.test(pathname)) return "catalog.manage";
  if (/^\/(mouvements|entrepots|alertes)(\/|$)/.test(pathname)) return "stock.view";
  if (/^\/transferts-stock(\/|$)/.test(pathname)) return "stock.adjust";
  if (/^\/inventaires(\/|$)/.test(pathname)) return "inventory.manage";
  if (/^\/agents(\/|$)/.test(pathname)) return "team.view";
  if (/^\/(depenses|echeances)(\/|$)/.test(pathname)) return "expenses.manage";
  if (/^\/journal(\/|$)/.test(pathname)) return "audit.view";
  if (/^\/pilotage-entrepots(\/|$)/.test(pathname)) return "settings.manage";
  if (/^\/donnees(\/|$)/.test(pathname)) return "settings.manage";
  if (/^\/parametres\/utilisateurs(\/|$)/.test(pathname)) return "users.manage";
  if (/^\/parametres\/(apparence|tableau-de-bord|securite)(\/|$)/.test(pathname)) return null;
  if (/^\/parametres(\/|$)/.test(pathname)) return "settings.manage";
  return null;
}
/** Pages ouvertes à l’agent commercial : son espace, les clients, le catalogue et son compte. */
const AGENT_ROUTES = /^\/($|mon-espace(\/|$)|clients(\/|$)|produits(\/|$)|synchronisation$|parametres\/(apparence|securite)$)/;
/** Pages ouvertes au caissier : son espace (encaissements, caisse du jour), la vente rapide, les clients et son compte. */
const CASHIER_ROUTES = /^\/($|caisse(\/|$)|pos(\/|$)|clients(\/|$)|synchronisation$|parametres\/(apparence|securite)$)/;
export function canOpenRoute(role: string | null | undefined, path: string): boolean {
  if (!role) return false;
  if (role === "cashier") return CASHIER_ROUTES.test(path.split("?")[0]!.replace(/(.)\/$/, "$1"));
  if (role === "agent") return AGENT_ROUTES.test(path.split("?")[0]!.replace(/(.)\/$/, "$1"));
  if (path === "/comptabilite") return can(role, "cash.close") || can(role, "accounting.export");
  const required = routePermission(path);
  return required === null || can(role, required);
}
