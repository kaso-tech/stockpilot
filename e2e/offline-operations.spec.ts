import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers";

// Sans serveur : un client créé est gardé, affiché « En attente d'envoi », puis envoyé au retour du serveur.
test("client créé sans serveur : gardé sur l'appareil puis envoyé au retour", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bonjour Compte" })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForTimeout(3500);
  await page.unroute("**/api/trpc/**");
  await page.route("**/api/trpc/**", route => route.abort("connectionrefused"));
  await page.goto("/clients");
  await expect(page.getByRole("status").filter({ hasText: "Hors connexion" })).toBeVisible();
  await page.getByRole("button", { name: /Nouveau client/ }).first().click();
  await page.getByRole("dialog").getByRole("textbox").first().fill("Client sans réseau");
  await page.getByRole("dialog").getByRole("button", { name: /Créer|Enregistrer/ }).last().click();
  await expect(page.getByText("Client sans réseau")).toBeVisible();
  await expect(page.getByText("En attente d’envoi", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "1 opération en attente" })).toBeVisible();

  // Retour du serveur : la sonde le détecte et envoie le client.
  const created: string[] = [];
  await page.unroute("**/api/trpc/**");
  page.on("request", request => { if (request.url().includes("commerce.customers.create")) created.push(request.postData() ?? ""); });
  await mockApi(page, "admin", true, false, { "commerce.customers.create": { id: 501 } });
  await expect.poll(() => created.length, { timeout: 25_000 }).toBeGreaterThan(0);
  expect(created[0]).toContain("Client sans réseau");
});
