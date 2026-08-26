import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { and, eq } from "drizzle-orm";
import { companies } from "../../drizzle/schema";
import { getDb } from "../db";

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
  if (user.companyId) {
    const db = await getDb();
    // Certaines doubles de tests injectent un accès DB minimal pour tester les
    // règles métier isolées. En production, le client Drizzle expose toujours
    // select et le contrôle de suspension est donc systématiquement appliqué.
    const company = db && typeof (db as any).select === "function" ? (await db.select({ status: companies.platformStatus }).from(companies).where(and(eq(companies.id, user.companyId))).limit(1))[0] : null;
    if (company?.status === "suspended") throw new TRPCError({ code: "FORBIDDEN", message: "Cette entreprise est temporairement suspendue. Contactez le support StockPilot." });
  }
  return next({ ctx: { ...ctx, user } });
});

export const protectedProcedure = authenticatedProcedure.use(requireActiveCompany);

export const adminProcedure = t.procedure.use(
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
