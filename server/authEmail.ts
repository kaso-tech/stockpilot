/**
 * Canonicalise une adresse e-mail uniquement pour les recherches et contraintes
 * d’authentification. L’adresse saisie reste celle affichée à l’utilisateur.
 */
export function normalizeAuthEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}
