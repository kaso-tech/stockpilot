import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ChevronLeft, KeyRound, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export default function SettingsSecurity() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const { data: sessions = [], isLoading: sessionsLoading } = trpc.auth.sessions.list.useQuery(undefined, { enabled: Boolean(user) });
  const revokeSession = trpc.auth.sessions.revoke.useMutation({ onSuccess: () => { void utils.auth.sessions.list.invalidate(); toast.success("La session a été révoquée."); }, onError: error => toast.error(error.message) });
  const revokeOthers = trpc.auth.sessions.revokeOthers.useMutation({ onSuccess: result => { void utils.auth.sessions.list.invalidate(); toast.success(result.revokedCount ? `${result.revokedCount} session(s) révoquée(s).` : "Aucune autre session active."); }, onError: error => toast.error(error.message) });
  const changePassword = trpc.auth.adminFallbackPasswordChange.useMutation({
    onSuccess: () => { setCurrentPassword(""); setNewPassword(""); setConfirmation(""); toast.success("Mot de passe de secours mis à jour."); },
    onError: error => toast.error(error.message),
  });

  if (!user) return <Restricted title="Sécurité du compte" description="Connectez-vous pour gérer vos sessions." />;
  const isAdmin = user.role === "admin";
  const valid = currentPassword.length > 0 && newPassword.length >= 10 && newPassword === confirmation;
  const save = () => {
    if (newPassword !== confirmation) { toast.error("La confirmation ne correspond pas au nouveau mot de passe."); return; }
    changePassword.mutate({ currentPassword, newPassword });
  };

  const returnPath = isAdmin ? "/parametres" : "/";
  return <div className="mx-auto max-w-2xl space-y-6"><Link href={returnPath} className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />{isAdmin ? "Retour aux paramètres" : "Retour au tableau de bord"}</Link><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Sécurité</p><h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Sécurité du compte</h1></header><Card className="border-border bg-card"><CardContent className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><MonitorSmartphone className="h-5 w-5" /></span><div><h2 className="font-semibold">Sessions actives</h2><p className="mt-1 text-sm text-muted-foreground">Révoquez l’accès d’un appareil que vous ne reconnaissez plus.</p></div></div>{sessions.filter(session => !session.isCurrent).length > 0 && <Button variant="outline" size="sm" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}><LogOut className="mr-2 h-4 w-4" />Tout révoquer</Button>}</div><div className="mt-5 space-y-3">{sessionsLoading ? <p className="text-sm text-muted-foreground">Chargement des sessions…</p> : sessions.length ? sessions.map(session => <div key={session.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><MonitorSmartphone className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-medium text-foreground">{session.deviceLabel}</span>{session.isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Cet appareil</span>}</span><span className="mt-1 block text-xs text-muted-foreground">Dernière activité : {new Date(session.lastSeenAt).toLocaleString("fr-FR")} · Expire le {new Date(session.expiresAt).toLocaleDateString("fr-FR")}</span></span>{session.isCurrent ? <span className="text-xs font-medium text-muted-foreground">Session protégée</span> : <Button variant="outline" size="sm" disabled={revokeSession.isPending} onClick={() => revokeSession.mutate({ sessionId: session.id })}>Révoquer</Button>}</div>) : <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Les nouvelles connexions apparaîtront ici. Connectez-vous à nouveau pour enregistrer cet appareil.</div>}</div></CardContent></Card>{isAdmin && <Card className="border-border bg-card"><CardContent className="p-5 sm:p-6"><div className="mb-6 flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound className="h-5 w-5" /></span><div><h2 className="font-semibold">Mot de passe administrateur</h2><p className="mt-1 text-sm text-muted-foreground">Le mot de passe est stocké sous forme hachée.</p></div></div><div className="space-y-4"><label className="block space-y-1.5"><span className="text-sm font-medium">Mot de passe actuel</span><Input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label><label className="block space-y-1.5"><span className="text-sm font-medium">Nouveau mot de passe</span><Input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /><span className="text-xs text-muted-foreground">10 caractères minimum.</span></label><label className="block space-y-1.5"><span className="text-sm font-medium">Confirmer le nouveau mot de passe</span><Input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label></div><div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.05] p-4 text-sm text-muted-foreground"><div className="flex items-center gap-2 font-medium text-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Protection de l’accès</div><p className="mt-1">Après l’enregistrement, seul le nouveau mot de passe permettra la connexion administrateur.</p></div><div className="mt-6 flex justify-end"><Button disabled={!valid || changePassword.isPending} onClick={save} className="bg-primary text-primary-foreground hover:bg-primary/90"><CheckCircle2 className="mr-2 h-4 w-4" />{changePassword.isPending ? "Mise à jour…" : "Mettre à jour le mot de passe"}</Button></div></CardContent></Card>}</div>;
}
