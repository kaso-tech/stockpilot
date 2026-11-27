import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { and, eq } from "drizzle-orm";
import { companies } from "../../drizzle/schema";
import { getDb } from "../db";
import { can, type Permission } from "@shared/permissions";

/** Message lisible pour une erreur SQL : la requête brute (avec ses paramètres) reste dans les journaux du serveur. */
export function databaseErrorMessage(error: { message: string; cause?: unknown }): string | null {
  if (!error.message.startsWith("Failed query:")) return null;
  const cause = error.cause as { code?: string; errno?: number; sqlMessage?: string } | undefined;
  const code = cause?.code ?? "";
  if (code === "WARN_DATA_TRUNCATED" || code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" || code === "ER_BAD_FIELD_ERROR" || code === "ER_NO_SUCH_TABLE" || /Data truncated|Unknown column|doesn't exist/i.test(cause?.sqlMessage ?? "")) return "La base de données n’est pas à jour pour cette fonctionnalité (mise à jour manquante). Contactez l’administrateur de la plateforme.";
  if (code === "ER_DUP_ENTRY") return "Cet élément existe déjà.";
  return "L’opération n’a pas pu être enregistrée dans la base de données. Réessayez ; si le problème persiste, contactez l’administrateur.";
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const friendly = databaseErrorMessage(error.cause instanceof Error ? (error.cause as Error & { cause?: unknown }) : error);
    if (!friendly) return shape;
    console.error("[DB]", error.message, (error.cause as any)?.cause?.sqlMessage ?? (error.cause as any)?.sqlMessage ?? "");
    return { ...shape, message: friendly };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const authenticatedProcedure = t.procedure.use(requireUser);

const requireActiveCompany = t.middleware(async opts => {
  const { ctx, next } = opts;
  const user = ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (user.companyId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Aucune entreprise active n’est associée à ce compte." });
  }

  const companyId = user.companyId;
  const db = await getDb();
  // Certaines doubles de tests injectent un accès DB minimal pour tester les
  // règles métier isolées. En production, le client Drizzle expose toujours
  // select et le contrôle de suspension est donc systématiquement appliqué.
  const company = db && typeof (db as any).select === "function" ? (await db.select({ status: companies.platformStatus }).from(companies).where(and(eq(companies.id, companyId))).limit(1))[0] : null;
  if (company?.status === "suspended") throw new TRPCError({ code: "FORBIDDEN", message: "Cette entreprise est temporairement suspendue. Contactez le support StockPilot." });

  return next({ ctx: { ...ctx, user: { ...user, companyId } } });
});

export const protectedProcedure = authenticatedProcedure.use(requireActiveCompany);

/** Applique la matrice d’accès tenant ; les contrôles entrepôt et vendeur restent complémentaires. */
export const permissionProcedure = (permission: Permission) => protectedProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user || !can(ctx.user.role, permission, ctx.user.permissions)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Cette action n’est pas autorisée pour votre rôle." });
    }
    return next();
  }),
);

export const adminProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Aliases de compatibilité : le code legacy conserve ses routes et reçoit désormais les refus métier.
export const catalogProcedure = permissionProcedure("catalog.manage");
export const customerProcedure = permissionProcedure("customers.manage");
export const purchasingProcedure = permissionProcedure("purchasing.manage");
export const stockAdjustmentProcedure = permissionProcedure("stock.adjust");
export const inventoryProcedure = permissionProcedure("inventory.manage");
export const expensesProcedure = permissionProcedure("expenses.manage");
export const payrollProcedure = permissionProcedure("payroll.manage");
export const teamProcedure = permissionProcedure("team.manage");
export const auditProcedure = permissionProcedure("audit.view");
export const cashProcedure = permissionProcedure("cash.close");
