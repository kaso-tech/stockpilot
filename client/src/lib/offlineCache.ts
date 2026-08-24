import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import { getOfflineQueryCache, replaceOfflineQueryCache, clearOfflineQueryCache as clearScopedQueryCache, type OfflineScope } from "./offlineStore";

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14;
type StoredCache = { savedAt: number; dehydratedState: ReturnType<typeof dehydrate> };

export async function restoreOfflineQueryCache(queryClient: QueryClient, scope: OfflineScope) {
  try {
    const cached = await getOfflineQueryCache(scope);
    if (!cached || Date.now() - cached.savedAt > CACHE_TTL_MS) return;
    if (!cached.dehydratedState || typeof cached.dehydratedState !== "object") {
      await clearScopedQueryCache(scope);
      return;
    }
    hydrate(queryClient, cached.dehydratedState as ReturnType<typeof dehydrate>);
  } catch {
    await clearScopedQueryCache(scope).catch(() => undefined);
  }
}

export function persistOfflineQueryCache(queryClient: QueryClient, scope: OfflineScope) {
  let pending = false;
  return queryClient.getQueryCache().subscribe(() => {
    if (pending) return;
    pending = true;
    window.setTimeout(() => {
      pending = false;
      try {
        const dehydratedState = dehydrate(queryClient, { shouldDehydrateQuery: query => query.state.status === "success" && query.state.data !== undefined });
        void replaceOfflineQueryCache(scope, dehydratedState).catch(() => undefined);
      } catch {
        // Le cache query reste un confort; l’application fonctionne sans lui.
      }
    }, 350);
  });
}

export function clearOfflineQueryCache(scope: OfflineScope) {
  return clearScopedQueryCache(scope);
}
