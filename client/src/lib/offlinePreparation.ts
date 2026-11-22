// Heure de la dernière préparation complète des données hors connexion, par compte et entrepôt.
import { offlineScopeKey, type OfflineScope } from "./offlineStore";

const prefix = "stockpilot-offline-prepared:";

export function markOfflineDataPrepared(scope: OfflineScope, now = Date.now()) {
  try { localStorage.setItem(prefix + offlineScopeKey(scope), String(now)); window.dispatchEvent(new Event("stockpilot-offline-prepared")); } catch { /* sans effet */ }
}

export function readOfflineDataPreparedAt(scope: OfflineScope): number | null {
  try { const value = Number(localStorage.getItem(prefix + offlineScopeKey(scope))); return Number.isFinite(value) && value > 0 ? value : null; } catch { return null; }
}
