import { PhoneInput } from "@/components/PhoneInput";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Save } from "lucide-react";
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
  if (!isAdmin) return <Restricted title="Informations de l’entreprise" description="Ce réglage est réservé aux administrateurs." />;
  const base = { defaultSalesAgentId: data?.defaultSalesAgentId ?? null, defaultCashierId: data?.defaultCashierId ?? null, requireSalesAgent: data?.requireSalesAgent ?? false, requireCashier: data?.requireCashier ?? false, currency: data?.currency ?? "XOF" };
  return <div className="mx-auto max-w-4xl space-y-5"><Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link><header><h1 className="text-[22px] font-bold tracking-tight text-foreground">Informations de l’entreprise</h1></header><Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Raison sociale *"><Input value={form.companyName} onChange={event => setForm(current => ({ ...current, companyName: event.target.value }))} /></Field><Field label="Téléphone"><PhoneInput value={form.companyPhone} onChange={companyPhone => setForm(current => ({ ...current, companyPhone }))} /></Field><Field label="E-mail"><Input type="email" value={form.companyEmail} onChange={event => setForm(current => ({ ...current, companyEmail: event.target.value }))} /></Field><Field label="Adresse"><Input value={form.companyAddress} onChange={event => setForm(current => ({ ...current, companyAddress: event.target.value }))} /></Field></CardContent></Card><div className="flex justify-end"><Button onClick={() => save.mutate({ ...base, ...form })} disabled={save.isPending || !form.companyName.trim()}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button></div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</label>; }
