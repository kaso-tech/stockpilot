import { describe, expect, it } from "vitest";
import { formatPhone, parsePhone } from "./phoneCountries";

describe("numéros de téléphone avec indicatif", () => {
  it("compose le numéro international", () => {
    expect(formatPhone("BF", "70 12 34 56")).toBe("+226 70 12 34 56");
    expect(formatPhone("FR", "06 12 34 56 78")).toBe("+33 6 12 34 56 78");
    expect(formatPhone("CI", "07 08 12 34 56")).toBe("+225 07 08 12 34 56");
    expect(formatPhone("BF", "+226 70 12 34 56")).toBe("+226 70 12 34 56");
    expect(formatPhone("BF", "  ")).toBe("");
  });
  it("relit un numéro enregistré", () => {
    expect(parsePhone("+226 70 12 34 56")).toEqual({ country: "BF", local: "70 12 34 56" });
    expect(parsePhone("+33 6 12 34 56 78")).toEqual({ country: "FR", local: "6 12 34 56 78" });
    expect(parsePhone("0022177123456")).toEqual({ country: "SN", local: "77123456" });
    expect(parsePhone("+1 514 555 0123")).toEqual({ country: "US", local: "514 555 0123" });
  });
  it("garde un ancien numéro sans indicatif avec le pays par défaut", () => {
    expect(parsePhone("70 12 34 56", "ML")).toEqual({ country: "ML", local: "70 12 34 56" });
    expect(parsePhone("+44 20 7946 0958").country).toBe("OTHER");
  });
});
