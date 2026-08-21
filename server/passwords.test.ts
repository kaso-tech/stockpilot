import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwords";

describe("identifiants vendeur", () => {
  it("hache le mot de passe avec un sel et le vérifie sans le conserver en clair", async () => {
    const hash = await hashPassword("Vendeur!2026");
    expect(hash).not.toContain("Vendeur!2026");
    await expect(verifyPassword("Vendeur!2026", hash)).resolves.toBe(true);
    await expect(verifyPassword("mauvais-mot-de-passe", hash)).resolves.toBe(false);
  });
});
