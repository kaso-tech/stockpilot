import { describe, expect, it } from "vitest";
import { matchesAdminFallbackCredentials } from "./adminFallbackAuth";

describe("identifiants administrateur de secours configurés", () => {
  it("accepte la paire e-mail et mot de passe active sans exposer ses valeurs", () => {
    const email = process.env.ADMIN_FALLBACK_EMAIL ?? "";
    const password = process.env.ADMIN_FALLBACK_PASSWORD ?? "";

    expect(email.length).toBeGreaterThan(0);
    expect(password.length).toBeGreaterThan(0);
    expect(matchesAdminFallbackCredentials({ email, password }, { email, password })).toBe(true);
  });
});
