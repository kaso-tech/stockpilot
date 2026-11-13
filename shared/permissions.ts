/**
 * Rôles et droits (9.3). La matrice est la seule source de vérité : le serveur
 * l'applique à chaque procédure, le client s'en sert pour adapter l'interface.
 */
export const ROLES = [
  "admin",
  "manager",
  "seller",
  "accountant",
  "viewer",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  manager: "Gérant",
  seller: "Vendeur",
  accountant: "Comptable",
  viewer: "Lecture seule",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin:
    "Tous les droits, y compris les paramètres, les sauvegardes et la gestion de l’équipe.",
  manager:
    "Gère le catalogue, les achats, les stocks, les ventes et les dépenses ; pas les paramètres ni l’équipe.",
  seller:
    "Vend, encaisse et gère les clients, dans les limites fixées dans les paramètres du point de vente.",
  accountant:
    "Consulte tout, gère les dépenses et la paie, exporte la comptabilité ; ne vend pas.",
  viewer: "Consulte les données sans pouvoir rien modifier.",
};

export type Permission =
  | "sales.create"
  | "sales.refund"
  | "customers.manage"
  | "catalog.manage"
  | "catalog.price"
  | "purchasing.manage"
  | "stock.adjust"
  | "inventory.manage"
  | "expenses.manage"
  | "payroll.manage"
  | "team.view"
  | "team.manage"
  | "users.manage"
  | "audit.view"
  | "accounting.export"
  | "cash.close"
  | "settings.manage"
  | "backups.manage";

const MATRIX: Record<Permission, Role[]> = {
  "sales.create": ["admin", "manager", "seller"],
  "sales.refund": ["admin", "manager", "seller"],
  "customers.manage": ["admin", "manager", "seller"],
  "catalog.manage": ["admin", "manager"],
  "catalog.price": ["admin", "manager", "seller"],
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
  "settings.manage": ["admin"],
  "backups.manage": ["admin"],
};

export function can(role: string | null | undefined, permission: Permission) {
  return Boolean(role) && (MATRIX[permission] as string[]).includes(role!);
}

/** Droits d'un rôle, pour l'affichage de la matrice. */
export function permissionsOf(role: Role) {
  return (Object.keys(MATRIX) as Permission[]).filter(permission =>
    MATRIX[permission].includes(role)
  );
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  "sales.create": "Créer et encaisser des ventes, factures et devis",
  "sales.refund": "Rembourser et enregistrer des retours",
  "customers.manage": "Gérer les clients",
  "catalog.manage": "Gérer produits, catégories, unités et fournisseurs",
  "catalog.price": "Modifier le coût d’achat",
  "purchasing.manage": "Gérer les bons de commande",
  "stock.adjust": "Corriger le stock",
  "inventory.manage": "Réaliser les inventaires",
  "expenses.manage": "Gérer les dépenses et budgets",
  "payroll.manage": "Gérer la paie",
  "team.view": "Consulter l’équipe",
  "team.manage": "Gérer vendeurs et agents",
  "users.manage": "Attribuer les rôles",
  "audit.view": "Consulter le journal d’audit",
  "accounting.export": "Exporter la comptabilité",
  "cash.close": "Clôturer la caisse",
  "settings.manage": "Modifier les paramètres",
  "backups.manage": "Gérer les sauvegardes",
};
