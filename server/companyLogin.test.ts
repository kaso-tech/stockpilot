import { describe, expect, it } from "vitest";
import { COMPANY_CODE_PATTERN, normalizeCompanyCode, suggestCompanyCode } from "./companyLogin";

describe("codes entreprise de connexion", () => {
  it("normalise la saisie (majuscules, sans accents ni espaces)", () => {
    expect(normalizeCompanyCode(" kaso-tech ")).toBe("KASO-TECH");
    expect(normalizeCompanyCode("Société Générale")).toBe("SOCIETEGENERALE");
    expect(normalizeCompanyCode(null)).toBe("");
  });
  it("propose un code valide à partir du nom", () => {
    expect(suggestCompanyCode("Station OTAM")).toBe("STATIONOTAM");
    expect(suggestCompanyCode("Épicerie du Marché Central de Ouaga")).toBe("EPICERIEDUMARC");
    expect(suggestCompanyCode("A")).toBe("AENT");
    for (const name of ["Station OTAM", "Kaso Tech", "AB"]) expect(COMPANY_CODE_PATTERN.test(suggestCompanyCode(name))).toBe(true);
  });
});
