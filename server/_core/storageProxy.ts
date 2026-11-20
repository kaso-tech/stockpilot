import type { Express } from "express";
import { and, eq } from "drizzle-orm";
import { products } from "../../drizzle/schema";
import { companyScope } from "../companyScope";
import { getDb } from "../db";
import { storageGetSignedUrl, storageRead } from "../storage";
import { parseProductImageKey } from "../productImages";
import { sdk } from "./sdk";

export function canReadCompanyStorageKey(key: string, companyId: number): boolean {
  const expectedPrefix = `company/${companyId}/`;
  if (!key.startsWith(expectedPrefix)) return false;
  return key.split("/").every(segment => segment.length > 0 && segment !== "." && segment !== "..");
}

/** Une photo n'est lisible que si son URL exacte figure sur le produit du même tenant. */
export async function isAttachedProductImage(key: string, companyId: number): Promise<boolean> {
  const parsed = parseProductImageKey(key);
  if (!parsed || parsed.companyId !== companyId) return false;
  const db = await getDb();
  if (!db) return false;
  const column = parsed.variant === "image" ? products.imageUrl : products.imageThumbUrl;
  const expectedUrl = `/manus-storage/${key}`;
  const rows = await db.select({ id: products.id }).from(products).where(and(
    eq(products.id, parsed.productId),
    companyScope(products.companyId, companyId),
    eq(column, expectedUrl),
  )).limit(1);
  return rows.length > 0;
}

const IMAGE_TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" };
export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/{*key}", async (req, res) => {
    const rawKey = (req.params as Record<string, string | string[]>).key;
    const key = Array.isArray(rawKey) ? rawKey.join("/") : rawKey;
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).send("Authentication required");
      return;
    }
    if (user.isCron || !canReadCompanyStorageKey(key, user.companyId)) {
      res.status(403).send("File access denied");
      return;
    }
    const image = parseProductImageKey(key);
    if (/^company\/\d+\/products\//.test(key) && !image) {
      res.status(404).set("Cache-Control", "no-store").send("Not found");
      return;
    }
    if (image) {
      try {
        if (!(await isAttachedProductImage(key, user.companyId))) {
          res.status(404).set("Cache-Control", "no-store").send("Not found");
          return;
        }
        const body = await storageRead(key);
        res.set({
          "Content-Type": IMAGE_TYPES[image.extension],
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        });
        res.send(body);
      } catch {
        res.set("Cache-Control", "no-store").status(404).send("Not found");
      }
      return;
    }
    try {
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch {
      console.error("[StorageProxy] storage signing failed");
      res.status(502).send("Storage proxy error");
    }
  });
}
