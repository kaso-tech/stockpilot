import { chromium } from "playwright";

const admin = { id: 1, openId: "backup-admin", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastSignedIn: new Date().toISOString() };
const settings = { automaticEnabled: true, frequencyHours: 24, retentionCount: 14, googleDriveConfigured: false, googleDriveConnected: false, googleDriveFolderId: null, scheduleNextAt: null, lastBackupAt: null, lastBackupStatus: "idle", lastBackupError: null };
const archives = [];
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.addInitScript(() => { window.__backupDownloadOpened = false; window.open = () => { window.__backupDownloadOpened = true; return null; }; });

await page.route("**/api/trpc/**", async route => {
  const paths = route.request().url().split("/api/trpc/")[1].split("?")[0].split(",");
  const value = path => {
    if (path === "auth.me") return admin;
    if (path === "backups.get") return { settings, archives };
    if (path === "backups.runNow") { const archive = { id: 9, filename: "stockpilot-backup-e2e.json", trigger: "manual", status: "completed", storageKey: "backups/e2e.json", storageUrl: "/manus-storage/backups/e2e.json", sizeBytes: 256, recordCount: 3, googleDriveFileId: null, googleDriveUrl: null, createdByUserId: 1, error: null, createdAt: new Date().toISOString() }; archives.unshift(archive); settings.lastBackupAt = archive.createdAt; settings.lastBackupStatus = "success"; return archive; }
    if (path === "backups.saveConfiguration") return { success: true, nextExecutionAt: null };
    if (path === "backups.previewRestore") return { exportedAt: "2026-08-21T00:00:00.000Z", counts: { products: 1, sales: 0 }, total: 1 };
    if (path === "backups.restore") return { restoredCount: 1 };
    if (path === "backups.download") return { url: "https://download.example.test/stockpilot-backup-e2e.json" };
    return { success: true };
  };
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(paths.map(path => ({ result: { data: { json: value(path) } } }))) });
});

await page.goto("http://localhost:3000/sauvegardes", { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Sauvegardes" }).waitFor();
await page.getByRole("button", { name: "Sauvegarder maintenant" }).click();
await page.getByText("stockpilot-backup-e2e.json", { exact: true }).waitFor();
await page.getByRole("button", { name: "Télécharger" }).click();
await page.waitForFunction(() => window.__backupDownloadOpened === true);
await page.getByRole("button", { name: "Enregistrer la planification" }).click();
const archive = { schemaVersion: 1, source: "StockPilot", exportedAt: "2026-08-21T00:00:00.000Z", tables: { products: [{ id: 1 }] } };
await page.locator('input[type="file"]').setInputFiles({ name: "stockpilot-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(archive)) });
await page.getByPlaceholder("Tapez RESTAURER pour confirmer").fill("RESTAURER");
await page.getByRole("button", { name: "Restaurer" }).click();
await browser.close();
console.log("Parcours E2E mobile sauvegarde locale validé : création, téléchargement, planification et restauration confirmée.");
