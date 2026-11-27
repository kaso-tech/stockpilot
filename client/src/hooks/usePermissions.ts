import { useAuth } from "@/_core/hooks/useAuth";
import { can, ROLE_LABELS, type Permission, type Role } from "@shared/permissions";
/** Droits de l’utilisateur courant selon la même matrice que les procédures serveur. */
export function usePermissions() {
  const { user } = useAuth();
  const role = (user?.role ?? null) as Role | null;
  const label = role === "custom" ? (user?.customRoleName ?? ROLE_LABELS.custom) : role ? ROLE_LABELS[role] : "";
  return { role, roleLabel: label, can: (permission: Permission) => can(role, permission, user?.permissions) };
}
