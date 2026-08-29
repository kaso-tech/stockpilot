import Dexie, { type Table } from "dexie";

export type OfflineUserScope = {
  companyId: number;
  userId: number;
};

export type OfflineScope = OfflineUserScope & {
  warehouseId: number;
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

export type OfflinePreference = {
  scopeKey: string;
  savedAt: number;
  payload: unknown;
};

export type OfflineQueryCache = {
  scopeKey: string;
  savedAt: number;
  dehydratedState: unknown;
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

export function offlineUserScopeKey(scope: OfflineUserScope) {
  if (!Number.isInteger(scope.companyId) || Number(scope.companyId) <= 0 || !Number.isInteger(scope.userId) || scope.userId <= 0) throw new Error("Un périmètre offline entreprise/utilisateur valide est requis.");
  return `company:${scope.companyId}:user:${scope.userId}`;
}

export function offlineScopeKey(scope: OfflineScope) {
  if (!Number.isInteger(scope.warehouseId) || scope.warehouseId <= 0) throw new Error("Un entrepôt actif est requis pour les opérations hors connexion.");
  return `${offlineUserScopeKey(scope)}:warehouse:${scope.warehouseId}`;
}

export function belongsToOfflineScope(value: { ownerUserId?: unknown; companyId?: unknown; warehouseId?: unknown }, scope: OfflineScope) {
  return value.ownerUserId === scope.userId && value.companyId === scope.companyId && value.warehouseId === scope.warehouseId;
}

class StockPilotOfflineDatabase extends Dexie {
  operations!: Table<OfflineOperation, string>;
  snapshots!: Table<OfflineSnapshot, string>;
  preferences!: Table<OfflinePreference, string>;
  queryCaches!: Table<OfflineQueryCache, string>;
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
    this.version(3).stores({
      operations: "id, scopeKey, createdAt, type",
      snapshots: "scopeKey, savedAt",
      preferences: "scopeKey, savedAt",
      queryCaches: "scopeKey, savedAt",
      migrations: "key, scopeKey, completedAt",
    });
    this.version(4).stores({
      operations: "id, scopeKey, createdAt, type",
      snapshots: "scopeKey, savedAt",
      preferences: "scopeKey, savedAt",
      queryCaches: "scopeKey, savedAt",
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

function belongsToScope(value: unknown, scope: OfflineUserScope) {
  if (!value || typeof value !== "object") return false;
  const record = value as { ownerUserId?: unknown; companyId?: unknown };
  if (record.ownerUserId !== scope.userId) return false;
  // Legacy entries predate companyId. The authenticated user is the only
  // trusted bridge that can migrate such entries into the active company.
  return record.companyId === undefined || record.companyId === scope.companyId;
}

function migrationKey(scope: OfflineUserScope) {
  return `${legacyMigrationName}:${offlineUserScopeKey(scope)}`;
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
 * Imports only records owned by the authenticated user into their known warehouse scopes.
 * The legacy keys are removed after the IndexedDB transaction succeeds, so the
 * old global store cannot remain a runtime fallback or leak another scope.
 */
export async function migrateLegacyOfflineStorage(scope: OfflineScope, storage?: Pick<Storage, "getItem" | "removeItem">) {
  const legacyStorage = getLegacyStorage(storage);
  if (!legacyStorage) return false;

  const userScope: OfflineUserScope = { companyId: scope.companyId, userId: scope.userId };
  const key = migrationKey(userScope);
  const alreadyMigrated = await offlineDatabase.migrations.get(key);
  if (alreadyMigrated) {
    legacyStorage.removeItem(legacyQueueKey);
    legacyStorage.removeItem(legacySyncLogKey);
    return false;
  }

  const legacySales = parseLegacyArray(legacyStorage.getItem(legacyQueueKey)).filter(value => belongsToScope(value, userScope));
  const legacyLog = parseLegacyArray(legacyStorage.getItem(legacySyncLogKey)).filter(value => belongsToScope(value, userScope));
  type LegacySale = { id: string; kind?: string; createdAt: number; status?: string; error?: string; draft?: { warehouseId?: unknown } };
  const validSales: LegacySale[] = legacySales.filter((value): value is LegacySale => {
    if (!value || typeof value !== "object") return false;
    const record = value as { id?: unknown; createdAt?: unknown };
    return typeof record.id === "string" && typeof record.createdAt === "number";
  });
  const salesByWarehouse = new Map<number, LegacySale[]>();
  for (const sale of validSales) {
    // The former format had no warehouse dimension. Its explicit migration is
    // limited to the currently selected warehouse rather than using a global fallback.
    const warehouseId = typeof sale.draft?.warehouseId === "number" && Number.isInteger(sale.draft.warehouseId) && sale.draft.warehouseId > 0 ? sale.draft.warehouseId : scope.warehouseId;
    const group = salesByWarehouse.get(warehouseId) ?? [];
    group.push(sale);
    salesByWarehouse.set(warehouseId, group);
  }

  await offlineDatabase.transaction("rw", offlineDatabase.operations, offlineDatabase.snapshots, offlineDatabase.migrations, async () => {
    for (const [warehouseId, warehouseSales] of Array.from(salesByWarehouse.entries())) {
      const warehouseScope: OfflineScope = { ...userScope, warehouseId };
      const scopeKey = offlineScopeKey(warehouseScope);
      const existingOperations = await offlineDatabase.operations.where("scopeKey").equals(scopeKey).toArray();
      const existingIds = new Set(existingOperations.map(operation => operation.id));
      const operations = warehouseSales.filter(value => !existingIds.has(value.id)).map(value => ({
        id: value.id,
        scopeKey,
        type: value.kind ?? "offline_sale",
        payload: { ...value, companyId: scope.companyId, warehouseId, draft: { ...value.draft, warehouseId } },
        createdAt: value.createdAt,
        attempts: value.status === "failed" ? 1 : 0,
        lastError: value.error,
      } satisfies OfflineOperation));
      if (operations.length) await offlineDatabase.operations.bulkPut(operations);

      const snapshot = await offlineDatabase.snapshots.get(scopeKey);
      const currentPayload = snapshot?.payload as { syncLog?: unknown } | undefined;
      const currentLog = Array.isArray(currentPayload?.syncLog) ? currentPayload.syncLog : [];
      const logsByOperation = new Map<string, object>();
      for (const entry of currentLog) {
        if (entry && typeof entry === "object" && typeof (entry as { operationId?: unknown }).operationId === "string") logsByOperation.set((entry as { operationId: string }).operationId, entry);
      }
      const permittedOperations = new Set(warehouseSales.map(sale => sale.id));
      for (const entry of legacyLog) {
        if (entry && typeof entry === "object" && typeof (entry as { operationId?: unknown }).operationId === "string") {
          const operationId = (entry as { operationId: string }).operationId;
          if (permittedOperations.has(operationId) && !logsByOperation.has(operationId)) logsByOperation.set(operationId, { ...entry, companyId: scope.companyId, warehouseId });
        }
      }
      await offlineDatabase.snapshots.put({ scopeKey, savedAt: Date.now(), payload: { syncLog: Array.from(logsByOperation.values()).slice(-maxLogEntries) } });
    }
    await offlineDatabase.migrations.put({ key, scopeKey: offlineUserScopeKey(userScope), name: legacyMigrationName, completedAt: Date.now() });
  });

  // Legacy entries from another user/company cannot be proven safe and are
  // deliberately discarded rather than left in a global browser store.
  legacyStorage.removeItem(legacyQueueKey);
  legacyStorage.removeItem(legacySyncLogKey);
  return validSales.length > 0;
}

export async function replaceOfflineSnapshot(scope: OfflineScope, payload: unknown) {
  await offlineDatabase.snapshots.put({ scopeKey: offlineScopeKey(scope), savedAt: Date.now(), payload });
}

export async function getOfflineSnapshot(scope: OfflineScope) {
  return offlineDatabase.snapshots.get(offlineScopeKey(scope));
}

export async function replaceOfflinePreferences(scope: OfflineUserScope, payload: unknown) {
  await offlineDatabase.preferences.put({ scopeKey: offlineUserScopeKey(scope), savedAt: Date.now(), payload });
}

export async function getOfflinePreferences(scope: OfflineUserScope) {
  return offlineDatabase.preferences.get(offlineUserScopeKey(scope));
}

export async function replaceOfflineQueryCache(scope: OfflineScope, dehydratedState: unknown) {
  await offlineDatabase.queryCaches.put({ scopeKey: offlineScopeKey(scope), savedAt: Date.now(), dehydratedState });
}

export async function getOfflineQueryCache(scope: OfflineScope) {
  return offlineDatabase.queryCaches.get(offlineScopeKey(scope));
}

export async function clearOfflineQueryCache(scope: OfflineScope) {
  await offlineDatabase.queryCaches.delete(offlineScopeKey(scope));
}

export async function clearOfflinePreferences(scope: OfflineUserScope) {
  await offlineDatabase.preferences.delete(offlineUserScopeKey(scope));
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
  await offlineDatabase.transaction("rw", offlineDatabase.operations, offlineDatabase.snapshots, offlineDatabase.preferences, offlineDatabase.queryCaches, async () => {
    await offlineDatabase.operations.where("scopeKey").equals(scopeKey).delete();
    await offlineDatabase.snapshots.delete(scopeKey);
    await offlineDatabase.preferences.delete(scopeKey);
    await offlineDatabase.queryCaches.delete(scopeKey);
  });
}
