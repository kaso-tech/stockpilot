/** Convert a small PDF to base64 without a data-URL prefix. */
export async function fileToBase64(file: Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const end = Math.min(index + 0x8000, bytes.length);
    for (let offset = index; offset < end; offset += 1) binary += String.fromCharCode(bytes[offset]!);
  }
  return btoa(binary);
}
