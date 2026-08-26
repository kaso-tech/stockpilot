import { describe, expect, it } from "vitest";
import { canManagePlatformCompanies } from "./platformAccess";

describe("permissions plateforme", () => {
  it("autorise les rôles plateforme explicitement prévus à gérer les entreprises", () => {
    expect(canManagePlatformCompanies("super_admin")).toBe(true);
    expect(canManagePlatformCompanies("operator")).toBe(true);
  });
});
