import { and, eq } from "drizzle-orm";
import { platformAdminUsers } from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { TrpcContext } from "./_core/context";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";

export type PlatformAccess = { userId: number; platformRole: "super_admin" | "operator" };

/**
 * Returns a distinct platform permission. The configured project owner may
 * bootstrap only their own super-admin record; every other operator must be
 * explicitly listed in platformAdminUsers.
 */
export async function requirePlatformAccess(ctx: TrpcContext): Promise<{ db: NonNullable<Awaited<ReturnType<typeof getDb>>>; access: PlatformAccess }> {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });

  let record = (await db.select().from(platformAdminUsers).where(and(eq(platformAdminUsers.userId, ctx.user.id), eq(platformAdminUsers.active, true))).limit(1))[0];
  if (!record && ENV.ownerOpenId && ctx.user.openId === ENV.ownerOpenId) {
    await db.insert(platformAdminUsers).values({ userId: ctx.user.id, platformRole: "super_admin", active: true, createdByUserId: ctx.user.id }).onDuplicateKeyUpdate({ set: { active: true, platformRole: "super_admin" } });
    record = (await db.select().from(platformAdminUsers).where(eq(platformAdminUsers.userId, ctx.user.id)).limit(1))[0];
  }
  if (!record || !record.active) throw new TRPCError({ code: "FORBIDDEN", message: "Accès plateforme non autorisé." });
  return { db, access: { userId: ctx.user.id, platformRole: record.platformRole } };
}

export function canManagePlatformCompanies(role: PlatformAccess["platformRole"]) {
  return role === "super_admin" || role === "operator";
}
