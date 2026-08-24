type RateLimitEntry = { count: number; resetAt: number };

const entries = new Map<string, RateLimitEntry>();
const MAX_ENTRIES = 10_000;

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    if (entries.size >= MAX_ENTRIES) {
      entries.forEach((entry, entryKey) => {
        if (entry.resetAt <= now) entries.delete(entryKey);
      });
      if (entries.size >= MAX_ENTRIES) return false;
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
