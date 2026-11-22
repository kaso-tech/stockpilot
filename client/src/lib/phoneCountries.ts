// Indicatifs proposés dans les champs téléphone : zone FCFA d'abord, puis pays voisins et fréquents.
// `example` est un numéro local fictif au format usuel du pays ; `trunkZero` indique qu'un 0 initial
// se retire quand on compose depuis l'étranger (France : 06… → +33 6…).
export type PhoneCountry = { code: string; name: string; dial: string; example: string; trunkZero?: boolean };

export const phoneCountries: PhoneCountry[] = [
  { code: "BF", name: "Burkina Faso", dial: "226", example: "70 12 34 56" },
  { code: "CI", name: "Côte d’Ivoire", dial: "225", example: "07 08 12 34 56" },
  { code: "ML", name: "Mali", dial: "223", example: "70 12 34 56" },
  { code: "SN", name: "Sénégal", dial: "221", example: "77 123 45 67" },
  { code: "NE", name: "Niger", dial: "227", example: "90 12 34 56" },
  { code: "TG", name: "Togo", dial: "228", example: "90 12 34 56" },
  { code: "BJ", name: "Bénin", dial: "229", example: "01 90 12 34 56" },
  { code: "GW", name: "Guinée-Bissau", dial: "245", example: "955 012 345" },
  { code: "CM", name: "Cameroun", dial: "237", example: "6 71 23 45 67" },
  { code: "GA", name: "Gabon", dial: "241", example: "06 03 12 34" },
  { code: "CG", name: "Congo", dial: "242", example: "06 612 3456" },
  { code: "CF", name: "Centrafrique", dial: "236", example: "70 01 23 45" },
  { code: "TD", name: "Tchad", dial: "235", example: "63 01 23 45" },
  { code: "GQ", name: "Guinée équatoriale", dial: "240", example: "222 123 456" },
  { code: "GN", name: "Guinée", dial: "224", example: "621 12 34 56" },
  { code: "GH", name: "Ghana", dial: "233", example: "24 123 4567", trunkZero: true },
  { code: "NG", name: "Nigeria", dial: "234", example: "802 123 4567", trunkZero: true },
  { code: "MR", name: "Mauritanie", dial: "222", example: "22 12 34 56" },
  { code: "MA", name: "Maroc", dial: "212", example: "6 12 34 56 78", trunkZero: true },
  { code: "FR", name: "France", dial: "33", example: "6 12 34 56 78", trunkZero: true },
  { code: "BE", name: "Belgique", dial: "32", example: "470 12 34 56", trunkZero: true },
  { code: "US", name: "États-Unis / Canada", dial: "1", example: "514 555 0123" },
  { code: "CN", name: "Chine", dial: "86", example: "131 2345 6789" },
];

export const DEFAULT_PHONE_COUNTRY = "BF";
export const OTHER_PHONE_COUNTRY = "OTHER";

export function countryByCode(code: string) { return phoneCountries.find(country => country.code === code); }

/** Sépare un numéro enregistré en indicatif + numéro local. Sans « + », l'indicatif par défaut s'applique. */
export function parsePhone(value: string | null | undefined, fallbackCountry = DEFAULT_PHONE_COUNTRY): { country: string; local: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { country: fallbackCountry, local: "" };
  const international = raw.startsWith("+") ? raw.slice(1) : raw.startsWith("00") ? raw.slice(2) : null;
  if (international === null) return { country: fallbackCountry, local: raw };
  const digits = international.replace(/\D/g, "");
  const match = [...phoneCountries].sort((a, b) => b.dial.length - a.dial.length).find(country => digits.startsWith(country.dial));
  if (!match) return { country: OTHER_PHONE_COUNTRY, local: raw };
  const rest = international.replace(/^[\s-]*/, "").slice(match.dial.length).replace(/^[\s.-]*/, "");
  return { country: match.code, local: rest };
}

/** Numéro enregistré : « +226 70 12 34 56 » (vide si aucun chiffre). */
export function formatPhone(country: string, local: string): string {
  const trimmed = local.trim();
  if (!/\d/.test(trimmed)) return "";
  if (country === OTHER_PHONE_COUNTRY) return trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/^0+/, "")}`;
  const definition = countryByCode(country) ?? countryByCode(DEFAULT_PHONE_COUNTRY)!;
  const cleaned = trimmed.replace(/^\+/, "").replace(new RegExp(`^(00)?${definition.dial}[\\s.-]*`), "");
  const withoutTrunk = definition.trunkZero ? cleaned.replace(/^0/, "") : cleaned;
  return `+${definition.dial} ${withoutTrunk.replace(/\s+/g, " ").trim()}`;
}

/** Drapeau à partir du code pays (lettres régionales Unicode). */
export function flag(code: string) {
  return code.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map(letter => 0x1f1e6 + letter.charCodeAt(0) - 65)) : "🌐";
}
