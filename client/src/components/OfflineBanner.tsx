import { useAuth } from "@/_core/hooks/useAuth";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { useOffline } from "@/contexts/OfflineContext";
import { readOfflineDataPreparedAt } from "@/lib/offlinePreparation";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

const formatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Bandeau affiché sans réseau : depuis quand les données datent et combien
 * d'opérations attendent la synchronisation.
 */
export function OfflineBanner() {
  const { isOnline, pendingCount } = useOffline();
  const { user, offlineSession } = useAuth() as ReturnType<typeof useAuth> & { offlineSession?: boolean };
  const { activeWarehouseId } = useActiveWarehouse();
  const [preparedAt, setPreparedAt] = useState<number | null>(null);
  useEffect(() => {
    const read = () => setPreparedAt(user && typeof user.companyId === "number" && activeWarehouseId ? readOfflineDataPreparedAt({ companyId: user.companyId, userId: user.id, warehouseId: activeWarehouseId }) : null);
    read();
    window.addEventListener("stockpilot-offline-prepared", read);
    return () => window.removeEventListener("stockpilot-offline-prepared", read);
  }, [user?.id, user?.companyId, activeWarehouseId]);
  if (isOnline && !offlineSession) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warning/30 bg-warning-soft px-4 py-2.5 text-[13px] text-foreground">
      <WifiOff className="h-4 w-4 shrink-0 text-warning" />
      <span className="font-semibold">Hors connexion</span>
      <span className="text-muted-foreground">{preparedAt ? `Données du ${formatter.format(preparedAt)}` : "Données gardées sur l’appareil"}</span>
      <span className="text-muted-foreground">· {pendingCount ? `${pendingCount} opération${pendingCount > 1 ? "s" : ""} en attente d’envoi` : "aucune opération en attente"}</span>
      <span className="w-full text-xs text-muted-foreground sm:w-auto">Vente et facturation possibles ; les autres pages affichent les dernières données consultées.</span>
    </div>
  );
}
