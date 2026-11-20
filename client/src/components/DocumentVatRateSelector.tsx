import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";

type VatRate = { id: number; label: string; rateBasisPoints: number };

function publishVatChoice(applyVat: boolean, rateBasisPoints: number) {
  sessionStorage.setItem("stockpilot-vat-choice", String(applyVat));
  sessionStorage.setItem("stockpilot-vat-rate", String(rateBasisPoints));
  window.dispatchEvent(new Event("stockpilot-vat-choice-change"));
}

export function DocumentVatRateSelector({ rates, defaultRateBasisPoints, canToggle }: { rates: VatRate[]; defaultRateBasisPoints: number; canToggle: boolean }) {
  const preferred = rates.some(rate => rate.rateBasisPoints === defaultRateBasisPoints) ? defaultRateBasisPoints : rates[0]?.rateBasisPoints ?? defaultRateBasisPoints;
  const [applyVat, setApplyVat] = useState(true); const [rateBasisPoints, setRateBasisPoints] = useState(preferred);
  useEffect(() => { setRateBasisPoints(preferred); publishVatChoice(true, preferred); }, [preferred]);
  const updateVat = (next: boolean) => { setApplyVat(next); publishVatChoice(next, rateBasisPoints); };
  const updateRate = (next: string) => { const rate = Number(next); setRateBasisPoints(rate); publishVatChoice(applyVat, rate); };
  return <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/[0.08] px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between"><div className="inline-flex items-center gap-3 font-medium">{canToggle ? <Checkbox checked={applyVat} onCheckedChange={value => updateVat(value === true)} /> : null}<span>{canToggle ? "TVA appliquée à ce document" : "TVA appliquée"}</span></div>{applyVat ? rates.length ? <Select value={String(rateBasisPoints)} onValueChange={updateRate} disabled={!canToggle}><SelectTrigger className="h-9 w-full bg-background sm:w-56"><SelectValue placeholder="Taux de TVA" /></SelectTrigger><SelectContent>{rates.map(rate => <SelectItem key={rate.id} value={String(rate.rateBasisPoints)}>{rate.label} · {(rate.rateBasisPoints / 100).toFixed(2)} %</SelectItem>)}</SelectContent></Select> : <span className="text-xs text-muted-foreground">Taux par défaut : {(rateBasisPoints / 100).toFixed(2)} %</span> : <span className="text-xs text-muted-foreground">Document hors TVA</span>}</div>;
}
