import { type Page } from "@playwright/test";
import superjson from "superjson";
export const warehouse = { id: 99, companyId: 101, name: "Entrepôt de recette", code: "TEST", active: true, isDefault: true };
export const product = { id: 42, companyId: 101, reference: "TEST-42", name: "Produit de recette", category: "Recette", unit: "pièce", quantity: 10, minimumQuantity: 2, purchasePriceCents: 100, retailPriceCents: 200, wholesalePriceCents: 180, supplierId: null };
export async function mockApi(page: Page, role = "admin", authenticated = true) {
  const user = authenticated ? { id: 1001, openId: "e2e-synthetic", companyId: 101, name: "Compte de recette", role, active: true, email: "test@example.test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null;
  await page.route("**/api/trpc/**", async route => {
    const names = new URL(route.request().url()).pathname.split("/api/trpc/")[1]!.split(",");
    const known: Record<string, unknown> = {
      "auth.me": user, "warehouses.active": { warehouseId: 99, warehouse }, "warehouses.list": [warehouse],
      "products.list": [product], "commerce.customers.list": [{ id: 55, name: "Client de recette", type: "ordinary", email: null, phone: null, address: null }],
      "commerce.settings.get": { companyName: "Entreprise de recette", currency: "XOF", primaryColor: "#2563EB", vatEnabled: false },
      "preferences.get": { currency: "XOF", primaryColor: "#2563EB" },
      "dashboard.get": { summary: {}, salesTrend: [], unpaidInvoices: [], recentSales: [], lowStock: [] },
      "onboarding.status": { completed: true, steps: { product: true, customer: true, paymentMethod: true } },
      "dashboardPreferences.get": null, "platform.access": { allowed: false },
      "backups.get": { settings: {}, archives: [] },
      "auth.requestPasswordReset": { success: true }, "auth.resetPassword": { success: true },
      "emailVerification.status": { verifiedAt: null, available: false },
    };
    const results = names.map(name => {
      const data = Object.hasOwn(known, name) ? known[name] : (name.endsWith(".list") || name.endsWith(".notifications") || name.endsWith(".managerAlerts") ? [] : {});
      return { result: { data: superjson.serialize(data) } };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(results) });
  });
}
export async function pushRoute(page: Page, path: string) {
  await page.evaluate(pathname => { history.pushState(null, "", pathname); window.dispatchEvent(new PopStateEvent("popstate")); }, path);
}
