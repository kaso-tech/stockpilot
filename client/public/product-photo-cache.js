/* Cache photo privé et local : un namespace par entreprise/utilisateur/entrepôt. */
(() => {
  const prefix = "stockpilot-product-photos-v1-";
  const scopes = new Map();
  const imagePath = /^\/manus-storage\/company\/(\d+)\/products\/\d+\/(image|thumb)_[a-f0-9]{8}\.(webp|jpg|png)$/;
  const validId = value => Number.isSafeInteger(value) && value > 0;
  self.addEventListener("message", event => {
    if (event.data?.type !== "STOCKPILOT_PHOTO_SCOPE" || !event.source?.id) return;
    const value = event.data.scope;
    if (!value) {
      scopes.delete(event.source.id);
      event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(prefix)).map(key => caches.delete(key)))));
      return;
    }
    if (!validId(value.companyId) || !validId(value.userId) || !validId(value.warehouseId)) return;
    scopes.set(event.source.id, { companyId: value.companyId, cacheName: `${prefix}${value.companyId}-${value.userId}-${value.warehouseId}` });
  });
  self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    const match = imagePath.exec(url.pathname);
    if (!match) return;
    event.respondWith((async () => {
      const scope = scopes.get(event.clientId);
      if (!scope || String(scope.companyId) !== match[1]) return fetch(event.request);
      const cache = await caches.open(scope.cacheName);
      try {
        // Le serveur revalide session, entreprise et rattachement de la photo au produit.
        const response = await fetch(event.request);
        if (response.ok && /^image\/(webp|jpeg|png)(;|$)/i.test(response.headers.get("Content-Type") || "")) {
          try {
            await cache.put(event.request, response.clone());
            const keys = await cache.keys();
            while (keys.length > 400) await cache.delete(keys.shift());
          } catch { /* Quota navigateur : ne pas faire échouer la lecture réseau. */ }
        } else if ([401, 403, 404].includes(response.status)) {
          await cache.delete(event.request);
        }
        return response;
      } catch (error) {
        const saved = await cache.match(event.request);
        if (saved) return saved;
        throw error;
      }
    })());
  });
})();
