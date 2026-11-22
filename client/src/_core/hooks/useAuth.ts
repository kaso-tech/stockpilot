import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SERVER_REACHABILITY_EVENT, isServerReachable } from "@/lib/serverReachability";
import { clearProductPhotoCaches } from "@/lib/productPhotoCache";
import { clearOfflineSession, isNetworkFailure, readOfflineSession, saveOfflineSession } from "@/lib/offlineSession";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    // Serveur injoignable : chaque page affichée ne doit pas relancer la question
    // (sinon l'écran de chargement revient en boucle). Elle est reposée au retour du serveur.
    retryOnMount: false,
  });
  const [serverReachable, setServerReachable] = useState(() => isServerReachable());
  useEffect(() => {
    const onChange = (event: Event) => { const value = (event as CustomEvent<boolean>).detail; setServerReachable(value); if (value && !meQuery.data) void meQuery.refetch(); };
    window.addEventListener(SERVER_REACHABILITY_EVENT, onChange);
    return () => window.removeEventListener(SERVER_REACHABILITY_EVENT, onChange);
  }, [meQuery.data, meQuery.refetch]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") return;
      throw error;
    } finally {
      await clearProductPhotoCaches();
      clearOfflineSession();
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  // Session confirmée par le serveur : gardée pour ouvrir l'application sans réseau.
  // Session refusée : oubliée.
  useEffect(() => {
    if (meQuery.data) saveOfflineSession(meQuery.data as Parameters<typeof saveOfflineSession>[0]);
    else if (meQuery.isSuccess && meQuery.data === null) clearOfflineSession();
  }, [meQuery.data, meQuery.isSuccess]);
  useEffect(() => {
    if (meQuery.error instanceof TRPCClientError && meQuery.error.data?.code === "UNAUTHORIZED") clearOfflineSession();
  }, [meQuery.error]);
  // Décision stable : elle ne dépend pas de l'état d'une requête en cours, mais de la
  // dernière réponse (ou absence de réponse) du serveur.
  const serverUnreachable = !meQuery.data && (!serverReachable || meQuery.isPaused || isNetworkFailure(meQuery.error) || (typeof navigator !== "undefined" && !navigator.onLine && !meQuery.isSuccess));
  const offlineUser = serverUnreachable ? readOfflineSession() : null;

  const state = useMemo(() => {
    const user = (meQuery.data ?? (offlineUser as typeof meQuery.data | null)) ?? null;
    return {
      user,
      /** Vrai quand l'identité vient de la session conservée (serveur injoignable). */
      offlineSession: !meQuery.data && Boolean(offlineUser),
      loading: (meQuery.isLoading && !user) || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [meQuery.data, meQuery.error, meQuery.isLoading, offlineUser?.id, offlineUser?.offlineSavedAt, logoutMutation.error, logoutMutation.isPending]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || meQuery.isLoading || logoutMutation.isPending || state.user) return;
    if (typeof window === "undefined" || !redirectPath || window.location.pathname === redirectPath) return;
    window.location.assign(redirectPath);
  }, [redirectOnUnauthenticated, redirectPath, logoutMutation.isPending, meQuery.isLoading, state.user]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
