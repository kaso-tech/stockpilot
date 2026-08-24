import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import superjson from "superjson";
import { toast } from "sonner";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  migrateLegacyOfflineStorage,
  offlineScopeKey,
  readOfflineScope,
  replaceOfflineScope,
  type OfflineScope,
} from "@/lib/offlineStore";

type Discount = { type: "none" | "percent" | "fixed"; value: number };
export type OfflinePayment = { method: "cash" | "card" | "mobile_money" | "bank_transfer" | "credit"; amountCents: number };
export type OfflinePosDraft = { channel: "pos"; customerId: null; salesAgentId: null; cashierId: null; salesAgentSelectionMade: boolean; cashierSelectionMade: boolean; note: null; deliveryAddress: null; invoiceDiscount: Discount; items: Array<{ productId: number; productName: string; productReference: string; unitPriceCents: number; lineTotalCents: number; quantity: number; discount: Discount }> };
export type OfflineInvoiceDraft = { channel: "invoice"; customerId: number; salesAgentId: number | null; cashierId: number | null; salesAgentSelectionMade: boolean; cashierSelectionMade: boolean; note: null; deliveryAddress: string | null; invoiceDiscount: Discount; items: Array<{ productId: number; quantity: number; manualUnitPriceCents: number | null; discount: Discount }> };
export type OfflineCheckout = { settlementMode: "full" | "partial"; payments: OfflinePayment[]; salesAgentId: number | null; cashierId: number | null; note: null };
export type OfflineSale = { id: string; ownerUserId: number; companyId: number; kind: "pos_sale" | "invoice_draft"; createdAt: number; status: "pending" | "syncing" | "failed"; error?: string; draft: OfflinePosDraft | OfflineInvoiceDraft; checkout?: OfflineCheckout };
export type SyncLogEntry = { id: string; ownerUserId: number; companyId: number; operationId: string; kind: OfflineSale["kind"]; summary: string; status: "queued" | "syncing" | "succeeded" | "failed"; createdAt: number; updatedAt: number; attemptCount: number; error?: string };

const maxLogEntries = 150;
function summaryFor(item: OfflineSale) { const quantity = item.draft.items.reduce((sum, line) => sum + line.quantity, 0); const title = item.kind === "pos_sale" ? "Vente comptoir" : item.checkout?.settlementMode === "partial" ? "Facture · règlement partiel" : "Brouillon de facture"; return `${title} · ${quantity} article${quantity > 1 ? "s" : ""}`; }
function authHeaders() { try { const raw = sessionStorage.getItem("manus-cookie"); const cookie = raw?.split(";").find(value => value.trim().startsWith("manus_session=")); const token = cookie?.trim().slice("manus_session=".length); return token ? { Authorization: `Bearer ${token}` } : {}; } catch { return {}; } }
const syncClient = createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, headers: authHeaders, fetch: (input, init) => globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }) })] });

type OfflineContextValue = { isOnline: boolean; sales: OfflineSale[]; syncLog: SyncLogEntry[]; pendingCount: number; failedCount: number; pendingProductQuantities: Record<number, number>; queuePosSale: (draft: OfflinePosDraft, checkout: OfflineCheckout) => void; queueInvoiceDraft: (draft: OfflineInvoiceDraft) => void; queueInvoiceSale: (draft: OfflineInvoiceDraft, checkout: OfflineCheckout) => void; syncNow: () => Promise<void>; retryOperation: (operationId: string) => Promise<void>; clearCompletedSyncLog: () => void };
const OfflineContext = createContext<OfflineContextValue | null>(null);

type ScopedRecord = { ownerUserId?: unknown; companyId?: unknown };
function normalizeScopedRecord<T extends ScopedRecord>(value: unknown, scope: OfflineScope) {
  if (!value || typeof value !== "object") return null;
  const record = value as T;
  if (record.ownerUserId !== scope.userId || record.companyId !== scope.companyId) return null;
  return { ...record, companyId: scope.companyId } as T;
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [sales, setSales] = useState<OfflineSale[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [hydratedScopeKey, setHydratedScopeKey] = useState<string | null>(null);
  const salesRef = useRef<OfflineSale[]>([]);
  const logRef = useRef<SyncLogEntry[]>([]);
  const scopeRef = useRef<OfflineScope | null>(null);
  const hydrationPromiseRef = useRef<Promise<void> | null>(null);
  const persistChainRef = useRef<Promise<void>>(Promise.resolve());
  const offlineScope = useMemo<OfflineScope | null>(() => {
    const companyId = user?.companyId;
    return user && typeof companyId === "number" && Number.isInteger(companyId) && companyId > 0 ? { companyId, userId: user.id } : null;
  }, [user]);
  const scopeKey = offlineScope ? offlineScopeKey(offlineScope) : null;

  const persistState = useCallback((nextSales: OfflineSale[], nextLog: SyncLogEntry[]) => {
    const normalizedLog = nextLog.slice(-maxLogEntries);
    salesRef.current = nextSales;
    logRef.current = normalizedLog;
    setSales(nextSales);
    setSyncLog(normalizedLog);
    const pendingScope = scopeRef.current;
    const pendingScopeKey = pendingScope ? offlineScopeKey(pendingScope) : null;
    if (!pendingScope || !pendingScopeKey) return;
    const operations = nextSales.map(sale => ({ id: sale.id, type: sale.kind, payload: sale, createdAt: sale.createdAt, attempts: sale.status === "failed" ? 1 : 0, lastError: sale.error }));
    persistChainRef.current = persistChainRef.current.then(async () => {
      await hydrationPromiseRef.current;
      if (scopeRef.current && offlineScopeKey(scopeRef.current) === pendingScopeKey) {
        await replaceOfflineScope(pendingScope, operations, { syncLog: normalizedLog });
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    scopeRef.current = offlineScope;
    salesRef.current = [];
    logRef.current = [];
    setSales([]);
    setSyncLog([]);
    setHydratedScopeKey(null);
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
      setHydratedScopeKey(scopeKey);
    };
    const hydration = hydrate().catch(() => undefined);
    hydrationPromiseRef.current = hydration;
    return () => { active = false; };
  }, [offlineScope, scopeKey]);

  const upsertLog = useCallback((item: OfflineSale, status: SyncLogEntry["status"], options?: { error?: string; increaseAttempt?: boolean }) => {
    const now = Date.now();
    const logs = logRef.current;
    const index = logs.findIndex(entry => entry.operationId === item.id);
    const previous: SyncLogEntry = index >= 0 ? logs[index] : { id: `sync-${item.id}`, ownerUserId: item.ownerUserId, companyId: item.companyId, operationId: item.id, kind: item.kind, summary: summaryFor(item), status: "queued", createdAt: item.createdAt, updatedAt: item.createdAt, attemptCount: 0 };
    const next: SyncLogEntry = { ...previous, status, updatedAt: now, error: options?.error, attemptCount: previous.attemptCount + (options?.increaseAttempt ? 1 : 0) };
    const updated = index >= 0 ? logs.map((entry, position) => position === index ? next : entry) : [...logs, next];
    persistState(salesRef.current, updated);
  }, [persistState]);

  const appendQueue = useCallback((item: OfflineSale) => {
    const nextSales = [...salesRef.current, item];
    const nextLog: SyncLogEntry = { id: `sync-${item.id}`, ownerUserId: item.ownerUserId, companyId: item.companyId, operationId: item.id, kind: item.kind, summary: summaryFor(item), status: "queued", createdAt: item.createdAt, updatedAt: item.createdAt, attemptCount: 0 };
    const existingLog = logRef.current.filter(entry => entry.operationId !== item.id);
    persistState(nextSales, [...existingLog, nextLog]);
  }, [persistState]);

  const queuePosSale = useCallback((draft: OfflinePosDraft, checkout: OfflineCheckout) => { if (!user || !offlineScope) throw new Error("Connectez-vous à une entreprise avant d’enregistrer une vente hors connexion."); const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; appendQueue({ id, ownerUserId: user.id, companyId: offlineScope.companyId, kind: "pos_sale", createdAt: Date.now(), status: "pending", draft, checkout }); }, [appendQueue, offlineScope, user]);
  const queueInvoiceDraft = useCallback((draft: OfflineInvoiceDraft) => { if (!user || !offlineScope) throw new Error("Connectez-vous à une entreprise avant d’enregistrer une facture hors connexion."); const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; appendQueue({ id, ownerUserId: user.id, companyId: offlineScope.companyId, kind: "invoice_draft", createdAt: Date.now(), status: "pending", draft }); }, [appendQueue, offlineScope, user]);
  const queueInvoiceSale = useCallback((draft: OfflineInvoiceDraft, checkout: OfflineCheckout) => { if (!user || !offlineScope) throw new Error("Connectez-vous à une entreprise avant d’enregistrer une facture hors connexion."); const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; appendQueue({ id, ownerUserId: user.id, companyId: offlineScope.companyId, kind: "invoice_draft", createdAt: Date.now(), status: "pending", draft, checkout }); }, [appendQueue, offlineScope, user]);

  const syncOperation = useCallback(async (item: OfflineSale) => {
    if (!navigator.onLine) return false;
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
  }, [persistState, upsertLog]);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || !user) return;
    const queue = salesRef.current.filter(item => item.ownerUserId === user.id && item.companyId === (user.companyId ?? null));
    let synced = 0;
    for (const item of queue) if (await syncOperation(item)) synced += 1;
    if (synced) { window.dispatchEvent(new Event("stockpilot-offline-sync")); toast.success(`${synced} opération${synced > 1 ? "s" : ""} synchronisée${synced > 1 ? "s" : ""}.`); }
  }, [syncOperation, user]);

  const retryOperation = useCallback(async (operationId: string) => {
    const item = salesRef.current.find(record => record.id === operationId && record.ownerUserId === user?.id && record.companyId === (user?.companyId ?? null));
    if (!item) { toast.error("Cette opération n’est plus disponible."); return; }
    if (!navigator.onLine) { toast.error("Reconnectez-vous avant de relancer la synchronisation."); return; }
    if (await syncOperation(item)) { window.dispatchEvent(new Event("stockpilot-offline-sync")); toast.success("Synchronisation relancée avec succès."); }
  }, [syncOperation, user]);

  useEffect(() => {
    if (hydratedScopeKey && navigator.onLine) void syncNow();
  }, [hydratedScopeKey, syncNow]);

  const clearCompletedSyncLog = useCallback(() => persistState(salesRef.current, logRef.current.filter(entry => entry.status !== "succeeded")), [persistState]);
  useEffect(() => { const online = () => { setIsOnline(true); void syncNow(); }; const offline = () => setIsOnline(false); window.addEventListener("online", online); window.addEventListener("offline", offline); if (navigator.onLine) void syncNow(); return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); }; }, [syncNow]);
  const accountSales = useMemo(() => sales.filter(sale => sale.ownerUserId === user?.id && sale.companyId === (user?.companyId ?? null)), [sales, user?.companyId, user?.id]);
  const accountLog = useMemo(() => syncLog.filter(entry => entry.ownerUserId === user?.id && entry.companyId === (user?.companyId ?? null)).sort((a, b) => b.updatedAt - a.updatedAt), [syncLog, user?.companyId, user?.id]);
  const pendingProductQuantities = useMemo(() => accountSales.reduce<Record<number, number>>((totals, sale) => { if (sale.kind !== "pos_sale" || sale.status === "failed") return totals; for (const item of sale.draft.items) totals[item.productId] = (totals[item.productId] ?? 0) + item.quantity; return totals; }, {}), [accountSales]);
  const value = useMemo(() => ({ isOnline, sales: accountSales, syncLog: accountLog, pendingCount: accountSales.length, failedCount: accountLog.filter(entry => entry.status === "failed").length, pendingProductQuantities, queuePosSale, queueInvoiceDraft, queueInvoiceSale, syncNow, retryOperation, clearCompletedSyncLog }), [accountLog, accountSales, clearCompletedSyncLog, isOnline, pendingProductQuantities, queueInvoiceDraft, queueInvoiceSale, queuePosSale, retryOperation, syncNow]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() { const value = useContext(OfflineContext); if (!value) throw new Error("useOffline doit être utilisé dans OfflineProvider."); return value; }
