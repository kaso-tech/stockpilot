export type ManagedRole = import("@shared/permissions").Role;
export type RoleChangeContext = {
  actorUserId: number;
  targetUserId: number;
  targetIsOwner: boolean;
  targetIsFallbackAdmin: boolean;
  activeAdminCount: number;
  currentRole: ManagedRole;
  nextRole: ManagedRole;
};
export type RoleChangeRefusal = "self" | "owner" | "fallback_admin" | "last_admin" | null;
/** Returns a stable refusal code; callers perform the tenant-scoped read before invoking it. */
export function roleChangeRefusal(input: RoleChangeContext): RoleChangeRefusal {
  if (input.actorUserId === input.targetUserId && input.currentRole !== input.nextRole) return "self";
  if (input.targetIsOwner && input.currentRole !== input.nextRole) return "owner";
  if (input.targetIsFallbackAdmin && input.currentRole === "admin" && input.nextRole !== "admin") return "fallback_admin";
  if (input.currentRole === "admin" && input.nextRole !== "admin" && input.activeAdminCount <= 1) return "last_admin";
  return null;
}
