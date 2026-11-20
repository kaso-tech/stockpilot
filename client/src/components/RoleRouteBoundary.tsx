import { useAuth } from "@/_core/hooks/useAuth";
import { canOpenRoute } from "@shared/routePermissions";
import { Link, useLocation } from "wouter";

export function RoleRouteBoundary({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  if (user && !canOpenRoute(user.role, location)) {
    return <section className="rounded-xl border border-border bg-card p-6 text-card-foreground" role="alert">
      <h1 className="text-xl font-semibold">Accès limité par votre rôle</h1>
      <p className="mt-0.5 text-[13px] text-muted-foreground">Cette rubrique n’est pas disponible pour votre rôle. Vos autres espaces restent accessibles dans le menu.</p>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-primary-foreground">Retour au tableau de bord</Link>
    </section>;
  }
  return children;
}
