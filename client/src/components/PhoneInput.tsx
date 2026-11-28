import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { DEFAULT_PHONE_COUNTRY, OTHER_PHONE_COUNTRY, countryByCode, flag, formatPhone, parsePhone, phoneCountries } from "@/lib/phoneCountries";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const LAST_COUNTRY_KEY = "stockpilot-phone-country";

/** Pays proposé par défaut : celui du téléphone de l'entreprise, sinon le dernier choisi, sinon le Burkina Faso. */
function useDefaultPhoneCountry() {
  const { data: settings } = trpc.commerce.settings.get.useQuery(undefined, { staleTime: 5 * 60_000 });
  return useMemo(() => {
    const companyPhone = (settings as { companyPhone?: string | null } | undefined)?.companyPhone;
    if (companyPhone?.trim().startsWith("+")) { const parsed = parsePhone(companyPhone); if (parsed.country !== OTHER_PHONE_COUNTRY) return parsed.country; }
    try { const stored = localStorage.getItem(LAST_COUNTRY_KEY); if (stored && countryByCode(stored)) return stored; } catch { /* sans effet */ }
    return DEFAULT_PHONE_COUNTRY;
  }, [settings]);
}

/**
 * Champ téléphone avec indicatif du pays. La valeur enregistrée est le numéro international
 * (« +226 70 12 34 56 ») ; un ancien numéro sans indicatif reste affiché tel quel avec le pays par défaut.
 */
export function PhoneInput({ value, onChange, id, ariaLabel = "Numéro de téléphone" }: { value: string | null | undefined; onChange: (value: string) => void; id?: string; ariaLabel?: string }) {
  const defaultCountry = useDefaultPhoneCountry();
  const initial = parsePhone(value, defaultCountry);
  const [country, setCountry] = useState(initial.country);
  const [local, setLocal] = useState(initial.local);
  const lastEmitted = useRef(value ?? "");
  // Valeur changée de l'extérieur (ouverture d'une autre fiche) : on relit le numéro.
  useEffect(() => {
    if ((value ?? "") === lastEmitted.current) return;
    const parsed = parsePhone(value, defaultCountry);
    setCountry(parsed.country); setLocal(parsed.local); lastEmitted.current = value ?? "";
  }, [value, defaultCountry]);
  // Champ vide : il suit le pays par défaut une fois les réglages chargés.
  useEffect(() => { if (!local.trim() && !(value ?? "").trim()) setCountry(defaultCountry); }, [defaultCountry]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (nextCountry: string, nextLocal: string) => { const next = formatPhone(nextCountry, nextLocal); lastEmitted.current = next; onChange(next); };
  const definition = countryByCode(country);
  // Exemple clairement signalé comme tel, pour ne pas ressembler à un numéro déjà saisi.
  const example = country === OTHER_PHONE_COUNTRY ? "+44 20 7946 0958" : definition?.example ?? "";
  const placeholder = example ? `Ex. ${example}` : "Numéro de téléphone";
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        {/* Le champ affiche le drapeau et l'indicatif ; la liste native (invisible par-dessus) donne les noms complets. */}
        <label className="relative flex h-9 w-[6.75rem] shrink-0 items-center justify-between gap-1 rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground focus-within:ring-2 focus-within:ring-ring/50">
          <span className="truncate">{country === OTHER_PHONE_COUNTRY ? "🌐 +…" : `${flag(country)} +${definition?.dial}`}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          <select aria-label="Indicatif du pays" value={country} onChange={event => { const next = event.target.value; setCountry(next); try { if (next !== OTHER_PHONE_COUNTRY) localStorage.setItem(LAST_COUNTRY_KEY, next); } catch { /* sans effet */ } emit(next, local); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
          {phoneCountries.map(item => <option key={item.code} value={item.code}>{flag(item.code)} +{item.dial} · {item.name}</option>)}
          <option value={OTHER_PHONE_COUNTRY}>🌐 Autre indicatif</option>
        </select>
        </label>
        <Input id={id} aria-label={ariaLabel} type="tel" inputMode="tel" autoComplete="tel-national" value={local} placeholder={placeholder} onChange={event => { setLocal(event.target.value); emit(country, event.target.value); }} className="min-w-0 flex-1 placeholder:italic placeholder:text-muted-foreground/60" />
      </div>
      <p className="text-xs text-muted-foreground">{country === OTHER_PHONE_COUNTRY ? "Saisissez le numéro complet avec son indicatif (+…)." : `Sans l’indicatif : il est ajouté automatiquement (ex. +${definition?.dial} ${definition?.example}).`}</p>
    </div>
  );
}
