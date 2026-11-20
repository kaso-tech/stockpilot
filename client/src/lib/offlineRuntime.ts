import { QueryClient, type DefaultOptions } from "@tanstack/react-query";

/**
 * Règles globales pour une application offline-first : les données locales restent
 * visibles et un changement de focus ne déclenche pas de trafic ni de remount.
 */
export const offlineFirstQueryDefaults = {
  staleTime: 60_000,
  gcTime: 1000 * 60 * 60 * 24,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false,
  refetchIntervalInBackground: false,
  networkMode: "offlineFirst",
} satisfies NonNullable<DefaultOptions["queries"]>;

export const PWA_UPDATE_EVENT = "stockpilot-pwa-update";
export type PwaUpdateActivation = () => void | Promise<void>;

export function createOfflineFirstQueryClient() {
  return new QueryClient({ defaultOptions: { queries: offlineFirstQueryDefaults } });
}

/** En développement, le service worker reste désactivé sauf demande explicite. */
export function shouldRegisterServiceWorker(isProduction: boolean, isDevelopmentPwaEnabled: boolean) {
  return isProduction || isDevelopmentPwaEnabled;
}

/** Seul un vrai changement entreprise-utilisateur-entrepôt autorise une purge mémoire. */
export function shouldClearOfflineQueryMemory(previousScopeKey: string | null, nextScopeKey: string | null) {
  return previousScopeKey !== null && previousScopeKey !== nextScopeKey;
}

/** Une mise à jour doit toujours être validée par l'utilisateur actif. */
export function announcePwaUpdateAvailable(activate: PwaUpdateActivation) {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") return;
  window.dispatchEvent(new CustomEvent<PwaUpdateActivation>(PWA_UPDATE_EVENT, { detail: activate }));
}
