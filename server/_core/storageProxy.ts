import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";

export function canReadCompanyStorageKey(key: string, companyId: number): boolean {
  const expectedPrefix = `company/${companyId}/`;
  if (!key.startsWith(expectedPrefix)) return false;
  return key.split("/").every(segment => segment.length > 0 && segment !== "." && segment !== "..");
}

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

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        console.error(`[StorageProxy] forge error: status=${forgeResp.status}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
