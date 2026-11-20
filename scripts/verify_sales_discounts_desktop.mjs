import { chromium } from "playwright";

const now = new Date().toISOString();
const admin = { id: 1, openId: "discount-desktop-admin", name: "Admin", email: "admin@example.test", role: "admin", active: true, createdAt: now, updatedAt: now, lastSignedIn: now };
const product = { id: 10, name: "Produit remisé", reference: "DIS-001", unit: "unité", quantity: 12, retailPriceCents: 1000000, wholesalePriceCents: 800000 };
const partialInvoice = { id: 88, invoiceNumber: "FAC-DIS-088", channel: "invoice", status: "partial", totalCents: 855000, amountPaidCents: 300000, createdAt: now, customerName: "Client remise" };
const detail = { sale: { ...partialInvoice, subtotalCents: 1000000, invoiceDiscountCents: 45000, companySignatureAlignment: "right" }, customer: { id: 4, name: "Client remise", type: "ordinary" }, items: [{ id: 1, productName: "Produit remisé", quantity: 1, unitPriceCents: 1000000, discountCents: 100000, lineTotalCents: 900000 }], commissions: [], participants: {} };
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { window.open = () => ({ document: { write: html => { document.body.dataset.printedInvoice = html; }, close: () => undefined }, focus: () => undefined, print: () => { document.body.dataset.printed = "yes"; }, close: () => undefined }); });
await page.route("**/api/trpc/**", async route => {
  const paths = route.request().url().split("/api/trpc/")[1].split("?")[0].split(",");
  const value = path => {
    if (path === "auth.me") return admin;
    if (path === "products.list") return [product];
    if (path === "commerce.agents.list") return [];
    if (path === "commerce.settings.get") return { currency: "XOF", ticketWidthMm: "80", requireSalesAgent: false, requireCashier: false };
    if (path === "transactions.list") return [partialInvoice];
    if (path === "commerce.sales.detail") return detail;
    if (path === "dashboard.get") return {};
    return [];
  };
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(paths.map(path => ({ result: { data: { json: value(path) } } }))) });
});

await page.goto("http://localhost:3000/pos", { waitUntil: "domcontentloaded" });
await page.getByText("Produit remisé", { exact: true }).click();
await page.getByRole("button", { name: /Panier · 1/ }).click();
await page.getByRole("combobox").first().click();
await page.getByRole("option", { name: "Pourcentage" }).click();
await page.locator("input[type=number]").fill("10");
await page.getByText("Remises lignes", { exact: true }).waitFor();
await page.locator("div.fixed.inset-y-0.right-0").getByRole("button").first().click();
await page.getByRole("button", { name: "Scanner un code-barres" }).click();
await page.getByRole("heading", { name: "Scanner un code-barres" }).waitFor();
await page.getByText(/saisie manuelle|Cadrez le code-barres/i).first().waitFor();
await page.keyboard.press("Escape");

await page.goto("http://localhost:3000/factures", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Encaisser" }).click();
await page.getByRole("heading", { name: "Encaissement" }).waitFor();
await page.getByText("Solde restant", { exact: true }).waitFor();
await page.keyboard.press("Escape");
await page.getByText("FAC-DIS-088", { exact: true }).locator("xpath=ancestor::tr").getByRole("button").first().click();
await page.locator("#invoice-print").getByText("Remises lignes", { exact: true }).waitFor();
await page.locator("#invoice-print").getByText("Remise facture", { exact: true }).waitFor();
const normalize = value => value.replace(/\s+/g, " ").trim();
const preview = normalize(await page.locator("#invoice-print").innerText());
for (const expected of ["-1 000 FCFA", "-450 FCFA", "8 550 FCFA"]) if (!preview.includes(expected)) throw new Error(`Montant remisé absent de l’aperçu : ${expected}`);
await page.getByRole("button", { name: "Imprimer A4" }).click();
await page.waitForFunction(() => document.body.dataset.printed === "yes");
const printed = await page.locator("body").evaluate(node => node.dataset.printedInvoice || "");
const printedText = normalize(printed.replace(/<[^>]+>/g, " "));
if (!printedText.includes("Remise facture") || !printedText.includes("Remises lignes")) throw new Error("Les remises ne figurent pas dans l’impression A4.");
for (const expected of ["-1 000 FCFA", "-450 FCFA", "8 550 FCFA"]) if (!printedText.includes(expected)) throw new Error(`Montant remisé absent de l’impression : ${expected}`);
await browser.close();
console.log("Parcours E2E desktop remises, scan et encaissement différé validé.");
