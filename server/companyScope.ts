import { and, eq, isNull, type AnyColumn, type SQL } from "drizzle-orm";

export type CompanyId = number | null;
export type RequiredCompanyId = CompanyId | undefined;

/**
 * Construit le prédicat de tenant à partir du contexte authentifié.
 * `undefined` est toujours une erreur : un appelant doit choisir explicitement
 * le tenant legacy (`null`) ou un tenant SaaS identifié par son numéro.
 */
export function companyScope(column: AnyColumn, companyId: RequiredCompanyId): SQL {
  if (companyId === undefined) throw new Error("Le périmètre entreprise est requis.");
  return companyId === null ? isNull(column) : eq(column, companyId);
}

/**
 * Compose un accès par identifiant et périmètre. Les routeurs doivent utiliser
 * ce helper pour toute ressource reçue depuis une entrée utilisateur.
 */
export function scopedResourceId(idColumn: AnyColumn, id: number, companyColumn: AnyColumn, companyId: RequiredCompanyId): SQL {
  return and(eq(idColumn, id), companyScope(companyColumn, companyId))!;
}

/** Vérifie en mémoire une ligne déjà chargée avant de la transmettre à un enfant ou service. */
export function belongsToCompany(row: { companyId?: number | null }, companyId: RequiredCompanyId): boolean {
  if (companyId === undefined) throw new Error("Le périmètre entreprise est requis.");
  return row.companyId === companyId;
}
