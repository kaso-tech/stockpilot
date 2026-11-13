type RateLimitEntry = { count: number; resetAt: number };

const entries = new Map<string, RateLimitEntry>();
const MAX_ENTRIES = 10_000;

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): boolean {
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    if (entries.size >= MAX_ENTRIES) {
      entries.forEach((entry, entryKey) => {
        if (entry.resetAt <= now) entries.delete(entryKey);
      });
      // Saturation : on évince les entrées les plus anciennes plutôt que de
      // refuser tout le monde (sinon un attaquant bloque toutes les connexions).
      const overflow = entries.size - MAX_ENTRIES + 1;
      if (overflow > 0)
        Array.from(entries.keys())
          .slice(0, overflow)
          .forEach(entryKey => entries.delete(entryKey));
    }
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function resetRateLimit(key: string) {
  entries.delete(key);
}

export function clearRateLimitsForTests() {
  entries.clear();
}
