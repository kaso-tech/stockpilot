import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ChevronLeft, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export default function SettingsSecurity() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const changePassword = trpc.auth.adminFallbackPasswordChange.useMutation({
    onSuccess: () => { setCurrentPassword(""); setNewPassword(""); setConfirmation(""); toast.success("Mot de passe de secours mis à jour."); },
    onError: error => toast.error(error.message),
  });

  if (user?.role !== "admin") return <Restricted title="Accès administrateur" description="Ce réglage est réservé à l’administrateur." />;
  const valid = currentPassword.length > 0 && newPassword.length >= 10 && newPassword === confirmation;
  const save = () => {
    if (newPassword !== confirmation) { toast.error("La confirmation ne correspond pas au nouveau mot de passe."); return; }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return <div className="mx-auto max-w-2xl space-y-6"><Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Sécurité</p><h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Accès administrateur</h1></header><Card className="border-border bg-card"><CardContent className="p-5 sm:p-6"><div className="mb-6 flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound className="h-5 w-5" /></span><div><h2 className="font-semibold">Mot de passe de secours</h2><p className="mt-1 text-sm text-muted-foreground">Utilisez ce mot de passe uniquement si la connexion Google est indisponible. Le mot de passe est stocké sous forme hachée.</p></div></div><div className="space-y-4"><label className="block space-y-1.5"><span className="text-sm font-medium">Mot de passe actuel</span><Input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label><label className="block space-y-1.5"><span className="text-sm font-medium">Nouveau mot de passe</span><Input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /><span className="text-xs text-muted-foreground">10 caractères minimum.</span></label><label className="block space-y-1.5"><span className="text-sm font-medium">Confirmer le nouveau mot de passe</span><Input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label></div><div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.05] p-4 text-sm text-muted-foreground"><div className="flex items-center gap-2 font-medium text-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Protection de l’accès</div><p className="mt-1">Après l’enregistrement, seul le nouveau mot de passe permettra la connexion administrateur de secours.</p></div><div className="mt-6 flex justify-end"><Button disabled={!valid || changePassword.isPending} onClick={save} className="bg-primary text-primary-foreground hover:bg-primary/90"><CheckCircle2 className="mr-2 h-4 w-4" />{changePassword.isPending ? "Mise à jour…" : "Mettre à jour le mot de passe"}</Button></div></CardContent></Card></div>;
}
