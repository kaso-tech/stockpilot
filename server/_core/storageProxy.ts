import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";
import { sdk } from "./sdk";

/**
 * Fichiers privés : sauvegardes (administrateurs) et justificatifs de dépenses ou de
 * paie de l'entreprise. Logos et signatures restent publics (factures partagées).
 */
const PRIVATE_KEY = /^company\/([^/]+)\/(backups|expenses|payroll)\//;

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
