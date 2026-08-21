import { trpc } from "@/lib/trpc";
import { setActiveCurrency } from "@/lib/format";
import { readPreference, writePreference } from "@/lib/preferenceStorage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type Currency = "USD" | "EUR" | "XOF";
type PreferencesContextType = { currency: Currency; setCurrency: (currency: Currency) => void };
const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => readPreference(typeof window === "undefined" ? undefined : localStorage, "stockpilot_currency", ["USD", "EUR", "XOF"], "XOF"));
  const { data } = trpc.commerce.settings.get.useQuery(undefined, { retry: false });
  useEffect(() => { if (data?.currency) { setCurrencyState(data.currency); setActiveCurrency(data.currency); writePreference(typeof window === "undefined" ? undefined : localStorage, "stockpilot_currency", data.currency); } }, [data?.currency]);
  const setCurrency = (nextCurrency: Currency) => { setCurrencyState(nextCurrency); setActiveCurrency(nextCurrency); writePreference(typeof window === "undefined" ? undefined : localStorage, "stockpilot_currency", nextCurrency); };
  return <PreferencesContext.Provider value={{ currency, setCurrency }}>{children}</PreferencesContext.Provider>;
}
export function usePreferences() { const context = useContext(PreferencesContext); if (!context) throw new Error("usePreferences must be used within PreferencesProvider"); return context; }
