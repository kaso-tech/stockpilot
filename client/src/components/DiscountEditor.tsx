import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export type DiscountForm = { type: "none" | "percent" | "fixed"; value: string };
export const noDiscount: DiscountForm = { type: "none", value: "" };

export function discountPayload(discount: DiscountForm) {
  if (discount.type === "none") return { type: "none" as const, value: 0 };
  const numeric = Math.max(0, Number(discount.value || 0));
  return discount.type === "percent" ? { type: "percent" as const, value: Math.round(numeric * 100) } : { type: "fixed" as const, value: Math.round(numeric * 100) };
}

export function calculateDiscount(subtotalCents: number, discount: DiscountForm) {
  const payload = discountPayload(discount);
  if (payload.type === "percent") return Math.min(subtotalCents, Math.round((subtotalCents * payload.value) / 10000));
  return Math.min(subtotalCents, payload.value);
}

export function DiscountEditor({ value, onChange, label = "Remise", compact = false }: { value: DiscountForm; onChange: (next: DiscountForm) => void; label?: string; compact?: boolean }) {
  const { user } = useAuth(); const { data: settings } = trpc.commerce.settings.get.useQuery(undefined, { enabled: user?.role === "seller" });
  const scope = label.toLowerCase().includes("panier") ? "cart" : label.toLowerCase().includes("ligne") || label === "Remise" ? "line" : "invoice";
  const allowed = scope === "cart" ? settings?.sellerCanCartDiscount : scope === "line" ? settings?.sellerCanLineDiscount : settings?.sellerCanInvoiceDiscount;
  if (user?.role === "seller" && !allowed) return null;
  return <div className={compact ? "flex items-center gap-2" : "grid gap-2 sm:grid-cols-[150px_1fr] sm:items-end"}><div className="space-y-1"><Label className="text-xs">{label}</Label><Select value={value.type} onValueChange={(type: DiscountForm["type"]) => onChange({ type, value: type === "none" ? "" : value.value })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Aucune</SelectItem><SelectItem value="percent">Pourcentage</SelectItem><SelectItem value="fixed">Montant</SelectItem></SelectContent></Select></div>{value.type !== "none" && <div className="space-y-1"><Label className="text-xs">{value.type === "percent" ? "Taux (%)" : "Montant (FCFA)"}</Label><Input className="h-9" type="number" min="0" max={value.type === "percent" ? "100" : undefined} value={value.value} onChange={event => onChange({ ...value, value: event.target.value })} /></div>}</div>;
}
