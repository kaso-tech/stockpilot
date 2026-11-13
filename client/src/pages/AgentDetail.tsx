import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Edit3,
  Mail,
  MessageSquare,
  Phone,
  ReceiptText,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";
import {
  AgentDialog,
  blankAgentForm,
  type AgentForm,
  type Beneficiary,
} from "./Agents";

export default function AgentDetail() {
  const [, params] = useRoute("/agents/:beneficiaryType/:id");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const beneficiaryType =
    params?.beneficiaryType === "user" ? ("user" as const) : ("agent" as const);
  const id = Number(params?.id);
  const { data, isLoading } = trpc.commerce.agents.detail.useQuery(
    { beneficiaryType, id },
    { enabled: Number.isFinite(id) && id > 0 }
  );
  const [openEdit, setOpenEdit] = useState(false);
  const [openPay, setOpenPay] = useState(false);
  const [amount, setAmount] = useState("");
  const [form, setForm] = useState<AgentForm>(blankAgentForm);
  const updateAgent = trpc.commerce.agents.update.useMutation({
    onSuccess: () => {
      utils.commerce.agents.detail.invalidate({ beneficiaryType, id });
      utils.commerce.agents.list.invalidate();
      setOpenEdit(false);
      toast.success("Agent modifié.");
    },
    onError: error => toast.error(error.message),
  });
  const updateSeller = trpc.commerce.sellers.update.useMutation({
    onSuccess: () => {
      utils.commerce.agents.detail.invalidate({ beneficiaryType, id });
      utils.commerce.sellers.list.invalidate();
      setOpenEdit(false);
      toast.success("Vendeur modifié.");
    },
    onError: error => toast.error(error.message),
  });
  const removeAgent = trpc.commerce.agents.remove.useMutation({
    onSuccess: () => {
      toast.success("Agent désactivé.");
      setLocation("/agents");
    },
    onError: error => toast.error(error.message),
  });
  const removeSeller = trpc.commerce.sellers.remove.useMutation({
    onSuccess: () => {
      toast.success("Vendeur désactivé.");
      setLocation("/agents");
    },
    onError: error => toast.error(error.message),
  });
  const pay = trpc.payroll.pay.useMutation({
    onSuccess: () => {
      utils.commerce.agents.detail.invalidate({ beneficiaryType, id });
      setOpenPay(false);
      setAmount("");
      toast.success("Paiement enregistré.");
    },
    onError: error => toast.error(error.message),
  });
  if (isLoading || !data)
    return (
      <div className="mx-auto max-w-6xl py-16 text-center text-sm text-muted-foreground">
        Chargement de la fiche agent…
      </div>
    );

  const { agent, profile, summary } = data;
  const phoneDigits = agent.phone?.replace(/\D/g, "") || "";
  const beneficiary: Beneficiary = {
    type: agent.beneficiaryType,
    id: agent.id,
    name: agent.name,
    role: agent.role,
    kind:
      agent.role === "Vendeur"
        ? "seller"
        : agent.role === "Caissier"
          ? "cashier"
          : "sales_agent",
    username: agent.username,
    email: agent.email,
    phone: agent.phone,
  };
  const openEditor = () => {
    setForm({
      name: agent.name,
      type: beneficiary.kind,
      email: agent.email || "",
      phone: agent.phone || "",
      username: agent.username || "",
      password: "",
      remunerationMode: profile?.remunerationMode ?? "commission",
      fixed: String((profile?.fixedMonthlyCents ?? 0) / 100),
      basis: profile?.commissionBasis ?? "revenue",
      rate: String((profile?.rateBasisPoints ?? 0) / 100),
    });
    setOpenEdit(true);
  };
  const submitEdit = () => {
    const remuneration = {
      remunerationMode: form.remunerationMode,
      fixedMonthlyCents:
        form.remunerationMode === "commission"
          ? 0
          : Math.round(Number(form.fixed || 0) * 100),
      commissionBasis: form.basis,
      rateBasisPoints:
        form.remunerationMode === "fixed"
          ? 0
          : Math.round(Number(form.rate || 0) * 100),
      active: true,
    };
    if (beneficiary.kind === "seller") {
      if (!form.email.trim() || !form.username.trim())
        return toast.error(
          "L’e-mail de connexion et l’identifiant interne sont requis."
        );
      return updateSeller.mutate({
        id,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        username: form.username.trim(),
        remuneration,
        ...(form.password ? { password: form.password } : {}),
      });
    }
    return updateAgent.mutate({
      id,
      name: form.name.trim(),
      type: form.type === "cashier" ? "cashier" : "sales_agent",
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      active: agent.active,
      remuneration,
    });
  };
  const remove = () => {
    if (
      window.confirm(`Désactiver ${agent.name} ? Son historique sera conservé.`)
    )
      (beneficiaryType === "user" ? removeSeller : removeAgent).mutate({ id });
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => setLocation("/agents")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux agents
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openEditor}>
            <Edit3 className="mr-2 h-4 w-4" />
            Modifier
          </Button>
          <Button
            variant="outline"
            onClick={remove}
            className="border-destructive/25 text-destructive hover:bg-destructive-soft"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </header>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex min-w-0 gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-xl font-semibold text-primary">
            {agent.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
              {agent.role}
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {agent.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="border-0 bg-muted text-muted-foreground">
                {agent.active ? "Actif" : "Désactivé"}
              </Badge>
              {agent.username && (
                <Badge className="border-0 bg-primary/10 text-primary">
                  @{agent.username}
                </Badge>
              )}
              <Badge className="border-0 bg-warning-soft text-warning">
                Solde dû : {formatCurrency(summary.dueCents)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
          <Contact
            label="Appeler"
            href={phoneDigits ? `tel:${phoneDigits}` : undefined}
            icon={<Phone className="h-4 w-4" />}
          />
          <Contact
            label="Message"
            href={phoneDigits ? `sms:${phoneDigits}` : undefined}
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <Contact
            label="E-mail"
            href={agent.email ? `mailto:${agent.email}` : undefined}
            icon={<Mail className="h-4 w-4" />}
          />
          <Button
            onClick={() => setOpenPay(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <WalletCards className="mr-2 h-4 w-4" />
            Enregistrer un paiement
          </Button>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Ventes associées"
          value={summary.salesCount}
          icon={<ReceiptText className="h-5 w-5" />}
        />
        <Metric
          label="Chiffre d’affaires"
          value={formatCurrency(summary.revenueCents)}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <Metric
          label="Commissions cumulées"
          value={formatCurrency(summary.commissionCents)}
          icon={<Banknote className="h-5 w-5" />}
        />
        <Metric
          label="Paiements cumulés"
          value={formatCurrency(summary.paidCents)}
          icon={<BriefcaseBusiness className="h-5 w-5" />}
        />
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <h2 className="font-semibold text-foreground">
              Rémunération & commissions
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Value
                label="Mode"
                value={
                  profile
                    ? {
                        fixed: "Salaire fixe",
                        commission: "Commission",
                        fixed_plus_commission: "Fixe + commission",
                      }[profile.remunerationMode]
                    : "Non configuré"
                }
              />
              <Value
                label="Fixe mensuel"
                value={formatCurrency(profile?.fixedMonthlyCents ?? 0)}
              />
              <Value
                label="Commission du mois"
                value={formatCurrency(summary.monthlyCommissionCents)}
              />
              <Value
                label="Versé ce mois"
                value={formatCurrency(summary.monthlyPaidCents)}
              />
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">
                Dernières commissions
              </p>
              <div className="mt-3 space-y-2">
                {data.commissions.length ? (
                  data.commissions.slice(0, 5).map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-muted-foreground">
                        {item.invoiceNumber} ·{" "}
                        {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                      <span className="shrink-0 font-semibold text-success">
                        {formatCurrency(item.commissionCents)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-faint">
                    Aucune commission enregistrée.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <h2 className="font-semibold text-foreground">
              Historique des paiements
            </h2>
            <div className="mt-4 space-y-3">
              {data.payments.length ? (
                data.payments.map(item => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/50 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {new Date(item.paidAt).toLocaleDateString("fr-FR")}
                      </p>
                      <p className="mt-1 truncate text-xs text-faint">
                        {item.periodLabel || "Période libre"}
                        {item.note ? ` · ${item.note}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-success">
                      {formatCurrency(item.amountCents)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-faint">Aucun paiement enregistré.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">Ventes associées</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {data.sales.length ? (
            data.sales.map(sale => (
              <button
                key={sale.id}
                type="button"
                onClick={() => setLocation(`/factures?facture=${sale.id}`)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 p-3 text-left hover:border-primary/25"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {sale.invoiceNumber}
                  </span>
                  <span className="block truncate text-xs text-faint">
                    {sale.customerName} ·{" "}
                    {new Date(sale.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-primary">
                  {formatCurrency(sale.totalCents)}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-faint">Aucune vente associée.</p>
          )}
        </div>
      </section>
      <AgentDialog
        open={openEdit}
        editing={beneficiary}
        form={form}
        setForm={setForm}
        onClose={() => setOpenEdit(false)}
        onSubmit={submitEdit}
        pending={updateAgent.isPending || updateSeller.isPending}
      />
      <Dialog open={openPay} onOpenChange={setOpenPay}>
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Paiement · {agent.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm">Montant</label>
            <Input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenPay(false)}>
              Annuler
            </Button>
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() => {
                const amountCents = Math.round(Number(amount) * 100);
                if (!amountCents)
                  return toast.error("Saisissez un montant valide.");
                pay.mutate({
                  beneficiaryType,
                  beneficiaryId: id,
                  amountCents,
                  note: null,
                });
              }}
            >
              Valider le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Contact({
  label,
  href,
  icon,
  target,
}: {
  label: string;
  href?: string;
  icon: React.ReactNode;
  target?: boolean;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="border-border text-foreground hover:border-primary/25 hover:bg-primary/5"
    >
      <a
        href={href || undefined}
        target={target ? "_blank" : undefined}
        rel={target ? "noreferrer" : undefined}
        onClick={event => {
          if (!href) {
            event.preventDefault();
            toast.error("Coordonnée non renseignée.");
          }
        }}
      >
        {icon}
        <span className="ml-2">{label}</span>
      </a>
    </Button>
  );
}
function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs text-faint">{label}</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
        </div>
        <span className="text-primary">{icon}</span>
      </CardContent>
    </Card>
  );
}
function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
