import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createOperatorContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "operator-test",
      name: "Opérateur de test",
      email: "operator@example.test",
      phone: null,
      loginMethod: "manus",
      role: "seller",
      active: true,
      companyId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("contrôle des rôles StockPilot", () => {
  it("interdit à un opérateur de créer un produit", async () => {
    const caller = appRouter.createCaller(createOperatorContext());

    await expect(
      caller.products.create({
        reference: "TEST-001",
        name: "Article de test",
        description: null,
        retailPriceCents: 0,
        wholesalePriceCents: 0,
        category: "Test",
        unit: "unité",
        purchasePriceCents: 100,
        quantity: 0,
        minimumQuantity: 0,
        supplierId: null,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("interdit à un opérateur d’accéder au journal d’audit", async () => {
    const caller = appRouter.createCaller(createOperatorContext());

    await expect(caller.audit.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
