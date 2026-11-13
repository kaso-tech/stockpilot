import { useAuth } from "@/_core/hooks/useAuth";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { useEffect } from "react";

export function ProductPhotoCacheBridge() {
  const { user, loading } = useAuth();
  const { activeWarehouseId, isReady } = useActiveWarehouse();
  const companyId = user?.companyId;
  const userId = user?.id;
  useEffect(() => {
    if (loading || !isReady || !("serviceWorker" in navigator)) return;
    if (userId && (!companyId || !activeWarehouseId)) return;
    const scope = companyId && userId && activeWarehouseId ? { companyId, userId, warehouseId: activeWarehouseId } : null;
    let cancelled = false;
    const send = () => navigator.serviceWorker.controller?.postMessage({ type: "STOCKPILOT_PHOTO_SCOPE", scope });
    send();
    void navigator.serviceWorker.ready.then(() => { if (!cancelled) send(); });
    navigator.serviceWorker.addEventListener("controllerchange", send);
    return () => { cancelled = true; navigator.serviceWorker.removeEventListener("controllerchange", send); };
  }, [companyId, userId, activeWarehouseId, isReady, loading]);
  return null;
}
