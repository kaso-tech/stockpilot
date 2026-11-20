import { test, expect } from "@playwright/test";
import type { Locator } from "@playwright/test";
import { mockApi, pushRoute } from "./helpers";

const quote = {
  id: 901, companyId: 101, warehouseId: 99, channel: "quote", status: "draft",
  invoiceNumber: "DEV-RECETTE-901", customerName: "Client de recette", totalCents: 2400,
  amountPaidCents: 0, createdAt: new Date("2026-11-20T12:00:00Z"), agents: [],
};

async function openQuotes(page: Parameters<typeof mockApi>[0]) {
  await mockApi(page, "admin", true, false, { "transactions.list": [quote], "commerce.documentParticipants": [] });
  await page.goto("/");
  await pushRoute(page, "/devis");
  const card = page.getByRole("button", { name: /DEV-RECETTE-901/ });
  await expect(card).toBeVisible();
  return card;
}

async function titleContrast(card: Locator) {
  return card.evaluate(el => {
    const title = el.querySelector("p")!;
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    };
    const foreground = luminance(getComputedStyle(title).color);
    const background = luminance(getComputedStyle(el).backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
}

async function setTheme(page: Parameters<typeof mockApi>[0], dark: boolean) {
  if (await page.evaluate(() => document.documentElement.classList.contains("dark")) !== dark) {
    await page.getByRole("button", { name: dark ? "Passer au thème sombre" : "Passer au thème clair" }).click();
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(dark);
}

test("le relief des cartes reste léger, contrasté et indépendant du shell en desktop", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const card = await openQuotes(page);
  await setTheme(page, false);
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).transform)).toBe("none");
  const initialShadow = await card.evaluate(el => getComputedStyle(el).boxShadow);
  await card.hover();
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).transform)).toBe("matrix(1, 0, 0, 1, 0, -2)");
  expect(await card.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe(initialShadow);
  expect(await card.evaluate(el => getComputedStyle(el).translate)).toBe("none");
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("main")!).transform)).toBe("none");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-primary").trim().toLowerCase())).toBe("#2563eb");
  await expect.poll(() => titleContrast(card)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath("desktop-light.png"), fullPage: true });
  await setTheme(page, true);
  await card.hover();
  await expect.poll(() => titleContrast(card)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath("desktop-dark.png"), fullPage: true });
});

test("les cartes restent immobiles en motion réduite et accessibles sur mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const card = await openQuotes(page);
  await card.hover();
  expect(await card.evaluate(el => getComputedStyle(el).transform)).toBe("none");
  expect(await card.evaluate(el => getComputedStyle(el).translate)).toBe("none");
  expect(await card.evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0s");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await setTheme(page, false);
  await card.hover();
  await expect.poll(() => titleContrast(card)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath("mobile-light.png"), fullPage: true });
  await setTheme(page, true);
  await card.hover();
  await expect.poll(() => titleContrast(card)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath("mobile-dark.png"), fullPage: true });
});

test("le panier POS reste fixé au viewport sans ancêtre transformé en desktop et mobile", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/");
  await pushRoute(page, "/pos");
  await page.getByRole("button", { name: /Produit de recette/ }).click();
  const cart = page.getByRole("complementary", { name: "Panier de vente", exact: true });
  await expect(cart).toBeVisible();
  for (const [width, height] of [[1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => cart.evaluate(el => {
      let ancestor = el.parentElement;
      while (ancestor) {
        const style = getComputedStyle(ancestor);
        if (style.transform !== "none" || style.translate !== "none" || style.perspective !== "none") return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    })).toBe(true);
    expect(await cart.evaluate(el => getComputedStyle(el).position)).toBe("fixed");
    const box = await cart.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    expect(height - (box!.y + box!.height)).toBeCloseTo(width < 640 ? 0 : 20, 0);
    await page.screenshot({ path: testInfo.outputPath(width < 640 ? "pos-mobile.png" : "pos-desktop.png") });
  }
});
