import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { adminFallbackPasswords, sellerCredentials } from "../drizzle/schema";

export type PasswordHashRecord = { passwordHash: string };
/** Retourne le hash du credential historique, sans déplacer ni réinitialiser les identifiants. */
export async function findPasswordHash(db: any, account: { id: number; openId: string }): Promise<PasswordHashRecord | null> {
  const [fallback, seller] = await Promise.all([
    db.select({ ownerOpenId: adminFallbackPasswords.ownerOpenId, passwordHash: adminFallbackPasswords.passwordHash }).from(adminFallbackPasswords).where(eq(adminFallbackPasswords.ownerOpenId, account.openId)).limit(1),
    db.select({ userId: sellerCredentials.userId, passwordHash: sellerCredentials.passwordHash }).from(sellerCredentials).where(eq(sellerCredentials.userId, account.id)).limit(1),
  ]);
  return fallback.find((row: { ownerOpenId: string }) => row.ownerOpenId === account.openId) ?? seller.find((row: { userId: number }) => row.userId === account.id) ?? null;
}
/** Enregistre le hash dans le magasin canonique du rôle et conserve l’ancien en miroir pour les conversions. */
export async function storePasswordHash(tx: any, account: { id: number; openId: string }, passwordHash: string, role: string, updatedByUserId = account.id) {
  const fallback = (await tx.select().from(adminFallbackPasswords).where(eq(adminFallbackPasswords.ownerOpenId, account.openId)).limit(1))[0];
  const seller = (await tx.select().from(sellerCredentials).where(eq(sellerCredentials.userId, account.id)).limit(1))[0];
  if (fallback) await tx.update(adminFallbackPasswords).set({ passwordHash, updatedByUserId }).where(eq(adminFallbackPasswords.id, fallback.id));
  if (seller) await tx.update(sellerCredentials).set({ passwordHash }).where(eq(sellerCredentials.id, seller.id));
  else if (role !== "admin") {
    // Seller credentials require a globally unique username; it is not used by email login.
    await tx.insert(sellerCredentials).values({ userId: account.id, username: `rolelogin-${account.id}-${randomUUID().slice(0, 12)}`, passwordHash });
  }
}
