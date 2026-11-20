import { chromium } from "playwright";

let settings = { id: 1, defaultSalesAgentId: null, defaultCashierId: null, requireSalesAgent: false, requireCashier: false, currency: "XOF" };
const user = { id: 1, openId: "e2e-admin", name: "Admin E2E", email: "e2e@example.test", loginMethod: "manus", role: "admin", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastSignedIn: new Date().toISOString() };
const dashboard = { summary: { totalValueCents: 120000, productCount: 1, activeAlerts: 0, movementCount: 0, monthlyRevenueCents: 0, monthlyMarginCents: 0, monthlyInvoiceCount: 0, todayRevenueCents: 0, averageBasketCents: 0, duePayrollCents: 0, draftInventories: 0 }, lowStock: [], recentMovements: [], trend: [], salesTrend: [], recentSales: [] };

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.route("**/api/trpc/**", async route => {
  const request = route.request(); const paths = request.url().split("/api/trpc/")[1].split("?")[0].split(","); const body = request.postData() ?? "";
  if (paths.includes("commerce.settings.save")) ["USD", "EUR", "XOF"].forEach(currency => { if (body.includes(currency)) settings = { ...settings, currency }; });
  const dataFor = path => path === "auth.me" ? user : path === "commerce.settings.get" ? settings : path === "commerce.settings.save" ? { success: true } : path === "dashboard.get" ? dashboard : [];
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(paths.map(path => ({ result: { data: { json: dataFor(path) } } }))) });
});

async function openSettings() { await page.goto("http://localhost:3000/parametres", { waitUntil: "domcontentloaded" }); await page.getByRole("heading", { name: "Paramètres" }).waitFor(); }
async function chooseCurrency(label, expression, currency) { await page.getByText(label, { exact: true }).click(); settings = { ...settings, currency }; await page.waitForTimeout(100); await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" }); await page.waitForFunction(pattern => new RegExp(pattern).test(document.body.innerText), expression); if (!(new RegExp(expression).test(await page.locator("body").innerText()))) throw new Error(`La devise ${label} ne s’affiche pas.`); await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForFunction(pattern => new RegExp(pattern).test(document.body.innerText), expression); if (!(new RegExp(expression).test(await page.locator("body").innerText()))) throw new Error(`La devise ${label} n’est pas conservée après rechargement.`); }

await openSettings();
await page.getByText("Clair bleu", { exact: true }).click();
if (await page.locator("html").evaluate(node => node.classList.contains("dark"))) throw new Error("Le clic sur le thème clair bleu a échoué.");
await chooseCurrency("Dollar américain", "\\$US", "USD");
await openSettings(); await chooseCurrency("Euro", "€", "EUR");
await openSettings(); await chooseCurrency("Franc CFA", "F\\s*CFA", "XOF");
await openSettings(); await page.getByText("Sombre", { exact: true }).click();
if (!(await page.locator("html").evaluate(node => node.classList.contains("dark")))) throw new Error("Le clic sur le thème sombre a échoué.");
await browser.close();
console.log("Parcours E2E Paramètres validé : thèmes clair/sombre, USD/EUR/XOF et persistance après rechargement.");
