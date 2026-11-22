import { Button } from "@/components/ui/button";
import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const DISMISS_KEY = "stockpilot-install-dismissed-at";
const DISMISS_DAYS = 14;

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const recentlyDismissed = () => { try { const at = Number(localStorage.getItem(DISMISS_KEY)); return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000; } catch { return false; } };

/**
 * Proposition d'installation à l'ouverture : bouton « Installer » quand le navigateur le permet
 * (Chrome, Edge, Android), marche à suivre sur iPhone et iPad (Safari n'a pas de bouton).
 * Masquée une fois l'application installée, ou pendant 14 jours si l'utilisateur la ferme.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    const onPrompt = (event: Event) => { event.preventDefault(); setDeferred(event as BeforeInstallPromptEvent); setVisible(true); };
    const onInstalled = () => { setVisible(false); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIos()) { setIos(true); setVisible(true); }
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  const dismiss = () => { setVisible(false); try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* sans effet */ } };
  const install = async () => { if (!deferred) return; await deferred.prompt(); const choice = await deferred.userChoice.catch(() => null); setDeferred(null); if (choice?.outcome === "accepted") setVisible(false); else dismiss(); };
  if (!visible) return null;
  return (
    <div role="dialog" aria-label="Installer StockPilot" className="animate-enter fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-xl sm:inset-x-auto sm:right-5 sm:bottom-5">
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Installer StockPilot</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{ios ? <>Touchez <Share className="mx-0.5 -mt-0.5 inline h-4 w-4" /> <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.</> : "Ouvrez-la comme une application, en plein écran, même sans connexion."}</p>
          {!ios && <Button size="sm" className="mt-3" onClick={() => void install()} disabled={!deferred}><Download className="h-4 w-4" />Installer</Button>}
        </div>
        <button type="button" onClick={dismiss} aria-label="Plus tard" className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
