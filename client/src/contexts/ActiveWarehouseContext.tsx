import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ActiveWarehouse = { id: number; name: string; code: string; isDefault: boolean; wholesaleEnabled: boolean };
type ActiveWarehouseContextValue = {
  activeWarehouseId: number | null;
  activeWarehouse: ActiveWarehouse | null;
  warehouses: ActiveWarehouse[];
  /** Au moins un entrepôt actif pratique la vente en gros : les champs grossiste restent utiles. */
  wholesaleAnywhere: boolean;
  isReady: boolean;
  setActiveWarehouseId: (warehouseId: number) => void;
};

const ActiveWarehouseContext = createContext<ActiveWarehouseContextValue | undefined>(undefined);

function storageKey(user: { id: number; companyId: number | null }) {
  return Number.isInteger(user.companyId) && Number(user.companyId) > 0 ? `stockpilot-active-warehouse:company:${user.companyId}:user:${user.id}` : null;
}

function readStoredWarehouse(user: { id: number; companyId: number | null }) {
  const key = storageKey(user);
  if (!key) return null;
  try {
    const parsed = Number(localStorage.getItem(key));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredWarehouse(user: { id: number; companyId: number | null }, warehouseId: number) {
  const key = storageKey(user);
  if (!key) return;
  try { localStorage.setItem(key, String(warehouseId)); } catch { /* Le contexte serveur reste la source de vérité à la prochaine connexion. */ }
}

export function ActiveWarehouseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [activeWarehouseId, setLocalActiveWarehouseId] = useState<number | null>(null);
  const { data: active, isLoading } = trpc.warehouses.active.useQuery(undefined, { enabled: Boolean(user) });
  const { data: rows = [] } = trpc.warehouses.list.useQuery(undefined, { enabled: Boolean(user) });
  const warehouses = useMemo(() => rows.filter(warehouse => warehouse.active).map(warehouse => ({ id: warehouse.id, name: warehouse.name, code: warehouse.code, isDefault: warehouse.isDefault, wholesaleEnabled: warehouse.wholesaleEnabled !== false })), [rows]);
  useEffect(() => {
    setLocalActiveWarehouseId(user ? active?.warehouseId ?? readStoredWarehouse(user) : null);
    // Entrepôt confirmé par le serveur : mémorisé pour rouvrir l'application sans réseau.
    if (user && active?.warehouseId) writeStoredWarehouse(user, active.warehouseId);
  }, [active?.warehouseId, user?.id, user?.companyId]);
  const setActive = trpc.warehouses.setActive.useMutation({
    onSuccess: result => { if (user) writeStoredWarehouse(user, result.warehouseId); setLocalActiveWarehouseId(result.warehouseId); void utils.warehouses.active.invalidate(); void utils.products.list.invalidate(); void utils.movements.list.invalidate(); void utils.inventory.list.invalidate(); void utils.dashboard.get.invalidate(); void utils.transactions.list.invalidate(); void utils.expenses.list.invalidate(); void utils.expenses.report.invalidate(); void utils.payroll.overview.invalidate(); void utils.commerce.agents.detail.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const value = useMemo(() => ({ activeWarehouseId, activeWarehouse: warehouses.find(warehouse => warehouse.id === activeWarehouseId) ?? null, warehouses, wholesaleAnywhere: !warehouses.length || warehouses.some(warehouse => warehouse.wholesaleEnabled), isReady: !user || !isLoading, setActiveWarehouseId: (warehouseId: number) => setActive.mutate({ warehouseId }) }), [activeWarehouseId, isLoading, setActive, user, warehouses]);
  return <ActiveWarehouseContext.Provider value={value}>{children}</ActiveWarehouseContext.Provider>;
}

export function useActiveWarehouse() {
  const context = useContext(ActiveWarehouseContext);
  if (!context) throw new Error("useActiveWarehouse doit être utilisé dans ActiveWarehouseProvider.");
  return context;
}
