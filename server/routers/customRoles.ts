import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, customRoles, users } from "../../drizzle/schema";
import { sanitizePermissions } from "@shared/permissions";
import { adminProcedure, router } from "../_core/trpc";
import { companyScope } from "../companyScope";
import { getDb } from "../db";

async function dbOrThrow() { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); return db; }

const roleInput = z.object({
  name: z.string().trim().min(2, "Donnez un nom au rôle.").max(80),
  description: z.string().trim().max(300).nullable().optional(),
  permissions: z.array(z.string().max(60)).max(60),
});

function parsePermissions(value: string) {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? sanitizePermissions(parsed.filter((item): item is string => typeof item === "string")) : []; } catch { return []; }
}

/** Rôles personnalisés de l’entreprise (réservé à l’administrateur). */
export const customRolesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const [rows, members] = await Promise.all([
      db.select().from(customRoles).where(companyScope(customRoles.companyId, ctx.user.companyId)).orderBy(customRoles.name),
      db.select({ customRoleId: users.customRoleId, active: users.active }).from(users).where(and(companyScope(users.companyId, ctx.user.companyId), eq(users.role, "custom"))),
    ]);
    return rows.map(row => ({ id: row.id, name: row.name, description: row.description, permissions: parsePermissions(row.permissions), userCount: members.filter(member => member.active && member.customRoleId === row.id).length }));
  }),
  create: adminProcedure.input(roleInput).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const permissions = sanitizePermissions(input.permissions);
    if (!permissions.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Cochez au moins une permission." });
    try {
      const result = await db.insert(customRoles).values({ companyId: ctx.user.companyId, name: input.name, description: input.description?.trim() || null, permissions: JSON.stringify(permissions), createdByUserId: ctx.user.id });
      const id = Number(result[0].insertId);
      await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Création", entityType: "Rôle personnalisé", entityId: String(id), detail: `Rôle « ${input.name} » : ${permissions.join(", ")}` });
      return { id };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "CONFLICT", message: "Un rôle porte déjà ce nom.", cause: error });
    }
  }),
  update: adminProcedure.input(roleInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const current = (await db.select().from(customRoles).where(and(eq(customRoles.id, input.id), companyScope(customRoles.companyId, ctx.user.companyId))).limit(1))[0];
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Rôle introuvable." });
    const permissions = sanitizePermissions(input.permissions);
    if (!permissions.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Cochez au moins une permission." });
    try {
      await db.update(customRoles).set({ name: input.name, description: input.description?.trim() || null, permissions: JSON.stringify(permissions) }).where(eq(customRoles.id, current.id));
    } catch (error) {
      throw new TRPCError({ code: "CONFLICT", message: "Un rôle porte déjà ce nom.", cause: error });
    }
    const before = parsePermissions(current.permissions);
    const added = permissions.filter(permission => !before.includes(permission));
    const removed = before.filter(permission => !permissions.includes(permission));
    await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Modification", entityType: "Rôle personnalisé", entityId: String(current.id), detail: `Rôle « ${input.name} »${added.length ? ` ; ajouté : ${added.join(", ")}` : ""}${removed.length ? ` ; retiré : ${removed.join(", ")}` : ""}` });
    return { success: true };
  }),
  remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const current = (await db.select().from(customRoles).where(and(eq(customRoles.id, input.id), companyScope(customRoles.companyId, ctx.user.companyId))).limit(1))[0];
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Rôle introuvable." });
    const holders = await db.select({ id: users.id }).from(users).where(and(companyScope(users.companyId, ctx.user.companyId), eq(users.role, "custom"), eq(users.customRoleId, current.id), eq(users.active, true)));
    if (holders.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Ce rôle est attribué à ${holders.length} utilisateur(s) : attribuez-leur d’abord un autre rôle.` });
    await db.delete(customRoles).where(eq(customRoles.id, current.id));
    await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Suppression", entityType: "Rôle personnalisé", entityId: String(current.id), detail: `Rôle « ${current.name} » supprimé` });
    return { success: true };
  }),
});
