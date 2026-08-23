import Dexie, { type Table } from "dexie";

export type OfflineScope = {
  companyId: number | null | undefined;
  userId: number;
};

export type OfflineOperation = {
  id: string;
  scopeKey: string;
  type: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type OfflineSnapshot = {
  scopeKey: string;
  savedAt: number;
  payload: unknown;
};

export function offlineScopeKey(scope: OfflineScope) {
  return `company:${scope.companyId ?? "legacy"}:user:${scope.userId}`;
}

class StockPilotOfflineDatabase extends Dexie {
  operations!: Table<OfflineOperation, string>;
  snapshots!: Table<OfflineSnapshot, string>;

  constructor() {
    super("stockpilot-offline-v2");
    this.version(1).stores({
      operations: "id, scopeKey, createdAt, type",
      snapshots: "scopeKey, savedAt",
    });
  }
}

export const offlineDatabase = new StockPilotOfflineDatabase();

export async function requestPersistentOfflineStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function replaceOfflineSnapshot(scope: OfflineScope, payload: unknown) {
  await offlineDatabase.snapshots.put({ scopeKey: offlineScopeKey(scope), savedAt: Date.now(), payload });
}

export async function getOfflineSnapshot(scope: OfflineScope) {
  return offlineDatabase.snapshots.get(offlineScopeKey(scope));
}

export async function queueOfflineOperation(scope: OfflineScope, operation: Omit<OfflineOperation, "scopeKey" | "attempts">) {
  await offlineDatabase.operations.put({ ...operation, scopeKey: offlineScopeKey(scope), attempts: 0 });
}

export async function listOfflineOperations(scope: OfflineScope) {
  return offlineDatabase.operations.where("scopeKey").equals(offlineScopeKey(scope)).sortBy("createdAt");
}

export async function replaceOfflineOperations(scope: OfflineScope, operations: Array<Omit<OfflineOperation, "scopeKey">>) {
  const scopeKey = offlineScopeKey(scope);
  await offlineDatabase.transaction("rw", offlineDatabase.operations, async () => {
    await offlineDatabase.operations.where("scopeKey").equals(scopeKey).delete();
    if (operations.length) await offlineDatabase.operations.bulkPut(operations.map(operation => ({ ...operation, scopeKey })));
  });
}

export async function clearOfflineScope(scope: OfflineScope) {
  const scopeKey = offlineScopeKey(scope);
  await offlineDatabase.transaction("rw", offlineDatabase.operations, offlineDatabase.snapshots, async () => {
    await offlineDatabase.operations.where("scopeKey").equals(scopeKey).delete();
    await offlineDatabase.snapshots.delete(scopeKey);
  });
}
