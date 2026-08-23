import { describe, expect, it } from "vitest";
import { sdk } from "./_core/sdk";

describe("session OAuth", () => {
  it("utilise un nom de secours lorsque le fournisseur OAuth ne retourne pas de nom", async () => {
    const token = await sdk.createSessionToken("google-user", { name: "" });
    await expect(sdk.verifySession(token)).resolves.toMatchObject({ openId: "google-user", name: "Utilisateur" });
  });
});
