export const DEFAULT_PRIMARY_COLOR = "#0B6E76";
/**
 * Anciennes couleurs par défaut (pétrole d'origine et bleu de l'ancien thème),
 * enregistrées par les entreprises créées avant le thème « Ardoise & Pétrole ».
 */
const LEGACY_DEFAULT_PRIMARY_COLORS = new Set(["#007B8B", "#2563EB"]);

export function normalizePrimaryColor(value: string | null | undefined) {
  if (!value || !/^#[0-9a-fA-F]{6}$/.test(value)) return DEFAULT_PRIMARY_COLOR;
  const upper = value.toUpperCase();
  return LEGACY_DEFAULT_PRIMARY_COLORS.has(upper)
    ? DEFAULT_PRIMARY_COLOR
    : upper;
}

export function primaryForeground(color: string) {
  const normalized = normalizePrimaryColor(color);
  const [red, green, blue] = [
    normalized.slice(1, 3),
    normalized.slice(3, 5),
    normalized.slice(5, 7),
  ].map(part => Number.parseInt(part, 16));
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.65 ? "#102030" : "#FFFFFF";
}

export function applyPrimaryColor(color: string) {
  if (typeof document === "undefined") return;
  const normalized = normalizePrimaryColor(color);
  const root = document.documentElement;
  root.style.setProperty("--app-primary", normalized);
  root.style.setProperty(
    "--app-primary-foreground",
    primaryForeground(normalized)
  );
}
