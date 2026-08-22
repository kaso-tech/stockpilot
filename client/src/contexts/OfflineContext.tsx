import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import superjson from "superjson";
import { toast } from "sonner";
import type { AppRouter } from "../../../server/routers";
import { useAuth } from "@/_core/hooks/useAuth";

type Discount = { type: "none" | "percent" | "fixed"; value: number };
type Payment = { method: "cash" | "card" | "mobile_money" | "bank_transfer" | "credit"; amountCents: number };
export type OfflinePosDraft = { channel: "pos"; customerId: null; salesAgentId: null; cashierId: null; salesAgentSelectionMade: boolean; cashierSelectionMade: boolean; note: null; invoiceDiscount: Discount; items: Array<{ productId: number; quantity: number; discount: Discount }> };
export type OfflineInvoiceDraft = { channel: "invoice"; customerId: number; salesAgentId: number | null; cashierId: number | null; salesAgentSelectionMade: boolean; cashierSelectionMade: boolean; note: null; invoiceDiscount: Discount; items: Array<{ productId: number; quantity: number; manualUnitPriceCents: number | null; discount: Discount }> };
type OfflineCheckout = { settlementMode: "full"; payments: Payment[]; salesAgentId: number | null; cashierId: number | null; note: null };
export type OfflineSale = { id: string; ownerUserId: number; kind: "pos_sale" | "invoice_draft"; createdAt: number; status: "pending" | "syncing" | "failed"; error?: string; draft: OfflinePosDraft | OfflineInvoiceDraft; checkout?: OfflineCheckout };

const queueKey = "stockpilot_offline_sales_v1";

function readQueue(): OfflineSale[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(queueKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeQueue(queue: OfflineSale[]) { localStorage.setItem(queueKey, JSON.stringify(queue)); }

function authHeaders() {
  try {
    const raw = sessionStorage.getItem("manus-cookie");
    const cookie = raw?.split(";").find(value => value.trim().startsWith("manus_session="));
    const token = cookie?.trim().slice("manus_session=".length);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

const syncClient = createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, headers: authHeaders, fetch: (input, init) => globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }) })] });

type OfflineContextValue = { isOnline: boolean; sales: OfflineSale[]; pendingCount: number; pendingProductQuantities: Record<number, number>; queuePosSale: (draft: OfflinePosDraft, checkout: OfflineCheckout) => void; queueInvoiceDraft: (draft: OfflineInvoiceDraft) => void; syncNow: () => Promise<void> };
const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [sales, setSales] = useState<OfflineSale[]>(() => readQueue());
  const commit = useCallback((next: OfflineSale[]) => { writeQueue(next); setSales(next); }, []);
  const queuePosSale = useCallback((draft: OfflinePosDraft, checkout: OfflineCheckout) => {
    if (!user) throw new Error("Connectez-vous avant d’enregistrer une vente hors connexion.");
    const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    commit([...readQueue(), { id, ownerUserId: user.id, kind: "pos_sale", createdAt: Date.now(), status: "pending", draft, checkout }]);
  }, [commit, user]);
  const queueInvoiceDraft = useCallback((draft: OfflineInvoiceDraft) => {
    if (!user) throw new Error("Connectez-vous avant d’enregistrer une facture hors connexion.");
    const id = globalThis.crypto?.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    commit([...readQueue(), { id, ownerUserId: user.id, kind: "invoice_draft", createdAt: Date.now(), status: "pending", draft }]);
  }, [commit, user]);
  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    const queue = readQueue().filter(item => item.ownerUserId === user?.id);
    if (!queue.length) return;
    let synced = 0;
    for (const item of queue) {
      commit(readQueue().map(record => record.id === item.id ? { ...record, status: "syncing", error: undefined } : record));
      try {
        const sale = await syncClient.transactions.createDraft.mutate({ ...item.draft, offlineOperationId: item.id });
        if (item.checkout) await syncClient.transactions.checkout.mutate({ ...item.checkout, saleId: sale.id, offlineOperationId: `${item.id}-payment` });
        commit(readQueue().filter(record => record.id !== item.id));
        synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "La synchronisation a échoué.";
        commit(readQueue().map(record => record.id === item.id ? { ...record, status: "failed", error: message } : record));
      }
    }
    if (synced) {
      window.dispatchEvent(new Event("stockpilot-offline-sync"));
      toast.success(`${synced} vente${synced > 1 ? "s" : ""} hors connexion synchronisée${synced > 1 ? "s" : ""}.`);
    }
  }, [commit, user?.id]);
  useEffect(() => {
    const online = () => { setIsOnline(true); void syncNow(); };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    if (navigator.onLine) void syncNow();
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [syncNow]);
  const accountSales = useMemo(() => sales.filter(sale => sale.ownerUserId === user?.id), [sales, user?.id]);
  const pendingProductQuantities = useMemo(() => accountSales.reduce<Record<number, number>>((totals, sale) => { if (sale.kind !== "pos_sale" || sale.status === "failed") return totals; for (const item of sale.draft.items) totals[item.productId] = (totals[item.productId] ?? 0) + item.quantity; return totals; }, {}), [accountSales]);
  const value = useMemo(() => ({ isOnline, sales: accountSales, pendingCount: accountSales.length, pendingProductQuantities, queuePosSale, queueInvoiceDraft, syncNow }), [accountSales, isOnline, pendingProductQuantities, queueInvoiceDraft, queuePosSale, syncNow]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const value = useContext(OfflineContext);
  if (!value) throw new Error("useOffline doit être utilisé dans OfflineProvider.");
  return value;
}
