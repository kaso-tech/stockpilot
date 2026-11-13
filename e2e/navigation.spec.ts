import { expect, test } from "@playwright/test";
import { register, trackErrors } from "./helpers";

const ROUTES = [
  "/",
  "/pos",
  "/factures",
  "/devis",
  "/clients",
  "/produits",
  "/categories",
  "/unites",
  "/mouvements",
  "/inventaires",
  "/depots",
  "/fournisseurs",
  "/bons-commande",
  "/agents",
  "/depenses",
  "/comptabilite",
  "/donnees",
  "/parametres",
  "/parametres/devise",
  "/parametres/identite",
  "/parametres/utilisateurs",
  "/parametres/abonnement",
  "/parametres/securite",
  "/sauvegardes",
  "/alertes",
  "/journal",
  "/synchronisation",
];

test("toutes les pages s'ouvrent sans erreur pour un administrateur", async ({
  page,
}) => {
  await register(page, "nav@e2e.test", "Navigation E2E");
  const errors = trackErrors(page);
  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("An unexpected error occurred."),
      route
    ).toHaveCount(0);
    await expect(page.getByRole("main"), route).toHaveCount(1);
    await expect(page.getByRole("main"), route).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});
