/** Encode un fichier en base64 (sans préfixe data:) pour l'envoi au serveur. */
export async function fileToBase64(file: Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(index, index + 0x8000))
    );
  return btoa(binary);
}
