// Disponibilité réelle du serveur. L'indicateur réseau du navigateur (navigator.onLine)
// peut rester « en ligne » alors que le serveur ne répond pas (3G faible, réseau saturé,
// portail captif) : chaque requête qui échoue sans réponse bascule l'application hors
// connexion, et une sonde vérifie régulièrement le retour du serveur.

export const SERVER_REACHABILITY_EVENT = "stockpilot-server-reachability";
let reachable = true;

export function isServerReachable() { return reachable; }

export function markServerReachable(value: boolean) {
  if (value === reachable) return;
  reachable = value;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<boolean>(SERVER_REACHABILITY_EVENT, { detail: value }));
}

/** Toute réponse HTTP (même un refus) prouve que le serveur est joignable. */
export async function probeServer(timeoutMs = 6000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`/api/trpc/auth.me?probe=${Date.now()}`, { cache: "no-store", credentials: "include", signal: controller.signal });
    markServerReachable(true);
    return true;
  } catch {
    markServerReachable(false);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Délai maximal d'une requête : au-delà, le serveur est considéré comme injoignable. */
export const REQUEST_TIMEOUT_MS = 25_000;

/** fetch des requêtes de l'application : suit la disponibilité du serveur et coupe les requêtes bloquées. */
export async function trackedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  const signals = [init?.signal, timeout.signal].filter(Boolean) as AbortSignal[];
  const signal = signals.length > 1 && typeof (AbortSignal as any).any === "function" ? (AbortSignal as any).any(signals) : timeout.signal;
  try {
    const response = await fetch(input, { ...(init ?? {}), credentials: "include", signal });
    markServerReachable(true);
    return response;
  } catch (error) {
    // Une annulation demandée par l'application n'est pas une panne réseau.
    if (!(init?.signal?.aborted)) markServerReachable(false);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
