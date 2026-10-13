import { randomBytes } from "crypto";
import {
  legacyKeyFromJwtSecret,
  openString,
  parseKey,
  sealString,
} from "./secretBox";
import { and, eq } from "drizzle-orm";
import { backupArchives, backupSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetSignedUrl } from "./storage";
import { companyScope } from "./companyScope";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

function clientId() {
  return process.env.GOOGLE_DRIVE_CLIENT_ID ?? "";
}
function clientSecret() {
  return process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? "";
}
/**
 * Clé dédiée aux jetons Google Drive (B3). À défaut, repli sur l'ancienne
 * dérivation depuis JWT_SECRET pour ne pas casser les connexions existantes.
 * Plus aucune clé codée en dur.
 */
function encryptionKey() {
  const key =
    parseKey(
      process.env.DRIVE_TOKEN_ENCRYPTION_KEY,
      "DRIVE_TOKEN_ENCRYPTION_KEY"
    ) ?? legacyKeyFromJwtSecret();
  if (!key)
    throw new Error(
      "Aucune clé de chiffrement des jetons Google Drive n’est configurée."
    );
  return key;
}
function requireConfig() {
  if (!clientId() || !clientSecret())
    throw new Error(
      "Google Drive n’est pas encore configuré. Ajoutez l’identifiant et le secret OAuth Google dans les secrets du projet."
    );
}

export function googleDriveConfigured() {
  return Boolean(clientId() && clientSecret());
}
export function encryptSecret(value: string) {
  return sealString(encryptionKey(), value);
}
export function decryptSecret(value: string) {
  try {
    return openString(encryptionKey(), value);
  } catch (error) {
    // Jetons chiffrés avant l'introduction de DRIVE_TOKEN_ENCRYPTION_KEY.
    const legacy = legacyKeyFromJwtSecret();
    if (legacy && process.env.DRIVE_TOKEN_ENCRYPTION_KEY)
      return openString(legacy, value);
    throw error instanceof Error && error.message === "Secret chiffré invalide."
      ? new Error("Jeton Google Drive invalide.")
      : error;
  }
}

export function buildGoogleDriveAuthorizationUrl(
  redirectUri: string,
  state: string
) {
  requireConfig();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleDriveCode(
  code: string,
  redirectUri: string
) {
  requireConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok)
    throw new Error(
      `Google Drive a refusé l’autorisation (${response.status}).`
    );
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

async function refreshGoogleDriveAccessToken(refreshToken: string) {
  requireConfig();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: "refresh_token",
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok)
    throw new Error(
      "La connexion Google Drive a expiré. Reconnectez le compte Google."
    );
  return (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
}

async function currentAccessToken(
  settings: typeof backupSettings.$inferSelect,
  companyId: number
) {
  const now = Date.now();
  if (
    settings.googleDriveAccessTokenEncrypted &&
    settings.googleDriveTokenExpiresAt &&
    settings.googleDriveTokenExpiresAt.getTime() > now + 60_000
  )
    return decryptSecret(settings.googleDriveAccessTokenEncrypted);
  if (!settings.googleDriveRefreshTokenEncrypted)
    throw new Error("Google Drive n’est pas connecté.");
  const refreshToken = decryptSecret(settings.googleDriveRefreshTokenEncrypted);
  const refreshed = await refreshGoogleDriveAccessToken(refreshToken);
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  await db
    .update(backupSettings)
    .set({
      googleDriveAccessTokenEncrypted: encryptSecret(refreshed.access_token),
      googleDriveTokenExpiresAt: new Date(
        Date.now() + refreshed.expires_in * 1000
      ),
    })
    .where(
      and(
        eq(backupSettings.id, settings.id),
        companyScope(backupSettings.companyId, companyId)
      )
    );
  return refreshed.access_token;
}

async function multipartUpload(
  accessToken: string,
  metadata: Record<string, unknown>,
  content: Buffer,
  mimeType: string
) {
  const boundary = `stockpilot-${randomBytes(8).toString("hex")}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    content,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const response = await fetch(DRIVE_FILES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!response.ok)
    throw new Error(`Échec de la copie Google Drive (${response.status}).`);
  return (await response.json()) as { id: string; webViewLink?: string };
}

async function createDriveFolder(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "StockPilot Backups",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!response.ok)
    throw new Error(
      `Impossible de créer le dossier Google Drive (${response.status}).`
    );
  return (await response.json()) as { id: string };
}

export async function syncArchiveToGoogleDrive(
  archiveId: number,
  companyId: number | null = null
) {
  const scopedCompanyId =
    typeof companyId === "number" ? companyId : Number.NaN;
  if (!Number.isInteger(scopedCompanyId) || scopedCompanyId <= 0)
    throw new Error("La synchronisation Drive exige une entreprise explicite.");
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  const settings = (
    await db
      .select()
      .from(backupSettings)
      .where(companyScope(backupSettings.companyId, scopedCompanyId))
      .limit(1)
  )[0];
  const archive = (
    await db
      .select()
      .from(backupArchives)
      .where(
        and(
          eq(backupArchives.id, archiveId),
          companyScope(backupArchives.companyId, scopedCompanyId)
        )
      )
      .limit(1)
  )[0];
  if (
    !settings ||
    !archive?.storageKey ||
    !settings.googleDriveRefreshTokenEncrypted
  )
    return null;
  const accessToken = await currentAccessToken(settings, scopedCompanyId);
  let folderId = settings.googleDriveFolderId;
  if (!folderId) {
    folderId = (await createDriveFolder(accessToken)).id;
    await db
      .update(backupSettings)
      .set({ googleDriveFolderId: folderId })
      .where(
        and(
          eq(backupSettings.id, settings.id),
          companyScope(backupSettings.companyId, scopedCompanyId)
        )
      );
  }
  const signedUrl = await storageGetSignedUrl(archive.storageKey);
  const source = await fetch(signedUrl);
  if (!source.ok)
    throw new Error(
      "Impossible de lire l’archive locale avant la copie Drive."
    );
  const content = Buffer.from(await source.arrayBuffer());
  const uploaded = await multipartUpload(
    accessToken,
    {
      name: archive.filename,
      parents: [folderId],
      mimeType: "application/json",
    },
    content,
    "application/json"
  );
  await db
    .update(backupArchives)
    .set({
      googleDriveFileId: uploaded.id,
      googleDriveUrl:
        uploaded.webViewLink ??
        `https://drive.google.com/open?id=${uploaded.id}`,
    })
    .where(
      and(
        eq(backupArchives.id, archive.id),
        companyScope(backupArchives.companyId, scopedCompanyId)
      )
    );
  return uploaded;
}
