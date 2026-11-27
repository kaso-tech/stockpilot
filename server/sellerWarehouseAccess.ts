import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { agents, salesAgentWarehouseAssignments, sellerWarehouseAssignments, users } from "../drizzle/schema";
import { companyScope } from "./companyScope";
import { getScopedWarehouse } from "./warehouseStock";
import { type WarehousePermission, type WarehouseRole, warehouseRoleCan } from "./warehouseRoleRules";

type ScopedUser = { id: number; role: import("@shared/permissions").Role; companyId: number | null };

/** Entrepôts d’un agent commercial connecté : selon la portée de sa fiche (null = tous). */
async function agentWarehouseIds(tx: any, user: ScopedUser): Promise<number[] | null> {
  const agent = (await tx.select({ id: agents.id, warehouseScope: agents.warehouseScope }).from(agents).where(and(companyScope(agents.companyId, user.companyId), eq(agents.userId, user.id))).limit(1))[0];
  if (!agent) return [];
  if (agent.warehouseScope !== "selected") return null;
  const rows = await tx.select({ warehouseId: salesAgentWarehouseAssignments.warehouseId }).from(salesAgentWarehouseAssignments).where(and(companyScope(salesAgentWarehouseAssignments.companyId, user.companyId), eq(salesAgentWarehouseAssignments.agentId, agent.id)));
  return rows.map((row: { warehouseId: number }) => row.warehouseId);
}

/** Rôles d’entreprise : tous les entrepôts. */
const COMPANY_WIDE_ROLES = new Set(["admin", "manager", "accountant", "viewer"]);
/** Rôles liés à une fiche de l’équipe : entrepôts selon la portée de la fiche. */
const MEMBER_ROLES = new Set(["agent", "cashier", "storekeeper", "purchaser"]);

/** Entrepôts d’un membre lié : portée de sa fiche ; sans fiche, ses affectations d’entrepôt. */
async function memberWarehouseIds(tx: any, user: ScopedUser): Promise<number[] | null> {
  const linked = (await tx.select({ id: agents.id }).from(agents).where(and(companyScope(agents.companyId, user.companyId), eq(agents.userId, user.id))).limit(1))[0];
  if (linked || user.role === "agent" || user.role === "cashier") return agentWarehouseIds(tx, user);
  const rows = await tx.select({ warehouseId: sellerWarehouseAssignments.warehouseId }).from(sellerWarehouseAssignments).where(and(companyScope(sellerWarehouseAssignments.companyId, user.companyId), eq(sellerWarehouseAssignments.sellerUserId, user.id)));
  return rows.map((row: { warehouseId: number }) => row.warehouseId);
}

/** Rôle personnalisé : portée de sa fiche s’il en a une, sinon ses affectations, sinon tous les entrepôts. */
async function customRoleWarehouseIds(tx: any, user: ScopedUser): Promise<number[] | null> {
  const ids = await memberWarehouseIds(tx, user);
  return ids !== null && ids.length === 0 ? null : ids;
}

export async function assignedWarehouseIds(tx: any, user: ScopedUser) {
  if (COMPANY_WIDE_ROLES.has(user.role)) return null;
  if (MEMBER_ROLES.has(user.role)) return memberWarehouseIds(tx, user);
  if (user.role === "custom") return customRoleWarehouseIds(tx, user);
  const rows = await tx.select({ warehouseId: sellerWarehouseAssignments.warehouseId })
    .from(sellerWarehouseAssignments)
    .where(and(companyScope(sellerWarehouseAssignments.companyId, user.companyId), eq(sellerWarehouseAssignments.sellerUserId, user.id)));
  return rows.map((row: { warehouseId: number }) => row.warehouseId);
}

export async function warehouseRoleForUser(tx: any, user: ScopedUser, warehouseId: number): Promise<WarehouseRole | null> {
  if (COMPANY_WIDE_ROLES.has(user.role)) return "manager";
  if (user.role === "custom") { const ids = await customRoleWarehouseIds(tx, user); return ids === null || ids.includes(warehouseId) ? "manager" : null; }
  if (user.role === "storekeeper" || user.role === "purchaser") { const ids = await memberWarehouseIds(tx, user); return ids === null || ids.includes(warehouseId) ? "manager" : null; }
  if (user.role === "agent" || user.role === "cashier") { const ids = await agentWarehouseIds(tx, user); return ids === null || ids.includes(warehouseId) ? (user.role === "cashier" ? "cashier" : "seller") : null; }
  const assignment = (await tx.select({ warehouseRole: sellerWarehouseAssignments.warehouseRole }).from(sellerWarehouseAssignments)
    .where(and(companyScope(sellerWarehouseAssignments.companyId, user.companyId), eq(sellerWarehouseAssignments.sellerUserId, user.id), eq(sellerWarehouseAssignments.warehouseId, warehouseId)))
    .limit(1))[0];
  return assignment?.warehouseRole ?? null;
}

/**
 * L’entrepôt a-t-il un caissier séparé (compte caissier actif qui y a accès, ou vendeur nommé caissier de ce dépôt) ?
 * Sans caissier séparé, les vendeurs encaissent eux-mêmes et le bouton « Envoyer en caisse » n’a pas lieu d’être.
 */
export async function warehouseHasDedicatedCashier(tx: any, companyId: number | null, warehouseId: number): Promise<boolean> {
  const sellerCashier = (await tx.select({ id: sellerWarehouseAssignments.id }).from(sellerWarehouseAssignments).innerJoin(users, eq(users.id, sellerWarehouseAssignments.sellerUserId)).where(and(companyScope(sellerWarehouseAssignments.companyId, companyId), eq(sellerWarehouseAssignments.warehouseId, warehouseId), eq(sellerWarehouseAssignments.warehouseRole, "cashier"), eq(users.active, true))).limit(1))[0];
  if (sellerCashier) return true;
  const cashiers = await tx.select({ agentId: agents.id, scope: agents.warehouseScope }).from(agents).innerJoin(users, eq(users.id, agents.userId)).where(and(companyScope(agents.companyId, companyId), eq(agents.type, "cashier"), eq(agents.active, true), eq(users.active, true), eq(users.role, "cashier")));
  for (const cashier of cashiers as Array<{ agentId: number; scope: string }>) {
    if (cashier.scope !== "selected") return true;
    const assigned = (await tx.select({ id: salesAgentWarehouseAssignments.id }).from(salesAgentWarehouseAssignments).where(and(eq(salesAgentWarehouseAssignments.agentId, cashier.agentId), eq(salesAgentWarehouseAssignments.warehouseId, warehouseId))).limit(1))[0];
    if (assigned) return true;
  }
  return false;
}

export async function assertSellerWarehouseAccess(tx: any, user: ScopedUser, warehouseId: number, options?: { requireActive?: boolean; permission?: WarehousePermission }) {
  const warehouse = await getScopedWarehouse(tx, user.companyId, warehouseId, options);
  if (user.role === "admin") return warehouse;
  const role = await warehouseRoleForUser(tx, user, warehouse.id);
  if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "Cet entrepôt ne vous est pas attribué." });
  // L’agent commercial consulte seulement le stock de ses entrepôts.
  if (user.role === "agent" && options?.permission && options.permission !== "view_stock") throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle ne permet pas cette action." });
  // Vendeur sans caissier séparé dans l’entrepôt : il encaisse lui-même.
  if (options?.permission === "checkout" && user.role === "seller" && !warehouseRoleCan(role, "checkout") && !(await warehouseHasDedicatedCashier(tx, user.companyId, warehouse.id))) return warehouse;
  if (options?.permission && (user.role === "seller" || user.role === "cashier") && !warehouseRoleCan(role, options.permission)) throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle dans cet entrepôt ne permet pas cette action." });
  return warehouse;
}
