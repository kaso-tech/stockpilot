import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { useOffline } from "@/contexts/OfflineContext";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Download, Lock, WalletCards, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Restricted } from "./AuditLog";
const METHOD_LABELS: Record<string, string> = { cash: "Espèces", card: "Carte", mobile_money: "Mobile money", bank_transfer: "Virement", credit: "Crédit client" };
function localDay(date: Date) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Abidjan", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); const values = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; }
function toInternalAmount(value: string) { const number = Number(value.replace(/\s/g, "").replace(",", ".")); return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : 0; }
function toUserAmount(value: string) { const number = Number(value.replace(/\s/g, "").replace(",", ".")); return Number.isFinite(number) && number >= 0 ? Math.round(number) * 100 : 0; }
function monthStart() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`; }
function CashClosure({ warehouseId, isOnline }: { warehouseId: number; isOnline: boolean }) {
  const utils = trpc.useUtils();
  const [businessDay, setBusinessDay] = useState("");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const input = useMemo(() => businessDay ? ({ warehouseId, businessDay }) : ({ warehouseId }), [warehouseId, businessDay]);
  const summaryQuery = trpc.accounting.cash.summary.useQuery(input, { enabled: isOnline });
  const historyQuery = trpc.accounting.cash.history.useQuery({ warehouseId }, { enabled: isOnline });
  const summary = summaryQuery.data;
  const today = summary?.currentBusinessDay ?? localDay(new Date());
  const history = historyQuery.data ?? [];
  const close = trpc.accounting.cash.close.useMutation({ onSuccess: result => { toast.success(result.differenceCents === 0 ? "Caisse clôturée sans écart." : `Caisse clôturée : écart de ${formatCurrency(result.differenceCents)}.`); void utils.accounting.cash.summary.invalidate(); void utils.accounting.cash.history.invalidate(); }, onError: error => toast.error(error.message) });
  const expected = toUserAmount(openingFloat) + (summary?.totals.cash ?? 0);
  const cashCounted = toUserAmount(counted);
  return <Card className="border-border bg-card text-foreground"><CardContent className="space-y-5 p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold">Clôture de caisse (Z)</h2><p className="mt-1 text-sm text-muted-foreground">Encaissements nets des remboursements · par entrepôt</p></div><label className="text-xs text-muted-foreground">Journée métier<Input type="date" aria-label="Journée métier" value={businessDay} max={today} onChange={event => setBusinessDay(event.target.value)} className="mt-1 w-44 border-border bg-card text-foreground" /></label></div>
    {!isOnline && <p role="status" className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3 text-sm text-amber-200"><WifiOff className="h-4 w-4 shrink-0" />Les données en cache restent consultables, mais la clôture est désactivée hors connexion. Reconnectez-vous pour charger le dernier état serveur.</p>}
    {summaryQuery.isLoading && isOnline && <p role="status" className="text-sm text-muted-foreground">Chargement du résumé de la journée…</p>}
    {summaryQuery.error && isOnline && <p role="alert" className="text-sm text-destructive">{summaryQuery.error.message}</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{Object.entries(summary?.totals ?? { cash: 0, card: 0, mobile_money: 0, bank_transfer: 0, credit: 0 }).map(([method, cents]) => <div key={method} className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">{METHOD_LABELS[method] ?? method}</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(cents)}</p></div>)}</div>
    {summary?.closure ? <p className="flex items-start gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] p-3 text-sm text-emerald-200"><Lock className="mt-0.5 h-4 w-4 shrink-0" /><span>Journée clôturée le {formatDate(summary.closure.closedAt, true)} : attendu {formatCurrency(summary.closure.expectedCashCents)}, compté {formatCurrency(summary.closure.countedCashCents)}, écart {formatCurrency(summary.closure.differenceCents)}. Cette clôture est immuable.</span></p> : <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => { event.preventDefault(); if (!isOnline || counted === "") return; close.mutate({ warehouseId, businessDay, openingFloatCents: toInternalAmount(openingFloat), countedCashCents: toInternalAmount(counted), note: note.trim() || null }); }}>
      <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Fond de caisse (XOF)</span><Input inputMode="numeric" pattern="[0-9 ]*" value={openingFloat} onChange={event => setOpeningFloat(event.target.value)} className="border-border bg-card" /></label>
      <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Espèces comptées (XOF)</span><Input inputMode="numeric" pattern="[0-9 ]*" value={counted} onChange={event => setCounted(event.target.value)} required className="border-border bg-card" /></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block text-xs text-muted-foreground">Commentaire facultatif</span><Input value={note} maxLength={500} onChange={event => setNote(event.target.value)} className="border-border bg-card" /></label>
      <p aria-live="polite" className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">Espèces attendues : <strong>{formatCurrency(expected)}</strong>{counted !== "" && <> · écart prévisionnel : <strong>{formatCurrency(cashCounted - expected)}</strong></>}</p>
      <Button type="submit" disabled={!isOnline || !summary || counted === "" || close.isPending} className="min-h-11"><Lock className="mr-2 h-4 w-4" />{close.isPending ? "Clôture…" : "Clôturer la journée"}</Button>
    </form>}
    {history.length > 0 && <section aria-labelledby="cash-history-title"><h3 id="cash-history-title" className="mb-2 text-sm font-medium">Dernières clôtures de cet entrepôt</h3><ul className="space-y-2 text-sm text-muted-foreground">{history.slice(0, 10).map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 border-t border-border py-2"><span>{item.businessDay} · {item.documentCount} document(s)</span><span className={item.differenceCents === 0 ? "text-success" : "text-amber-200"}>écart {formatCurrency(item.differenceCents)}</span></li>)}</ul></section>}
  </CardContent></Card>;
}
function Exports({ warehouseId, isOnline }: { warehouseId: number; isOnline: boolean }) {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(localDay(new Date()));
  const [referential, setReferential] = useState<"pcg" | "syscohada">("syscohada");
  const exportFile = trpc.accounting.export.useMutation({ onSuccess: file => { const url = URL.createObjectURL(new Blob([file.content], { type: `${file.mimeType};charset=utf-8` })); const link = document.createElement("a"); link.href = url; link.download = file.filename; link.rel = "noopener"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); toast.success(`${file.filename} téléchargé.`); }, onError: error => toast.error(error.message) });
  const run = (format: "sales_csv" | "payments_csv" | "fec") => { if (isOnline) exportFile.mutate({ warehouseId, from, to, format, referential }); };
  return <Card className="border-border bg-card text-foreground"><CardContent className="space-y-4 p-4 sm:p-6"><div><h2 className="font-semibold">Exports comptables</h2><p className="mt-1 text-sm text-muted-foreground">Journaux indicatifs (ventes, encaissements et écritures FEC).</p></div>
    <div role="note" className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3 text-xs leading-relaxed text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Ces fichiers sont une aide de rapprochement uniquement. Le mapping PCG/SYSCOHADA, les taxes et les écritures ne garantissent pas la conformité fiscale ou comptable. Faites valider le format et le traitement par un professionnel habilité dans votre juridiction. Devise exportée : XOF.</span></div>
    {!isOnline && <p role="status" className="flex items-center gap-2 text-sm text-amber-200"><WifiOff className="h-4 w-4" />Les données comptables en cache peuvent rester visibles, mais la génération d’exports nécessite une connexion.</p>}
    <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Du</span><Input type="date" value={from} onChange={event => setFrom(event.target.value)} className="border-border bg-card" /></label><label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Au</span><Input type="date" value={to} onChange={event => setTo(event.target.value)} className="border-border bg-card" /></label><label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Référentiel de comptes (indicatif)</span><select value={referential} onChange={event => setReferential(event.target.value as "pcg" | "syscohada")} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><option value="syscohada">SYSCOHADA (indicatif)</option><option value="pcg">PCG France (indicatif)</option></select></label></div>
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><Button variant="outline" disabled={!isOnline || exportFile.isPending || !from || !to || from > to} onClick={() => run("sales_csv")} className="min-h-11 justify-start border-border bg-transparent text-foreground"><Download className="mr-2 h-4 w-4" />Journal des ventes · CSV</Button><Button variant="outline" disabled={!isOnline || exportFile.isPending || !from || !to || from > to} onClick={() => run("payments_csv")} className="min-h-11 justify-start border-border bg-transparent text-foreground"><Download className="mr-2 h-4 w-4" />Journal des encaissements · CSV</Button><Button variant="outline" disabled={!isOnline || exportFile.isPending || !from || !to || from > to} onClick={() => run("fec")} className="min-h-11 justify-start border-border bg-transparent text-foreground"><Download className="mr-2 h-4 w-4" />Écritures FEC · TXT</Button></div>
  </CardContent></Card>;
}
/** Clôture tenant/entrepôt et exports; aucune mutation critique en mode hors connexion. */
export default function Accounting() {
  const { can } = usePermissions();
  const { activeWarehouseId, activeWarehouse, isReady } = useActiveWarehouse();
  const { isOnline } = useOffline();
  if (!can("cash.close") && !can("accounting.export")) return <Restricted title="Caisse & comptabilité" description="Cette page est réservée aux rôles autorisés à clôturer la caisse ou à exporter la comptabilité." />;
  return <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6"><header className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><WalletCards className="h-5 w-5" /></span><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Finance</p><h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">Caisse & comptabilité</h1><p className="mt-1 text-sm text-muted-foreground">{activeWarehouse?.name ? `Entrepôt : ${activeWarehouse.name}` : "Sélectionnez un entrepôt actif pour consulter les données."}</p></div></header>
    {!isReady || !activeWarehouseId ? <Card className="border-border bg-card"><CardContent className="p-5 text-sm text-muted-foreground" role="status">{!isReady ? "Vérification de l’entrepôt actif…" : "Aucun entrepôt actif. Sélectionnez un entrepôt autorisé dans le menu pour continuer."}</CardContent></Card> : <>{can("cash.close") && <CashClosure warehouseId={activeWarehouseId} isOnline={isOnline} />}{can("accounting.export") && <Exports warehouseId={activeWarehouseId} isOnline={isOnline} />}</>}
  </div>;
}
