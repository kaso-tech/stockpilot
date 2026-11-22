import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { persistOfflineQueryCache, restoreOfflineQueryCache } from "@/lib/offlineCache";
import { shouldClearOfflineQueryMemory } from "@/lib/offlineRuntime";
import { offlineScopeKey, type OfflineScope } from "@/lib/offlineStore";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { markOfflineDataPrepared } from "@/lib/offlinePreparation";
import { can } from "@shared/permissions";

/** Restores and persists only the React Query data belonging to the active tenant, user and warehouse. */
export function OfflineQueryCacheBridge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeWarehouseId } = useActiveWarehouse();
  const previousScopeKeyRef = useRef<string | null>(null);
  const scope = useMemo<OfflineScope | null>(() => {
    const companyId = user?.companyId;
    return user && typeof companyId === "number" && Number.isInteger(companyId) && companyId > 0 && typeof activeWarehouseId === "number" && Number.isInteger(activeWarehouseId) && activeWarehouseId > 0
      ? { companyId, userId: user.id, warehouseId: activeWarehouseId }
      : null;
  }, [activeWarehouseId, user?.companyId, user?.id]);

  useEffect(() => {
    let active = true;
    const scopeKey = scope ? offlineScopeKey(scope) : null;
    const previousScopeKey = previousScopeKeyRef.current;
    const shouldClearMemory = shouldClearOfflineQueryMemory(previousScopeKey, scopeKey);
    previousScopeKeyRef.current = scopeKey;
    if (shouldClearMemory) queryClient.clear();
    if (!scope) return () => { active = false; };
    void restoreOfflineQueryCache(queryClient, scope, () => active);
    const unsubscribe = persistOfflineQueryCache(queryClient, scope);
    return () => {
      active = false;
      unsubscribe();
      if (previousScopeKeyRef.current !== scopeKey) queryClient.clear();
    };
  }, [queryClient, scope?.companyId, scope?.userId, scope?.warehouseId]);

  // Données nécessaires pour vendre et facturer sans réseau, préparées dès la connexion
  // (sans attendre qu'on ouvre les pages), puis rafraîchies toutes les 10 minutes.
  const utils = trpc.useUtils();
  const role = user?.role;
  useEffect(() => {
    if (!scope) return;
    const warehouseId = scope.warehouseId;
    let cancelled = false;
    const prepare = async () => {
      if (cancelled || typeof navigator !== "undefined" && !navigator.onLine) return;
      const finance = role === "admin" || role === "manager" || role === "accountant";
      const tasks: Array<Promise<unknown>> = [
        utils.warehouses.list.prefetch(),
        utils.products.list.prefetch({ warehouseId }),
        utils.commerce.settings.get.prefetch(),
        utils.commerce.agents.list.prefetch({ warehouseId }),
        utils.commerce.customers.list.prefetch(),
        utils.transactions.list.prefetch({ warehouseId }),
        utils.vatRates.list.prefetch(),
        utils.suppliers.list.prefetch(),
        ...(role === "seller" ? [utils.sellerDiscountPermissions.get.prefetch()] : []),
        ...(finance ? [utils.dashboard.get.prefetch({ warehouseId })] : []),
        // Dépenses et échéances, pour les saisir et les régler sans réseau.
        ...(can(role as any, "expenses.manage") ? (() => { const yearMonth = new Date().toISOString().slice(0, 7); return [
          utils.expenses.list.prefetch({ warehouseId }), utils.expenses.budget.get.prefetch({ yearMonth, warehouseId }), utils.expenses.report.prefetch({ yearMonth, warehouseId }),
          utils.paymentDues.list.prefetch({ warehouseId }), utils.paymentDues.schedules.list.prefetch({ warehouseId }), utils.paymentDues.groups.list.prefetch({ warehouseId }),
          utils.paymentDues.templates.list.prefetch({ warehouseId, includeInactive: true }), utils.paymentDues.templates.list.prefetch({ scheduleType: "expense", warehouseId }),
          utils.paymentDues.forecast.prefetch({ warehouseId, months: 6 }), utils.payroll.overview.prefetch({ warehouseId }),
        ]; })() : []),
      ];
      const results = await Promise.allSettled(tasks);
      if (!cancelled && results.every(result => result.status === "fulfilled")) markOfflineDataPrepared(scope);
    };
    const first = window.setTimeout(() => void prepare(), 1500);
    const timer = window.setInterval(() => void prepare(), 10 * 60_000);
    const online = () => void prepare();
    window.addEventListener("online", online);
    return () => { cancelled = true; window.clearTimeout(first); window.clearInterval(timer); window.removeEventListener("online", online); };
  }, [scope?.companyId, scope?.userId, scope?.warehouseId, role, utils]);

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries();
    window.addEventListener("stockpilot-offline-sync", refresh);
    return () => window.removeEventListener("stockpilot-offline-sync", refresh);
  }, [queryClient]);

  return null;
}
