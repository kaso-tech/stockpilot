import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import superjson from "superjson";
import { toast } from "sonner";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";
import { useAuth } from "@/_core/hooks/useAuth";
import { getOfflineSnapshot, listOfflineOperations, replaceOfflineOperations, replaceOfflineSnapshot, type OfflineScope } from "@/lib/offlineStore";

type Discount = { type: "none" | "percent" | "fixed"; value: number };
export type OfflinePayment = { method: "cash" | "card" | "mobile_money" | "bank_transfer" | "credit"; amountCents: number };
export type OfflinePosDraft = { channel: "pos"; customerId: null; salesAgentId: null; cashierId: null; salesAgentSelectionMade: boolean; cashierSelectionMade: boolean; note: null; deliveryAddress: null; invoiceDiscount: Discount; items: Array<{ productId: number; productName: string; productReference: string; unitPriceCents: number; lineTotalCents: number; quantity: number; discount: Discount }> };
export type OfflineInvoiceDraft = { channel: "invoice"; customerId: number; salesAgentId: number | null; cashierId: number | null; salesAgentSelectionMade: boolean; cashierSelectionMade: boolean; note: null; deliveryAddress: string | null; invoiceDiscount: Discount; items: Array<{ productId: number; quantity: number; manualUnitPriceCents: number | null; discount: Discount }> };
export type OfflineCheckout = { settlementMode: "full" | "partial"; payments: OfflinePayment[]; salesAgentId: number | null; cashierId: number | null; note: null };
export type OfflineSale = { id: string; ownerUserId: number; kind: "pos_sale" | "invoice_draft"; createdAt: number; status: "pending" | "syncing" | "failed"; error?: string; draft: OfflinePosDraft | OfflineInvoiceDraft; checkout?: OfflineCheckout };
export type SyncLogEntry = { id: string; ownerUserId: number; operationId: string; kind: OfflineSale["kind"]; summary: string; status: "queued" | "syncing" | "succeeded" | "failed"; createdAt: number; updatedAt: number; attemptCount: number; error?: string };

const queueKey = "stockpilot_offline_sales_v1";
const syncLogKey = "stockpilot_sync_log_v1";
const maxLogEntries = 150;
function readJson<T>(key: string): T[] { try { const parsed = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function readQueue(): OfflineSale[] { return readJson<OfflineSale>(queueKey); }
function readLog(): SyncLogEntry[] { return readJson<SyncLogEntry>(syncLogKey); }
function writeQueue(queue: OfflineSale[]) { localStorage.setItem(queueKey, JSON.stringify(queue)); }
function writeLog(log: SyncLogEntry[]) { localStorage.setItem(syncLogKey, JSON.stringify(log.slice(-maxLogEntries))); }
function summaryFor(item: OfflineSale) { const quantity = item.draft.items.reduce((sum, line) => sum + line.quantity, 0); const title = item.kind === "pos_sale" ? "Vente comptoir" : item.checkout?.settlementMode === "partial" ? "Facture · règlement partiel" : "Brouillon de facture"; return `${title} · ${quantity} article${quantity > 1 ? "s" : ""}`; }
function authHeaders() { try { const raw = sessionStorage.getItem("manus-cookie"); const cookie = raw?.split(";").find(value => value.trim().startsWith("manus_session=")); const token = cookie?.trim().slice("manus_session=".length); return token ? { Authorization: `Bearer ${token}` } : {}; } catch { return {}; } }
const syncClient = createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, headers: authHeaders, fetch: (input, init) => globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }) })] });

type OfflineContextValue = { isOnline: boolean; sales: OfflineSale[]; syncLog: SyncLogEntry[]; pendingCount: number; failedCount: number; pendingProductQuantities: Record<number, number>; queuePosSale: (draft: OfflinePosDraft, checkout: OfflineCheckout) => void; queueInvoiceDraft: (draft: OfflineInvoiceDraft) => void; queueInvoiceSale: (draft: OfflineInvoiceDraft, checkout: OfflineCheckout) => void; syncNow: () => Promise<void>; retryOperation: (operationId: string) => Promise<void>; clearCompletedSyncLog: () => void };
const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [sales, setSales] = useState<OfflineSale[]>(() => readQueue());
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>(() => readLog());
  const commit = useCallback((next: OfflineSale[]) => { writeQueue(next); setSales(next); }, []);
  const commitLog = useCallback((next: SyncLogEntry[]) => { writeLog(next); setSyncLog(next); }, []);
  const upsertLog = useCallback((item: OfflineSale, status: SyncLogEntry["status"], options?: { error?: string; increaseAttempt?: boolean }) => {
    const now = Date.now(); const logs = readLog(); const index = logs.findIndex(entry => entry.operationId === item.id);
    const previous = index >= 0 ? logs[index] : { id: `sync-${item.id}`, ownerUserId: item.ownerUserId, operationId: item.id, kind: item.kind, summary: summaryFor(item), status: "queued" as const, createdAt: item.createdAt, updatedAt: item.createdAt, attemptCount: 0 };
    const next: SyncLogEntry = { ...previous, status, updatedAt: now, error: options?.error, attemptCount: previous.attemptCount + (options?.increaseAttempt ? 1 : 0) };
    const updated = index >= 0 ? logs.map((entry, position) => position === index ? next : entry) : [...logs, next]; commitLog(updated);
  }, [commitLog]);
  const appendQueue = useCallback((item: OfflineSale) => { commit([...readQueue(), item]); upsertLog(item, "queued"); }, [commit, upsertLog]);
  const offlineScope = useMemo<OfflineScope | null>(() => user ? { companyId: user.companyId, userId: user.id } : null, [user]);
  useEffect(() => { if (!offlineScope) return; let active = true; void Promise.all([listOfflineOperations(offlineScope), getOfflineSnapshot(offlineScope)]).then(([operations, snapshot]) => { if (!active) return; const queued = operations.map(operation => operation.payload as OfflineSale); if (queued.length) { writeQueue(queued); setSales(queued); } const storedLog = snapshot?.payload as { syncLog?: SyncLogEntry[] } | undefined; if (storedLog?.syncLog) { writeLog(storedLog.syncLog); setSyncLog(storedLog.syncLog); } }).catch(() => undefined); return () => { active = false; }; }, [offlineScope]);
  useEffect(() => { if (!offlineScope) return; const scopedSales = sales.filter(sale => sale.ownerUserId === offlineScope.userId); void replaceOfflineOperations(offlineScope, scopedSales.map(sale => ({ id: sale.id, type: sale.kind, payload: sale, createdAt: sale.createdAt, attempts: sale.status === "failed" ? 1 : 0, lastError: sale.error }))); const scopedLog = syncLog.filter(entry => entry.ownerUserId === offlineScope.userId); void replaceOfflineSnapshot(offlineScope, { syncLog: scopedLog }); }, [offlineScope, sales, syncLog]);
  const queuePosSale = useCallback((draft: OfflinePosDraft, checkout: OfflineCheckout) => { if (!user) throw new Error("Connectez-vous avant d’enregistrer une vente hors connexion."); const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; appendQueue({ id, ownerUserId: user.id, kind: "pos_sale", createdAt: Date.now(), status: "pending", draft, checkout }); }, [appendQueue, user]);
  const queueInvoiceDraft = useCallback((draft: OfflineInvoiceDraft) => { if (!user) throw new Error("Connectez-vous avant d’enregistrer une facture hors connexion."); const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; appendQueue({ id, ownerUserId: user.id, kind: "invoice_draft", createdAt: Date.now(), status: "pending", draft }); }, [appendQueue, user]);
  const queueInvoiceSale = useCallback((draft: OfflineInvoiceDraft, checkout: OfflineCheckout) => { if (!user) throw new Error("Connectez-vous avant d’enregistrer une facture hors connexion."); const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; appendQueue({ id, ownerUserId: user.id, kind: "invoice_draft", createdAt: Date.now(), status: "pending", draft, checkout }); }, [appendQueue, user]);
  const syncOperation = useCallback(async (item: OfflineSale) => {
    if (!navigator.onLine) return false;
    commit(readQueue().map(record => record.id === item.id ? { ...record, status: "syncing", error: undefined } : record)); upsertLog(item, "syncing", { increaseAttempt: true });
    try { const sale = await syncClient.transactions.createDraft.mutate({ ...item.draft, offlineOperationId: item.id }); if (item.checkout) await syncClient.transactions.checkout.mutate({ ...item.checkout, saleId: sale.id, offlineOperationId: `${item.id}-payment` }); commit(readQueue().filter(record => record.id !== item.id)); upsertLog(item, "succeeded"); return true; }
    catch (error) { const message = error instanceof Error ? error.message : "La synchronisation a échoué."; commit(readQueue().map(record => record.id === item.id ? { ...record, status: "failed", error: message } : record)); upsertLog(item, "failed", { error: message }); return false; }
  }, [commit, upsertLog]);
  const syncNow = useCallback(async () => { if (!navigator.onLine) return; const queue = readQueue().filter(item => item.ownerUserId === user?.id); let synced = 0; for (const item of queue) if (await syncOperation(item)) synced += 1; if (synced) { window.dispatchEvent(new Event("stockpilot-offline-sync")); toast.success(`${synced} opération${synced > 1 ? "s" : ""} synchronisée${synced > 1 ? "s" : ""}.`); } }, [syncOperation, user?.id]);
  const retryOperation = useCallback(async (operationId: string) => { const item = readQueue().find(record => record.id === operationId && record.ownerUserId === user?.id); if (!item) { toast.error("Cette opération n’est plus disponible."); return; } if (!navigator.onLine) { toast.error("Reconnectez-vous avant de relancer la synchronisation."); return; } const success = await syncOperation(item); if (success) { window.dispatchEvent(new Event("stockpilot-offline-sync")); toast.success("Synchronisation relancée avec succès."); } }, [syncOperation, user?.id]);
  const clearCompletedSyncLog = useCallback(() => commitLog(readLog().filter(entry => entry.status !== "succeeded")), [commitLog]);
  useEffect(() => { const online = () => { setIsOnline(true); void syncNow(); }; const offline = () => setIsOnline(false); window.addEventListener("online", online); window.addEventListener("offline", offline); if (navigator.onLine) void syncNow(); return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); }; }, [syncNow]);
  const accountSales = useMemo(() => sales.filter(sale => sale.ownerUserId === user?.id), [sales, user?.id]);
  const accountLog = useMemo(() => syncLog.filter(entry => entry.ownerUserId === user?.id).sort((a, b) => b.updatedAt - a.updatedAt), [syncLog, user?.id]);
  const failedCount = useMemo(() => accountLog.filter(entry => entry.status === "failed").length, [accountLog]);
  const pendingProductQuantities = useMemo(() => accountSales.reduce<Record<number, number>>((totals, sale) => { if (sale.kind !== "pos_sale" || sale.status === "failed") return totals; for (const item of sale.draft.items) totals[item.productId] = (totals[item.productId] ?? 0) + item.quantity; return totals; }, {}), [accountSales]);
  const value = useMemo(() => ({ isOnline, sales: accountSales, syncLog: accountLog, pendingCount: accountSales.length, failedCount: accountLog.filter(entry => entry.status === "failed").length, pendingProductQuantities, queuePosSale, queueInvoiceDraft, queueInvoiceSale, syncNow, retryOperation, clearCompletedSyncLog }), [accountLog, accountSales, clearCompletedSyncLog, failedCount, isOnline, pendingProductQuantities, queueInvoiceDraft, queueInvoiceSale, queuePosSale, retryOperation, syncNow]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() { const value = useContext(OfflineContext); if (!value) throw new Error("useOffline doit être utilisé dans OfflineProvider."); return value; }
