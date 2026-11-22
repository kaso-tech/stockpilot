// Session conservée sur l'appareil pour ouvrir l'application sans réseau.
// Elle ne contient aucun secret (pas de jeton) : seulement l'identité affichée et
// l'entreprise, qui servent à retrouver les données gardées pour ce compte.
// Elle n'est reprise que si le serveur est injoignable, jamais s'il refuse la session.

const KEY = "stockpilot-offline-session";
export const OFFLINE_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

export type OfflineSessionUser = { id: number; companyId: number | null; role: string; name?: string | null; email?: string | null; [key: string]: unknown };
type StoredSession = { savedAt: number; user: OfflineSessionUser };

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function saveOfflineSession(user: OfflineSessionUser, now = Date.now()) {
  try { storage()?.setItem(KEY, JSON.stringify({ savedAt: now, user } satisfies StoredSession)); } catch { /* Stockage plein ou bloqué : pas de mode hors connexion. */ }
}

export function readOfflineSession(now = Date.now()): (OfflineSessionUser & { offlineSavedAt: number }) | null {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    const user = parsed?.user;
    if (typeof parsed?.savedAt !== "number" || !user || !Number.isInteger(user.id) || typeof user.role !== "string") return null;
    if (now - parsed.savedAt > OFFLINE_SESSION_MAX_AGE_MS || parsed.savedAt > now + 60_000) { clearOfflineSession(); return null; }
    return { ...user, offlineSavedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function clearOfflineSession() {
  try { storage()?.removeItem(KEY); } catch { /* rien à effacer */ }
}

/** Vrai quand la requête n'a pas obtenu de réponse du serveur (réseau coupé, serveur injoignable). */
export function isNetworkFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { data?: { httpStatus?: number } | null; message?: string; cause?: unknown };
  if (candidate.data?.httpStatus) return false;
  const message = String(candidate.message ?? "");
  return /fetch|network|load failed|connexion|ECONNREFUSED|Failed to fetch/i.test(message) || candidate.cause instanceof TypeError;
}
