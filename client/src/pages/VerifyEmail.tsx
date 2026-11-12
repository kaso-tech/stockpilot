import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { LoaderCircle, MailCheck } from "lucide-react";
import { Link } from "wouter";
export default function VerifyEmail() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const verify = trpc.emailVerification.verify.useMutation();
  const valid = /^[A-Za-z0-9_-]{43}$/.test(token);
  return <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground"><section className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl">
    <MailCheck className="h-8 w-8 text-primary" /><h1 className="text-2xl font-semibold">Confirmer votre adresse e-mail</h1>
    {verify.isSuccess ? <p role="status">Votre adresse est vérifiée. Votre accès à l’entreprise reste inchangé.</p> : <>
      <p className="text-sm text-muted-foreground">Confirmez uniquement si vous avez demandé ce lien. Aucun paiement ou abonnement ne sera activé.</p>
      {!valid ? <p role="alert" className="text-sm text-destructive">Le lien est incomplet ou invalide.</p> : <Button disabled={!navigator.onLine || verify.isPending} onClick={() => verify.mutate({ token })} className="min-h-11 w-full">{verify.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}{verify.isPending ? "Vérification…" : "Confirmer mon adresse"}</Button>}
      {verify.error && <p role="alert" className="text-sm text-destructive">{verify.error.message}</p>}
    </>}
    <Link href="/" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">Retour à StockPilot</Link>
  </section></main>;
}
