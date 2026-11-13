import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout (9.11) sur le serveur de production compilé (`pnpm build`)
 * et une base MySQL dédiée : E2E_DATABASE_URL (vidée puis migrée avant les tests).
 */
const port = Number(process.env.E2E_PORT ?? 4173);
const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  "mysql://root:root@127.0.0.1:3306/stockpilot_e2e";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: process.env.E2E_CHROMIUM_PATH
      ? { executablePath: process.env.E2E_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    // La base dédiée est recréée et migrée juste avant le démarrage du serveur.
    command: "node scripts/e2e-prepare-db.mjs && node dist/index.js",
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
      MAIL_TRANSPORT: "memory",
      TRUST_PROXY: "false",
    },
  },
});
