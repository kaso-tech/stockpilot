import { TRPCError } from "@trpc/server";
import { storageDelete } from "./storage";

export const PRODUCT_IMAGE_MAX_BYTES = 600 * 1024;
export const PRODUCT_THUMB_MAX_BYTES = 120 * 1024;
export type ProductImageType = "image/webp" | "image/jpeg" | "image/png";
const IMAGE_KEY = /^company\/(\d+)\/products\/(\d+)\/(image|thumb)_([a-f0-9]{8})\.(webp|jpg|png)$/;

/** Reconnaît les trois formats raster par leurs signatures réelles. */
export function detectImageType(buffer: Uint8Array): ProductImageType | null {
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "image/webp";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => buffer[index] === byte)) return "image/png";
  return null;
}

/** Décode une data URL sans faire confiance au MIME annoncé. */
export function decodeProductImage(dataUrl: string, maxBytes: number, label: string): { buffer: Buffer; mimeType: ProductImageType; extension: string } {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: `${label} : format d’image non reconnu.` });
  const encoded = match[1];
  if (Math.floor((encoded.length * 3) / 4) > maxBytes + 2) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: `${label} : l’image dépasse ${Math.round(maxBytes / 1024)} Ko.` });
  const buffer = Buffer.from(encoded, "base64");
  const mimeType = detectImageType(buffer);
  if (!mimeType) throw new TRPCError({ code: "BAD_REQUEST", message: `${label} : seules les images WEBP, JPEG ou PNG sont acceptées.` });
  if (buffer.byteLength > maxBytes) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: `${label} : l’image dépasse ${Math.round(maxBytes / 1024)} Ko.` });
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  return { buffer, mimeType, extension };
}

/** Clé de base ; storagePut ajoute le suffixe aléatoire obligatoire de huit hexadécimaux. */
export function productImageKey(companyId: number, productId: number, variant: "image" | "thumb", extension: string) {
  if (!Number.isSafeInteger(companyId) || companyId <= 0 || !Number.isSafeInteger(productId) || productId <= 0 || !["webp", "jpg", "png"].includes(extension)) throw new Error("Clé de photo produit invalide.");
  return `company/${companyId}/products/${productId}/${variant}.${extension}`;
}

export function parseProductImageKey(key: string): { companyId: number; productId: number; variant: "image" | "thumb"; extension: "webp" | "jpg" | "png" } | null {
  const match = IMAGE_KEY.exec(key);
  if (!match) return null;
  const companyId = Number(match[1]);
  const productId = Number(match[2]);
  if (!Number.isSafeInteger(companyId) || companyId <= 0 || !Number.isSafeInteger(productId) || productId <= 0) return null;
  return { companyId, productId, variant: match[3] as "image" | "thumb", extension: match[5] as "webp" | "jpg" | "png" };
}

/** N’accepte qu’une URL proxy locale, exactement conforme au format d’image produit. */
export function storageKeyFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith("/manus-storage/")) return null;
  const key = url.slice("/manus-storage/".length);
  return parseProductImageKey(key) ? key : null;
}

/** Nettoyage best-effort après détachement DB : Forge peut ne pas offrir DeleteObject. */
export async function deleteProductImageFiles(urls: Array<string | null | undefined>): Promise<{ removed: number; retained: number }> {
  let removed = 0;
  let retained = 0;
  for (const url of new Set(urls)) {
    const key = storageKeyFromUrl(url);
    if (!key) continue;
    try {
      if (await storageDelete(key)) removed++;
      else retained++;
    } catch {
      retained++;
    }
  }
  return { removed, retained };
}
