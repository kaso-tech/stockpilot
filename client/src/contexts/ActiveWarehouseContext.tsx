import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ActiveWarehouse = { id: number; name: string; code: string; isDefault: boolean };
type ActiveWarehouseContextValue = {
  activeWarehouseId: number | null;
  activeWarehouse: ActiveWarehouse | null;
  warehouses: ActiveWarehouse[];
  isReady: boolean;
  setActiveWarehouseId: (warehouseId: number) => void;
};

const ActiveWarehouseContext = createContext<ActiveWarehouseContextValue | undefined>(undefined);

export function ActiveWarehouseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [activeWarehouseId, setLocalActiveWarehouseId] = useState<number | null>(null);
  const { data: active, isLoading } = trpc.warehouses.active.useQuery(undefined, { enabled: isAdmin });
  const { data: rows = [] } = trpc.warehouses.list.useQuery(undefined, { enabled: isAdmin });
  const warehouses = useMemo(() => rows.filter(warehouse => warehouse.active).map(warehouse => ({ id: warehouse.id, name: warehouse.name, code: warehouse.code, isDefault: warehouse.isDefault })), [rows]);
  useEffect(() => { setLocalActiveWarehouseId(isAdmin ? active?.warehouseId ?? null : null); }, [active?.warehouseId, isAdmin]);
  const setActive = trpc.warehouses.setActive.useMutation({
    onSuccess: result => { setLocalActiveWarehouseId(result.warehouseId); void utils.warehouses.active.invalidate(); void utils.products.list.invalidate(); void utils.movements.list.invalidate(); void utils.inventory.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const value = useMemo(() => ({ activeWarehouseId, activeWarehouse: warehouses.find(warehouse => warehouse.id === activeWarehouseId) ?? null, warehouses, isReady: !isAdmin || !isLoading, setActiveWarehouseId: (warehouseId: number) => setActive.mutate({ warehouseId }) }), [activeWarehouseId, isAdmin, isLoading, setActive, warehouses]);
  return <ActiveWarehouseContext.Provider value={value}>{children}</ActiveWarehouseContext.Provider>;
}

export function useActiveWarehouse() {
  const context = useContext(ActiveWarehouseContext);
  if (!context) throw new Error("useActiveWarehouse doit être utilisé dans ActiveWarehouseProvider.");
  return context;
}
