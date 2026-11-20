import { test, expect } from "@playwright/test";
import { mockApi, pushRoute } from "./helpers";

test("la navigation conserve le document et le catalogue après plusieurs changements d’onglet", async ({ page }) => {
  await mockApi(page);
  let documents = 0;
  page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.goto("/");
  await pushRoute(page, "/produits");
  await expect(page.getByText("Produit de recette", { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as any).__documentIdentity = "stockpilot-stable"; });
  await pushRoute(page, "/clients");
  await expect(page.getByText("Client de recette", { exact: true })).toBeVisible();
  await pushRoute(page, "/produits");
  await expect(page.getByText("Produit de recette", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__documentIdentity)).toBe("stockpilot-stable");
  expect(documents).toBe(1);
});

test("la PWA conserve ses pages déjà chargées après coupure réseau sans rechargement de document", async ({ page, context }) => {
  await mockApi(page);
  await page.goto("/");
  await pushRoute(page, "/produits");
  await expect(page.getByText("Produit de recette", { exact: true })).toBeVisible();
  await pushRoute(page, "/clients");
  await expect(page.getByText("Client de recette", { exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.unroute("**/api/trpc/**");
  await context.setOffline(true);
  await pushRoute(page, "/produits");
  await expect(page.getByText("Produit de recette", { exact: true })).toBeVisible();
  await pushRoute(page, "/clients");
  await expect(page.getByText("Client de recette", { exact: true })).toBeVisible();
  await context.setOffline(false);
});

test("une mise à jour est reportable et ne s’active qu’après confirmation explicite", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bonjour Compte" })).toBeVisible();
  await page.evaluate(() => {
    (window as any).__updateActivated = 0;
    window.dispatchEvent(new CustomEvent("stockpilot-pwa-update", { detail: async () => { (window as any).__updateActivated++; } }));
  });
  await expect(page.getByText("Une nouvelle version est prête")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__updateActivated)).toBe(0);
  await page.getByRole("button", { name: "Plus tard", exact: true }).click();
  await expect(page.getByText("Une nouvelle version est prête")).not.toBeVisible();
  expect(await page.evaluate(() => (window as any).__updateActivated)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("stockpilot-pwa-update", { detail: async () => { (window as any).__updateActivated++; } })));
  await page.getByRole("button", { name: "Voir la mise à jour" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__updateActivated)).toBe(0);
  await page.getByRole("button", { name: "Confirmer la mise à jour" }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__updateActivated)).toBe(1);
});

test("le rôle lecture seule ne voit pas de création produit et ne peut ouvrir la création facture", async ({ page }) => {
  await mockApi(page, "viewer");
  await page.goto("/");
  await pushRoute(page, "/produits");
  await expect(page.getByText("Produit de recette", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ajouter un produit" })).not.toBeVisible();
  await pushRoute(page, "/factures/nouvelle");
  await expect(page.getByRole("heading", { name: "Accès limité par votre rôle" })).toBeVisible();
});
