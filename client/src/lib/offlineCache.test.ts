import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOfflineQueryCache, offlineQueryCacheKey, persistOfflineQueryCache, restoreOfflineQueryCache } from "./offlineCache";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), read: (key: string) => values.get(key) ?? null };
}

describe("cache hors connexion", () => {
  const storage = memoryStorage();
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("window", { localStorage: storage, setTimeout }); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); clearOfflineQueryCache(); });

  it("enregistre et restaure les données déjà synchronisées", () => {
    const source = new QueryClient();
    persistOfflineQueryCache(source);
    source.setQueryData(["products"], [{ id: 1, name: "Article disponible" }]);
    vi.runAllTimers();
    expect(storage.read(offlineQueryCacheKey)).toContain("Article disponible");
    const target = new QueryClient();
    restoreOfflineQueryCache(target);
    expect(target.getQueryData(["products"])).toEqual([{ id: 1, name: "Article disponible" }]);
  });

  it("écarte un cache local corrompu sans bloquer l’application", () => {
    storage.setItem(offlineQueryCacheKey, "{");
    const client = new QueryClient();
    expect(() => restoreOfflineQueryCache(client)).not.toThrow();
    expect(storage.read(offlineQueryCacheKey)).toBeNull();
  });
});
