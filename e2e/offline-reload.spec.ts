import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers";

// Hors connexion après fermeture ou rechargement : l'application doit se rouvrir avec la
// session et les données gardées sur l'appareil, sans écran de connexion.

async function openOnlineThenCut(page: import("@playwright/test").Page) {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bonjour Compte" })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // Laisse le temps de préparer et d'enregistrer les données hors connexion.
  await page.waitForTimeout(3500);
  await page.unroute("**/api/trpc/**");
}

test("réseau coupé : rechargée, l'application rouvre la caisse avec le catalogue", async ({ page, context }) => {
  await openOnlineThenCut(page);
  await context.setOffline(true);
  await page.goto("/pos");
  await expect(page.getByRole("status").filter({ hasText: "Hors connexion" })).toBeVisible();
  await expect(page.getByText("Accédez à votre espace")).toHaveCount(0);
  await expect(page.getByText("Produit de recette", { exact: true }).first()).toBeVisible();
  await context.setOffline(false);
});

test("serveur injoignable avec réseau actif : pas d'écran de connexion ni de chargement sans fin", async ({ page }) => {
  await openOnlineThenCut(page);
  await page.route("**/api/trpc/**", route => route.abort("connectionrefused"));
  await page.goto("/pos");
  await expect(page.getByRole("status").filter({ hasText: "Hors connexion" })).toBeVisible();
  await expect(page.getByText("Accédez à votre espace")).toHaveCount(0);
  await expect(page.getByText("Produit de recette", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Encaisser hors connexion/ }).or(page.getByText("Panier vide"))).toBeVisible();
});

test("une session refusée par le serveur n'est jamais reprise hors connexion", async ({ page }) => {
  await openOnlineThenCut(page);
  await mockApi(page, "admin", false);
  await page.goto("/");
  await expect(page.getByText("Accédez à votre espace")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("stockpilot-offline-session"))).toBeNull();
});
