import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { userSessions, users } from "../drizzle/schema";
import { getDb } from "./db";
import { hashPassword, verifyPassword } from "./passwords";
import { consumeRateLimit } from "./rateLimit";

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type RequestLike = { ip?: string };

/**
 * Identité réseau utilisée pour la limitation de débit. `req.ip` est calculé par
 * Express à partir de `trust proxy` : on ne lit jamais X-Forwarded-For brut,
 * que le client peut forger librement.
 */
export function requestIdentity(req: RequestLike) {
  return req.ip || "unknown";
}

export function assertRateLimit(
  req: RequestLike,
  scope: string,
  limit: number,
  windowMs: number,
  subject?: string
) {
  const identity = requestIdentity(req);
  const allowedForIp = consumeRateLimit(
    `${scope}:ip:${identity}`,
    limit,
    windowMs
  );
  const allowedForSubject =
    subject === undefined ||
    consumeRateLimit(
      `${scope}:subject:${subject.trim().toLowerCase()}`,
      Math.max(5, Math.floor(limit / 3)),
      windowMs
    );
  if (!allowedForIp || !allowedForSubject)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Trop de tentatives. Réessayez plus tard.",
    });
}

/** Recherche d'un compte de connexion par e-mail normalisé, directement en SQL. */
export async function findLoginAccount(db: DbClient, email: string) {
  const normalized = email.trim().toLowerCase();
  return (
    await db
      .select()
      .from(users)
      .where(
        and(
          sql`lower(${users.email}) = ${normalized}`,
          eq(users.active, true),
          inArray(users.role, ["admin", "seller"])
        )
      )
      .limit(1)
  )[0];
}

export async function emailIsTaken(
  db: DbClient,
  email: string,
  exceptUserId?: number
) {
  const normalized = email.trim().toLowerCase();
  const conditions = [sql`lower(${users.email}) = ${normalized}`];
  if (exceptUserId !== undefined) conditions.push(ne(users.id, exceptUserId));
  return Boolean(
    (
      await db
        .select({ id: users.id })
        .from(users)
        .where(and(...conditions))
        .limit(1)
    )[0]
  ); // tenant-scope-ok: e-mail unique sur toute la plateforme
}

let dummyHash: Promise<string> | null = null;
/**
 * Vérifie un mot de passe contre un haché factice lorsque le compte n'existe pas,
 * afin que le temps de réponse ne révèle pas l'existence d'une adresse.
 */
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword("stockpilot-timing-equalizer");
  await verifyPassword(password, await dummyHash);
}

/** Révoque toutes les sessions actives d'un utilisateur, sauf éventuellement la session courante. */
export async function revokeUserSessions(
  db: DbClient,
  userId: number,
  exceptSessionId?: string
) {
  const conditions = [
    eq(userSessions.userId, userId),
    isNull(userSessions.revokedAt),
  ];
  if (exceptSessionId) conditions.push(ne(userSessions.id, exceptSessionId));
  const result = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions));
  return Number(
    (result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ??
      0
  );
}
