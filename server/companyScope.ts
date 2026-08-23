import { eq, isNull } from "drizzle-orm";

/** Les données historiques sans entreprise restent dans l’espace existant ; chaque nouvel espace utilise son identifiant dédié. */
export function companyScope(column: any, companyId: number | null) {
  return companyId === null ? isNull(column) : eq(column, companyId);
}
