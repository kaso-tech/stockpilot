/**
 * Recherche tolérante : sans accents, sans casse, ligatures et apostrophes unifiées.
 * « television » retrouve « Télévision », « oeuf » retrouve « Œuf ».
 */
export function normalizeSearch(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .trim();
}

/** Vrai si chaque mot de la recherche figure dans l'un des champs (ordre indifférent). */
export function matchesSearch(query: string | null | undefined, ...values: Array<string | number | null | undefined>) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalizeSearch(values.filter(value => value !== null && value !== undefined).join(" "));
  return words.every(word => haystack.includes(word));
}
