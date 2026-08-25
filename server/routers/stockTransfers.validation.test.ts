import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { stockTransfersRouter } from "./stockTransfers";

function context(): TrpcContext {
  return {
    user: { id: 31, openId: "warehouse-admin", name: "Admin", email: "admin@example.test", loginMethod: "password", role: "admin", companyId: 17, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("stockTransfers.create", () => {
  it("refuse un transfert dont la source et la destination sont identiques avant tout accès en base", async () => {
    const caller = stockTransfersRouter.createCaller(context());
    await expect(caller.create({ sourceWarehouseId: 4, destinationWarehouseId: 4, notes: null, items: [{ productId: 11, quantity: 2 }] })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("différentes") });
  });

  it("refuse un produit dupliqué dans les lignes avant tout accès en base", async () => {
    const caller = stockTransfersRouter.createCaller(context());
    await expect(caller.create({ sourceWarehouseId: 4, destinationWarehouseId: 9, notes: null, items: [{ productId: 11, quantity: 2 }, { productId: 11, quantity: 3 }] })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("qu’une fois") });
  });
});
