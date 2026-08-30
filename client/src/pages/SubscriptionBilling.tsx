import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, CircleAlert, CreditCard, ExternalLink, Loader2, ReceiptText, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatXof(amountCents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(amountCents);
}

export default function SubscriptionBilling() {
  const billing = trpc.subscriptionBilling.current.useQuery();
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const checkout = trpc.subscriptionBilling.createCheckout.useMutation({
    onSuccess: payment => {
      setRequestKey(null);
      if (!payment.checkoutUrl) {
        toast.message("La demande est déjà en cours de préparation. Actualisez l’état avant de recommencer.");
        return;
      }
      window.location.assign(payment.checkoutUrl);
    },
    onError: error => {
      setRequestKey(null);
      toast.error(error.message);
    },
  });

  const startCheckout = (planId: number) => {
    const key = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setRequestKey(key);
    checkout.mutate({ planId, requestKey: key });
  };

  if (billing.isLoading) {
    return <div className="mx-auto max-w-5xl space-y-5"><div className="h-9 w-64 animate-pulse rounded-lg bg-muted" /><div className="h-60 animate-pulse rounded-2xl bg-muted" /></div>;
  }

  if (billing.error) {
    return <Alert className="mx-auto max-w-2xl border-destructive/30 bg-destructive/10 text-foreground"><CircleAlert className="h-4 w-4 text-destructive" /><AlertTitle>Abonnement indisponible</AlertTitle><AlertDescription>Cette section est réservée au propriétaire de l’entreprise. Si vous êtes le propriétaire, reconnectez-vous puis réessayez.</AlertDescription></Alert>;
  }

  const activeIntent = billing.data?.intents.find(intent => intent.status === "pending");
  return <div className="mx-auto max-w-5xl space-y-6">
    <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><div className="mb-3 flex items-center gap-2"><Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Paiement SANDBOX</Badge>{billing.data?.subscription?.status && <Badge variant="outline">Statut : {billing.data.subscription.status}</Badge>}</div><h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Abonnement de votre entreprise</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choisissez votre offre. Le checkout est ouvert chez YengaPay et l’abonnement n’est activé qu’après confirmation serveur du paiement.</p></div><div className="flex items-center gap-2 rounded-2xl border border-border bg-background/75 px-4 py-3 text-sm"><CreditCard className="h-4 w-4 text-primary" /><span>FCFA · mensuel</span></div></div>
    </section>

    {activeIntent && <Alert className="border-amber-500/30 bg-amber-500/10 text-foreground"><ReceiptText className="h-4 w-4 text-amber-600" /><AlertTitle>Paiement en attente</AlertTitle><AlertDescription>Un checkout est déjà en cours pour {formatXof(activeIntent.amountCents)}. Terminez-le chez YengaPay ; l’état se mettra à jour après confirmation sécurisée.</AlertDescription></Alert>}

    <section className="grid gap-5 md:grid-cols-2">{billing.data?.plans.map(plan => <Card key={plan.id} className="border-border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{plan.name}</span><Badge className="bg-primary text-primary-foreground hover:bg-primary">{formatXof(plan.priceCents)} · {plan.billingInterval === "monthly" ? "mois" : plan.billingInterval === "annual" ? "an" : "à vie"}</Badge></CardTitle><CardDescription>{plan.description || "Offre d’abonnement StockPilot."}</CardDescription></CardHeader><CardContent className="space-y-5"><div className="rounded-xl bg-muted/60 px-4 py-3 text-sm"><p className="font-medium">Essai de {plan.trialDays} jour{plan.trialDays > 1 ? "s" : ""}</p><p className="mt-1 text-muted-foreground">Le paiement est traité sur la page sécurisée du prestataire.</p></div><Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={checkout.isPending || Boolean(activeIntent) || plan.billingInterval !== "monthly"} onClick={() => startCheckout(plan.id)}>{checkout.isPending && requestKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}{checkout.isPending ? "Ouverture sécurisée…" : activeIntent ? "Paiement en attente" : plan.billingInterval !== "monthly" ? "Paiement à configurer" : "Payer avec YengaPay"}</Button></CardContent></Card>)}</section>

    <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><p>La redirection de retour ne suffit pas à valider le paiement. StockPilot attend une notification signée et rapproche l’intention avant toute mise à jour de l’abonnement.</p></div></section>
  </div>;
}
