import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Boxes, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

function RecoveryShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-background px-4 py-8 text-foreground sm:px-6"><section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl shadow-black/30 sm:p-8"><div className="mb-7 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400 text-slate-950"><Boxes className="h-6 w-6" /></span><span className="text-lg font-semibold">StockPilot</span></div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><div className="mt-6 space-y-4">{children}</div><Link href="/" className="mt-6 block rounded px-2 py-2 text-center text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Retour à la connexion</Link></section></main>;
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const request = trpc.auth.requestPasswordReset.useMutation();
  return <RecoveryShell title="Mot de passe oublié">
    {request.isSuccess ? <p className="text-sm leading-6 text-muted-foreground" role="status">Si un compte correspond à cette adresse et que l’envoi d’e-mail est configuré, un lien de réinitialisation valable une heure vous sera envoyé.</p> : <form className="space-y-3" onSubmit={event => { event.preventDefault(); request.mutate({ email }); }}>
      <p className="text-sm leading-6 text-muted-foreground">Indiquez l’adresse e-mail utilisée pour vous connecter. Cette demande nécessite une connexion Internet.</p>
      <label htmlFor="recovery-email" className="block text-sm font-medium text-foreground">Adresse e-mail</label>
      <Input id="recovery-email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={event => setEmail(event.target.value)} className="min-h-11 border-border bg-muted/50 text-foreground placeholder:text-muted-foreground" />
      <Button type="submit" disabled={!email.trim() || request.isPending || !navigator.onLine} className="h-11 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200">{request.isPending ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Envoi…</> : "Recevoir le lien"}</Button>
      {!navigator.onLine && <p className="text-sm text-amber-200" role="status">Vous êtes hors connexion. Reconnectez-vous avant de demander un lien.</p>}
      {request.error && <p className="text-sm text-rose-200" role="alert">{request.error.message}</p>}
    </form>}
  </RecoveryShell>;
}

export function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const reset = trpc.auth.resetPassword.useMutation();
  const mismatch = confirmation.length > 0 && confirmation !== password;
  return <RecoveryShell title="Choisir un nouveau mot de passe">
    {reset.isSuccess ? <p className="text-sm leading-6 text-muted-foreground" role="status">Votre mot de passe a été modifié et toutes les sessions ont été fermées. Connectez-vous avec le nouveau mot de passe.</p> : !token ? <p className="text-sm text-rose-200" role="alert">Lien incomplet ou invalide. <Link href="/mot-de-passe-oublie" className="underline">Demandez un nouveau lien.</Link></p> : <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (password === confirmation) reset.mutate({ token, password }); }}>
      <label htmlFor="new-password" className="block text-sm font-medium text-foreground">Nouveau mot de passe</label>
      <Input id="new-password" type="password" autoComplete="new-password" required minLength={10} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} className="min-h-11 border-border bg-muted/50 text-foreground" />
      <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">Confirmer le nouveau mot de passe</label>
      <Input id="confirm-password" type="password" autoComplete="new-password" required minLength={10} maxLength={256} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="min-h-11 border-border bg-muted/50 text-foreground" />
      {mismatch && <p className="text-sm text-rose-200" role="alert">Les mots de passe ne correspondent pas.</p>}
      <Button type="submit" disabled={password.length < 10 || mismatch || reset.isPending || !navigator.onLine} className="h-11 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200">{reset.isPending ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</> : "Enregistrer le mot de passe"}</Button>
      {!navigator.onLine && <p className="text-sm text-amber-200" role="status">Vous êtes hors connexion. La réinitialisation sera disponible après reconnexion.</p>}
      {reset.error && <p className="text-sm text-rose-200" role="alert">{reset.error.message} <Link href="/mot-de-passe-oublie" className="underline">Demander un nouveau lien</Link></p>}
    </form>}
  </RecoveryShell>;
}
