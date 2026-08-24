export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Compatibility shim for legacy callers. StockPilot authenticates internally
 * through the email/password form rendered by DashboardLayout; no external
 * OAuth navigation is permitted.
 */
export const startLogin = () => {
  if (typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.assign("/");
  }
};
