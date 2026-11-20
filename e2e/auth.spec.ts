import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers";
test("la connexion expose une seule inscription et un lien de récupération", async ({ page }) => {
  await mockApi(page, "admin", false);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Créer mon entreprise", exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await expect(page.getByRole("heading", { name: "Mot de passe oublié" })).toBeVisible();
  await page.getByLabel("Adresse e-mail", { exact: true }).fill("compte@example.test");
  await page.getByRole("button", { name: "Recevoir le lien", exact: true }).click();
  await expect(page.getByText(/Si un compte correspond à cette adresse/)).toBeVisible();
});
