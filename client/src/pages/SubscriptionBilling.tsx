import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, CircleAlert, CreditCard, Download, ExternalLink, Loader2, ReceiptText, ShieldCheck, Trash2 } from "lucide-react";
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
  const exportTenant = trpc.subscriptionBilling.exportTenantData.useMutation({
    onSuccess: payload => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `stockpilot-export-${payload.companyId}-${payload.exportedAt.slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Export JSON prêt. Les identifiants et secrets ont été exclus.");
    },
    onError: error => toast.error(error.message),
  });
  const [deletionPreview, setDeletionPreview] = useState<{ totalRecords: number; counts: Record<string, number>; deletionEnabled: false; blockers: string[] } | null>(null);
  const previewDeletion = trpc.subscriptionBilling.previewTenantDeletion.useMutation({
    onSuccess: preview => {
      setDeletionPreview(preview);
      toast.message("Simulation terminée : aucune donnée n’a été supprimée.");
    },
    onError: error => toast.error(error.message),
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
  const checkoutEnabled = billing.data?.checkoutEnabled === true;
  return <div className="mx-auto max-w-5xl space-y-6">
    <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><div className="mb-3 flex items-center gap-2"><Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Paiement SANDBOX</Badge>{billing.data?.subscription?.status && <Badge variant="outline">Statut : {billing.data.subscription.status}</Badge>}</div><h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Abonnement de votre entreprise</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choisissez votre offre. Le checkout est ouvert chez YengaPay et l’abonnement n’est activé qu’après confirmation serveur du paiement.</p></div><div className="flex items-center gap-2 rounded-2xl border border-border bg-background/75 px-4 py-3 text-sm"><CreditCard className="h-4 w-4 text-primary" /><span>FCFA · mensuel</span></div></div>
    </section>

    {activeIntent && <Alert className="border-amber-500/30 bg-amber-500/10 text-foreground"><ReceiptText className="h-4 w-4 text-amber-600" /><AlertTitle>Paiement en attente</AlertTitle><AlertDescription>Un checkout est déjà en cours pour {formatXof(activeIntent.amountCents)}. Terminez-le chez YengaPay ; l’état se mettra à jour après confirmation sécurisée.</AlertDescription></Alert>}
    {!checkoutEnabled && <Alert className="border-amber-500/30 bg-amber-500/10 text-foreground"><CircleAlert className="h-4 w-4 text-amber-600" /><AlertTitle>Intégration YengaPay en pause</AlertTitle><AlertDescription>Aucun checkout, paiement ni abonnement SANDBOX ne peut être créé pendant la validation technique. Les offres restent consultables.</AlertDescription></Alert>}

    <section className="grid gap-5 md:grid-cols-2">{billing.data?.plans.map(plan => <Card key={plan.id} className="border-border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{plan.name}</span><Badge className="bg-primary text-primary-foreground hover:bg-primary">{formatXof(plan.priceCents)} · {plan.billingInterval === "monthly" ? "mois" : plan.billingInterval === "annual" ? "an" : "à vie"}</Badge></CardTitle><CardDescription>{plan.description || "Offre d’abonnement StockPilot."}</CardDescription></CardHeader><CardContent className="space-y-5"><div className="rounded-xl bg-muted/60 px-4 py-3 text-sm"><p className="font-medium">Essai de {plan.trialDays} jour{plan.trialDays > 1 ? "s" : ""}</p><p className="mt-1 text-muted-foreground">Le paiement est traité sur la page sécurisée du prestataire.</p></div><Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={!checkoutEnabled || checkout.isPending || Boolean(activeIntent) || plan.billingInterval !== "monthly"} onClick={() => startCheckout(plan.id)}>{checkout.isPending && requestKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}{!checkoutEnabled ? "Intégration en pause" : checkout.isPending ? "Ouverture sécurisée…" : activeIntent ? "Paiement en attente" : plan.billingInterval !== "monthly" ? "Paiement à configurer" : "Payer avec YengaPay"}</Button></CardContent></Card>)}</section>

    <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><p>La redirection de retour ne suffit pas à valider le paiement. StockPilot attend une notification signée et rapproche l’intention avant toute mise à jour de l’abonnement.</p></div></section>

    <section className="grid gap-5 md:grid-cols-2" aria-label="Données de l’entreprise">
      <Card className="border-border bg-card text-card-foreground">
        <CardHeader><CardTitle className="text-base">Exporter mes données</CardTitle><CardDescription>Prépare un export JSON limité à votre entreprise. Les empreintes, identifiants de connexion et jetons sont retirés.</CardDescription></CardHeader>
        <CardContent><Button className="min-h-11 w-full" variant="outline" disabled={exportTenant.isPending} onClick={() => exportTenant.mutate()}>{exportTenant.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Télécharger l’export JSON</Button></CardContent>
      </Card>
      <Card className="border-amber-600/30 bg-card text-card-foreground">
        <CardHeader><CardTitle className="text-base">Simulation de suppression</CardTitle><CardDescription>L’effacement réel reste désactivé tant que la conservation légale et la possibilité de restauration ne sont pas confirmées.</CardDescription></CardHeader>
        <CardContent className="space-y-3"><Button className="min-h-11 w-full border-amber-700 text-amber-900 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-200 dark:hover:bg-amber-950" variant="outline" disabled={previewDeletion.isPending} onClick={() => previewDeletion.mutate()}>{previewDeletion.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Prévisualiser — sans suppression</Button>{deletionPreview && <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm" role="status"><p className="font-medium text-foreground">Simulation uniquement · {deletionPreview.totalRecords} enregistrements comptabilisés</p><p className="mt-1 text-muted-foreground">La suppression réelle n’est pas disponible. À vérifier :</p><ul className="mt-1 list-inside list-disc text-muted-foreground">{deletionPreview.blockers.map(item => <li key={item}>{item}</li>)}</ul></div>}</CardContent>
      </Card>
    </section>
  </div>;
}
