/** Code entreprise de connexion : prérempli par le lien (?entreprise=CODE) puis mémorisé sur l'appareil. */
const STORAGE_KEY = "stockpilot-company-code";

export function normalizeCompanyCodeInput(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
}

export function readStoredCompanyCode() {
  try { return normalizeCompanyCodeInput(localStorage.getItem(STORAGE_KEY) ?? ""); } catch { return ""; }
}

export function storeCompanyCode(code: string | null | undefined) {
  try { if (code) localStorage.setItem(STORAGE_KEY, normalizeCompanyCodeInput(code)); else localStorage.removeItem(STORAGE_KEY); } catch { /* stockage indisponible */ }
}

/** Code fourni par le lien d'invitation, sinon celui mémorisé. */
export function initialCompanyCode() {
  try {
    const fromLink = new URLSearchParams(window.location.search).get("entreprise");
    if (fromLink) { const code = normalizeCompanyCodeInput(fromLink); storeCompanyCode(code); return { code, remembered: true }; }
  } catch { /* URL illisible */ }
  const stored = readStoredCompanyCode();
  return { code: stored, remembered: Boolean(stored) };
}

/** Lien de connexion qui préremplit le code entreprise. */
export function companyLoginLink(code: string | null | undefined) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return code ? `${origin}/?entreprise=${encodeURIComponent(code)}` : origin;
}
