export type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export function readPreference<T extends string>(storage: PreferenceStorage | undefined, key: string, allowed: readonly T[], fallback: T): T {
  const value = storage?.getItem(key);
  return value && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

export function writePreference(storage: PreferenceStorage | undefined, key: string, value: string) {
  storage?.setItem(key, value);
}
