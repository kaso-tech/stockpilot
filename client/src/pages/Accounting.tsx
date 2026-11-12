import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Download, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Restricted } from "./AuditLog";

const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  mobile_money: "Mobile money",
  bank_transfer: "Virement",
  credit: "Crédit client",
};
const toCents = (value: string) =>
  Math.max(0, Math.round((Number(value.replace(",", ".")) || 0) * 100));
const monthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString(
    "en-CA"
  );
};

/** Clôture de caisse quotidienne et exports comptables (9.5). */
export default function Accounting() {
  const { can } = usePermissions();
  if (!can("cash.close") && !can("accounting.export"))
    return (
      <Restricted
        title="Caisse & comptabilité"
        description="Cette page est réservée aux rôles autorisés à clôturer la caisse ou à exporter la comptabilité."
      />
    );
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
          Finance
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Caisse & comptabilité</h1>
      </header>
      {can("cash.close") && <CashClosure />}
      {can("accounting.export") && <Exports />}
    </div>
  );
}

function CashClosure() {
  const utils = trpc.useUtils();
  const [businessDay, setBusinessDay] = useState(() =>
    new Date().toLocaleDateString("en-CA")
  );
  const [openingFloat, setOpeningFloat] = useState("0");
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const { data: summary } = trpc.accounting.cash.summary.useQuery({
    businessDay,
  });
  const { data: history = [] } = trpc.accounting.cash.history.useQuery();
  const close = trpc.accounting.cash.close.useMutation({
    onSuccess: result => {
      toast.success(
        result.differenceCents === 0
          ? "Caisse clôturée sans écart."
          : `Caisse clôturée : écart de ${formatCurrency(result.differenceCents)}.`
      );
      utils.accounting.cash.summary.invalidate();
      utils.accounting.cash.history.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const expected = toCents(openingFloat) + (summary?.totals.cash ?? 0);
  return (
    <Card className="border-border bg-card">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Clôture de caisse (Z)</h2>
            <p className="text-sm text-muted-foreground">
              Encaissements de la journée par moyen de paiement, remboursements
              déduits.
            </p>
          </div>
          <Input
            type="date"
            aria-label="Journée"
            value={businessDay}
            onChange={event => setBusinessDay(event.target.value)}
            className="w-44"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          {Object.entries(summary?.totals ?? {}).map(([method, cents]) => (
            <div key={method} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {METHOD_LABELS[method] ?? method}
              </p>
              <p className="mt-1 font-semibold">{formatCurrency(cents)}</p>
            </div>
          ))}
        </div>
        {summary?.closure ? (
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <Lock className="h-4 w-4" />
            Journée clôturée le {formatDate(summary.closure.closedAt, true)} :
            attendu {formatCurrency(summary.closure.expectedCashCents)}, compté{" "}
            {formatCurrency(summary.closure.countedCashCents)}, écart{" "}
            {formatCurrency(summary.closure.differenceCents)}.
          </p>
        ) : (
          <form
            className="grid gap-3 sm:grid-cols-4"
            onSubmit={event => {
              event.preventDefault();
              close.mutate({
                businessDay,
                openingFloatCents: toCents(openingFloat),
                countedCashCents: toCents(counted),
                note: note.trim() || null,
              });
            }}
          >
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                Fond de caisse
              </span>
              <Input
                inputMode="decimal"
                value={openingFloat}
                onChange={event => setOpeningFloat(event.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                Espèces comptées
              </span>
              <Input
                inputMode="decimal"
                value={counted}
                onChange={event => setCounted(event.target.value)}
                required
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">
                Commentaire
              </span>
              <Input
                value={note}
                maxLength={500}
                onChange={event => setNote(event.target.value)}
              />
            </label>
            <p className="text-sm sm:col-span-3">
              Espèces attendues : <strong>{formatCurrency(expected)}</strong>
              {counted !== "" && (
                <>
                  {" "}
                  · écart :{" "}
                  <strong>{formatCurrency(toCents(counted) - expected)}</strong>
                </>
              )}
            </p>
            <Button type="submit" disabled={counted === "" || close.isPending}>
              {close.isPending ? "Clôture…" : "Clôturer la journée"}
            </Button>
          </form>
        )}
        {history.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Dernières clôtures</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {history.slice(0, 10).map(item => (
                <li
                  key={item.id}
                  className="flex flex-wrap justify-between gap-2"
                >
                  <span>
                    {item.businessDay} · {item.documentCount} document(s)
                  </span>
                  <span
                    className={
                      item.differenceCents === 0
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }
                  >
                    écart {formatCurrency(item.differenceCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Exports() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [referential, setReferential] = useState<"pcg" | "syscohada">(
    "syscohada"
  );
  const exportFile = trpc.accounting.export.useMutation({
    onSuccess: file => {
      const url = URL.createObjectURL(
        new Blob([file.content], { type: `${file.mimeType};charset=utf-8` })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${file.filename} téléchargé.`);
    },
    onError: error => toast.error(error.message),
  });
  const run = (format: "sales_csv" | "payments_csv" | "fec") =>
    exportFile.mutate({ from, to, format, referential });
  return (
    <Card className="border-border bg-card">
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold">Exports comptables</h2>
          <p className="text-sm text-muted-foreground">
            Journaux au format tableur et fichier des écritures comptables (FEC)
            pour votre expert-comptable.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Du</span>
            <Input
              type="date"
              value={from}
              onChange={event => setFrom(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Au</span>
            <Input
              type="date"
              value={to}
              onChange={event => setTo(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">
              Plan comptable
            </span>
            <select
              value={referential}
              onChange={event =>
                setReferential(event.target.value as "pcg" | "syscohada")
              }
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="syscohada">SYSCOHADA (OHADA)</option>
              <option value="pcg">Plan comptable général (France)</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={exportFile.isPending}
            onClick={() => run("sales_csv")}
          >
            <Download className="mr-2 h-4 w-4" />
            Journal des ventes (CSV)
          </Button>
          <Button
            variant="outline"
            disabled={exportFile.isPending}
            onClick={() => run("payments_csv")}
          >
            <Download className="mr-2 h-4 w-4" />
            Journal des encaissements (CSV)
          </Button>
          <Button
            variant="outline"
            disabled={exportFile.isPending}
            onClick={() => run("fec")}
          >
            <Download className="mr-2 h-4 w-4" />
            Écritures comptables (FEC)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
