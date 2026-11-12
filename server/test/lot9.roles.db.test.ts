import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  ctx,
  realDb,
  realDbUrl,
  resetDatabase,
  seedTenant,
  type SeededTenant,
} from "./realDb";
import { appRouter } from "../routers";
import { clearRateLimitsForTests } from "../rateLimit";
import { users } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import type { AuthenticatedUser } from "../_core/sdk";

const product = {
  reference: "ROLE-1",
  name: "Produit",
  description: null,
  category: "Divers",
  unit: "pièce",
  purchasePriceCents: 100,
  retailPriceCents: 200,
  wholesalePriceCents: 150,
  quantity: 5,
  minimumQuantity: 0,
  supplierId: null,
};
const remuneration = {
  remunerationMode: "fixed" as const,
  fixedMonthlyCents: 0,
  commissionBasis: "revenue" as const,
  rateBasisPoints: 0,
  active: true,
};
const publicCaller = () =>
  appRouter.createCaller({
    user: null,
    req: { protocol: "https", ip: "203.0.113.30", headers: {} },
    res: { cookie: () => undefined, clearCookie: () => undefined },
  } as unknown as TrpcContext);

describe.skipIf(!realDbUrl)("Lot 9.3 — rôles (MySQL réel)", () => {
  let a: SeededTenant;
  beforeEach(async () => {
    clearRateLimitsForTests();
    await resetDatabase();
    a = await seedTenant("a");
  });

  async function withRole(role: AuthenticatedUser["role"]) {
    const db = await realDb();
    await db.update(users).set({ role }).where(eq(users.id, a.seller.id));
    return { ...a.seller, role } as AuthenticatedUser;
  }

  it("lecture seule : consulte mais ne modifie rien", async () => {
    const viewer = appRouter.createCaller(ctx(await withRole("viewer")));
    await expect(viewer.products.list()).resolves.toEqual([]);
    await expect(viewer.products.create(product)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      viewer.commerce.customers.create({
        name: "Client",
        otherReference: null,
        type: "ordinary",
        email: null,
        phone: null,
        address: null,
        taxNumber: null,
        notes: null,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("gérant : gère le catalogue mais ni les paramètres ni les sauvegardes", async () => {
    const manager = appRouter.createCaller(ctx(await withRole("manager")));
    await expect(manager.products.create(product)).resolves.toHaveProperty(
      "id"
    );
    await expect(
      manager.commerce.settings.save({
        defaultSalesAgentId: null,
        defaultCashierId: null,
        requireSalesAgent: false,
        requireCashier: false,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(manager.backups.get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("comptable : dépenses oui, ventes non", async () => {
    const accountant = appRouter.createCaller(
      ctx(await withRole("accountant"))
    );
    await expect(accountant.expenses.list()).resolves.toEqual([]);
    const { id: productId } = await appRouter
      .createCaller(ctx(a.admin))
      .products.create(product);
    await expect(
      accountant.transactions.createDraft({
        channel: "pos",
        customerId: null,
        note: null,
        items: [{ productId, quantity: 1 }],
        salesAgentId: null,
        cashierId: null,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("l'administrateur attribue les rôles ; un vendeur promu se connecte toujours ; le dernier administrateur est protégé", async () => {
    const admin = appRouter.createCaller(ctx(a.admin));
    const { id } = await admin.commerce.sellers.create({
      name: "Awa",
      email: "awa@a.test",
      username: "awa.a",
      password: "Vendeuse!2026",
      remuneration,
    });
    await admin.users.updateRole({ id, role: "admin" });
    await expect(
      publicCaller().auth.passwordLogin({
        email: "awa@a.test",
        password: "Vendeuse!2026",
      })
    ).resolves.toMatchObject({ role: "admin" });
    await admin.users.updateRole({ id, role: "accountant" });
    await expect(
      publicCaller().auth.passwordLogin({
        email: "awa@a.test",
        password: "Vendeuse!2026",
      })
    ).resolves.toMatchObject({ role: "accountant" });
    await expect(
      admin.users.updateRole({ id: a.admin.id, role: "manager" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      appRouter
        .createCaller(ctx(await withRole("manager")))
        .users.updateRole({ id, role: "viewer" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("un rôle ne peut pas être attribué dans une autre entreprise", async () => {
    const b = await seedTenant("b");
    await expect(
      appRouter
        .createCaller(ctx(a.admin))
        .users.updateRole({ id: b.seller.id, role: "viewer" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
