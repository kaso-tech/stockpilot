import { trpc } from "@/lib/trpc";
import { setActiveCurrency, setActivePriceFormat, type PriceGrouping, type PriceRounding } from "@/lib/format";
import { applyPrimaryColor, DEFAULT_PRIMARY_COLOR, normalizePrimaryColor } from "@/lib/primaryColor";
import { getOfflinePreferences, replaceOfflinePreferences, type OfflineScope } from "@/lib/offlineStore";
import { useAuth } from "@/_core/hooks/useAuth";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Currency = "USD" | "EUR" | "XOF";
type PreferencesContextType = { currency: Currency; setCurrency: (currency: Currency) => void; primaryColor: string; setPrimaryColor: (color: string) => void; priceGrouping: PriceGrouping; setPriceGrouping: (value: PriceGrouping) => void; priceRounding: PriceRounding; setPriceRounding: (value: PriceRounding) => void };
type StoredPreferences = { currency: Currency; primaryColor: string; priceGrouping: PriceGrouping; priceRounding: PriceRounding };
const DEFAULT_PREFERENCES: StoredPreferences = { currency: "XOF", primaryColor: DEFAULT_PRIMARY_COLOR, priceGrouping: "space", priceRounding: "none" };
const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

function validScope(user: { id: number; companyId: number | null } | null | undefined): OfflineScope | null {
  return user && Number.isInteger(user.id) && user.id > 0 && Number.isInteger(user.companyId) && Number(user.companyId) > 0 ? { userId: user.id, companyId: Number(user.companyId) } : null;
}

function normalizeStoredPreferences(value: unknown): StoredPreferences | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<StoredPreferences>;
  if (!record.currency || !["USD", "EUR", "XOF"].includes(record.currency)) return null;
  if (!record.priceGrouping || !["space", "comma", "none"].includes(record.priceGrouping)) return null;
  if (!record.priceRounding || !["none", "unit", "ten", "hundred", "thousand"].includes(record.priceRounding)) return null;
  return { currency: record.currency, primaryColor: normalizePrimaryColor(record.primaryColor), priceGrouping: record.priceGrouping, priceRounding: record.priceRounding };
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const scope = useMemo(() => validScope(user), [user]);
  const [preferences, setPreferences] = useState<StoredPreferences>(DEFAULT_PREFERENCES);
  const { data } = trpc.commerce.settings.get.useQuery(undefined, { retry: false, enabled: Boolean(scope) });

  useEffect(() => {
    applyPrimaryColor(preferences.primaryColor);
    setActiveCurrency(preferences.currency);
    setActivePriceFormat(preferences.priceGrouping, preferences.priceRounding);
  }, [preferences]);

  useEffect(() => {
    let active = true;
    if (!scope) {
      setPreferences(DEFAULT_PREFERENCES);
      return () => { active = false; };
    }
    void getOfflinePreferences(scope).then(snapshot => {
      if (!active) return;
      const stored = normalizeStoredPreferences(snapshot?.payload);
      if (stored && typeof navigator !== "undefined" && !navigator.onLine) setPreferences(stored);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [scope]);

  useEffect(() => {
    if (!scope || !data) return;
    const next: StoredPreferences = {
      currency: data.currency ?? DEFAULT_PREFERENCES.currency,
      primaryColor: normalizePrimaryColor(data.primaryColor),
      priceGrouping: preferences.priceGrouping,
      priceRounding: preferences.priceRounding,
    };
    setPreferences(current => ({ ...next, priceGrouping: current.priceGrouping, priceRounding: current.priceRounding }));
    void replaceOfflinePreferences(scope, next).catch(() => undefined);
  }, [data?.currency, data?.primaryColor, scope]);

  const persist = (scopeAtWrite: OfflineScope | null, next: StoredPreferences) => {
    setPreferences(next);
    if (scopeAtWrite) void replaceOfflinePreferences(scopeAtWrite, next).catch(() => undefined);
  };
  const setCurrency = (currency: Currency) => persist(scope, { ...preferences, currency });
  const setPrimaryColor = (color: string) => persist(scope, { ...preferences, primaryColor: normalizePrimaryColor(color || DEFAULT_PRIMARY_COLOR) });
  const setPriceGrouping = (priceGrouping: PriceGrouping) => persist(scope, { ...preferences, priceGrouping });
  const setPriceRounding = (priceRounding: PriceRounding) => persist(scope, { ...preferences, priceRounding });

  return <PreferencesContext.Provider value={{ currency: preferences.currency, setCurrency, primaryColor: preferences.primaryColor, setPrimaryColor, priceGrouping: preferences.priceGrouping, setPriceGrouping, priceRounding: preferences.priceRounding, setPriceRounding }}>{children}</PreferencesContext.Provider>;
}
export function usePreferences() { const context = useContext(PreferencesContext); if (!context) throw new Error("usePreferences must be used within PreferencesProvider"); return context; }
