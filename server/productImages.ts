// Photos de produits : contrôle du contenu réel, clés de stockage par entreprise et nettoyage.
import { TRPCError } from "@trpc/server";
import { storageDelete } from "./storage";

export const PRODUCT_IMAGE_MAX_BYTES = 600 * 1024;
export const PRODUCT_THUMB_MAX_BYTES = 120 * 1024;

export type ProductImageType = "image/webp" | "image/jpeg" | "image/png";

/** Reconnaît le format à partir des premiers octets, pas du type annoncé. */
export function detectImageType(buffer: Uint8Array): ProductImageType | null {
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  )
    return "image/webp";
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return "image/jpeg";
  if (
    buffer.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (byte, index) => buffer[index] === byte
    )
  )
    return "image/png";
  return null;
}

/** Décode une image envoyée en data URL et vérifie format et taille. */
export function decodeProductImage(
  dataUrl: string,
  maxBytes: number,
  label: string
): { buffer: Buffer; mimeType: ProductImageType; extension: string } {
  const match = dataUrl.match(/^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/);
  if (!match)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${label} : format d’image non reconnu.`,
    });
  const buffer = Buffer.from(match[1], "base64");
  const mimeType = detectImageType(buffer);
  if (!mimeType)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${label} : seules les images WEBP, JPEG ou PNG sont acceptées.`,
    });
  if (buffer.byteLength > maxBytes)
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: `${label} : l’image est trop lourde (${Math.round(maxBytes / 1024)} Ko au maximum).`,
    });
  const extension =
    mimeType === "image/jpeg"
      ? "jpg"
      : mimeType === "image/png"
        ? "png"
        : "webp";
  return { buffer, mimeType, extension };
}

export function productImageKey(
  companyId: number | null,
  productId: number,
  variant: "image" | "thumb",
  extension: string
) {
  return `company/${companyId ?? "legacy"}/products/${productId}/${variant}.${extension}`;
}

const STORAGE_PREFIX = "/manus-storage/";

/** Clé de stockage d'une URL d'image produit, si elle est bien sous /manus-storage. */
export function storageKeyFromUrl(url: string | null | undefined) {
  if (!url || !url.startsWith(STORAGE_PREFIX)) return null;
  const key = url.slice(STORAGE_PREFIX.length);
  return key && !key.includes("..") ? key : null;
}

/** Supprime les fichiers d'images d'un produit ; une erreur de stockage n'interrompt pas l'opération. */
export async function deleteProductImageFiles(
  urls: Array<string | null | undefined>
) {
  for (const url of urls) {
    const key = storageKeyFromUrl(url);
    if (key) await storageDelete(key).catch(() => false);
  }
}
