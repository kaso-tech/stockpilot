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
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.unroute("**/api/trpc/**");
  await context.setOffline(true);
  await pushRoute(page, "/produits");
  await pushRoute(page, "/depenses");
  await expect(chart).toBeVisible();
  await expect(chart.locator(".recharts-sector")).toHaveCount(2);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test("les priorités conservent les dépenses quand les autres blocs sont masqués sans les divulguer au vendeur", async ({ page, context }) => {
  const preferencesJson = JSON.stringify({ metrics: false, expenses: false, budget: false, salesTrend: false, recentSales: false, lowStock: false, unpaidInvoices: false, priorities: true });
  const overrides = {
    "dashboardPreferences.get": { preferencesJson },
    "expenses.report": { totalCents: 0, count: 0, agentPaymentCents: 0, agentPaymentCount: 0, breakdown: [] },
    "expenses.budget.get": null,
    "dashboard.get": {
      summary: { monthlyExpenseCents: 100000, monthlyAgentPaymentCents: 25000 },
      salesTrend: [], unpaidInvoices: [], recentSales: [], lowStock: [],
    },
  };
  await mockApi(page, "admin", true, false, overrides);
  await page.goto("/");
  await expect(page.getByText("À traiter", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Indicateurs" })).not.toBeVisible();
  const expenses = page.getByRole("button", { name: /^Dépenses du mois/ });
  await expect(expenses).toBeVisible();
  await expect(expenses).toContainText(/1\s?000/);
  await expect(page.getByText(/^Dont paie/)).toBeVisible();
  await expenses.click();
  await expect(page).toHaveURL(/\/depenses$/);

  const sellerPage = await context.newPage();
  await mockApi(sellerPage, "seller", true, false, overrides);
  await sellerPage.goto("/");
  await expect(sellerPage.getByText("À traiter", { exact: true })).toBeVisible();
  await expect(sellerPage.getByRole("button", { name: /^Dépenses du mois/ })).not.toBeVisible();
  await expect(sellerPage.getByText(/^Dont paie/)).not.toBeVisible();
});
