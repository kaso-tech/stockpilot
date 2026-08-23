const storagePrefix = "stockpilot_read_notifications";

function storageKey(userId: number) {
  return `${storagePrefix}:${userId}`;
}

export function readNotificationIds(userId: number | undefined, storage: Storage | undefined = typeof window === "undefined" ? undefined : localStorage) {
  if (!userId || !storage) return [] as string[];
  try {
    const value = JSON.parse(storage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeNotificationIds(userId: number | undefined, ids: string[], storage: Storage | undefined = typeof window === "undefined" ? undefined : localStorage) {
  if (!userId || !storage) return;
  storage.setItem(storageKey(userId), JSON.stringify(Array.from(new Set(ids))));
}

export function unreadNotificationCount(notificationIds: string[], readIds: string[]) {
  const read = new Set(readIds);
  return notificationIds.filter(id => !read.has(id)).length;
}
