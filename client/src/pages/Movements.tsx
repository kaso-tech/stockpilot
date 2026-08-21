import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatSignedQuantity, movementLabels } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type MovementType = "entry" | "exit" | "adjustment";

export default function Movements() {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const { data: movements = [], isLoading } = trpc.movements.list.useQuery();
  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState("none");
  const [type, setType] = useState<MovementType>("entry");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const selectedProduct = products.find(product => product.id === Number(productId));

  const createMovement = trpc.movements.create.useMutation({
    onSuccess: () => {
      utils.movements.list.invalidate();
      utils.products.list.invalidate();
      utils.dashboard.get.invalidate();
      setQuantity("");
      setReason("");
      toast.success("Mouvement enregistré.");
    },
  });

  const submit = () => {
    if (!productId || !quantity || !reason) {
      toast.error("Sélectionnez un produit, une quantité et un motif.");
      return;
    }
    createMovement.mutate({
      productId: Number(productId),
      supplierId: supplierId === "none" ? null : Number(supplierId),
      type,
      quantity: Number(quantity),
      reason,
    }, { onError: error => toast.error(error.message) });
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">Opérations</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Mouvements de stock</h1>
        <p className="mt-1.5 text-sm text-slate-400">Enregistrez chaque entrée, sortie ou correction pour préserver la traçabilité.</p>
      </header>

      <section className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <Card className="h-fit border-white/[0.07] bg-[#111722] shadow-none">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><SlidersHorizontal className="h-5 w-5" /></span>
              <div><p className="text-sm font-semibold text-white">Nouveau mouvement</p><p className="text-xs text-slate-500">Mise à jour instantanée du stock</p></div>
            </div>
            <div className="space-y-4">
              <Field label="Type de mouvement">
                <Select value={type} onValueChange={value => setType(value as MovementType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="entry">Entrée en stock</SelectItem><SelectItem value="exit">Sortie de stock</SelectItem><SelectItem value="adjustment">Ajustement</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Produit">
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
                  <SelectContent>{products.map(product => <SelectItem key={product.id} value={String(product.id)}>{product.reference} · {product.name}</SelectItem>)}</SelectContent>
                </Select>
                {selectedProduct && <p className="pt-1 text-xs text-slate-500">Stock disponible : <span className="font-medium text-slate-300">{selectedProduct.quantity} {selectedProduct.unit}</span></p>}
              </Field>
              <Field label="Quantité"><Input type="number" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder={type === "adjustment" ? "Ex. -2 ou 5" : "Ex. 20"} /></Field>
              <Field label="Fournisseur (optionnel)">
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Sans fournisseur</SelectItem>{suppliers.map(supplier => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Motif"><Input value={reason} onChange={event => setReason(event.target.value)} placeholder="Ex. Réception commande BC-1042" /></Field>
              <Button onClick={submit} disabled={createMovement.isPending || !products.length} className="h-10 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                {type === "entry" ? <ArrowDownToLine className="mr-2 h-4 w-4" /> : <ArrowUpFromLine className="mr-2 h-4 w-4" />} Enregistrer le mouvement
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.07] bg-[#111722] shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-white/[0.07] px-5 py-5"><p className="text-sm font-semibold text-white">Registre des mouvements</p><p className="mt-1 text-xs text-slate-500">Chaque ligne contient le niveau avant et après opération.</p></div>
            {isLoading ? <div className="px-5 py-12 text-center text-sm text-slate-500">Chargement des mouvements…</div> : movements.length === 0 ? (
              <div className="px-5 py-16 text-center"><p className="font-medium text-slate-300">Aucun mouvement enregistré</p><p className="mt-1 text-xs text-slate-500">Utilisez le formulaire pour tracer votre première opération.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                  <thead className="bg-white/[0.018] text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500"><tr><th className="px-5 py-3">Produit</th><th className="px-4 py-3">Mouvement</th><th className="px-4 py-3">Variation</th><th className="px-4 py-3">Avant → après</th><th className="px-5 py-3 text-right">Horodatage</th></tr></thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {movements.map(movement => <tr key={movement.id} className="text-sm hover:bg-white/[0.018]"><td className="px-5 py-4"><p className="font-medium text-slate-200">{movement.productName}</p><p className="mt-0.5 text-xs text-slate-500">{movement.reason}</p></td><td className="px-4 py-4"><Badge className={`border-0 ${movement.type === "entry" ? "bg-emerald-400/10 text-emerald-300" : movement.type === "exit" ? "bg-rose-400/10 text-rose-300" : "bg-violet-400/10 text-violet-300"}`}>{movementLabels[movement.type]}</Badge></td><td className={`px-4 py-4 font-semibold ${movement.quantity >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSignedQuantity(movement.quantity)}</td><td className="px-4 py-4 text-slate-400">{movement.previousQuantity} <span className="px-1 text-slate-600">→</span> {movement.resultingQuantity}</td><td className="px-5 py-4 text-right text-xs text-slate-500">{formatDate(movement.occurredAt, true)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="text-xs font-medium text-slate-300">{label}</Label>{children}</div>;
}
