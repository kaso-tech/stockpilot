import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { toast } from "sonner";

export function EmailVerificationCard() {
  const status = trpc.emailVerification.status.useQuery();
  const request = trpc.emailVerification.request.useMutation({
    onSuccess: () => toast.success("E-mail de vérification envoyé. Le lien est valable 24 heures."),
    onError: error => toast.error(error.message),
  });
  return <Card className="border-border bg-card text-card-foreground gap-0 py-0"><CardContent className="space-y-3 p-5">
    <div className="flex items-center gap-2 font-semibold">{status.data?.verifiedAt ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Mail className="h-5 w-5 text-primary" />}Vérification de l’adresse e-mail</div>
    <p className="text-sm text-muted-foreground">{status.data?.verifiedAt ? "Votre adresse e-mail est vérifiée." : "La vérification est facultative et ne bloque pas votre accès actuel."}</p>
    {!status.data?.verifiedAt && <Button disabled={status.isLoading || request.isPending || !status.data?.available || !navigator.onLine} onClick={() => request.mutate()}>
      {request.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}{request.isPending ? "Envoi…" : "Recevoir un lien de vérification"}
    </Button>}
    {status.data && !status.data.available && !status.data.verifiedAt && <p className="text-xs text-muted-foreground">Le service e-mail doit être configuré avant de pouvoir envoyer un lien.</p>}
    {status.error && <p role="alert" className="text-sm text-destructive">La vérification n’a pas pu être chargée. Votre accès reste inchangé.</p>}
  </CardContent></Card>;
}
