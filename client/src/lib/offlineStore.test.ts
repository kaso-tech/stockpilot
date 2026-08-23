import { describe, expect, it } from "vitest";
import { offlineScopeKey } from "./offlineStore";

describe("offlineScopeKey", () => {
  it("sépare les données hors connexion par entreprise et utilisateur", () => {
    expect(offlineScopeKey({ companyId: 12, userId: 4 })).toBe("company:12:user:4");
    expect(offlineScopeKey({ companyId: 13, userId: 4 })).not.toBe(offlineScopeKey({ companyId: 12, userId: 4 }));
  });

  it("isole aussi les comptes hérités sans entreprise", () => {
    expect(offlineScopeKey({ companyId: null, userId: 4 })).toBe("company:legacy:user:4");
  });
});
