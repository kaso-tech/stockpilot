import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ExternalLink, FileImage, Loader2, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const statusLabels = { open: "Ouverte", in_progress: "En cours", closed: "Clôturée" } as const;

export default function SupportRequests() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<"open" | "in_progress" | "closed" | "all">("open");
  const { data: requests = [], isLoading: loadingRequests } = trpc.support.adminList.useQuery(status === "all" ? {} : { status }, { enabled: user?.role === "admin" });
  const update = trpc.support.updateStatus.useMutation({ onSuccess: () => { utils.support.adminList.invalidate(); toast.success("Statut de la demande mis à jour."); }, onError: error => toast.error(error.message) });
  useEffect(() => { if (!loading && user?.role !== "admin") setLocation("/contactez-nous"); }, [loading, setLocation, user?.role]);
  if (loading) return <div className="grid min-h-screen place-items-center bg-card"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (user?.role !== "admin") return null;
  return <main className="min-h-screen bg-card px-4 py-8 text-foreground sm:px-6"><div className="mx-auto max-w-5xl space-y-6"><button onClick={() => setLocation("/contactez-nous")} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" />Retour au contact</button><header className="rounded-xl border border-border bg-card p-6"><h1 className="text-[22px] font-bold tracking-tight text-foreground">Demandes d’assistance</h1></header><div className="flex flex-wrap gap-2">{(["open", "in_progress", "closed", "all"] as const).map(value => <Button key={value} size="sm" variant={status === value ? "default" : "outline"} onClick={() => setStatus(value)} className={status === value ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground"}>{value === "all" ? "Toutes" : statusLabels[value]}</Button>)}</div><Card className="border-border bg-card gap-0 py-0"><CardContent className="p-0">{loadingRequests ? <div className="grid min-h-52 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : requests.length ? <div className="divide-y divide-border">{requests.map(request => <article key={request.id} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{request.subject}</p><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{statusLabels[request.status]}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{request.message}</p><div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-faint"><span>Créée le {new Date(request.createdAt).toLocaleString("fr-FR")}</span>{request.attachmentUrl && <a href={request.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><FileImage className="h-3.5 w-3.5" />{request.attachmentName || "Capture"}<ExternalLink className="h-3 w-3" /></a>}</div></div><select value={request.status} disabled={update.isPending} onChange={event => update.mutate({ id: request.id, status: event.target.value as "open" | "in_progress" | "closed" })} className="h-9 rounded-md border border-border bg-muted/50 px-2 text-sm text-foreground outline-none focus:border-primary"><option value="open" className="bg-background">Ouverte</option><option value="in_progress" className="bg-background">En cours</option><option value="closed" className="bg-background">Clôturée</option></select></div></article>)}</div> : <div className="grid min-h-52 place-items-center text-sm text-faint"><div className="text-center"><Paperclip className="mx-auto h-5 w-5" /><p className="mt-2">Aucune demande dans ce statut.</p></div></div>}</CardContent></Card></div></main>;
}
