import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { companies, sellerCredentials, users } from "../drizzle/schema";
import { ROLES } from "@shared/permissions";
import { normalizeAuthEmail } from "./authEmail";
import { findPasswordHash } from "./userPasswordStorage";
import { verifyPassword } from "./passwords";

type Db = any;

/** Code entreprise saisi par l'utilisateur : majuscules, sans accents, lettres, chiffres et tirets. */
export function normalizeCompanyCode(value: string | null | undefined) {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
}

/** Code proposé à partir du nom de l'entreprise (« Station OTAM » → « STATIONOTAM »). */
export function suggestCompanyCode(name: string) {
  const base = normalizeCompanyCode(name).replace(/-/g, "").slice(0, 14);
  return base.length >= 3 ? base : `${base}ENT`.slice(0, 14);
}

export const COMPANY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,19}$/;

/** Premier code libre : BASE, puis BASE2, BASE3… */
export async function availableCompanyCode(db: Db, base: string, exceptCompanyId?: number) {
  const root = base.slice(0, 17) || "ENT";
  const taken = new Set((await db.select({ id: companies.id, loginCode: companies.loginCode }).from(companies)).filter((row: { id: number; loginCode: string | null }) => row.id !== exceptCompanyId && row.loginCode).map((row: { loginCode: string }) => row.loginCode));
  if (!taken.has(root)) return root;
  for (let suffix = 2; suffix < 1000; suffix += 1) if (!taken.has(`${root}${suffix}`)) return `${root}${suffix}`;
  return `${root}${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
}

/** Code de l'entreprise, attribué s'il manque (entreprises créées avant les codes). */
export async function ensureCompanyLoginCode(db: Db, companyId: number): Promise<string | null> {
  const company = (await db.select({ id: companies.id, name: companies.name, loginCode: companies.loginCode }).from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  if (!company) return null;
  if (company.loginCode) return company.loginCode;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = await availableCompanyCode(db, suggestCompanyCode(company.name), company.id);
    try {
      await db.update(companies).set({ loginCode: code }).where(and(eq(companies.id, company.id), isNull(companies.loginCode)));
      const saved = (await db.select({ loginCode: companies.loginCode }).from(companies).where(eq(companies.id, company.id)).limit(1))[0];
      if (saved?.loginCode) return saved.loginCode;
    } catch { /* code pris entre-temps : nouvel essai */ }
  }
  return null;
}

/** Au démarrage : attribue un code à toutes les entreprises qui n'en ont pas encore. */
export async function ensureAllCompanyLoginCodes(db: Db) {
  const missing = await db.select({ id: companies.id }).from(companies).where(isNull(companies.loginCode));
  for (const company of missing) await ensureCompanyLoginCode(db, company.id);
  return missing.length;
}

export const INVALID_CREDENTIALS = "Code entreprise, identifiant ou mot de passe incorrect.";
export const COMPANY_CODE_REQUIRED = "Ce compte existe dans plusieurs entreprises : indiquez le code entreprise.";

/**
 * Retrouve le compte qui se connecte. Avec un code entreprise, la recherche se limite à cette entreprise ;
 * sans code (anciens appareils, administrateurs), le compte est accepté s'il est le seul à correspondre
 * à ces identifiants. L'e-mail ou l'identifiant ne sont uniques qu'au sein d'une entreprise.
 */
export async function resolveLoginAccount(db: Db, input: { companyCode?: string | null; identifier: string; password: string }) {
  const identifier = normalizeAuthEmail(input.identifier);
  if (!identifier) throw new TRPCError({ code: "UNAUTHORIZED", message: INVALID_CREDENTIALS });
  const code = normalizeCompanyCode(input.companyCode);
  let companyId: number | null = null;
  if (code) {
    const company = (await db.select({ id: companies.id }).from(companies).where(eq(companies.loginCode, code)).limit(1))[0];
    if (!company) throw new TRPCError({ code: "UNAUTHORIZED", message: "Code entreprise inconnu. Vérifiez-le auprès de votre administrateur." });
    companyId = company.id;
  }
  const scope = companyId === null ? undefined : eq(users.companyId, companyId);
  let candidates: Array<typeof users.$inferSelect>;
  if (identifier.includes("@")) {
    candidates = await db.select().from(users).where(and(or(eq(users.emailNormalized, identifier), and(isNull(users.emailNormalized), sql`lower(trim(${users.email})) = ${identifier}`)), eq(users.active, true), inArray(users.role, ROLES), scope)).limit(20);
  } else {
    const credentials = await db.select({ userId: sellerCredentials.userId }).from(sellerCredentials).where(and(sql`lower(${sellerCredentials.username}) = ${identifier}`, companyId === null ? undefined : or(eq(sellerCredentials.companyId, companyId), isNull(sellerCredentials.companyId)))).limit(20);
    const ids = credentials.map((row: { userId: number }) => row.userId);
    candidates = ids.length ? await db.select().from(users).where(and(inArray(users.id, ids), eq(users.active, true), inArray(users.role, ROLES), scope)) : [];
  }
  const matches: typeof candidates = [];
  for (const candidate of candidates) {
    const credential = await findPasswordHash(db, candidate);
    if (credential && await verifyPassword(input.password, credential.passwordHash)) matches.push(candidate);
  }
  if (!matches.length) throw new TRPCError({ code: "UNAUTHORIZED", message: INVALID_CREDENTIALS });
  if (matches.length > 1) throw new TRPCError({ code: "BAD_REQUEST", message: COMPANY_CODE_REQUIRED });
  const account = matches[0];
  // Comptes créés sans e-mail normalisé (ancienne version) : champ complété à la connexion.
  if (identifier.includes("@") && !account.emailNormalized) { try { await db.update(users).set({ emailNormalized: identifier }).where(eq(users.id, account.id)); } catch { /* complété à la prochaine connexion */ } }
  const companyCode = account.companyId ? await ensureCompanyLoginCode(db, account.companyId) : null;
  return { account, companyCode };
}
