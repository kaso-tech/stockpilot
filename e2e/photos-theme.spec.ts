import { test, expect } from "@playwright/test";
import { mockApi, pushRoute } from "./helpers";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4/x8AAwAB//wl3FEAAAAASUVORK5CYII=", "base64");

test("la photo déjà chargée reste décodable hors réseau dans son périmètre et le cache est effacé à la déconnexion", async ({ page, context }) => {
  await mockApi(page, "admin", true, true);
  await context.route("**/manus-storage/company/101/products/42/**", route => route.fulfill({ status: 200, contentType: "image/png", body: png }));
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByText("Performance du mois", { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.controller?.postMessage({ type: "STOCKPILOT_PHOTO_SCOPE", scope: { companyId: 101, userId: 1001, warehouseId: 99 } }));
  await pushRoute(page, "/produits");
  const image = page.locator('img[src*="thumb_1234abcd.png"]').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(async () => { const keys = await caches.keys(); const name = keys.find(key => key === "stockpilot-product-photos-v1-101-1001-99"); return name ? (await (await caches.open(name)).keys()).length : 0; })).toBeGreaterThan(0);
  await context.unroute("**/manus-storage/company/101/products/42/**");
  await context.setOffline(true);
  await page.evaluate(async () => {
    const response = await fetch("/manus-storage/company/101/products/42/thumb_1234abcd.png");
    const bitmap = await createImageBitmap(await response.blob());
    if (bitmap.width !== 1) throw new Error("Photo locale illisible");
    bitmap.close();
  });
  await page.evaluate(() => navigator.serviceWorker.controller?.postMessage({ type: "STOCKPILOT_PHOTO_SCOPE", scope: null }));
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).filter(key => key.startsWith("stockpilot-product-photos-")).length)).toBe(0);
  await context.setOffline(false);
});

test("la recherche Ctrl+K utilise les routes autorisées sans nouveau document et le bleu reste personnalisable", async ({ page }) => {
  await mockApi(page, "viewer");
  await page.goto("/");
  await expect(page.getByText("Performance du mois", { exact: true })).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Caisse & comptabilité", { exact: true })).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-primary").trim().toLowerCase())).toBe("#2563eb");
  await page.getByRole("button", { name: "Passer au thème clair" }).click();
  await expect(page.getByRole("button", { name: "Passer au thème sombre" })).toBeVisible();
  await page.getByRole("button", { name: "Passer au thème sombre" }).click();
  await expect(page.getByRole("button", { name: "Passer au thème clair" })).toBeVisible();
});
