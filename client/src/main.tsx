import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { requestPersistentOfflineStorage } from "./lib/offlineStore";
import { trackedFetch } from "./lib/serverReachability";
import { announcePwaUpdateAvailable, createOfflineFirstQueryClient, shouldRegisterServiceWorker } from "./lib/offlineRuntime";
import "./index.css";

const queryClient = createOfflineFirstQueryClient();
void requestPersistentOfflineStorage();

// Une mise à jour ne peut jamais interrompre une saisie en cours : elle est
// proposée dans l’interface puis appliquée uniquement sur action explicite.
if ("serviceWorker" in navigator && shouldRegisterServiceWorker(import.meta.env.PROD, import.meta.env.VITE_ENABLE_PWA_DEV === "true")) {
  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      announcePwaUpdateAvailable(() => updateSW(true));
    },
  });
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (isUnauthorized) {
    // DashboardLayout exposes the local sign-in screen, which now includes the
    // administrator fallback form. Redirecting here would make that option
    // unreachable whenever a session expires.
    console.info("[Auth] Session absente ou expirée ; affichage de l’écran de connexion.");
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Forward the internal session token when the browser blocks cookies
        // (Safari ITP / private browsing / WebView).
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      // Suit la disponibilité réelle du serveur (bascule hors connexion si aucune réponse).
      fetch: trackedFetch,
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
