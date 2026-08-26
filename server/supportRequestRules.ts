const IMAGE_SIGNATURES = {
  "image/png": (buffer: Buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (buffer: Buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  "image/webp": (buffer: Buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP",
} as const;

export type SupportImageMimeType = keyof typeof IMAGE_SIGNATURES;

export function isSupportImageMimeType(value: string): value is SupportImageMimeType {
  return value in IMAGE_SIGNATURES;
}

export function hasValidSupportImageSignature(mimeType: SupportImageMimeType, buffer: Buffer): boolean {
  return IMAGE_SIGNATURES[mimeType](buffer);
}

export function normalizeSupportFilename(filename: string): string {
  const cleaned = filename.trim().replace(/[\\/\u0000]/g, "_").replace(/\s+/g, " ");
  return cleaned.slice(0, 180) || "capture";
}
