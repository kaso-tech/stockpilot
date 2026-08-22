import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

export const offlineQueryCacheKey = "stockpilot_offline_query_cache_v1";

type StoredCache = {
  savedAt: number;
  dehydratedState: ReturnType<typeof dehydrate>;
};

function storage() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function restoreOfflineQueryCache(queryClient: QueryClient) {
  try {
    const raw = storage()?.getItem(offlineQueryCacheKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as StoredCache;
    if (!parsed?.dehydratedState || Date.now() - parsed.savedAt > 1000 * 60 * 60 * 24 * 14) return;
    hydrate(queryClient, parsed.dehydratedState);
  } catch {
    storage()?.removeItem(offlineQueryCacheKey);
  }
}

export function persistOfflineQueryCache(queryClient: QueryClient) {
  let pending = false;
  return queryClient.getQueryCache().subscribe(() => {
    if (pending) return;
    pending = true;
    window.setTimeout(() => {
      pending = false;
      try {
        const dehydratedState = dehydrate(queryClient, { shouldDehydrateQuery: query => query.state.status === "success" && query.state.data !== undefined });
        storage()?.setItem(offlineQueryCacheKey, JSON.stringify({ savedAt: Date.now(), dehydratedState } satisfies StoredCache));
      } catch {
        // Le cache est un confort hors ligne : l'application reste fonctionnelle si le stockage local est saturé.
      }
    }, 350);
  });
}

export function clearOfflineQueryCache() {
  storage()?.removeItem(offlineQueryCacheKey);
}
