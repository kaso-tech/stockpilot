import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { authTokens, users } from "../drizzle/schema";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashAuthToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateAuthToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Stocke uniquement le SHA-256 du jeton et invalide les demandes antérieures. */
export async function issuePasswordResetToken(db: any, userId: number, now = new Date()): Promise<string> {
  const token = generateAuthToken();
  await db.transaction(async (tx: any) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    await tx.update(authTokens).set({ usedAt: now }).where(and(eq(authTokens.userId, userId), eq(authTokens.type, "password_reset"), isNull(authTokens.usedAt)));
    await tx.insert(authTokens).values({ userId, type: "password_reset", tokenHash: hashAuthToken(token), expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS) });
  });
  return token;
}

/** À appeler dans une transaction : verrouille et consomme atomiquement un jeton valable. */
export async function consumePasswordResetToken(tx: any, token: string, now = new Date()): Promise<number | null> {
  const row = (await tx.select().from(authTokens).where(and(eq(authTokens.tokenHash, hashAuthToken(token)), eq(authTokens.type, "password_reset"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, now))).limit(1).for("update"))[0];
  if (!row) return null;
  await tx.update(authTokens).set({ usedAt: now }).where(eq(authTokens.id, row.id));
  return row.userId as number;
}
