import { timingSafeEqual } from "crypto";

export function matchesAdminFallbackCredentials(input: { email: string; password: string }, configured: { email: string; password: string }) {
  const emailMatches = Boolean(configured.email) && input.email.trim().toLowerCase() === configured.email.trim().toLowerCase();
  const supplied = Buffer.from(input.password);
  const expected = Buffer.from(configured.password);
  const passwordMatches = expected.length > 0 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
  return emailMatches && passwordMatches;
}
