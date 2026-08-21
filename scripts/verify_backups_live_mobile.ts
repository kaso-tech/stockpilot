import { chromium } from "playwright";
import { desc, eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "../server/db";
import { sdk } from "../server/_core/sdk";
import { COOKIE_NAME } from "../shared/const";

const baseUrl = process.env.STOCKPILOT_E2E_BASE_URL || "http://localhost:3000";
const db = await getDb();
if (!db) throw new Error("Base de données indisponible pour le parcours réel.");
const admin = (await db.select().from(users).where(eq(users.role, "admin")).orderBy(desc(users.id)).limit(1))[0];
if (!admin) throw new Error("Aucun administrateur disponible pour le parcours réel.");
const token = await sdk.createSessionToken(admin.openId, { name: admin.name || "Administrateur", expiresInMs: 5 * 60 * 1000 });

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await context.addCookies([{ name: COOKIE_NAME, value: token, url: baseUrl }]);
const page = await context.newPage();
await page.goto(`${baseUrl}/sauvegardes`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Sauvegardes" }).waitFor();
await page.getByRole("button", { name: "Sauvegarder maintenant" }).click();
await page.getByText(/stockpilot-backup-.*\.json/).first().waitFor({ timeout: 60_000 });
const popup = await Promise.race([page.waitForEvent("popup"), page.getByRole("button", { name: "Télécharger" }).click().then(() => null)]);
if (popup) await popup.close();
await page.getByRole("button", { name: "Enregistrer la planification" }).click();
await page.getByText("Importez une archive pour en vérifier le contenu", { exact: false }).waitFor();
await browser.close();
console.log("Parcours mobile réel validé : archive créée, téléchargement demandé et planification enregistrée sans restauration destructive.");
