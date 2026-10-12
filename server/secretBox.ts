import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Chiffrement symétrique AES-256-GCM. Format : base64(iv).base64(tag).base64(données).
 * Les clés sont fournies en hexadécimal (64 caractères) ou base64 (32 octets).
 */
export function parseKey(raw: string | undefined, name: string): Buffer | null {
  if (!raw) return null;
  const value = raw.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error(`${name} doit contenir 32 octets (64 caractères hexadécimaux ou base64).`);
  return key;
}

/** Ancienne dérivation (clé tirée de JWT_SECRET), conservée uniquement pour relire les secrets existants. */
export function legacyKeyFromJwtSecret(): Buffer | null {
  const secret = process.env.JWT_SECRET;
  return secret ? createHash("sha256").update(secret).digest() : null;
}

export function sealBuffer(key: Buffer, plain: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") };
}

export function openBuffer(key: Buffer, sealed: { iv: string; tag: string; data: string }) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.data, "base64")), decipher.final()]);
}

export function sealString(key: Buffer, value: string) {
  const sealed = sealBuffer(key, Buffer.from(value, "utf8"));
  return [sealed.iv, sealed.tag, sealed.data].join(".");
}

export function openString(key: Buffer, value: string) {
  const [iv, tag, data] = value.split(".");
  if (!iv || !tag || !data) throw new Error("Secret chiffré invalide.");
  return openBuffer(key, { iv, tag, data }).toString("utf8");
}
