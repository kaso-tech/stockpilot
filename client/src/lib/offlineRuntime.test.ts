import { describe, expect, it } from "vitest";
import { createOfflineFirstQueryClient, offlineFirstQueryDefaults, shouldClearOfflineQueryMemory, shouldRegisterServiceWorker } from "./offlineRuntime";

describe("politique runtime offline-first", () => {
  it("désactive les revalidations automatiques susceptibles de perturber une session hors connexion", () => {
    const queryClient = createOfflineFirstQueryClient();
    const defaults = queryClient.getDefaultOptions().queries;

    expect(defaults).toMatchObject({
      staleTime: 60_000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      networkMode: "offlineFirst",
    });
    expect(offlineFirstQueryDefaults.gcTime).toBeGreaterThanOrEqual(1000 * 60 * 60);
  });

  it("n’enregistre pas le service worker dans la prévisualisation de développement par défaut", () => {
    expect(shouldRegisterServiceWorker(false, false)).toBe(false);
    expect(shouldRegisterServiceWorker(false, true)).toBe(true);
    expect(shouldRegisterServiceWorker(true, false)).toBe(true);
  });

  it("ne purge le cache local que lorsqu’entreprise, utilisateur ou entrepôt change réellement", () => {
    const activeScope = "company:1:user:4:warehouse:9";
    expect(shouldClearOfflineQueryMemory(null, activeScope)).toBe(false);
    expect(shouldClearOfflineQueryMemory(activeScope, activeScope)).toBe(false);
    expect(shouldClearOfflineQueryMemory(activeScope, "company:1:user:4:warehouse:10")).toBe(true);
    expect(shouldClearOfflineQueryMemory(activeScope, null)).toBe(true);
  });
});
