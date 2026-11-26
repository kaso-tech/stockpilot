import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { agents, salesAgentWarehouseAssignments, sellerWarehouseAssignments } from "../drizzle/schema";
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

export async function assignedWarehouseIds(tx: any, user: ScopedUser) {
  if (user.role === "admin") return null;
  if (user.role === "agent") return agentWarehouseIds(tx, user);
  const rows = await tx.select({ warehouseId: sellerWarehouseAssignments.warehouseId })
    .from(sellerWarehouseAssignments)
    .where(and(companyScope(sellerWarehouseAssignments.companyId, user.companyId), eq(sellerWarehouseAssignments.sellerUserId, user.id)));
  return rows.map((row: { warehouseId: number }) => row.warehouseId);
}

export async function warehouseRoleForUser(tx: any, user: ScopedUser, warehouseId: number): Promise<WarehouseRole | null> {
  if (user.role === "admin") return "manager";
  if (user.role === "agent") { const ids = await agentWarehouseIds(tx, user); return ids === null || ids.includes(warehouseId) ? "seller" : null; }
  const assignment = (await tx.select({ warehouseRole: sellerWarehouseAssignments.warehouseRole }).from(sellerWarehouseAssignments)
    .where(and(companyScope(sellerWarehouseAssignments.companyId, user.companyId), eq(sellerWarehouseAssignments.sellerUserId, user.id), eq(sellerWarehouseAssignments.warehouseId, warehouseId)))
    .limit(1))[0];
  return assignment?.warehouseRole ?? null;
}

export async function assertSellerWarehouseAccess(tx: any, user: ScopedUser, warehouseId: number, options?: { requireActive?: boolean; permission?: WarehousePermission }) {
  const warehouse = await getScopedWarehouse(tx, user.companyId, warehouseId, options);
  if (user.role === "admin") return warehouse;
  const role = await warehouseRoleForUser(tx, user, warehouse.id);
  if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "Cet entrepôt ne vous est pas attribué." });
  // L’agent commercial consulte seulement le stock de ses entrepôts.
  if (user.role === "agent" && options?.permission && options.permission !== "view_stock") throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle ne permet pas cette action." });
  if (options?.permission && user.role === "seller" && !warehouseRoleCan(role, options.permission)) throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle dans cet entrepôt ne permet pas cette action." });
  return warehouse;
}
