import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Percent } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type DiscountKey = "line" | "invoice" | "cart";
type PermissionState = Record<DiscountKey, { enabled: boolean; maximum: number }>;

const initialState: PermissionState = {
  line: { enabled: false, maximum: 0 },
  invoice: { enabled: false, maximum: 0 },
  cart: { enabled: false, maximum: 0 },
};

export function SellerDiscountPermissionsCard() {
  const utils = trpc.useUtils();
  const { data } = trpc.sellerDiscountPermissions.get.useQuery();
  const [permissions, setPermissions] = useState<PermissionState>(initialState);

  useEffect(() => {
    if (!data) return;
    setPermissions({
      line: { enabled: data.sellerCanLineDiscount, maximum: data.sellerMaxLineDiscountPercent },
      invoice: { enabled: data.sellerCanInvoiceDiscount, maximum: data.sellerMaxInvoiceDiscountPercent },
      cart: { enabled: data.sellerCanCartDiscount, maximum: data.sellerMaxCartDiscountPercent },
    });
  }, [data]);

  const save = trpc.sellerDiscountPermissions.save.useMutation({
    onSuccess: () => { utils.sellerDiscountPermissions.get.invalidate(); toast.success("Autorisations de remise enregistrées."); },
    onError: error => toast.error(error.message),
  });

  const update = (key: DiscountKey, patch: Partial<PermissionState[DiscountKey]>) => setPermissions(current => ({ ...current, [key]: { ...current[key], ...patch } }));
  const persist = () => save.mutate({
    sellerCanLineDiscount: permissions.line.enabled,
    sellerMaxLineDiscountPercent: permissions.line.maximum,
    sellerCanInvoiceDiscount: permissions.invoice.enabled,
    sellerMaxInvoiceDiscountPercent: permissions.invoice.maximum,
    sellerCanCartDiscount: permissions.cart.enabled,
    sellerMaxCartDiscountPercent: permissions.cart.maximum,
  });

  return <section className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-5">
    <div className="flex items-start gap-3"><Percent className="mt-0.5 h-5 w-5 text-primary" /><div><h3 className="font-semibold text-foreground">Autorisations de remise</h3><p className="mt-1 text-sm text-muted-foreground">Activez séparément les remises que le vendeur peut appliquer et définissez leur plafond.</p></div></div>
    <DiscountPermission label="Remise par produit" value={permissions.line} onChange={patch => update("line", patch)} />
    <DiscountPermission label="Remise sur la facture" value={permissions.invoice} onChange={patch => update("invoice", patch)} />
    <DiscountPermission label="Remise sur le panier" value={permissions.cart} onChange={patch => update("cart", patch)} />
    <Button type="button" onClick={persist} disabled={save.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">{save.isPending ? "Enregistrement…" : "Enregistrer les autorisations de remise"}</Button>
  </section>;
}

function DiscountPermission({ label, value, onChange }: { label: string; value: { enabled: boolean; maximum: number }; onChange: (patch: Partial<{ enabled: boolean; maximum: number }>) => void }) {
  return <div className="rounded-xl border border-border bg-muted/50 p-4"><div className="flex items-center justify-between gap-4"><Label className="text-sm text-foreground">{label}</Label><Switch checked={value.enabled} onCheckedChange={enabled => onChange({ enabled })} /></div>{value.enabled && <div className="mt-4 space-y-2"><Label className="text-sm text-muted-foreground">Taux maximum autorisé (%)</Label><Input type="number" min={0} max={100} value={value.maximum} onChange={event => onChange({ maximum: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /></div>}</div>;
}
