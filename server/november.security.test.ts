import { describe, expect, it, vi } from "vitest";
vi.mock("./db", () => ({ getDb: vi.fn(async () => null) }));
import { permissionProcedure, router } from "./_core/trpc";
import { roleChangeRefusal } from "./userRoleRules";
import { calculatePartialReturn } from "./returnRules";
import { hashAuthToken, generateAuthToken } from "./authTokens";
import { appUrl } from "./mailer";
const secured = router({ write: permissionProcedure("sales.create").mutation(() => ({ success: true })), manageUsers: permissionProcedure("users.manage").mutation(() => ({ success: true })) });
function ctx(role: string) { return { user: { id: 1001, companyId: 101, role }, req: { headers: {} }, res: {} } as never; }
describe("sécurité de l’intégration de novembre", () => {
  it("bloque les écritures du lecteur et du comptable côté serveur", async () => {
    await expect(secured.createCaller(ctx("viewer")).write()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(secured.createCaller(ctx("accountant")).write()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(secured.createCaller(ctx("manager")).manageUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(secured.createCaller(ctx("seller")).write()).resolves.toEqual({ success: true });
  });
  it("protège le propriétaire, la modification de son propre rôle et le dernier administrateur", () => {
    const base = { actorUserId: 1, targetUserId: 2, targetIsOwner: false, targetIsFallbackAdmin: false, activeAdminCount: 1, currentRole: "admin" as const, nextRole: "seller" as const };
    expect(roleChangeRefusal(base)).toBe("last_admin");
    expect(roleChangeRefusal({ ...base, targetIsOwner: true })).toBe("owner");
    expect(roleChangeRefusal({ ...base, targetUserId: 1 })).toBe("self");
    expect(roleChangeRefusal({ ...base, activeAdminCount: 2 })).toBe(null);
  });
  it("ne stocke qu’une empreinte de jeton et génère un jeton aléatoire de 43 caractères", () => {
    const token = generateAuthToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashAuthToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAuthToken(token)).not.toBe(token);
  });
  it("conserve exactement la somme remboursable lors de trois retours d’une unité", () => {
    const item = { id: 1, productId: 1, productName: "Article", quantity: 3, returnedQuantity: 0, lineTotalCents: 100, lineCostCents: 50 };
    let total = 0;
    for (let index = 0; index < 3; index++) {
      const result = calculatePartialReturn({ totalCents: 100, deliveryFeeCents: 0, amountPaidCents: 100 - total }, [{ ...item, returnedQuantity: index }], [{ saleItemId: 1, quantity: 1, restock: true }]);
      total += result.refundCents;
    }
    expect(total).toBe(100);
  });
  it("isole les taux différents lors d’un retour de la seule ligne exonérée", () => {
    const items = [{ id: 1, productId: 1, productName: "Taxé", quantity: 1, lineTotalCents: 10000, lineCostCents: 0, vatRateBasisPoints: 2000, vatCents: 2000 }, { id: 2, productId: 2, productName: "Exonéré", quantity: 1, lineTotalCents: 10000, lineCostCents: 0, vatRateBasisPoints: 0, vatCents: 0 }];
    expect(calculatePartialReturn({ totalCents: 22000, deliveryFeeCents: 0, amountPaidCents: 22000 }, items, [{ saleItemId: 2, quantity: 1, restock: false }]).refundCents).toBe(10000);
  });
  it("n’utilise jamais le Host navigateur comme origine du lien de récupération", () => {
    const before = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = "https://stockpilot.example.test";
    expect(appUrl({ protocol: "http", get: () => "attacker.invalid" })).toBe("https://stockpilot.example.test");
    process.env.PUBLIC_APP_URL = "http://attacker.invalid";
    expect(() => appUrl()).toThrow(/HTTPS/);
    if (before === undefined) delete process.env.PUBLIC_APP_URL; else process.env.PUBLIC_APP_URL = before;
  });
});
