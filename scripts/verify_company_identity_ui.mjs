import { chromium } from "playwright";

const admin = { id: 1, openId: "admin-company-e2e", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastSignedIn: new Date().toISOString() };
const logo = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDBiY2Q0Ii8+PHRleHQgeD0iMjAiIHk9IjI2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxOCI+QjwvdGV4dD48L3N2Zz4=";
const identity = { id: 1, defaultSalesAgentId: null, defaultCashierId: null, requireSalesAgent: false, requireCashier: false, currency: "XOF", companyName: "StockPilot", companyLogoUrl: null, companyAddress: null, companyPhone: null, companyEmail: null, companyFooter: null };
const sale = { id: 77, invoiceNumber: "FAC-IDENT-00077", customerName: "Client identité", customerType: "ordinary", sellerName: "Vendeur test", totalCents: 7500, createdAt: new Date().toISOString() };
const detail = { sale: { ...sale, status: "paid", sellerUserId: 3, paymentMethod: "cash", subtotalCents: 7500 }, customer: { id: 5, name: "Client identité", type: "ordinary" }, items: [{ id: 1, productName: "Article identité", quantity: 1, unitPriceCents: 7500, lineTotalCents: 7500 }], commissions: [], participants: { seller: { id: 3, name: "Vendeur test", role: "Vendeur" }, salesAgent: null, cashier: null } };
let identitySaved = false;
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.route("**/api/trpc/**", async route => {
  const paths = route.request().url().split("/api/trpc/")[1].split("?")[0].split(",");
  const value = path => path === "auth.me" ? admin : path === "commerce.settings.get" ? identity : path === "commerce.sales.list" ? [sale] : path === "commerce.sales.detail" ? detail : path === "commerce.settings.uploadLogo" ? { url: logo } : { success: true };
  if (paths.includes("commerce.settings.uploadLogo")) identity.companyLogoUrl = logo;
  if (paths.includes("commerce.settings.save")) { identitySaved = true; Object.assign(identity, { companyName: "Bati Pro", companyAddress: "Ouagadougou, Koulouba", companyPhone: "+226 70 00 00 00", companyEmail: "contact@batipro.test", companyFooter: "NIF : BF-TEST" }); }
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(paths.map(path => ({ result: { data: { json: value(path) } } }))) });
});
await page.goto("http://localhost:3000/parametres", { waitUntil: "domcontentloaded" });
await page.locator('input[type="file"]').setInputFiles({ name: "batipro.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#00bcd4"/></svg>') });
await page.waitForFunction(() => document.body.textContent?.includes("Logo enregistré."));
await page.getByLabel("Raison sociale *").fill("Bati Pro");
await page.getByLabel("Téléphone").fill("+226 70 00 00 00");
await page.getByLabel("E-mail").fill("contact@batipro.test");
await page.getByLabel("Adresse").fill("Ouagadougou, Koulouba");
await page.getByLabel("Mention de bas de page").fill("NIF : BF-TEST");
await page.getByRole("button", { name: "Enregistrer l’identité" }).click();
await page.waitForFunction(() => document.body.textContent?.includes("Préférences enregistrées."));
if (!identitySaved) throw new Error("La sauvegarde de l’identité entreprise n’a pas été appelée.");
await page.goto("http://localhost:3000/factures", { waitUntil: "domcontentloaded" });
await page.getByText("FAC-IDENT-00077", { exact: true }).click();
await page.locator("#invoice-print").getByText("Bati Pro", { exact: true }).waitFor();
await page.locator("#invoice-print").getByText("NIF : BF-TEST", { exact: true }).waitFor();
const companyLogo = page.locator('#invoice-print img[alt="Logo Bati Pro"]');
if (await companyLogo.count() !== 1) throw new Error("Le logo de l’entreprise n’est pas affiché sur la facture.");
await browser.close();
console.log("Parcours E2E identité entreprise validé : paramètres, coordonnées et logo sur facture.");
