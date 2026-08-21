import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { backupSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { buildGoogleDriveAuthorizationUrl, encryptSecret, exchangeGoogleDriveCode, googleDriveConfigured } from "./googleDrive";
import { sdk } from "./_core/sdk";

function redirectUri(req: Request) { return `${req.protocol}://${req.get("host")}/api/integrations/google-drive/callback`; }
async function settingsOrCreate() { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); const current = (await db.select().from(backupSettings).limit(1))[0]; if (current) return { db, settings: current }; const result = await db.insert(backupSettings).values({}); const settings = (await db.select().from(backupSettings).where(eq(backupSettings.id, Number(result[0].insertId))).limit(1))[0]!; return { db, settings }; }

export function registerGoogleDriveRoutes(app: Express) {
  app.get("/api/integrations/google-drive/connect", async (req: Request, res: Response) => { try { const user = await sdk.authenticateRequest(req); if (user.role !== "admin") return res.status(403).send("Accès administrateur requis."); if (!googleDriveConfigured()) return res.status(503).send("Google Drive doit être configuré dans les secrets du projet."); const { db, settings } = await settingsOrCreate(); const state = randomUUID(); await db.update(backupSettings).set({ googleDriveOauthState: state, updatedByUserId: user.id }).where(eq(backupSettings.id, settings.id)); res.redirect(buildGoogleDriveAuthorizationUrl(redirectUri(req), state)); } catch (error) { res.status(500).send(error instanceof Error ? error.message : "Impossible de démarrer la connexion Google Drive."); } });
  app.get("/api/integrations/google-drive/callback", async (req: Request, res: Response) => { try { const code = typeof req.query.code === "string" ? req.query.code : ""; const state = typeof req.query.state === "string" ? req.query.state : ""; const { db, settings } = await settingsOrCreate(); if (!code || !state || state !== settings.googleDriveOauthState) return res.status(400).send("Réponse Google Drive invalide ou expirée."); const tokens = await exchangeGoogleDriveCode(code, redirectUri(req)); if (!tokens.refresh_token) return res.status(400).send("Google Drive n’a pas fourni de jeton durable. Recommencez et acceptez les autorisations."); await db.update(backupSettings).set({ googleDriveAccessTokenEncrypted: encryptSecret(tokens.access_token), googleDriveRefreshTokenEncrypted: encryptSecret(tokens.refresh_token), googleDriveTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000), googleDriveOauthState: null }).where(eq(backupSettings.id, settings.id)); res.redirect("/sauvegardes?drive=connected"); } catch (error) { res.status(500).send(error instanceof Error ? error.message : "Impossible de terminer la connexion Google Drive."); } });
}
