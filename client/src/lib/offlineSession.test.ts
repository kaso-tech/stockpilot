import { beforeEach, describe, expect, it } from "vitest";
import { OFFLINE_SESSION_MAX_AGE_MS, clearOfflineSession, isNetworkFailure, readOfflineSession, saveOfflineSession } from "./offlineSession";

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  (globalThis as any).window = { localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) } };
});

describe("session gardée sur l'appareil", () => {
  const user = { id: 7, companyId: 3, role: "seller", name: "Awa" };
  it("est relue telle quelle pendant 14 jours", () => {
    saveOfflineSession(user, 1_000);
    expect(readOfflineSession(1_000 + OFFLINE_SESSION_MAX_AGE_MS - 1)).toMatchObject({ id: 7, companyId: 3, role: "seller" });
  });
  it("expire et s'efface au-delà de 14 jours", () => {
    saveOfflineSession(user, 1_000);
    expect(readOfflineSession(1_000 + OFFLINE_SESSION_MAX_AGE_MS + 1)).toBeNull();
    expect(memory.size).toBe(0);
  });
  it("ignore un contenu corrompu et s'efface à la déconnexion", () => {
    memory.set("stockpilot-offline-session", "{pas du json");
    expect(readOfflineSession()).toBeNull();
    saveOfflineSession(user);
    clearOfflineSession();
    expect(readOfflineSession()).toBeNull();
  });
});

describe("détection d'une absence de réponse du serveur", () => {
  it("reconnaît une coupure réseau", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure({ message: "Failed to fetch", data: undefined })).toBe(true);
  });
  it("ne confond pas un refus du serveur avec une coupure", () => {
    expect(isNetworkFailure({ message: "UNAUTHORIZED", data: { httpStatus: 401 } })).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});
