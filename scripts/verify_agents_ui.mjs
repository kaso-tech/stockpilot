import { chromium } from "playwright";

const admin = { id: 1, openId: "admin-e2e", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastSignedIn: new Date().toISOString() };
const payroll = { users: [], agents: [], profiles: [], balances: [], periodLabel: "2026-08" };
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.route("**/api/trpc/**", async route => {
  const paths = route.request().url().split("/api/trpc/")[1].split("?")[0].split(",");
  const data = path => path === "auth.me" ? admin : path === "payroll.overview" ? payroll : path === "commerce.sellers.list" ? [] : [];
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(paths.map(path => ({ result: { data: { json: data(path) } } }))) });
});
await page.goto("http://localhost:3000/agents", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Nouvel agent" }).click();
await page.getByRole("combobox").first().click();
await page.getByRole("option", { name: "Vendeur" }).click();
await page.getByText("Nom d’utilisateur *", { exact: true }).waitFor();
await page.getByText("Mot de passe *", { exact: true }).waitFor();
await page.getByRole("combobox").nth(1).click();
await page.getByRole("option", { name: "Salaire fixe" }).click();
await page.getByText("Salaire fixe mensuel", { exact: true }).waitFor();
if (await page.getByText("Base de commission", { exact: true }).count()) throw new Error("Les champs de commission sont visibles pour un salaire fixe.");
await page.getByRole("combobox").nth(1).click();
await page.getByRole("option", { name: "Commission", exact: true }).click();
await page.getByText("Base de commission", { exact: true }).waitFor();
if (await page.getByText("Salaire fixe mensuel", { exact: true }).count()) throw new Error("Le champ fixe est visible pour une commission seule.");
await browser.close();
console.log("Parcours E2E Agents validé : vendeur authentifiable et rémunération conditionnelle.");
