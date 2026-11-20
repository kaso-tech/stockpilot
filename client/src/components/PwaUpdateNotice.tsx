import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useOffline } from "@/contexts/OfflineContext";
import { PWA_UPDATE_EVENT, type PwaUpdateActivation } from "@/lib/offlineRuntime";
import { ArrowUpRight, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

/** L’activation est possible uniquement après une confirmation explicite. */
export function PwaUpdateNotice() {
  const [activateUpdate, setActivateUpdate] = useState<PwaUpdateActivation | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pendingCount, persistenceStatus, isOnline } = useOffline();
  useEffect(() => {
    const available = (event: Event) => {
      const activation = (event as CustomEvent<PwaUpdateActivation>).detail;
      if (typeof activation === "function") { setActivateUpdate(() => activation); setError(null); }
    };
    window.addEventListener(PWA_UPDATE_EVENT, available);
    return () => window.removeEventListener(PWA_UPDATE_EVENT, available);
  }, []);
  if (!activateUpdate) return null;
  const apply = async () => {
    if (isUpdating || !activateUpdate || persistenceStatus === "error") return;
    setIsUpdating(true); setError(null);
    try { await activateUpdate(); }
    catch { setError("La mise à jour n’a pas pu être appliquée. Vos données restent conservées. Réessayez plus tard."); setIsUpdating(false); }
  };
  return <>
    <aside aria-live="polite" aria-label="Mise à jour StockPilot disponible" className="fixed inset-x-3 bottom-4 z-[100] mx-auto max-w-lg rounded-xl border border-primary/20 bg-card p-4 text-card-foreground shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[420px]">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><RefreshCw className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-mediumr text-primary">StockPilot Pro</p><h2 className="mt-0.5 text-sm font-semibold">Une nouvelle version est prête</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Améliorations et correctifs disponibles. Installez-les quand vous avez terminé vos saisies.</p></div><Button type="button" aria-label="Reporter la mise à jour" size="icon" variant="ghost" onClick={() => setActivateUpdate(null)} disabled={isUpdating} className="h-8 w-8 shrink-0"><X className="h-4 w-4" /></Button></div>
      <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" disabled={isUpdating} onClick={() => setActivateUpdate(null)}>Plus tard</Button><Button type="button" size="sm" disabled={isUpdating} onClick={() => setConfirmationOpen(true)}>Voir la mise à jour<ArrowUpRight className="ml-2 h-4 w-4" /></Button></div>
    </aside>
    <AlertDialog open={confirmationOpen} onOpenChange={open => { if (!isUpdating) setConfirmationOpen(open); }}>
      <AlertDialogContent className="max-h-[85dvh] overflow-y-auto border-border bg-card text-card-foreground sm:max-w-md">
        <AlertDialogHeader><div className="mb-2 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 className="h-6 w-6" /></div><AlertDialogTitle>Mettre StockPilot à jour maintenant ?</AlertDialogTitle><AlertDialogDescription>La page va se recharger. Les données déjà enregistrées sur cet appareil sont conservées, mais les saisies non enregistrées peuvent être perdues.</AlertDialogDescription></AlertDialogHeader>
        {pendingCount > 0 && <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm">{pendingCount} opération(s) attendent une synchronisation. Elles restent dans la file locale ; il est préférable de les synchroniser avant la mise à jour.</p>}
        {!isOnline && <p role="status" className="text-sm text-muted-foreground">Vous êtes hors connexion. Vous pouvez reporter cette mise à jour jusqu’au rétablissement du réseau.</p>}
        {persistenceStatus === "error" && <p role="alert" className="text-sm text-destructive">Le stockage local a signalé une erreur. La mise à jour est bloquée pour protéger vos données.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={isUpdating}>Continuer sans mise à jour</AlertDialogCancel><Button type="button" disabled={isUpdating || persistenceStatus === "error"} onClick={() => void apply()}>{isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}{isUpdating ? "Mise à jour…" : "Confirmer la mise à jour"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
