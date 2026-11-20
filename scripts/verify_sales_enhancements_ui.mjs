import { chromium } from "playwright";

const now = new Date().toISOString();
const admin = { id: 1, openId: "enhancements-admin", name: "Admin", email: "admin@example.test", role: "admin", active: true, createdAt: now, updatedAt: now, lastSignedIn: now };
const products = [{ id: 10, name: "Produit remise", reference: "REM-001", unit: "unité", quantity: 12, retailPriceCents: 1000000, wholesalePriceCents: 800000 }];
const customer = { id: 4, name: "Client partiel", type: "ordinary" };
const partialInvoice = { id: 64, invoiceNumber: "FAC-PART-064", channel: "invoice", status: "partial", totalCents: 1000000, amountPaidCents: 400000, createdAt: now, customerName: "Client partiel" };
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.route("**/api/trpc/**", async route => {
  const paths = route.request().url().split("/api/trpc/")[1].split("?")[0].split(",");
  const value = path => {
    if (path === "auth.me") return admin;
    if (path === "products.list") return products;
    if (path === "commerce.customers.list") return [customer];
    if (path === "commerce.agents.list") return [];
    if (path === "commerce.settings.get") return { currency: "XOF", requireSalesAgent: false, requireCashier: false };
    if (path === "transactions.list") return [partialInvoice];
    if (path === "commerce.sales.detail") return { sale: partialInvoice, customer, items: [], commissions: [], participants: {} };
    if (path === "dashboard.get") return {};
    return [];
  };
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(paths.map(path => ({ result: { data: { json: value(path) } } }))) });
});

await page.goto("http://localhost:3000/pos", { waitUntil: "domcontentloaded" });
await page.getByText("Produit remise", { exact: true }).click();
await page.getByRole("button", { name: /Panier · 1/ }).click();
await page.getByRole("combobox").first().click();
await page.getByRole("option", { name: "Pourcentage" }).click();
await page.locator("input[type=number]").fill("10");
await page.getByText("Remise facture", { exact: true }).waitFor();

await page.goto("http://localhost:3000/factures/nouvelle", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Ajouter un produit" }).click();
await page.getByRole("button", { name: "Scanner par caméra" }).click();
await page.getByRole("heading", { name: "Scanner un code-barres" }).waitFor();
await page.keyboard.press("Escape");

await page.goto("http://localhost:3000/factures", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Encaisser" }).click();
await page.getByRole("heading", { name: "Encaissement" }).waitFor();
await page.getByText("Solde restant", { exact: true }).waitFor();
await browser.close();
console.log("Parcours E2E remises, caméra et encaissement différé validé.");
