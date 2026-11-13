import { saleSettings } from "../drizzle/schema";
import { companyScope } from "./companyScope";

export const DEFAULT_TIMEZONE = "Africa/Abidjan";

export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timezone: string) {
  const zone = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  let value = formatters.get(zone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(zone, value);
  }
  return value;
}

/** Journée comptable « AAAA-MM-JJ » dans le fuseau de l'entreprise (E6). */
export function dayKey(date: Date, timezone: string) {
  const parts = Object.fromEntries(
    formatter(timezone)
      .formatToParts(date)
      .map(part => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Mois comptable « AAAA-MM » dans le fuseau de l'entreprise. */
export function monthKey(date: Date, timezone: string) {
  return dayKey(date, timezone).slice(0, 7);
}

/** Les `count` dernières journées (la plus ancienne en premier), aujourd'hui inclus. */
export function lastDayKeys(count: number, timezone: string, now = new Date()) {
  return Array.from({ length: count }, (_, index) =>
    dayKey(new Date(now.getTime() - (count - 1 - index) * 86_400_000), timezone)
  );
}

export async function companyTimezone(db: any, companyId: number | null) {
  const row = (
    await db
      .select({ timezone: saleSettings.timezone })
      .from(saleSettings)
      .where(companyScope(saleSettings.companyId, companyId))
      .limit(1)
  )[0];
  return row?.timezone && isValidTimezone(row.timezone)
    ? row.timezone
    : DEFAULT_TIMEZONE;
}
