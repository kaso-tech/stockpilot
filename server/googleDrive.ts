import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { backupArchives, backupSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetSignedUrl } from "./storage";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

function clientId() { return process.env.GOOGLE_DRIVE_CLIENT_ID ?? ""; }
function clientSecret() { return process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? ""; }
function encryptionKey() { return createHash("sha256").update(process.env.JWT_SECRET ?? "stockpilot-dev-key").digest(); }
function requireConfig() { if (!clientId() || !clientSecret()) throw new Error("Google Drive n’est pas encore configuré. Ajoutez l’identifiant et le secret OAuth Google dans les secrets du projet."); }

export function googleDriveConfigured() { return Boolean(clientId() && clientSecret()); }
export function encryptSecret(value: string) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv); const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join("."); }
export function decryptSecret(value: string) { const [ivEncoded, tagEncoded, encryptedEncoded] = value.split("."); if (!ivEncoded || !tagEncoded || !encryptedEncoded) throw new Error("Jeton Google Drive invalide."); const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64")); decipher.setAuthTag(Buffer.from(tagEncoded, "base64")); return Buffer.concat([decipher.update(Buffer.from(encryptedEncoded, "base64")), decipher.final()]).toString("utf8"); }

export function buildGoogleDriveAuthorizationUrl(redirectUri: string, state: string) { requireConfig(); const url = new URL(GOOGLE_AUTH_URL); url.searchParams.set("client_id", clientId()); url.searchParams.set("redirect_uri", redirectUri); url.searchParams.set("response_type", "code"); url.searchParams.set("scope", DRIVE_SCOPE); url.searchParams.set("access_type", "offline"); url.searchParams.set("prompt", "consent"); url.searchParams.set("state", state); return url.toString(); }

export async function exchangeGoogleDriveCode(code: string, redirectUri: string) { requireConfig(); const body = new URLSearchParams({ code, client_id: clientId(), client_secret: clientSecret(), redirect_uri: redirectUri, grant_type: "authorization_code" }); const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }); if (!response.ok) throw new Error(`Google Drive a refusé l’autorisation (${response.status}).`); return await response.json() as { access_token: string; refresh_token?: string; expires_in: number; } ; }

async function refreshGoogleDriveAccessToken(refreshToken: string) { requireConfig(); const body = new URLSearchParams({ refresh_token: refreshToken, client_id: clientId(), client_secret: clientSecret(), grant_type: "refresh_token" }); const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }); if (!response.ok) throw new Error("La connexion Google Drive a expiré. Reconnectez le compte Google."); return await response.json() as { access_token: string; expires_in: number; } ; }

async function currentAccessToken(settings: typeof backupSettings.$inferSelect) { const now = Date.now(); if (settings.googleDriveAccessTokenEncrypted && settings.googleDriveTokenExpiresAt && settings.googleDriveTokenExpiresAt.getTime() > now + 60_000) return decryptSecret(settings.googleDriveAccessTokenEncrypted); if (!settings.googleDriveRefreshTokenEncrypted) throw new Error("Google Drive n’est pas connecté."); const refreshToken = decryptSecret(settings.googleDriveRefreshTokenEncrypted); const refreshed = await refreshGoogleDriveAccessToken(refreshToken); const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); await db.update(backupSettings).set({ googleDriveAccessTokenEncrypted: encryptSecret(refreshed.access_token), googleDriveTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000) }).where(eq(backupSettings.id, settings.id)); return refreshed.access_token; }

async function multipartUpload(accessToken: string, metadata: Record<string, unknown>, content: Buffer, mimeType: string) { const boundary = `stockpilot-${randomBytes(8).toString("hex")}`; const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`), content, Buffer.from(`\r\n--${boundary}--`)]); const response = await fetch(DRIVE_FILES_URL, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }); if (!response.ok) throw new Error(`Échec de la copie Google Drive (${response.status}).`); return await response.json() as { id: string; webViewLink?: string; } ; }

async function createDriveFolder(accessToken: string) { const response = await fetch("https://www.googleapis.com/drive/v3/files", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: "StockPilot Backups", mimeType: "application/vnd.google-apps.folder" }) }); if (!response.ok) throw new Error(`Impossible de créer le dossier Google Drive (${response.status}).`); return await response.json() as { id: string; } ; }

export async function syncArchiveToGoogleDrive(archiveId: number) {
  const db = await getDb(); if (!db) throw new Error("Base de données indisponible.");
  const settings = (await db.select().from(backupSettings).limit(1))[0]; const archive = (await db.select().from(backupArchives).where(eq(backupArchives.id, archiveId)).limit(1))[0];
  if (!settings || !archive?.storageKey || !settings.googleDriveRefreshTokenEncrypted) return null;
  const accessToken = await currentAccessToken(settings); let folderId = settings.googleDriveFolderId;
  if (!folderId) { folderId = (await createDriveFolder(accessToken)).id; await db.update(backupSettings).set({ googleDriveFolderId: folderId }).where(eq(backupSettings.id, settings.id)); }
  const signedUrl = await storageGetSignedUrl(archive.storageKey); const source = await fetch(signedUrl); if (!source.ok) throw new Error("Impossible de lire l’archive locale avant la copie Drive."); const content = Buffer.from(await source.arrayBuffer());
  const uploaded = await multipartUpload(accessToken, { name: archive.filename, parents: [folderId], mimeType: "application/json" }, content, "application/json");
  await db.update(backupArchives).set({ googleDriveFileId: uploaded.id, googleDriveUrl: uploaded.webViewLink ?? `https://drive.google.com/open?id=${uploaded.id}` }).where(eq(backupArchives.id, archive.id));
  return uploaded;
}
