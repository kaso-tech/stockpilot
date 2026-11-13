import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  adminFallbackPasswords,
  sellerCredentials,
  userSessions,
  users,
} from "../drizzle/schema";
import { ROLES } from "@shared/permissions";
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
          inArray(users.role, [...ROLES])
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

type PasswordOwner = {
  id: number;
  openId: string;
  role: string;
  email: string | null;
};

/**
 * Empreinte du mot de passe d'un compte, quel que soit son rôle (9.3) : les
 * administrateurs historiques l'ont dans `adminFallbackPasswords`, les autres
 * comptes dans `sellerCredentials`. Un changement de rôle ne fait donc jamais
 * perdre l'accès.
 */
export async function findPasswordHash(db: any, owner: PasswordOwner) {
  const adminRow = (
    await db
      .select()
      .from(adminFallbackPasswords)
      .where(eq(adminFallbackPasswords.ownerOpenId, owner.openId))
      .limit(1)
  )[0];
  if (adminRow) return adminRow.passwordHash as string;
  const credential = (
    await db
      .select()
      .from(sellerCredentials)
      .where(eq(sellerCredentials.userId, owner.id))
      .limit(1)
  )[0];
  return (credential?.passwordHash as string | undefined) ?? null;
}

/** Enregistre un nouveau mot de passe là où le compte stocke le sien. */
export async function storePasswordHash(
  db: any,
  owner: PasswordOwner,
  passwordHash: string,
  updatedByUserId: number
) {
  const adminRow = (
    await db
      .select()
      .from(adminFallbackPasswords)
      .where(eq(adminFallbackPasswords.ownerOpenId, owner.openId))
      .limit(1)
  )[0];
  if (adminRow) {
    await db
      .update(adminFallbackPasswords)
      .set({ passwordHash, updatedByUserId })
      .where(eq(adminFallbackPasswords.id, adminRow.id));
    return;
  }
  const credential = (
    await db
      .select()
      .from(sellerCredentials)
      .where(eq(sellerCredentials.userId, owner.id))
      .limit(1)
  )[0];
  if (credential) {
    await db
      .update(sellerCredentials)
      .set({ passwordHash })
      .where(eq(sellerCredentials.id, credential.id));
    return;
  }
  if (owner.role === "admin")
    await db
      .insert(adminFallbackPasswords)
      .values({ ownerOpenId: owner.openId, passwordHash, updatedByUserId });
  else
    await db
      .insert(sellerCredentials)
      .values({ userId: owner.id, username: `user-${owner.id}`, passwordHash });
}
