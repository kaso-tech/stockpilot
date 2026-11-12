import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { can, type Permission } from "@shared/permissions";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  // Depuis la migration 0044, tout compte appartient à une entreprise : un
  // compte sans entreprise ne doit jamais accéder aux données (S5).
  if (
    !Number.isInteger(ctx.user.companyId) ||
    Number(ctx.user.companyId) <= 0
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Compte non rattaché à une entreprise.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    if (
      !Number.isInteger(ctx.user.companyId) ||
      Number(ctx.user.companyId) <= 0
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Compte non rattaché à une entreprise.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);

/**
 * Procédure soumise à un droit de la matrice (9.3). Les restrictions
 * propres aux vendeurs configurées dans le point de vente restent vérifiées
 * dans les procédures concernées.
 */
export const permissionProcedure = (permission: Permission) =>
  protectedProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      if (!can(ctx.user?.role, permission))
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      return next();
    })
  );
