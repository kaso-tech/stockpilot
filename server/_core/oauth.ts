import type { Express } from "express";

/**
 * StockPilot uses internal email/password authentication. The historical
 * external OAuth callback is intentionally not registered anymore.
 */
export function registerOAuthRoutes(_app: Express) {
  return;
}
