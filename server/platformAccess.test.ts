import { describe, expect, it } from "vitest";
import { canManagePlatformCompanies, canManagePlatformOperators, canManagePlatformSupport } from "./platformAccess";

describe("permissions plateforme", () => {
  it("autorise uniquement les rôles opérations à gérer les entreprises", () => {
    expect(canManagePlatformCompanies("super_admin")).toBe(true);
    expect(canManagePlatformCompanies("operator")).toBe(true);
    expect(canManagePlatformCompanies("operations")).toBe(true);
    expect(canManagePlatformCompanies("support")).toBe(false);
    expect(canManagePlatformCompanies("billing")).toBe(false);
  });

  it("sépare les permissions support de la gestion des opérateurs", () => {
    expect(canManagePlatformSupport("support")).toBe(true);
    expect(canManagePlatformSupport("billing")).toBe(false);
    expect(canManagePlatformOperators("super_admin")).toBe(true);
    expect(canManagePlatformOperators("operations")).toBe(false);
  });
});
