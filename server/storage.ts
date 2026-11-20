// Preconfigured storage helpers for Manus WebDev templates
// Uploads via Forge Server presigned URL to S3 (PUT direct).
// Downloads return /manus-storage/{key} paths served via 307 redirect.

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

/** Indique si le pilote actif permet de supprimer réellement un objet. */
export function storageSupportsDelete(): boolean {
  return storageDriver() === "s3";
}

let s3Client: S3Client | null = null;

function s3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      ...(process.env.S3_ENDPOINT
        ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
        : {}),
      // Le SDK lit les identifiants depuis l'environnement ou le rôle de l'hôte.
    });
  }
  return s3Client;
}

function bucket(): string {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET n'est pas configuré.");
  return name;
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Stockage non configuré : définissez S3_BUCKET ou BUILT_IN_FORGE_API_URL et BUILT_IN_FORGE_API_KEY.",
    );
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "");
  if (!key || key.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Clé de stockage invalide.");
  }
  return key;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
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
      }),
    );
  } else {
    const { forgeUrl, forgeKey } = getForgeConfig();
    const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
    presignUrl.searchParams.set("path", key);
    const presignResp = await fetch(presignUrl, {
      headers: { Authorization: `Bearer ${forgeKey}` },
    });
    if (!presignResp.ok) {
      throw new Error(`Forge storage request failed (${presignResp.status}).`);
    }
    const { url: s3Url } = (await presignResp.json()) as { url?: string };
    if (!s3Url) throw new Error("Forge returned an empty storage URL.");
    const uploadResp = await fetch(s3Url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: new Blob([body as BlobPart], { type: contentType }),
    });
    if (!uploadResp.ok) {
      throw new Error(`Storage upload failed (${uploadResp.status}).`);
    }
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  if (storageDriver() === "s3") {
    return getSignedUrl(
      s3(),
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: 300 },
    );
  }
  const { forgeUrl, forgeKey } = getForgeConfig();
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!resp.ok) {
    throw new Error(`Forge storage request failed (${resp.status}).`);
  }
  const { url } = (await resp.json()) as { url?: string };
  if (!url) throw new Error("Forge returned an empty storage URL.");
  return url;
}

/** Lecture serveur des octets (ex. copie Google Drive). */
export async function storageRead(relKey: string): Promise<Buffer> {
  const response = await fetch(await storageGetSignedUrl(relKey));
  if (!response.ok) {
    throw new Error(`Lecture du fichier stocké impossible (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Forge ne fournit pas d'API de suppression : false conserve l'objet distant. */
export async function storageDelete(relKey: string): Promise<boolean> {
  if (!storageSupportsDelete()) return false;
  await s3().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: normalizeKey(relKey) }),
  );
  return true;
}
