import { eq } from "drizzle-orm";
import { adminFallbackPasswords, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { hashPassword } from "./passwords";

type AdminAccount = { id: number; openId: string; email: string | null; name: string | null };

export function findConfiguredAdmin(accounts: AdminAccount[], email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return accounts.find(account => account.email?.trim().toLowerCase() === normalizedEmail);
}

export async function ensureAdminFallbackPasswordSeed() {
  if (!ENV.adminFallbackEmail || !ENV.adminFallbackPassword) return;
  const db = await getDb();
  if (!db) return;

  const accounts = await db.select({ id: users.id, openId: users.openId, email: users.email, name: users.name }).from(users).where(eq(users.role, "admin"));
  const admin = findConfiguredAdmin(accounts, ENV.adminFallbackEmail) ?? (accounts.length === 1 ? accounts[0] : undefined);
  if (!admin) {
    console.warn("[Auth fallback] Seed skipped: configured administrator account was not found.");
    return;
  }

  const existing = (await db.select().from(adminFallbackPasswords).where(eq(adminFallbackPasswords.ownerOpenId, admin.openId)).limit(1))[0];
  if (existing) return;

  await db.insert(adminFallbackPasswords).values({ ownerOpenId: admin.openId, passwordHash: await hashPassword(ENV.adminFallbackPassword), updatedByUserId: admin.id });
  console.info("[Auth fallback] Seeded hashed administrator fallback password.");
}
