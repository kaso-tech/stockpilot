import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./startup";

describe("validation de l'environnement", () => {
  it("bloque un secret de session absent ou trop court en production", () => {
    expect(validateEnvironment({ NODE_ENV: "production", DATABASE_URL: "mysql://x" }).problems).toContain("JWT_SECRET est requis.");
    expect(validateEnvironment({ NODE_ENV: "production", DATABASE_URL: "mysql://x", JWT_SECRET: "court" }).problems[0]).toContain("32 caractères");
  });

  it("valide le format des clés de chiffrement et signale l'absence de chiffrement des sauvegardes", () => {
    const result = validateEnvironment({ NODE_ENV: "production", DATABASE_URL: "mysql://x", JWT_SECRET: "x".repeat(40), BACKUP_ENCRYPTION_KEY: "trop-courte" });
    expect(result.problems[0]).toContain("BACKUP_ENCRYPTION_KEY");
    expect(validateEnvironment({ NODE_ENV: "production", DATABASE_URL: "mysql://x", JWT_SECRET: "x".repeat(40) }).warnings).toHaveLength(1);
    expect(validateEnvironment({ NODE_ENV: "development", JWT_SECRET: "dev" }).problems).toEqual([]);
  });
});
