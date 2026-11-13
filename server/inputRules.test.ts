import { describe, expect, it } from "vitest";
import { safeFileUrl } from "./inputRules";

describe("safeFileUrl", () => {
  it("accepte le stockage interne et HTTPS", () => {
    expect(safeFileUrl.parse("/manus-storage/company/1/expenses/a.pdf")).toBe(
      "/manus-storage/company/1/expenses/a.pdf"
    );
    expect(safeFileUrl.parse("https://cdn.example.test/a.png")).toBe(
      "https://cdn.example.test/a.png"
    );
  });

  it("refuse les schémas exécutables ou non chiffrés", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,x",
      "http://example.test/a.png",
      "JaVaScRiPt:alert(1)",
    ])
      expect(() => safeFileUrl.parse(value)).toThrow();
  });
});
