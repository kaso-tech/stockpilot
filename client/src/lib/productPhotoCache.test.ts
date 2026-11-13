import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../../public/product-photo-cache.js", import.meta.url), "utf8");
function worker() {
  const events: Record<string, (event: any) => void> = {};
  const store = new Map<string, Map<string, Response>>();
  const network = vi.fn(async () => new Response("photo", { headers: { "Content-Type": "image/webp" } }));
  const caches = {
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const cache = store.get(name)!;
      return {
        put: async (request: Request, response: Response) => { cache.set(request.url, response); },
        match: async (request: Request) => cache.get(request.url)?.clone(),
        keys: async () => [...cache.keys()].map(url => new Request(url)),
        delete: async (request: Request) => cache.delete(request.url),
      };
    },
  };
  vm.runInNewContext(source, { self: { location: { origin: "https://stockpilot.test" }, addEventListener: (name: string, listener: (event: any) => void) => { events[name] = listener; } }, caches, fetch: network, URL, Number, Map, Promise });
  const message = async (scope: unknown) => { let waiting: Promise<unknown> | undefined; events.message({ source: { id: "tab" }, data: { type: "STOCKPILOT_PHOTO_SCOPE", scope }, waitUntil: (value: Promise<unknown>) => { waiting = value; } }); await waiting; };
  const image = async (company = 1) => { let response: Promise<Response> | undefined; events.fetch({ clientId: "tab", request: new Request(`https://stockpilot.test/manus-storage/company/${company}/products/5/thumb_1234abcd.webp`), respondWith: (value: Promise<Response>) => { response = value; } }); if (!response) throw new Error("Photo non interceptée"); return response; };
  return { message, image, network, store };
}
describe("cache photo du service worker", () => {
  it("sauvegarde seulement la portée courante et relit la photo après une coupure réseau", async () => {
    const w = worker(); await w.message({ companyId: 1, userId: 2, warehouseId: 3 });
    expect(await (await w.image()).text()).toBe("photo");
    expect([...w.store.keys()]).toEqual(["stockpilot-product-photos-v1-1-2-3"]);
    w.network.mockRejectedValue(new Error("offline"));
    expect(await (await w.image()).text()).toBe("photo");
  });
  it("ne relit pas la photo d’un autre utilisateur, entrepôt ou entreprise depuis le cache précédent", async () => {
    const w = worker(); await w.message({ companyId: 1, userId: 2, warehouseId: 3 }); await w.image();
    w.network.mockRejectedValue(new Error("offline"));
    await w.message({ companyId: 1, userId: 4, warehouseId: 3 }); await expect(w.image()).rejects.toThrow("offline");
    await w.message({ companyId: 1, userId: 2, warehouseId: 9 }); await expect(w.image()).rejects.toThrow("offline");
    await w.message({ companyId: 8, userId: 2, warehouseId: 3 }); await expect(w.image(1)).rejects.toThrow("offline");
  });
  it("supprime une photo locale si le serveur révoque son accès", async () => {
    const w = worker(); await w.message({ companyId: 1, userId: 2, warehouseId: 3 }); await w.image();
    w.network.mockResolvedValue(new Response("denied", { status: 403 })); expect((await w.image()).status).toBe(403);
    w.network.mockRejectedValue(new Error("offline")); await expect(w.image()).rejects.toThrow("offline");
  });
  it("purge les photos à la déconnexion sans toucher aux autres caches", async () => {
    const w = worker(); await w.message({ companyId: 1, userId: 2, warehouseId: 3 }); await w.image();
    w.store.set("workbox-precache", new Map()); await w.message(null);
    expect([...w.store.keys()]).toEqual(["workbox-precache"]);
  });
});
