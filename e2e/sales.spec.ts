import { expect, test } from "@playwright/test";
import { register, trackErrors, trpc, trpcQuery } from "./helpers";

test("vente au comptoir de bout en bout : produit, panier, encaissement, stock", async ({
  page,
}) => {
  await register(page, "pos@e2e.test", "Caisse E2E");
  const errors = trackErrors(page);
  const product = await trpc<{ id: number }>(page, "products.create", {
    reference: "E2E-001",
    name: "Savon E2E",
    description: null,
    category: "Hygiène",
    unit: "pièce",
    purchasePriceCents: 300,
    retailPriceCents: 500,
    wholesalePriceCents: 450,
    quantity: 10,
    minimumQuantity: 2,
    supplierId: null,
  });
  await page.goto("/pos");
  await page.getByPlaceholder("Nom, référence ou code-barres").fill("E2E-001");
  await page.getByRole("button", { name: /Savon E2E/ }).click();
  await page.getByRole("button", { name: /^Encaisser/ }).click();
  const validate = page.getByRole("button", { name: "Valider l’encaissement" });
  await expect(validate).toBeVisible();
  await page.getByLabel("Espèces").check();
  // Agent commercial et caissier doivent être choisis explicitement (ici « Aucun »).
  for (const select of await page.getByRole("combobox").all()) {
    await select.click();
    await page.getByRole("option", { name: "Aucun" }).click();
  }
  await expect(validate).toBeEnabled();
  await validate.click();
  await expect
    .poll(
      async () =>
        (
          await trpcQuery<Array<{ id: number; quantity: number }>>(
            page,
            "products.list"
          )
        ).find(item => item.id === product.id)?.quantity,
      { timeout: 15_000 }
    )
    .toBe(9);
  expect(errors).toEqual([]);
});
