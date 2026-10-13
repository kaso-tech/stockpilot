import { Button } from "@/components/ui/button";
import { PWA_UPDATE_EVENT, type PwaUpdateActivation } from "@/lib/offlineRuntime";
import { Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

/** Empêche toute activation de service worker tant que l’utilisateur ne l’a pas demandée. */
export function PwaUpdateNotice() {
  const [activateUpdate, setActivateUpdate] = useState<PwaUpdateActivation | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const onUpdateAvailable = (event: Event) => {
      const activate = (event as CustomEvent<PwaUpdateActivation>).detail;
      if (typeof activate === "function") setActivateUpdate(() => activate);
    };
    window.addEventListener(PWA_UPDATE_EVENT, onUpdateAvailable);
    return () => window.removeEventListener(PWA_UPDATE_EVENT, onUpdateAvailable);
  }, []);

  if (!activateUpdate) return null;

  const applyUpdate = async () => {
    setIsUpdating(true);
    try {
      await activateUpdate();
    } catch {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-primary/25 bg-card p-4 text-card-foreground shadow-2xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Une mise à jour est prête</p>
        <p className="mt-1 text-xs text-muted-foreground">Terminez vos saisies avant de l’appliquer. Les données locales restent conservées.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setActivateUpdate(null)} disabled={isUpdating}>
          <X className="mr-1.5 h-4 w-4" />Plus tard
        </Button>
        <Button type="button" size="sm" onClick={() => void applyUpdate()} disabled={isUpdating} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {isUpdating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          {isUpdating ? "Mise à jour…" : "Mettre à jour"}
        </Button>
      </div>
    </div>
  );
}
