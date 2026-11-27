/** Règles du circuit vendeur → caisse (tickets de caisse non soldés). */

/** Un verrou d’encaissement expire au bout de 2 minutes (caissier parti, onglet fermé). */
export const CHECKOUT_LOCK_TTL_MS = 2 * 60 * 1000;

/** Vrai si le ticket est verrouillé par QUELQU’UN D’AUTRE et que le verrou n’a pas expiré. */
export function lockedByOther(lockedBy: number | null | undefined, lockedAt: Date | null | undefined, userId: number, now = new Date()) {
  if (!lockedBy || !lockedAt || lockedBy === userId) return false;
  return now.getTime() - lockedAt.getTime() < CHECKOUT_LOCK_TTL_MS;
}

/** Numéro court du jour : on garde celui du ticket s’il a déjà été numéroté aujourd’hui, sinon le suivant. */
export function queueNumberFor(previous: { queueNumber: number | null; queueDay: string | null } | null | undefined, today: string, currentMax: number | null | undefined) {
  if (previous?.queueNumber && previous.queueDay === today) return previous.queueNumber;
  return (currentMax ?? 0) + 1;
}

/** Affichage du numéro : 001, 012, 123. */
export function formatQueueNumber(value: number | null | undefined) {
  return value ? String(value).padStart(3, "0") : "—";
}
