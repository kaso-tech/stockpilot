import { chromium } from "playwright";

const now = new Date().toISOString();
const admin = { id: 1, openId: "sales-e2e-admin", name: "Admin", email: "admin@example.test", role: "admin", active: true, createdAt: now, updatedAt: now, lastSignedIn: now };
const products = [{ id: 10, name: "Article POS", reference: "POS-001", unit: "unité", quantity: 12, retailPriceCents: 5000000, wholesalePriceCents: 4200000 }, { id: 11, name: "Article facture", reference: "FAC-002", unit: "unité", quantity: 8, retailPriceCents: 8000000, wholesalePriceCents: 6500000 }];
const customers = [{ id: 4, name: "Client Pro", type: "wholesale" }];
const agents = [{ id: 7, name: "Agent commercial", type: "sales_agent", active: true }, { id: 8, name: "Caissier", type: "cashier", active: true }];
const settings = { defaultSalesAgentId: null, defaultCashierId: null, requireSalesAgent: false, requireCashier: false, currency: "XOF", ticketWidthMm: "80" };
let nextSaleId = 70; let checkoutCount = 0;
const detail = id => ({ sale: { id, invoiceNumber: `FAC-TEST-${id}`, status: "draft", amountPaidCents: 0, sellerUserId: 1, paymentMethod: "cash", subtotalCents: 6500000, totalCents: 6500000, createdAt: now }, customer: customers[0], items: [{ id: 1, productName: "Article facture", quantity: 1, unitPriceCents: 6500000, lineTotalCents: 6500000 }], commissions: [], participants: { seller: { id: 1, name: "Admin", role: "Vendeur" }, salesAgent: null, cashier: null } });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { window.open = () => ({ document: { write: () => undefined, close: () => undefined }, focus: () => undefined, print: () => { document.body.dataset.autoPrinted = "yes"; }, close: () => undefined }); });
await page.route("**/api/trpc/**", async route => {
  const paths = route.request().url().split("/api/trpc/")[1].split("?")[0].split(",");
  const value = path => {
    if (path === "auth.me") return admin;
    if (path === "products.list") return products;
    if (path === "commerce.customers.list") return customers;
    if (path === "commerce.agents.list") return agents;
    if (path === "commerce.settings.get") return settings;
    if (path === "transactions.createDraft") { const id = nextSaleId++; return { id, invoiceNumber: `FAC-TEST-${id}`, totalCents: 6500000 }; }
    if (path === "transactions.checkout") { checkoutCount += 1; return checkoutCount === 1 ? { status: "paid", amountPaidCents: 5000000, balanceCents: 0 } : { status: "partial", amountPaidCents: 2000000, balanceCents: 4500000 }; }
    if (path === "transactions.list") return [{ id: 72, invoiceNumber: "FAC-TEST-72", channel: "invoice", status: "draft", totalCents: 6500000, amountPaidCents: 0, createdAt: now, customerName: "Client Pro" }];
    if (path === "commerce.sales.detail") return detail(72);
    if (path === "dashboard.get") return {};
    return [];
  };
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(paths.map(path => ({ result: { data: { json: value(path) } } }))) });
});

await page.goto("http://localhost:3000/pos", { waitUntil: "domcontentloaded" });
await page.getByText("Article POS", { exact: true }).click();
await page.getByRole("button", { name: /Panier · 1/ }).click();
await page.getByRole("button", { name: "Encaisser", exact: true }).click();
await page.getByRole("heading", { name: "Encaissement" }).waitFor();
await page.getByRole("button", { name: "Valider l’encaissement" }).click();
await page.getByText("Règlement intégral validé.", { exact: true }).waitFor();

async function prepareInvoice() {
  await page.goto("http://localhost:3000/factures/nouvelle", { waitUntil: "domcontentloaded" });
  await page.getByText("Sélectionner un client", { exact: true }).click();
  await page.getByText("Client Pro · Grossiste", { exact: true }).click();
  await page.getByRole("button", { name: "Ajouter un produit" }).click();
  await page.getByPlaceholder("Code scanné").fill("FAC-002");
  await page.getByRole("button", { name: "Scan" }).click();
  await page.locator("div.rounded-xl.border.border-border.p-3").getByText("Article facture", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
}

await prepareInvoice();
await page.getByRole("button", { name: "Encaisser" }).click();
await page.getByRole("heading", { name: "Encaissement" }).waitFor();
await page.getByText("Partiel", { exact: true }).click();
await page.getByRole("dialog").locator("input").fill("20000");
await page.getByRole("button", { name: "Valider l’encaissement" }).click();
await page.getByText(/Règlement partiel validé/).waitFor();

await prepareInvoice();
await page.getByRole("button", { name: "Imprimer" }).click();
await page.waitForURL("**/factures?facture=**");
await page.waitForFunction(() => document.body.dataset.autoPrinted === "yes");
await browser.close();
console.log("Parcours E2E POS intégral, facture partielle et impression A4 validé.");
