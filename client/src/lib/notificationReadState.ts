const storagePrefix = "stockpilot_read_notifications";

function storageKey(companyId: number, userId: number) {
  return `${storagePrefix}:company:${companyId}:user:${userId}`;
}

function validScope(companyId: number | undefined, userId: number | undefined): companyId is number {
  return Number.isInteger(companyId) && Number(companyId) > 0 && Number.isInteger(userId) && Number(userId) > 0;
}

export function readNotificationIds(companyId: number | undefined, userId: number | undefined, storage: Storage | undefined = typeof window === "undefined" ? undefined : localStorage) {
  if (!validScope(companyId, userId) || !storage) return [] as string[];
  try {
    const value = JSON.parse(storage.getItem(storageKey(companyId, userId as number)) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeNotificationIds(companyId: number | undefined, userId: number | undefined, ids: string[], storage: Storage | undefined = typeof window === "undefined" ? undefined : localStorage) {
  if (!validScope(companyId, userId) || !storage) return;
  storage.setItem(storageKey(companyId, userId as number), JSON.stringify(Array.from(new Set(ids))));
}

export function unreadNotificationCount(notificationIds: string[], readIds: string[]) {
  const read = new Set(readIds);
  return notificationIds.filter(id => !read.has(id)).length;
}
