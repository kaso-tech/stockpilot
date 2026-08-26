import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ExternalLink, FileImage, LifeBuoy, Loader2, Paperclip, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import LegalPage from "./LegalPage";

type PendingScreenshot = { dataUrl: string; filename: string };

function readScreenshot(file?: File) {
  return new Promise<PendingScreenshot | null>(resolve => {
    if (!file) return resolve(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { toast.error("La capture doit être une image PNG, JPEG ou WEBP."); return resolve(null); }
    if (file.size > 3 * 1024 * 1024) { toast.error("La capture ne doit pas dépasser 3 Mo."); return resolve(null); }
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: String(reader.result), filename: file.name });
    reader.onerror = () => { toast.error("La capture n’a pas pu être lue."); resolve(null); };
    reader.readAsDataURL(file);
  });
}

export default function ContactUs() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<PendingScreenshot | null>(null);
  const { data: requests = [] } = trpc.support.mine.useQuery(undefined, { enabled: Boolean(user) });
  const create = trpc.support.create.useMutation({
    onSuccess: () => { setSubject(""); setMessage(""); setScreenshot(null); utils.support.mine.invalidate(); toast.success("Votre demande d’assistance a été enregistrée."); },
    onError: error => toast.error(error.message),
  });

  const submit = () => {
    if (subject.trim().length < 4 || message.trim().length < 10) { toast.error("Renseignez un sujet et un message suffisamment détaillés."); return; }
    create.mutate({ subject: subject.trim(), message: message.trim(), screenshot: screenshot ?? undefined });
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#080c14]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <LegalPage title="Contactez-nous" updatedAt="26 août 2026" sections={[
    { title: "Assistance sécurisée", content: "Connectez-vous à votre espace StockPilot Pro pour créer une demande d’assistance sécurisée et joindre une capture d’écran. Cette connexion permet de cloisonner chaque demande à votre entreprise." },
    { title: "Préparer votre demande", content: "Précisez le sujet, l’entrepôt concerné, la référence d’un document et le message rencontré. Ne transmettez jamais de mot de passe, de code secret ou de clé d’accès." },
  ]} />;

  return <main className="min-h-screen bg-[#080c14] px-4 py-8 text-slate-100 sm:px-6"><div className="mx-auto max-w-5xl space-y-6"><button onClick={() => setLocation("/")} className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" />Retour à StockPilot</button><header className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#111722] p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><LifeBuoy className="h-5 w-5" /></span><div><h1 className="text-2xl font-semibold text-white">Contactez-nous</h1></div></div>{isAdmin && <Button variant="outline" onClick={() => setLocation("/support")} className="border-primary/30 text-primary hover:bg-primary/10">Registre des demandes</Button>}</header><div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><Card className="border-white/[0.08] bg-[#111722]"><CardContent className="p-6"><div className="mb-5 flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><p className="text-sm leading-6 text-slate-400">Décrivez le contexte sans inclure de mot de passe, code secret ou donnée bancaire. La capture est facultative et réservée aux formats image.</p></div><div className="grid gap-4"><label className="grid gap-2 text-sm font-medium"><span>Sujet</span><Input maxLength={180} value={subject} onChange={event => setSubject(event.target.value)} placeholder="Ex. Écart de stock après un transfert" /></label><label className="grid gap-2 text-sm font-medium"><span>Votre demande</span><Textarea maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} className="min-h-36 resize-y" placeholder="Décrivez les étapes, l’entrepôt concerné et le résultat attendu…" /></label><div className="rounded-xl border border-dashed border-primary/35 bg-primary/[0.04] p-4"><label className="flex cursor-pointer items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><FileImage className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Joindre une capture</span><span className="mt-0.5 block truncate text-xs text-slate-500">{screenshot?.filename || "PNG, JPEG ou WEBP · 3 Mo max."}</span></span><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async event => setScreenshot(await readScreenshot(event.target.files?.[0]))} /></label>{screenshot && <Button type="button" variant="ghost" size="sm" onClick={() => setScreenshot(null)} className="mt-2 h-7 px-0 text-xs text-slate-400">Retirer la capture</Button>}</div><Button onClick={submit} disabled={create.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{create.isPending ? "Envoi sécurisé…" : "Envoyer la demande"}</Button></div></CardContent></Card><Card className="border-white/[0.08] bg-[#111722]"><CardContent className="p-6"><p className="font-semibold text-white">Mes demandes</p><div className="mt-4 space-y-3">{requests.length ? requests.map(request => <article key={request.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-3"><p className="font-medium text-slate-100">{request.subject}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${request.status === "closed" ? "bg-emerald-400/10 text-emerald-300" : request.status === "in_progress" ? "bg-primary/10 text-primary" : "bg-amber-400/10 text-amber-300"}`}>{request.status === "closed" ? "Clôturée" : request.status === "in_progress" ? "En cours" : "Ouverte"}</span></div><p className="mt-2 line-clamp-2 text-sm text-slate-400">{request.message}</p><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{new Date(request.createdAt).toLocaleDateString("fr-FR")}</span>{request.attachmentUrl && <a href={request.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Paperclip className="h-3 w-3" />Capture<ExternalLink className="h-3 w-3" /></a>}</div></article>) : <div className="rounded-xl border border-dashed border-white/[0.1] px-4 py-10 text-center text-sm text-slate-500">Aucune demande enregistrée.</div>}</div></CardContent></Card></div></div></main>;
}
