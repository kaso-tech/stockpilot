import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { sellerWarehouseAssignments } from "../drizzle/schema";
import { companyScope } from "./companyScope";
import { getScopedWarehouse } from "./warehouseStock";
import { type WarehousePermission, type WarehouseRole, warehouseRoleCan } from "./warehouseRoleRules";

type ScopedUser = { id: number; role: "admin" | "seller"; companyId: number | null };

export async function assignedWarehouseIds(tx: any, user: ScopedUser) {
  if (user.role !== "seller") return null;
  const rows = await tx.select({ warehouseId: sellerWarehouseAssignments.warehouseId })
    .from(sellerWarehouseAssignments)
    .where(and(companyScope(sellerWarehouseAssignments.companyId, user.companyId), eq(sellerWarehouseAssignments.sellerUserId, user.id)));
  return rows.map((row: { warehouseId: number }) => row.warehouseId);
}

export async function warehouseRoleForUser(tx: any, user: ScopedUser, warehouseId: number): Promise<WarehouseRole | null> {
  if (user.role !== "seller") return "manager";
  const assignment = (await tx.select({ warehouseRole: sellerWarehouseAssignments.warehouseRole }).from(sellerWarehouseAssignments)
    .where(and(companyScope(sellerWarehouseAssignments.companyId, user.companyId), eq(sellerWarehouseAssignments.sellerUserId, user.id), eq(sellerWarehouseAssignments.warehouseId, warehouseId)))
    .limit(1))[0];
  return assignment?.warehouseRole ?? null;
}

export async function assertSellerWarehouseAccess(tx: any, user: ScopedUser, warehouseId: number, options?: { requireActive?: boolean; permission?: WarehousePermission }) {
  const warehouse = await getScopedWarehouse(tx, user.companyId, warehouseId, options);
  if (user.role !== "seller") return warehouse;
  const role = await warehouseRoleForUser(tx, user, warehouse.id);
  if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "Cet entrepôt ne vous est pas attribué." });
  if (options?.permission && !warehouseRoleCan(role, options.permission)) throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle dans cet entrepôt ne permet pas cette action." });
  return warehouse;
}
