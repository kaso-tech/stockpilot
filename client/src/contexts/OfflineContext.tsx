import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import superjson from "superjson";
import { toast } from "sonner";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";
import { useAuth } from "@/_core/hooks/useAuth";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import {
  migrateLegacyOfflineStorage,
  belongsToOfflineScope,
  offlineScopeKey,
  readOfflineScope,
  replaceOfflineScope,
  type OfflineScope,
} from "@/lib/offlineStore";
import { createSingleFlight } from "@/lib/singleFlight";

type Discount = { type: "none" | "percent" | "fixed"; value: number };
export type OfflinePayment = { method: "cash" | "card" | "mobile_money" | "bank_transfer" | "credit"; amountCents: number };
export type OfflinePosDraft = { channel: "pos"; warehouseId: number; customerId: null; salesAgentId: null; cashierId: null; salesAgentSelectionMade: boolean; cashierSelectionMade: boolean; note: null; deliveryAddress: null; invoiceDiscount: Discount; applyVat?: boolean; vatRateBasisPoints?: number; items: Array<{ productId: number; productName: string; productReference: string; unitPriceCents: number; lineTotalCents: number; quantity: number; discount: Discount }> };
export type OfflineInvoiceDraft = { channel: "invoice" | "quote"; warehouseId: number; customerId: number; salesAgentId: number | null; cashierId: number | null; salesAgentSelectionMade: boolean; cashierSelectionMade: boolean; note: null; deliveryAddress: string | null; deliveryFeeCents: number; invoiceDiscount: Discount; items: Array<{ productId: number; quantity: number; manualUnitPriceCents: number | null; discount: Discount }> };
export type OfflineCheckout = { settlementMode: "full" | "partial"; payments: OfflinePayment[]; salesAgentId: number | null; cashierId: number | null; note: null };
export type OfflineSale = { id: string; ownerUserId: number; companyId: number; warehouseId: number; kind: "pos_sale" | "invoice_draft"; createdAt: number; status: "pending" | "syncing" | "failed"; error?: string; draft: OfflinePosDraft | OfflineInvoiceDraft; checkout?: OfflineCheckout };
export type SyncLogEntry = { id: string; ownerUserId: number; companyId: number; warehouseId: number; operationId: string; kind: OfflineSale["kind"]; summary: string; status: "queued" | "syncing" | "succeeded" | "failed"; createdAt: number; updatedAt: number; attemptCount: number; error?: string };

const maxLogEntries = 150;
function summaryFor(item: OfflineSale) { const quantity = item.draft.items.reduce((sum, line) => sum + line.quantity, 0); const title = item.kind === "pos_sale" ? "Vente comptoir" : item.draft.channel === "quote" ? "Devis" : item.checkout?.settlementMode === "partial" ? "Facture · règlement partiel" : "Brouillon de facture"; return `${title} · ${quantity} article${quantity > 1 ? "s" : ""}`; }
function authHeaders() { try { const raw = sessionStorage.getItem("manus-cookie"); const cookie = raw?.split(";").find(value => value.trim().startsWith("manus_session=")); const token = cookie?.trim().slice("manus_session=".length); return token ? { Authorization: `Bearer ${token}` } : {}; } catch { return {}; } }
const syncClient = createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, headers: authHeaders, fetch: (input, init) => globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }) })] });

export type PersistenceStatus = "idle" | "saving" | "saved" | "error";
type OfflineContextValue = { isOnline: boolean; sales: OfflineSale[]; syncLog: SyncLogEntry[]; pendingCount: number; failedCount: number; pendingProductQuantitiesByWarehouse: Record<number, Record<number, number>>; persistenceStatus: PersistenceStatus; persistenceError: string | null; lastLocalSnapshotAt: number | null; retryPersistence: () => void; queuePosSale: (draft: OfflinePosDraft, checkout: OfflineCheckout) => void; queueInvoiceDraft: (draft: OfflineInvoiceDraft) => void; queueInvoiceSale: (draft: OfflineInvoiceDraft, checkout: OfflineCheckout) => void; syncNow: () => Promise<void>; retryOperation: (operationId: string) => Promise<void>; clearCompletedSyncLog: () => void };
const OfflineContext = createContext<OfflineContextValue | null>(null);

type ScopedRecord = { ownerUserId?: unknown; companyId?: unknown; warehouseId?: unknown; draft?: { warehouseId?: unknown } };
function normalizeScopedRecord<T extends ScopedRecord>(value: unknown, scope: OfflineScope) {
  if (!value || typeof value !== "object") return null;
  const record = value as T;
  const warehouseId = record.warehouseId ?? record.draft?.warehouseId;
  if (!belongsToOfflineScope({ ownerUserId: record.ownerUserId, companyId: record.companyId, warehouseId }, scope)) return null;
  return { ...record, companyId: scope.companyId, warehouseId: scope.warehouseId } as T;
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeWarehouseId, isReady: isWarehouseReady } = useActiveWarehouse();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [sales, setSales] = useState<OfflineSale[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [hydratedScopeKey, setHydratedScopeKey] = useState<string | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>("idle");
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [lastLocalSnapshotAt, setLastLocalSnapshotAt] = useState<number | null>(null);
  const salesRef = useRef<OfflineSale[]>([]);
  const logRef = useRef<SyncLogEntry[]>([]);
  const scopeRef = useRef<OfflineScope | null>(null);
  const hydrationPromiseRef = useRef<Promise<void> | null>(null);
  const persistChainRef = useRef<Promise<void>>(Promise.resolve());
  const pendingPersistenceRef = useRef<{ sales: OfflineSale[]; syncLog: SyncLogEntry[] } | null>(null);
  const syncSingleFlightRef = useRef(createSingleFlight<void>());
  const offlineScope = useMemo<OfflineScope | null>(() => {
    const companyId = user?.companyId;
    const warehouseId = activeWarehouseId;
    return user && typeof companyId === "number" && Number.isInteger(companyId) && companyId > 0 && typeof warehouseId === "number" && Number.isInteger(warehouseId) && warehouseId > 0 ? { companyId, userId: user.id, warehouseId } : null;
  }, [activeWarehouseId, user]);
  const scopeKey = offlineScope ? offlineScopeKey(offlineScope) : null;

  const persistState = useCallback((nextSales: OfflineSale[], nextLog: SyncLogEntry[]) => {
    const normalizedLog = nextLog.slice(-maxLogEntries);
    salesRef.current = nextSales;
    logRef.current = normalizedLog;
    setSales(nextSales);
    setSyncLog(normalizedLog);
    pendingPersistenceRef.current = { sales: nextSales, syncLog: normalizedLog };
    const pendingScope = scopeRef.current;
    const pendingScopeKey = pendingScope ? offlineScopeKey(pendingScope) : null;
    if (!pendingScope || !pendingScopeKey) return;
    setPersistenceStatus("saving");
    setPersistenceError(null);
    const operations = nextSales.map(sale => ({ id: sale.id, type: sale.kind, payload: sale, createdAt: sale.createdAt, attempts: sale.status === "failed" ? 1 : 0, lastError: sale.error }));
    const write = persistChainRef.current.catch(() => undefined).then(async () => {
      await hydrationPromiseRef.current;
      if (scopeRef.current && offlineScopeKey(scopeRef.current) === pendingScopeKey) {
        await replaceOfflineScope(pendingScope, operations, { syncLog: normalizedLog });
      }
    });
    persistChainRef.current = write.then(
      () => { if (scopeRef.current && offlineScopeKey(scopeRef.current) === pendingScopeKey) { setPersistenceStatus("saved"); setLastLocalSnapshotAt(Date.now()); } },
      () => { if (scopeRef.current && offlineScopeKey(scopeRef.current) === pendingScopeKey) { setPersistenceStatus("error"); setPersistenceError("Impossible de sauvegarder les opérations hors connexion. Réessayez."); } console.error("[Offline] Échec de persistance IndexedDB."); },
    );
  }, []);

  const retryPersistence = useCallback(() => {
    const pending = pendingPersistenceRef.current;
    if (pending) persistState(pending.sales, pending.syncLog);
  }, [persistState]);

  useEffect(() => {
    scopeRef.current = offlineScope;
    salesRef.current = [];
    logRef.current = [];
    setSales([]);
    setSyncLog([]);
    setHydratedScopeKey(null);
    setPersistenceStatus("idle");
    setPersistenceError(null);
    setLastLocalSnapshotAt(null);
    pendingPersistenceRef.current = null;
    hydrationPromiseRef.current = null;
    if (!offlineScope || !scopeKey) return;
    let active = true;
    const hydrate = async () => {
      await migrateLegacyOfflineStorage(offlineScope);
      const { operations, snapshot } = await readOfflineScope(offlineScope);
      if (!active) return;
      const queued = operations.map(operation => normalizeScopedRecord<OfflineSale>(operation.payload, offlineScope)).filter((value): value is OfflineSale => Boolean(value));
      const storedLog = snapshot?.payload as { syncLog?: unknown } | undefined;
      const restoredLog = Array.isArray(storedLog?.syncLog)
        ? storedLog.syncLog.map(entry => normalizeScopedRecord<SyncLogEntry>(entry, offlineScope)).filter((value): value is SyncLogEntry => Boolean(value)).slice(-maxLogEntries)
        : [];
      salesRef.current = queued;
      logRef.current = restoredLog;
      setSales(queued);
      setSyncLog(restoredLog);
      setLastLocalSnapshotAt(snapshot?.savedAt ?? null);
      setHydratedScopeKey(scopeKey);
    };
    const hydration = hydrate().catch(() => {
      if (active) {
        setPersistenceStatus("error");
        setPersistenceError("Impossible de charger les opérations hors connexion. Réessayez.");
      }
      console.error("[Offline] Échec d’hydratation IndexedDB.");
    });
    hydrationPromiseRef.current = hydration;
    return () => { active = false; };
  }, [offlineScope, scopeKey]);

  const upsertLog = useCallback((item: OfflineSale, status: SyncLogEntry["status"], options?: { error?: string; increaseAttempt?: boolean }) => {
    const now = Date.now();
    const logs = logRef.current;
    const index = logs.findIndex(entry => entry.operationId === item.id);
    const previous: SyncLogEntry = index >= 0 ? logs[index] : { id: `sync-${item.id}`, ownerUserId: item.ownerUserId, companyId: item.companyId, warehouseId: item.warehouseId, operationId: item.id, kind: item.kind, summary: summaryFor(item), status: "queued", createdAt: item.createdAt, updatedAt: item.createdAt, attemptCount: 0 };
    const next: SyncLogEntry = { ...previous, status, updatedAt: now, error: options?.error, attemptCount: previous.attemptCount + (options?.increaseAttempt ? 1 : 0) };
    const updated = index >= 0 ? logs.map((entry, position) => position === index ? next : entry) : [...logs, next];
    persistState(salesRef.current, updated);
  }, [persistState]);

  const appendQueue = useCallback((item: OfflineSale) => {
    const nextSales = [...salesRef.current, item];
    const nextLog: SyncLogEntry = { id: `sync-${item.id}`, ownerUserId: item.ownerUserId, companyId: item.companyId, warehouseId: item.warehouseId, operationId: item.id, kind: item.kind, summary: summaryFor(item), status: "queued", createdAt: item.createdAt, updatedAt: item.createdAt, attemptCount: 0 };
    const existingLog = logRef.current.filter(entry => entry.operationId !== item.id);
    persistState(nextSales, [...existingLog, nextLog]);
  }, [persistState]);

  const assertDraftScope = useCallback((warehouseId: number) => { if (!user || !offlineScope || !isWarehouseReady) throw new Error("Sélectionnez un entrepôt actif avant d’enregistrer une opération hors connexion."); if (warehouseId !== offlineScope.warehouseId) throw new Error("L’entrepôt a changé : vérifiez le panier avant de l’enregistrer hors connexion."); }, [isWarehouseReady, offlineScope, user]);
  const queuePosSale = useCallback((draft: OfflinePosDraft, checkout: OfflineCheckout) => { assertDraftScope(draft.warehouseId); const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; appendQueue({ id, ownerUserId: user!.id, companyId: offlineScope!.companyId, warehouseId: offlineScope!.warehouseId, kind: "pos_sale", createdAt: Date.now(), status: "pending", draft, checkout }); }, [appendQueue, assertDraftScope, offlineScope, user]);
  const queueInvoiceDraft = useCallback((draft: OfflineInvoiceDraft) => { assertDraftScope(draft.warehouseId); const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; appendQueue({ id, ownerUserId: user!.id, companyId: offlineScope!.companyId, warehouseId: offlineScope!.warehouseId, kind: "invoice_draft", createdAt: Date.now(), status: "pending", draft }); }, [appendQueue, assertDraftScope, offlineScope, user]);
  const queueInvoiceSale = useCallback((draft: OfflineInvoiceDraft, checkout: OfflineCheckout) => { assertDraftScope(draft.warehouseId); const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; appendQueue({ id, ownerUserId: user!.id, companyId: offlineScope!.companyId, warehouseId: offlineScope!.warehouseId, kind: "invoice_draft", createdAt: Date.now(), status: "pending", draft, checkout }); }, [appendQueue, assertDraftScope, offlineScope, user]);

  const syncOperation = useCallback(async (item: OfflineSale) => {
    if (!navigator.onLine || !offlineScope || item.warehouseId !== offlineScope.warehouseId || item.draft.warehouseId !== offlineScope.warehouseId) return false;
    persistState(salesRef.current.map(record => record.id === item.id ? { ...record, status: "syncing", error: undefined } : record), logRef.current);
    upsertLog(item, "syncing", { increaseAttempt: true });
    try {
      const sale = await syncClient.transactions.createDraft.mutate({ ...item.draft, offlineOperationId: item.id });
      if (item.checkout) await syncClient.transactions.checkout.mutate({ ...item.checkout, saleId: sale.id, offlineOperationId: `${item.id}-payment` });
      persistState(salesRef.current.filter(record => record.id !== item.id), logRef.current);
      upsertLog(item, "succeeded");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "La synchronisation a échoué.";
      const failed = salesRef.current.map(record => record.id === item.id ? { ...record, status: "failed" as const, error: message } : record);
      persistState(failed, logRef.current);
      upsertLog(item, "failed", { error: message });
      return false;
    }
  }, [offlineScope, persistState, upsertLog]);

  const reportSyncHealth = useCallback(async () => {
    if (!navigator.onLine || !user || !offlineScope) return;
    const scopedSales = salesRef.current.filter(item => belongsToOfflineScope(item, offlineScope));
    try {
      await syncClient.syncHealth.report.mutate({
        isOnline: true,
        pendingOperations: scopedSales.length,
        failedOperations: scopedSales.filter(item => item.status === "failed").length,
      });
    } catch {
      // Le signal de santé est non bloquant : la synchronisation métier garde sa propre reprise fiable.
    }
  }, [offlineScope, user]);

  const syncNow = useCallback(() => syncSingleFlightRef.current(async () => {
    if (!navigator.onLine || !user) return;
    const queue = offlineScope ? salesRef.current.filter(item => belongsToOfflineScope(item, offlineScope) && item.draft.warehouseId === offlineScope.warehouseId) : [];
    let synced = 0;
    for (const item of queue) if (await syncOperation(item)) synced += 1;
    await reportSyncHealth();
    if (synced) { window.dispatchEvent(new Event("stockpilot-offline-sync")); toast.success(`${synced} opération${synced > 1 ? "s" : ""} synchronisée${synced > 1 ? "s" : ""}.`); }
  }), [offlineScope?.warehouseId, reportSyncHealth, syncOperation, user]);

  const retryOperation = useCallback((operationId: string) => syncSingleFlightRef.current(async () => {
    const item = offlineScope ? salesRef.current.find(record => record.id === operationId && belongsToOfflineScope(record, offlineScope) && record.draft.warehouseId === offlineScope.warehouseId) : undefined;
    if (!item) { toast.error("Cette opération n’est plus disponible."); return; }
    if (!navigator.onLine) { toast.error("Reconnectez-vous avant de relancer la synchronisation."); return; }
    if (await syncOperation(item)) { window.dispatchEvent(new Event("stockpilot-offline-sync")); toast.success("Synchronisation relancée avec succès."); }
  }), [offlineScope?.warehouseId, syncOperation, user]);

  useEffect(() => {
    if (hydratedScopeKey && navigator.onLine) void syncNow();
  }, [hydratedScopeKey, syncNow]);

  const clearCompletedSyncLog = useCallback(() => persistState(salesRef.current, logRef.current.filter(entry => entry.status !== "succeeded")), [persistState]);
  useEffect(() => { const online = () => { setIsOnline(true); void syncNow(); }; const offline = () => setIsOnline(false); window.addEventListener("online", online); window.addEventListener("offline", offline); if (navigator.onLine) void syncNow(); return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); }; }, [syncNow]);
  const accountSales = useMemo(() => offlineScope ? sales.filter(sale => belongsToOfflineScope(sale, offlineScope) && sale.draft.warehouseId === offlineScope.warehouseId) : [], [offlineScope, sales]);
  const accountLog = useMemo(() => offlineScope ? syncLog.filter(entry => belongsToOfflineScope(entry, offlineScope)).sort((a, b) => b.updatedAt - a.updatedAt) : [], [offlineScope, syncLog]);
  const pendingProductQuantitiesByWarehouse = useMemo(() => accountSales.reduce<Record<number, Record<number, number>>>((totals, sale) => { if (sale.kind !== "pos_sale" || sale.status === "failed" || !Number.isInteger(sale.draft.warehouseId)) return totals; const warehouseTotals = totals[sale.draft.warehouseId] ?? {}; for (const item of sale.draft.items) warehouseTotals[item.productId] = (warehouseTotals[item.productId] ?? 0) + item.quantity; totals[sale.draft.warehouseId] = warehouseTotals; return totals; }, {}), [accountSales]);
  const value = useMemo(() => ({ isOnline, sales: accountSales, syncLog: accountLog, pendingCount: accountSales.length, failedCount: accountLog.filter(entry => entry.status === "failed").length, pendingProductQuantitiesByWarehouse, persistenceStatus, persistenceError, lastLocalSnapshotAt, retryPersistence, queuePosSale, queueInvoiceDraft, queueInvoiceSale, syncNow, retryOperation, clearCompletedSyncLog }), [accountLog, accountSales, clearCompletedSyncLog, isOnline, lastLocalSnapshotAt, pendingProductQuantitiesByWarehouse, persistenceError, persistenceStatus, queueInvoiceDraft, queueInvoiceSale, queuePosSale, retryOperation, retryPersistence, syncNow]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() { const value = useContext(OfflineContext); if (!value) throw new Error("useOffline doit être utilisé dans OfflineProvider."); return value; }
