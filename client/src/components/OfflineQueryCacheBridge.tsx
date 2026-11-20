import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { persistOfflineQueryCache, restoreOfflineQueryCache } from "@/lib/offlineCache";
import { shouldClearOfflineQueryMemory } from "@/lib/offlineRuntime";
import { offlineScopeKey, type OfflineScope } from "@/lib/offlineStore";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

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

  return null;
}
