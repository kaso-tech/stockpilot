import { PhoneInput } from "@/components/PhoneInput";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Copy, ImageUp, KeyRound, Save } from "lucide-react";
import { companyLoginLink, normalizeCompanyCodeInput, storeCompanyCode } from "@/lib/companyCode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export default function SettingsIdentity() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data } = trpc.commerce.settings.get.useQuery(undefined, { enabled: isAdmin });
  const [form, setForm] = useState({ companyName: "", companyAddress: "", companyPhone: "", companyEmail: "", companyLogoUrl: null as string | null });
  useEffect(() => { if (data) setForm({ companyName: data.companyName ?? "", companyAddress: data.companyAddress ?? "", companyPhone: data.companyPhone ?? "", companyEmail: data.companyEmail ?? "", companyLogoUrl: data.companyLogoUrl ?? null }); }, [data]);
  const save = trpc.commerce.settings.save.useMutation({ onSuccess: () => { utils.commerce.settings.get.invalidate(); toast.success("Informations de l’entreprise enregistrées."); }, onError: error => toast.error(error.message) });
  const uploadLogo = trpc.commerce.settings.uploadLogo.useMutation({ onSuccess: result => { setForm(current => ({ ...current, companyLogoUrl: result.url })); void utils.commerce.settings.get.invalidate(); toast.success("Logo enregistré : il apparaît sur les factures et les tickets."); }, onError: error => toast.error(error.message) });
  const chooseLogo = (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) return toast.error("Choisissez une image PNG, JPEG, WEBP ou SVG.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Le logo ne doit pas dépasser 2 Mo.");
    const reader = new FileReader();
    reader.onload = () => uploadLogo.mutate({ dataUrl: String(reader.result), filename: file.name });
    reader.readAsDataURL(file);
  };
  if (!isAdmin) return <Restricted title="Informations de l’entreprise" description="Ce réglage est réservé aux administrateurs." />;
  const base = { defaultSalesAgentId: data?.defaultSalesAgentId ?? null, defaultCashierId: data?.defaultCashierId ?? null, requireSalesAgent: data?.requireSalesAgent ?? false, requireCashier: data?.requireCashier ?? false, currency: data?.currency ?? "XOF" };
  return <div className="mx-auto max-w-4xl space-y-5"><Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link><header><h1 className="text-[22px] font-bold tracking-tight text-foreground">Informations de l’entreprise</h1></header><Card><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="grid h-24 w-full shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 sm:w-40">{form.companyLogoUrl ? <img src={form.companyLogoUrl} alt="Logo de l’entreprise" className="h-full w-full object-contain p-2" /> : <ImageUp className="h-7 w-7 text-muted-foreground" />}</div><div className="min-w-0 flex-1"><h2 className="font-semibold text-foreground">Logo</h2><p className="mt-1 text-sm text-muted-foreground">Affiché sur les factures, devis et tickets. PNG, JPEG, WEBP ou SVG, 2 Mo maximum.</p><label className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 ${uploadLogo.isPending ? "pointer-events-none opacity-60" : ""}`}><ImageUp className="h-4 w-4" />{uploadLogo.isPending ? "Envoi…" : form.companyLogoUrl ? "Changer le logo" : "Ajouter un logo"}<input aria-label="Logo de l’entreprise" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={event => { chooseLogo(event.target.files?.[0]); event.target.value = ""; }} /></label></div></CardContent></Card><Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Raison sociale *"><Input value={form.companyName} onChange={event => setForm(current => ({ ...current, companyName: event.target.value }))} /></Field><Field label="Téléphone"><PhoneInput value={form.companyPhone} onChange={companyPhone => setForm(current => ({ ...current, companyPhone }))} /></Field><Field label="E-mail"><Input type="email" value={form.companyEmail} onChange={event => setForm(current => ({ ...current, companyEmail: event.target.value }))} /></Field><Field label="Adresse"><Input value={form.companyAddress} onChange={event => setForm(current => ({ ...current, companyAddress: event.target.value }))} /></Field></CardContent></Card><div className="flex justify-end"><Button onClick={() => save.mutate({ ...base, ...form })} disabled={save.isPending || !form.companyName.trim()}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button></div><CompanyCodeCard /></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</label>; }


/** Code entreprise demandé à la connexion : affiché, copiable et modifiable par l’administrateur. */
function CompanyCodeCard() {
  const utils = trpc.useUtils();
  const { data } = trpc.companyLogin.get.useQuery();
  const [draft, setDraft] = useState("");
  useEffect(() => { if (data?.code) setDraft(data.code); }, [data?.code]);
  const update = trpc.companyLogin.update.useMutation({ onSuccess: result => { storeCompanyCode(result.code); void utils.companyLogin.get.invalidate(); toast.success("Code entreprise enregistré.", { description: "Communiquez le nouveau code à votre équipe." }); }, onError: error => toast.error(error.message) });
  const link = companyLoginLink(data?.code);
  const copy = async () => { try { await navigator.clipboard.writeText(`Code entreprise : ${data?.code}\nLien de connexion : ${link}`); toast.success("Code et lien copiés."); } catch { toast.error("Copie impossible."); } };
  return <Card><CardContent className="space-y-4 p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound className="h-5 w-5" /></span><div><h2 className="font-semibold text-foreground">Code entreprise de connexion</h2><p className="mt-1 text-sm text-muted-foreground">Demandé à la connexion avec l’e-mail ou l’identifiant. Il est mémorisé sur chaque appareil après la première connexion, et le lien ci-dessous le préremplit.</p></div></div><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Input aria-label="Code entreprise" value={draft} onChange={event => setDraft(normalizeCompanyCodeInput(event.target.value))} className="font-mono text-base font-semibold uppercase tracking-wide" /><Button type="button" disabled={!draft || draft === data?.code || update.isPending} onClick={() => update.mutate({ code: draft })}><Save className="h-4 w-4" />{update.isPending ? "Enregistrement…" : "Modifier le code"}</Button></div><div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 truncate text-muted-foreground">Lien de connexion : <span className="font-medium text-foreground">{link}</span></span><Button type="button" variant="outline" size="sm" disabled={!data?.code} onClick={() => void copy()}><Copy className="h-4 w-4" />Copier le code et le lien</Button></div></CardContent></Card>;
}
