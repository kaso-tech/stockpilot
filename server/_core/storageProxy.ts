import type { Express } from "express";
import { storageGetSignedUrl, storageRead } from "../storage";
import { sdk } from "./sdk";

/**
 * Fichiers privés : sauvegardes (administrateurs), justificatifs de dépenses ou de
 * paie et photos de produits de l'entreprise. Logos et signatures restent publics
 * (factures partagées).
 */
const PRIVATE_KEY = /^company\/([^/]+)\/(backups|expenses|payroll|products)\//;
/** Photos de produits : contenu servi directement, mis en cache par le navigateur (clé unique par envoi). */
const PRODUCT_IMAGE_KEY =
  /^company\/[^/]+\/products\/\d+\/(image|thumb)_[a-f0-9]{8}\.(webp|jpg|png)$/;
const IMAGE_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

export async function canReadStorageKey(
  key: string,
  authenticate: () => Promise<{ companyId: number | null; role: string }>
) {
  const match = key.match(PRIVATE_KEY);
  if (!match) return true;
  try {
    const user = await authenticate();
    if (String(user.companyId) !== match[1]) return false;
    return match[2] !== "backups" || user.role === "admin";
  } catch {
    return false;
  }
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (
      key.includes("..") ||
      !(await canReadStorageKey(key, () => sdk.authenticateRequest(req)))
    ) {
      res.status(404).send("Not found");
      return;
    }

    if (PRODUCT_IMAGE_KEY.test(key)) {
      try {
        const body = await storageRead(key);
        res.set({
          "Content-Type":
            IMAGE_TYPES[key.split(".").pop() ?? ""] ?? "image/webp",
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        });
        res.send(body);
      } catch (err) {
        console.error("[StorageProxy] product image failed:", err);
        res.status(404).send("Not found");
      }
      return;
    }

    try {
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
