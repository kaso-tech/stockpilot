import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwords";

describe("stockage du mot de passe administrateur de secours", () => {
  it("accepte le nouveau mot de passe haché et rejette l’ancien", async () => {
    const storedHash = await hashPassword("MotDePasseAdministrateur2026");
    await expect(verifyPassword("MotDePasseAdministrateur2026", storedHash)).resolves.toBe(true);
    await expect(verifyPassword("AncienMotDePasse", storedHash)).resolves.toBe(false);
  });
});
