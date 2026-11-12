import { saleSettings } from "../drizzle/schema";
import { companyScope } from "./companyScope";
export const DEFAULT_TIMEZONE = "Africa/Abidjan";
export function isValidTimezone(timezone: string) {
  try { new Intl.DateTimeFormat("en-CA", { timeZone: timezone }); return true; }
  catch { return false; }
}
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timezone: string) {
  const zone = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  let value = formatters.get(zone);
  if (!value) { value = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }); formatters.set(zone, value); }
  return value;
}
export function dayKey(date: Date, timezone: string) {
  const parts = Object.fromEntries(formatter(timezone).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
/** Fuseau configuré par entreprise quand disponible; défaut explicite Abidjan (XOF). */
export async function companyTimezone(db: any, companyId: number | null) {
  // Cette version du schéma partagé ne possède pas encore de champ timezone.
  // Garder un sélecteur scoped rendra le helper rétrocompatible dès son ajout.
  if (!(saleSettings as any).timezone) return DEFAULT_TIMEZONE;
  const row = (await db.select({ timezone: (saleSettings as any).timezone }).from(saleSettings).where(companyScope(saleSettings.companyId, companyId)).limit(1))[0];
  return row?.timezone && isValidTimezone(row.timezone) ? row.timezone : DEFAULT_TIMEZONE;
}
