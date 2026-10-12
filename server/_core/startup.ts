/** Vérifie la configuration au démarrage (P11) : une erreur bloquante vaut mieux qu'un service à moitié fonctionnel. */
export function validateEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const problems: string[] = [];
  const isProduction = env.NODE_ENV === "production";
  if (!env.JWT_SECRET) problems.push("JWT_SECRET est requis.");
  else if (isProduction && env.JWT_SECRET.length < 32) problems.push("JWT_SECRET doit contenir au moins 32 caractères en production.");
  if (isProduction && !env.DATABASE_URL) problems.push("DATABASE_URL est requis en production.");
  for (const name of ["BACKUP_ENCRYPTION_KEY", "DRIVE_TOKEN_ENCRYPTION_KEY"]) {
    const value = env[name]?.trim();
    if (value && !/^[0-9a-fA-F]{64}$/.test(value) && Buffer.from(value, "base64").length !== 32) problems.push(`${name} doit contenir 32 octets (64 caractères hexadécimaux ou base64).`);
  }
  const warnings: string[] = [];
  if (isProduction && !env.BACKUP_ENCRYPTION_KEY) warnings.push("BACKUP_ENCRYPTION_KEY n'est pas définie : les archives de sauvegarde sont stockées en clair.");
  return { problems, warnings };
}
