import { trpc } from "@/lib/trpc";
import { setActiveCurrency } from "@/lib/format";
import { readPreference, writePreference } from "@/lib/preferenceStorage";
import { applyPrimaryColor, DEFAULT_PRIMARY_COLOR, normalizePrimaryColor } from "@/lib/primaryColor";
import React, { createContext, useContext, useEffect, useState } from "react";

export type Currency = "USD" | "EUR" | "XOF";
type PreferencesContextType = { currency: Currency; setCurrency: (currency: Currency) => void; primaryColor: string; setPrimaryColor: (color: string) => void };
const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => readPreference(typeof window === "undefined" ? undefined : localStorage, "stockpilot_currency", ["USD", "EUR", "XOF"], "XOF"));
  const [primaryColor, setPrimaryColorState] = useState(() => normalizePrimaryColor(typeof window === "undefined" ? undefined : localStorage.getItem("stockpilot_primary_color")));
  const { data } = trpc.commerce.settings.get.useQuery(undefined, { retry: false });
  useEffect(() => { applyPrimaryColor(primaryColor); }, [primaryColor]);
  useEffect(() => { if (data?.currency) { setCurrencyState(data.currency); setActiveCurrency(data.currency); writePreference(typeof window === "undefined" ? undefined : localStorage, "stockpilot_currency", data.currency); } if (data?.primaryColor) { const next = normalizePrimaryColor(data.primaryColor); setPrimaryColorState(next); writePreference(typeof window === "undefined" ? undefined : localStorage, "stockpilot_primary_color", next); } }, [data?.currency, data?.primaryColor]);
  const setCurrency = (nextCurrency: Currency) => { setCurrencyState(nextCurrency); setActiveCurrency(nextCurrency); writePreference(typeof window === "undefined" ? undefined : localStorage, "stockpilot_currency", nextCurrency); };
  const setPrimaryColor = (nextColor: string) => { const normalized = normalizePrimaryColor(nextColor || DEFAULT_PRIMARY_COLOR); setPrimaryColorState(normalized); writePreference(typeof window === "undefined" ? undefined : localStorage, "stockpilot_primary_color", normalized); };
  return <PreferencesContext.Provider value={{ currency, setCurrency, primaryColor, setPrimaryColor }}>{children}</PreferencesContext.Provider>;
}
export function usePreferences() { const context = useContext(PreferencesContext); if (!context) throw new Error("usePreferences must be used within PreferencesProvider"); return context; }
