import { test, expect } from "@playwright/test";
import { mockApi, pushRoute } from "./helpers";

test("le rapport des dépenses conserve son anneau, sa portée et sa lecture mobile hors connexion", async ({ page, context }) => {
  const report = {
    totalCents: 100000,
    count: 2,
    agentPaymentCents: 0,
    agentPaymentCount: 0,
    breakdown: [
      { category: "rent", amountCents: 60000 },
      { category: "marketing", amountCents: 40000 },
    ],
  };
  const errors: string[] = [];
  const expenseInputs: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.url().includes("expenses.report")) {
      expenseInputs.push(decodeURIComponent(new URL(request.url()).searchParams.get("input") ?? ""));
    }
  });
  await mockApi(page, "admin", true, false, {
    "expenses.report": report,
    "expenses.budget.get": null,
  });
  await page.goto("/depenses");
  // Le premier chargement installe la PWA mais n'est pas encore contrôlé.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByRole("heading", { name: "Dépenses", exact: true })).toBeVisible();
  const chart = page.getByRole("img", { name: /^Répartition des dépenses, total/ });
  await expect(chart).toBeVisible();
  await expect(chart.locator(".recharts-sector")).toHaveCount(2);
  await expect(page.getByText("Loyer", { exact: true })).toBeVisible();
  await expect(page.getByText("Marketing", { exact: true })).toBeVisible();
  expect(expenseInputs.length).toBeGreaterThan(0);
  for (const input of expenseInputs) expect(input).toContain('"warehouseId":99');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(chart).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await pushRoute(page, "/produits");
  await expect(page.getByText("Produit de recette", { exact: true })).toBeVisible();
  await pushRoute(page, "/depenses");
  await expect(chart).toBeVisible();
  await page.unroute("**/api/trpc/**");
  await context.setOffline(true);
  await pushRoute(page, "/produits");
  await expect(page.getByText("Produit de recette", { exact: true })).toBeVisible();
  await pushRoute(page, "/depenses");
  await expect(chart).toBeVisible();
  await expect(chart.locator(".recharts-sector")).toHaveCount(2);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test("« À traiter » reste seul quand les autres blocs sont masqués, sans montant financier pour le vendeur", async ({ page, context }) => {
  // Les dépenses et le budget sont sur la page Dépenses ; l'accueil ne garde que ce qui demande une action.
  const preferencesJson = JSON.stringify({ hero: true, metrics: false, salesTrend: false, recentSales: false, lowStock: false, todo: true });
  const overrides = {
    "dashboardPreferences.get": { preferencesJson },
    "dashboard.get": {
      summary: { receivableCount: 2, receivableCents: 150000, receivableOverdueCount: 1, monthlyExpenseCents: 100000, monthlyAgentPaymentCents: 25000, activeAlerts: 1 },
      salesTrend30: [], unpaidInvoices: [], recentSales: [], lowStock: [], topProducts: [],
    },
  };
  await mockApi(page, "admin", true, false, overrides);
  await page.goto("/");
  await expect(page.getByText("À traiter", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Indicateurs" })).not.toBeVisible();
  const receivables = page.getByRole("button", { name: /Factures à encaisser/ });
  await expect(receivables).toBeVisible();
  await expect(receivables).toContainText(/1\s?500/);
  await expect(page.getByText(/Dépenses du mois/)).not.toBeVisible();
  await receivables.click();
  await expect(page).toHaveURL(/\/factures$/);

  const sellerPage = await context.newPage();
  await mockApi(sellerPage, "seller", true, false, overrides);
  await sellerPage.goto("/");
  await expect(sellerPage.getByText("À traiter", { exact: true })).toBeVisible();
  await expect(sellerPage.getByRole("button", { name: /Factures à encaisser/ })).not.toBeVisible();
  await expect(sellerPage.getByText(/1\s?500/)).not.toBeVisible();
});
