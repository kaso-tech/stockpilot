import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { authTokens } from "../drizzle/schema";

type TokenType = "password_reset" | "email_verification";
const LIFETIME_MS: Record<TokenType, number> = {
  password_reset: 60 * 60 * 1000,
  email_verification: 7 * 24 * 60 * 60 * 1000,
};

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Crée un jeton à usage unique ; les jetons précédents du même type sont invalidés. */
export async function issueToken(db: any, userId: number, type: TokenType) {
  const token = randomBytes(32).toString("base64url");
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt)
      )
    );
  await db.insert(authTokens).values({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + LIFETIME_MS[type]),
  });
  return token;
}

/** Consomme un jeton valide (non utilisé, non expiré) et renvoie l'identifiant de l'utilisateur. */
export async function consumeToken(tx: any, token: string, type: TokenType) {
  const row = (
    await tx
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, hashToken(token)),
          eq(authTokens.type, type),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date())
        )
      )
      .limit(1)
      .for("update")
  )[0];
  if (!row) return null;
  await tx
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, row.id));
  return row.userId as number;
}
