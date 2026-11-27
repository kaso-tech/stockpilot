import { COOKIE_NAME } from "@shared/const";

/** Jeton de session transmis en en-tête quand le navigateur bloque le cookie (navigation privée, WebView, aperçu). */
export function sessionAuthHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("manus-cookie");
    const pair = raw?.split(";").find(value => value.trim().startsWith(`${COOKIE_NAME}=`));
    const token = pair?.trim().slice(COOKIE_NAME.length + 1);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
