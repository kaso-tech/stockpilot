import { expect, test } from "@playwright/test";
import { login, PASSWORD, register, trackErrors } from "./helpers";

test("inscription, déconnexion puis reconnexion", async ({ page }) => {
  const errors = trackErrors(page);
  await register(page, "awa@e2e.test");
  await expect(page.getByText("Confirmez votre adresse e-mail")).toBeVisible();
  await page.getByText("awa@e2e.test").first().click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(
    page.getByRole("button", { name: "Se connecter" })
  ).toBeVisible();
  await login(page, "awa@e2e.test");
  expect(errors).toEqual([]);
});

test("mauvais mot de passe puis mot de passe oublié", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Adresse e-mail").fill("awa@e2e.test");
  await page.getByPlaceholder("Mot de passe").first().fill(`${PASSWORD}x`);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(
    page.getByText("E-mail ou mot de passe incorrect.")
  ).toBeVisible();
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await page.getByPlaceholder("Adresse e-mail").fill("awa@e2e.test");
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(
    page.getByText("Si un compte correspond à cette adresse")
  ).toBeVisible();
});
