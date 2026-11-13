// Compression des photos de produits dans le navigateur, avant l'envoi :
// une photo de téléphone (3 à 6 Mo) devient une image d'environ 30 à 80 Ko.

export const PRODUCT_IMAGE_SIZE = 600;
export const PRODUCT_THUMB_SIZE = 320;
const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif|avif|gif)$/i;

export type CompressedProductImage = { image: string; thumbnail: string };

/** Dimensions cibles : le plus grand côté ramené à `max`, sans agrandir une petite image. */
export function fitWithin(width: number, height: number, max: number) {
  const ratio = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Taille en octets d'une data URL base64. */
export function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

async function loadImage(
  file: File
): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Repli sur <img> (anciens navigateurs, formats non pris en charge par createImageBitmap).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(
  source: CanvasImageSource & { width: number; height: number },
  max: number,
  maxBytes: number
) {
  const { width, height } = fitWithin(source.width, source.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Le navigateur ne peut pas traiter cette image.");
  // Fond blanc : une image PNG transparente reste lisible une fois convertie.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  for (const quality of [0.82, 0.72, 0.6, 0.5]) {
    let dataUrl = canvas.toDataURL("image/webp", quality);
    // Safari ancien : pas d'encodage WebP, on se replie sur JPEG.
    if (!dataUrl.startsWith("data:image/webp"))
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
  }
  throw new Error("L’image reste trop lourde après compression.");
}

/** Prépare la photo (600 px) et la miniature (320 px) d'un produit. */
export async function compressProductImage(
  file: File
): Promise<CompressedProductImage> {
  if (file.type && !ACCEPTED.test(file.type))
    throw new Error("Choisissez une photo (JPEG, PNG ou WEBP).");
  if (file.size > 25 * 1024 * 1024) throw new Error("La photo dépasse 25 Mo.");
  let source: CanvasImageSource & { width: number; height: number };
  try {
    source = await loadImage(file);
  } catch {
    throw new Error("Cette photo ne peut pas être lue par le navigateur.");
  }
  return {
    image: encode(source, PRODUCT_IMAGE_SIZE, 550 * 1024),
    thumbnail: encode(source, PRODUCT_THUMB_SIZE, 110 * 1024),
  };
}
