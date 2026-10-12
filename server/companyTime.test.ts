import { describe, expect, it } from "vitest";
import { dayKey, isValidTimezone, lastDayKeys, monthKey } from "./companyTime";

describe("dates comptables par fuseau (E6)", () => {
  it("rattache une vente de 00 h 30 à Cotonou (UTC+1) à la bonne journée", () => {
    const sale = new Date("2026-10-31T23:30:00Z");
    expect(dayKey(sale, "Africa/Porto-Novo")).toBe("2026-11-01");
    expect(monthKey(sale, "Africa/Porto-Novo")).toBe("2026-11");
    expect(dayKey(sale, "Africa/Abidjan")).toBe("2026-10-31");
  });

  it("produit les dernières journées dans l'ordre", () => {
    expect(lastDayKeys(3, "UTC", new Date("2026-10-12T10:00:00Z"))).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
  });

  it("valide les fuseaux IANA", () => {
    expect(isValidTimezone("Europe/Paris")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
  });
});
