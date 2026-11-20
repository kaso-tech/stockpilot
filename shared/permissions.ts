/** Matrice tenant StockPilot : les droits plateforme restent séparés (platformAdminUsers). */
export const ROLES = ["admin", "manager", "seller", "accountant", "viewer"] as const;
export type Role = (typeof ROLES)[number];
export type Permission =
  | "sales.view" | "sales.create" | "sales.refund" | "customers.view" | "customers.manage"
  | "catalog.view" | "catalog.manage" | "catalog.price" | "stock.view"
  | "purchasing.manage" | "stock.adjust" | "inventory.manage" | "expenses.manage" | "payroll.manage"
  | "team.view" | "team.manage" | "users.manage" | "audit.view" | "accounting.export" | "cash.close"
  | "finance.notifications" | "settings.manage" | "backups.manage";
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur", manager: "Gérant", seller: "Vendeur", accountant: "Comptable", viewer: "Lecture seule",
};
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Tous les droits de l’entreprise, sans privilèges implicites sur la plateforme SaaS.",
  manager: "Gère catalogue, achats, stocks, ventes et dépenses ; pas les paramètres ni les rôles.",
  seller: "Vend et gère les clients selon les restrictions de point de vente et d’entrepôt.",
  accountant: "Consulte les données, gère dépenses et paie, et exporte la comptabilité.",
  viewer: "Consulte les données sans pouvoir les modifier.",
};
const MATRIX: Record<Permission, readonly Role[]> = {
  "sales.view": ["admin", "manager", "seller", "accountant", "viewer"],
  "sales.create": ["admin", "manager", "seller"],
  "sales.refund": ["admin", "manager", "seller"],
  "customers.view": ["admin", "manager", "seller", "accountant", "viewer"],
  "customers.manage": ["admin", "manager", "seller"],
  "catalog.view": ["admin", "manager", "seller", "accountant", "viewer"],
  "catalog.manage": ["admin", "manager"],
  "catalog.price": ["admin", "manager", "seller"],
  "stock.view": ["admin", "manager", "seller", "accountant", "viewer"],
  "purchasing.manage": ["admin", "manager"],
  "stock.adjust": ["admin", "manager", "seller"],
  "inventory.manage": ["admin", "manager"],
  "expenses.manage": ["admin", "manager", "accountant"],
  "payroll.manage": ["admin", "manager", "accountant"],
  "team.view": ["admin", "manager", "accountant"],
  "team.manage": ["admin"],
  "users.manage": ["admin"],
  "audit.view": ["admin", "manager", "accountant"],
  "accounting.export": ["admin", "manager", "accountant"],
  "cash.close": ["admin", "manager", "seller"],
  "finance.notifications": ["admin", "manager", "accountant"],
  "settings.manage": ["admin"],
  "backups.manage": ["admin"],
};
export const PERMISSION_LABELS: Record<Permission, string> = {
  "sales.view": "Consulter les ventes et documents", "sales.create": "Créer et encaisser ventes, factures et devis", "sales.refund": "Rembourser et enregistrer les retours",
  "customers.view": "Consulter les clients", "customers.manage": "Gérer les clients", "catalog.view": "Consulter le catalogue", "catalog.manage": "Gérer le catalogue et les fournisseurs",
  "catalog.price": "Modifier les prix et coûts", "stock.view": "Consulter les stocks", "purchasing.manage": "Gérer les bons de commande",
  "stock.adjust": "Corriger le stock", "inventory.manage": "Gérer les inventaires", "expenses.manage": "Gérer les dépenses et budgets",
  "payroll.manage": "Gérer la paie", "team.view": "Consulter l’équipe", "team.manage": "Gérer vendeurs et agents", "users.manage": "Attribuer les rôles",
  "audit.view": "Consulter le journal d’audit", "accounting.export": "Exporter la comptabilité", "cash.close": "Clôturer la caisse",
  "finance.notifications": "Recevoir les notifications financières", "settings.manage": "Modifier les paramètres", "backups.manage": "Gérer les sauvegardes",
};
export function can(role: string | null | undefined, permission: Permission): boolean {
  return role != null && (ROLES as readonly string[]).includes(role) && MATRIX[permission].includes(role as Role);
}
export function permissionsOf(role: Role): Permission[] {
  return (Object.keys(MATRIX) as Permission[]).filter(permission => MATRIX[permission].includes(role));
}
