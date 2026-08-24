import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOfflineQueryCache, persistOfflineQueryCache, restoreOfflineQueryCache } from "./offlineCache";
import { offlineDatabase, type OfflineScope } from "./offlineStore";

const scope: OfflineScope = { companyId: 3, userId: 9 };
const waitForPersistence = () => new Promise(resolve => setTimeout(resolve, 450));

describe("cache hors connexion", () => {
  beforeEach(async () => {
    await offlineDatabase.delete();
    await offlineDatabase.open();
    vi.stubGlobal("window", { setTimeout: globalThis.setTimeout });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("enregistre et restaure les données déjà synchronisées dans le scope actif", async () => {
    const source = new QueryClient();
    persistOfflineQueryCache(source, scope);
    source.setQueryData(["products"], [{ id: 1, name: "Article disponible" }]);
    await waitForPersistence();
    const target = new QueryClient();
    await restoreOfflineQueryCache(target, scope);
    expect(target.getQueryData(["products"])).toEqual([{ id: 1, name: "Article disponible" }]);
    const other = new QueryClient();
    await restoreOfflineQueryCache(other, { companyId: 4, userId: 9 });
    expect(other.getQueryData(["products"])).toBeUndefined();
  });

  it("écarte un cache IndexedDB local corrompu sans bloquer l’application", async () => {
    await offlineDatabase.queryCaches.put({ scopeKey: "company:3:user:9", savedAt: Date.now(), dehydratedState: "{" });
    const client = new QueryClient();
    await expect(restoreOfflineQueryCache(client, scope)).resolves.toBeUndefined();
    expect(await offlineDatabase.queryCaches.get("company:3:user:9")).toBeUndefined();
    await clearOfflineQueryCache(scope);
  });
});
