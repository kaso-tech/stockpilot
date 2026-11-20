// Compression navigateur avant l'envoi des photos de produit.
export const PRODUCT_IMAGE_SIZE = 600;
export const PRODUCT_THUMB_SIZE = 320;
const ACCEPTED = /^image\/(jpeg|png|webp)$/i;
export type CompressedProductImage = { image: string; thumbnail: string };

/** Ajuste le plus grand côté sans agrandir l'image. */
export function fitWithin(width: number, height: number, max: number) {
  if (![width, height, max].every(Number.isFinite) || width <= 0 || height <= 0 || max <= 0) throw new Error("Dimensions d’image invalides.");
  const ratio = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export function dataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* fallback */ }
  }
  const url = URL.createObjectURL(file);
  try { const image = new Image(); image.decoding = "async"; image.src = url; await image.decode(); return image; }
  finally { URL.revokeObjectURL(url); }
}

function encode(source: CanvasImageSource & { width: number; height: number }, max: number, maxBytes: number) {
  const { width, height } = fitWithin(source.width, source.height, max);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le navigateur ne peut pas traiter cette image.");
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, width, height); context.imageSmoothingQuality = "high"; context.drawImage(source, 0, 0, width, height);
  for (const quality of [0.82, 0.72, 0.6, 0.5]) {
    let dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
  }
  throw new Error("L’image reste trop lourde après compression.");
}

export async function compressProductImage(file: File): Promise<CompressedProductImage> {
  if (!ACCEPTED.test(file.type)) throw new Error("Choisissez une photo JPEG, PNG ou WEBP.");
  if (file.size > 25 * 1024 * 1024) throw new Error("La photo dépasse 25 Mo.");
  let source: CanvasImageSource & { width: number; height: number };
  try { source = await loadImage(file); }
  catch { throw new Error("Cette photo ne peut pas être lue par le navigateur."); }
  return { image: encode(source, PRODUCT_IMAGE_SIZE, 600 * 1024), thumbnail: encode(source, PRODUCT_THUMB_SIZE, 120 * 1024) };
}
