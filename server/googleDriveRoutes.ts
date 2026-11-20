import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { backupSettings } from "../drizzle/schema";
import { companyScope } from "./companyScope";
import { getDb } from "./db";
import { buildGoogleDriveAuthorizationUrl, encryptSecret, exchangeGoogleDriveCode, googleDriveConfigured } from "./googleDrive";
import { sdk } from "./_core/sdk";

function redirectUri(req: Request) { return `${req.protocol}://${req.get("host")}/api/integrations/google-drive/callback`; }
function validCompanyId(companyId: number | null | undefined): companyId is number { return Number.isInteger(companyId) && Number(companyId) > 0; }
async function settingsOrCreate(companyId: number) { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); const current = (await db.select().from(backupSettings).where(companyScope(backupSettings.companyId, companyId)).limit(1))[0]; if (current) return { db, settings: current }; const result = await db.insert(backupSettings).values({ companyId }); const settings = (await db.select().from(backupSettings).where(and(eq(backupSettings.id, Number(result[0].insertId)), companyScope(backupSettings.companyId, companyId))).limit(1))[0]; if (!settings) throw new Error("Configuration de sauvegarde introuvable."); return { db, settings }; }

export function registerGoogleDriveRoutes(app: Express) {
  app.get("/api/integrations/google-drive/connect", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.role !== "admin") return res.status(403).send("Accès administrateur requis.");
      if (!validCompanyId(user.companyId)) return res.status(403).send("Entreprise non configurée.");
      if (!googleDriveConfigured()) return res.status(503).send("Google Drive doit être configuré dans les secrets du projet.");
      const { db, settings } = await settingsOrCreate(user.companyId);
      const state = randomUUID();
      await db.update(backupSettings).set({ googleDriveOauthState: state, updatedByUserId: user.id }).where(and(eq(backupSettings.id, settings.id), companyScope(backupSettings.companyId, user.companyId)));
      return res.redirect(buildGoogleDriveAuthorizationUrl(redirectUri(req), state));
    } catch (error) {
      console.error("[GoogleDrive] connect failed", error);
      return res.status(500).send("Impossible de démarrer la connexion Google Drive.");
    }
  });

  app.get("/api/integrations/google-drive/callback", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.role !== "admin") return res.status(403).send("Accès administrateur requis.");
      if (!validCompanyId(user.companyId)) return res.status(403).send("Entreprise non configurée.");
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const { db, settings } = await settingsOrCreate(user.companyId);
      if (!code || !state || state !== settings.googleDriveOauthState) return res.status(400).send("Réponse Google Drive invalide ou expirée.");
      const tokens = await exchangeGoogleDriveCode(code, redirectUri(req));
      if (!tokens.refresh_token) return res.status(400).send("Google Drive n’a pas fourni de jeton durable. Recommencez et acceptez les autorisations.");
      await db.update(backupSettings).set({ googleDriveAccessTokenEncrypted: encryptSecret(tokens.access_token), googleDriveRefreshTokenEncrypted: encryptSecret(tokens.refresh_token), googleDriveTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000), googleDriveOauthState: null, updatedByUserId: user.id }).where(and(eq(backupSettings.id, settings.id), companyScope(backupSettings.companyId, user.companyId)));
      return res.redirect("/sauvegardes?drive=connected");
    } catch (error) {
      console.error("[GoogleDrive] callback failed", error);
      return res.status(500).send("Impossible de terminer la connexion Google Drive.");
    }
  });
}
