export async function clearProductPhotoCaches() {
  if (typeof caches !== "undefined") {
    try { const keys = await caches.keys(); await Promise.all(keys.filter(key => key.startsWith("stockpilot-product-photos-")).map(key => caches.delete(key))); } catch { /* Le refus de stockage ne bloque pas la déconnexion. */ }
  }
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) navigator.serviceWorker.controller?.postMessage({ type: "STOCKPILOT_PHOTO_SCOPE", scope: null });
}
