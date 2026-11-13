// Stockage des fichiers (logos, justificatifs, archives de sauvegarde).
// Deux pilotes : S3 ou compatible (MinIO, R2, Scaleway…) si S3_BUCKET est défini,
// sinon le stockage de la plateforme Manus (Forge). Les fichiers sont toujours
// exposés sous /manus-storage/{clé} : le proxy vérifie les droits puis redirige
// vers une URL signée de courte durée.

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

export type StorageDriverName = "s3" | "forge";

export function storageDriver(): StorageDriverName {
  return process.env.S3_BUCKET ? "s3" : "forge";
}

/** Indique si le pilote actif sait supprimer définitivement un fichier. */
export function storageSupportsDelete() {
  return storageDriver() === "s3";
}

let s3Client: S3Client | null = null;
function s3() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      ...(process.env.S3_ENDPOINT
        ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
        : {}),
      // Identifiants lus par le SDK (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
      // ou rôle de l'hôte) : jamais dans le code.
    });
  }
  return s3Client;
}

function bucket() {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET n'est pas configuré.");
  return name;
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Stockage non configuré : définissez S3_BUCKET ou BUILT_IN_FORGE_API_URL et BUILT_IN_FORGE_API_KEY."
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

async function forgePresign(kind: "get" | "put", key: string) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL(`v1/storage/presign/${kind}`, forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const response = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage presign failed (${response.status}): ${message}`);
  }
  const { url } = (await response.json()) as { url: string };
  if (!url) throw new Error("Forge returned empty presign URL");
  return url;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : data;
  if (storageDriver() === "s3") {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  } else {
    const uploadUrl = await forgePresign("put", key);
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: new Blob([body as any], { type: contentType }),
    });
    if (!response.ok)
      throw new Error(`Storage upload failed (${response.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  if (storageDriver() === "s3") {
    return getSignedUrl(
      s3(),
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: 300 }
    );
  }
  return forgePresign("get", key);
}

/** Lit le contenu d'un fichier stocké (copie Google Drive, export RGPD…). */
export async function storageRead(relKey: string): Promise<Buffer> {
  const response = await fetch(await storageGetSignedUrl(relKey));
  if (!response.ok)
    throw new Error(
      `Lecture du fichier stocké impossible (${response.status}).`
    );
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Supprime définitivement un fichier. Renvoie false si le pilote ne le permet
 * pas (stockage Manus) : l'appelant conserve alors l'information.
 */
export async function storageDelete(relKey: string): Promise<boolean> {
  if (!storageSupportsDelete()) return false;
  await s3().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: normalizeKey(relKey) })
  );
  return true;
}
