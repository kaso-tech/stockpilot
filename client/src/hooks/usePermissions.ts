import { useAuth } from "@/_core/hooks/useAuth";
import {
  can,
  ROLE_LABELS,
  type Permission,
  type Role,
} from "@shared/permissions";

/** Droits de l'utilisateur connecté selon la matrice partagée avec le serveur (9.3). */
export function usePermissions() {
  const { user } = useAuth();
  const role = (user?.role ?? null) as Role | null;
  return {
    role,
    roleLabel: role ? ROLE_LABELS[role] : "",
    can: (permission: Permission) => can(role, permission),
  };
}
