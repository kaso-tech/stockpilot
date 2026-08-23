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

type OfflineMigration = {
  key: string;
  scopeKey: string;
  name: string;
  completedAt: number;
};

const legacyQueueKey = "stockpilot_offline_sales_v1";
const legacySyncLogKey = "stockpilot_sync_log_v1";
const legacyMigrationName = "localStorage-to-indexeddb-v1";
const maxLogEntries = 150;

export function offlineScopeKey(scope: OfflineScope) {
  return `company:${scope.companyId ?? "legacy"}:user:${scope.userId}`;
}

class StockPilotOfflineDatabase extends Dexie {
  operations!: Table<OfflineOperation, string>;
  snapshots!: Table<OfflineSnapshot, string>;
  migrations!: Table<OfflineMigration, string>;

  constructor() {
    super("stockpilot-offline-v2");
    this.version(1).stores({
      operations: "id, scopeKey, createdAt, type",
      snapshots: "scopeKey, savedAt",
    });
    this.version(2).stores({
      operations: "id, scopeKey, createdAt, type",
      snapshots: "scopeKey, savedAt",
      migrations: "key, scopeKey, completedAt",
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

function parseLegacyArray(raw: string | null) {
  if (!raw) return [] as unknown[];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as unknown[];
  }
}

function belongsToScope(value: unknown, scope: OfflineScope) {
  if (!value || typeof value !== "object") return false;
  const record = value as { ownerUserId?: unknown; companyId?: unknown };
  if (record.ownerUserId !== scope.userId) return false;
  // Legacy entries predate companyId. The authenticated user is the only
  // trusted bridge that can migrate such entries into the active company.
  return record.companyId === undefined || record.companyId === scope.companyId;
}

function scopedRecord<T extends object>(value: T, scope: OfflineScope) {
  return { ...value, companyId: scope.companyId };
}

function migrationKey(scope: OfflineScope) {
  return `${legacyMigrationName}:${offlineScopeKey(scope)}`;
}

function getLegacyStorage(storage?: Pick<Storage, "getItem" | "removeItem">) {
  if (storage) return storage;
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) return undefined;
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Imports only records owned by the authenticated user into the active scope.
 * The legacy keys are removed after the IndexedDB transaction succeeds, so the
 * old global store cannot remain a runtime fallback or leak another scope.
 */
export async function migrateLegacyOfflineStorage(scope: OfflineScope, storage?: Pick<Storage, "getItem" | "removeItem">) {
  const legacyStorage = getLegacyStorage(storage);
  if (!legacyStorage) return false;

  const key = migrationKey(scope);
  const alreadyMigrated = await offlineDatabase.migrations.get(key);
  if (alreadyMigrated) {
    legacyStorage.removeItem(legacyQueueKey);
    legacyStorage.removeItem(legacySyncLogKey);
    return false;
  }

  const legacySales = parseLegacyArray(legacyStorage.getItem(legacyQueueKey)).filter(value => belongsToScope(value, scope));
  const legacyLog = parseLegacyArray(legacyStorage.getItem(legacySyncLogKey)).filter(value => belongsToScope(value, scope));

  await offlineDatabase.transaction("rw", offlineDatabase.operations, offlineDatabase.snapshots, offlineDatabase.migrations, async () => {
    const scopeKey = offlineScopeKey(scope);
    const existingOperations = await offlineDatabase.operations.where("scopeKey").equals(scopeKey).toArray();
    const existingIds = new Set(existingOperations.map(operation => operation.id));
    const operations = legacySales
      .filter((value): value is { id: string; kind?: string; createdAt: number; status?: string; error?: string } => {
        if (!value || typeof value !== "object") return false;
        const record = value as { id?: unknown; createdAt?: unknown };
        return typeof record.id === "string" && typeof record.createdAt === "number";
      })
      .filter(value => !existingIds.has(value.id))
      .map(value => {
        const payload = scopedRecord(value as object, scope);
        return {
          id: value.id,
          scopeKey,
          type: value.kind ?? "offline_sale",
          payload,
          createdAt: value.createdAt,
          attempts: value.status === "failed" ? 1 : 0,
          lastError: value.error,
        } satisfies OfflineOperation;
      });
    if (operations.length) await offlineDatabase.operations.bulkPut(operations);

    const snapshot = await offlineDatabase.snapshots.get(scopeKey);
    const currentPayload = snapshot?.payload as { syncLog?: unknown } | undefined;
    const currentLog = Array.isArray(currentPayload?.syncLog) ? currentPayload.syncLog : [];
    const logsByOperation = new Map<string, object>();
    for (const entry of currentLog) {
      if (entry && typeof entry === "object" && typeof (entry as { operationId?: unknown }).operationId === "string") {
        logsByOperation.set((entry as { operationId: string }).operationId, entry);
      }
    }
    for (const entry of legacyLog) {
      if (entry && typeof entry === "object" && typeof (entry as { operationId?: unknown }).operationId === "string") {
        const operationId = (entry as { operationId: string }).operationId;
        if (!logsByOperation.has(operationId)) logsByOperation.set(operationId, scopedRecord(entry, scope));
      }
    }
    await offlineDatabase.snapshots.put({
      scopeKey,
      savedAt: Date.now(),
      payload: { syncLog: Array.from(logsByOperation.values()).slice(-maxLogEntries) },
    });
    await offlineDatabase.migrations.put({ key, scopeKey, name: legacyMigrationName, completedAt: Date.now() });
  });

  // Legacy entries from another user/company cannot be proven safe and are
  // deliberately discarded rather than left in a global browser store.
  legacyStorage.removeItem(legacyQueueKey);
  legacyStorage.removeItem(legacySyncLogKey);
  return legacySales.length > 0 || legacyLog.length > 0;
}

export async function replaceOfflineSnapshot(scope: OfflineScope, payload: unknown) {
  await offlineDatabase.snapshots.put({ scopeKey: offlineScopeKey(scope), savedAt: Date.now(), payload });
}

export async function getOfflineSnapshot(scope: OfflineScope) {
  return offlineDatabase.snapshots.get(offlineScopeKey(scope));
}

export async function readOfflineScope(scope: OfflineScope) {
  const scopeKey = offlineScopeKey(scope);
  return offlineDatabase.transaction("r", offlineDatabase.operations, offlineDatabase.snapshots, async () => {
    const [operations, snapshot] = await Promise.all([
      offlineDatabase.operations.where("scopeKey").equals(scopeKey).sortBy("createdAt"),
      offlineDatabase.snapshots.get(scopeKey),
    ]);
    return { operations, snapshot };
  });
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

export async function replaceOfflineScope(scope: OfflineScope, operations: Array<Omit<OfflineOperation, "scopeKey">>, payload: unknown) {
  const scopeKey = offlineScopeKey(scope);
  await offlineDatabase.transaction("rw", offlineDatabase.operations, offlineDatabase.snapshots, async () => {
    await offlineDatabase.operations.where("scopeKey").equals(scopeKey).delete();
    if (operations.length) await offlineDatabase.operations.bulkPut(operations.map(operation => ({ ...operation, scopeKey })));
    await offlineDatabase.snapshots.put({ scopeKey, savedAt: Date.now(), payload });
  });
}

export async function clearOfflineScope(scope: OfflineScope) {
  const scopeKey = offlineScopeKey(scope);
  await offlineDatabase.transaction("rw", offlineDatabase.operations, offlineDatabase.snapshots, async () => {
    await offlineDatabase.operations.where("scopeKey").equals(scopeKey).delete();
    await offlineDatabase.snapshots.delete(scopeKey);
  });
}
