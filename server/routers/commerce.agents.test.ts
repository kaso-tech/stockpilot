import { beforeEach, describe, expect, it, vi } from "vitest";
import { agents, auditLogs, remunerationProfiles, sellerCredentials, users } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ getDb: vi.fn() }));
import { getDb } from "../db";
import { commerceRouter } from "./commerce";

const mockedGetDb = vi.mocked(getDb);
const remuneration = { remunerationMode: "commission" as const, fixedMonthlyCents: 0, commissionBasis: "revenue" as const, rateBasisPoints: 750, active: true };

function adminContext(): TrpcContext { return { user: { id: 1, openId: "admin-agent-test", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", active: true, companyId: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] }; }

describe("commerce agents et vendeurs", () => {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: unknown }> = [];
  beforeEach(() => {
    inserts.length = 0; updates.length = 0;
    const credential = { id: 71, userId: 30, username: "vendeur.test", passwordHash: "salt:hash" };
    const sourceAgent = { id: 20, name: "Awa Agent", type: "sales_agent", email: "awa@example.test", phone: null, active: true };
    const sourceSeller = { id: 30, name: "Vendeur Test", email: "vendeur@example.test", role: "seller", active: true };
    const profiles = [{ id: 51, beneficiaryType: "agent" as const, beneficiaryId: 20, ...remuneration }, { id: 52, beneficiaryType: "user" as const, beneficiaryId: 30, ...remuneration }];
    const rowsFor = (table: unknown) => table === sellerCredentials ? [credential] : table === remunerationProfiles ? profiles : table === agents ? [sourceAgent] : table === users ? [sourceSeller] : [];
    const db: any = {
      insert: (table: unknown) => ({ values: async (values: unknown) => { inserts.push({ table, values }); return [{ insertId: table === agents ? 20 : table === users ? 30 : 1 }]; } }),
      update: (table: unknown) => ({ set: (values: unknown) => ({ where: async () => { updates.push({ table, values }); } }) }),
      select: () => ({ from: (table: unknown) => { const rows: any = rowsFor(table); rows.limit = async () => rows; rows.where = () => rows; return rows; } }),
    };
    mockedGetDb.mockResolvedValue(db);
  });

  it("crée un agent avec un profil de rémunération", async () => {
    const result = await commerceRouter.createCaller(adminContext()).agents.create({ name: "Awa Agent", type: "sales_agent", email: null, phone: null, active: true, remuneration });
    expect(result).toEqual({ id: 20 });
    expect(inserts.find(item => item.table === agents)?.values).toMatchObject({ name: "Awa Agent", type: "sales_agent" });
    expect(inserts.find(item => item.table === remunerationProfiles)?.values).toMatchObject({ beneficiaryType: "agent", beneficiaryId: 20, ...remuneration });
  });

  it("met à jour puis désactive un agent en préservant l’historique", async () => {
    const caller = commerceRouter.createCaller(adminContext());
    await caller.agents.update({ id: 20, name: "Awa Modifiée", type: "cashier", email: null, phone: null, active: true, remuneration: { ...remuneration, remunerationMode: "fixed", fixedMonthlyCents: 150000, rateBasisPoints: 0 } });
    await caller.agents.remove({ id: 20 });
    expect(updates.find(item => item.table === agents && (item.values as any).name === "Awa Modifiée")?.values).toMatchObject({ type: "cashier" });
    expect(updates.find(item => item.table === agents && (item.values as any).active === false)?.values).toEqual({ active: false });
  });

  it("crée, modifie et désactive un vendeur avec des identifiants locaux", async () => {
    const caller = commerceRouter.createCaller(adminContext());
    await caller.sellers.create({ name: "Vendeur Test", email: "nouveau.vendeur@example.test", username: "vendeur.test", password: "Vendeur!2026", remuneration });
    await caller.sellers.update({ id: 30, name: "Vendeur Modifié", email: "vendeur@example.test", username: "vendeur.modifie", remuneration, password: "Nouveau!2026" });
    await caller.sellers.remove({ id: 30 });
    expect(inserts.find(item => item.table === sellerCredentials)?.values).toMatchObject({ userId: 30, username: "vendeur.test" });
    expect(updates.find(item => item.table === sellerCredentials)?.values).toMatchObject({ username: "vendeur.modifie" });
    expect(updates.find(item => item.table === users && (item.values as any).active === false)?.values).toEqual({ active: false });
    expect(inserts.filter(item => item.table === auditLogs)).toHaveLength(3);
  });

  it("convertit un agent en vendeur puis un vendeur en agent tout en désactivant l’ancien profil", async () => {
    const caller = commerceRouter.createCaller(adminContext());
    await caller.agents.convertToSeller({ id: 20, email: "awa.vendeuse@example.test", username: "awa.vendeuse", password: "Awa!2026", remuneration });
    await caller.agents.convertSellerToAgent({ id: 30, type: "cashier", phone: "+22670000000", remuneration });
    expect(inserts.find(item => item.table === users)?.values).toMatchObject({ name: "Awa Agent", role: "seller", active: true });
    expect(inserts.find(item => item.table === sellerCredentials)?.values).toMatchObject({ username: "awa.vendeuse" });
    expect(inserts.filter(item => item.table === agents).map(item => item.values)).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Vendeur Test", type: "cashier" })]));
    expect(updates.filter(item => (item.values as any).active === false)).toHaveLength(2);
  });
});
