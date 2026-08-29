import { describe, expect, it } from "vitest";
import { canReadCompanyStorageKey } from "./storageProxy";

describe("canReadCompanyStorageKey", () => {
  it("autorise un objet valide du seul périmètre entreprise courant", () => {
    expect(canReadCompanyStorageKey("company/41/support/12/capture.png", 41)).toBe(true);
  });

  it("refuse les objets d’une autre entreprise, les clés globales et les chemins ambigus", () => {
    expect(canReadCompanyStorageKey("company/42/support/12/capture.png", 41)).toBe(false);
    expect(canReadCompanyStorageKey("support/12/capture.png", 41)).toBe(false);
    expect(canReadCompanyStorageKey("company/41/support/../42/capture.png", 41)).toBe(false);
  });
});
