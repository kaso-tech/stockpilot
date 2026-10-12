import { Button } from "@/components/ui/button";
import { useState } from "react";

/** Limite extensible pour les listes paginées côté serveur (« Charger plus »). */
export function usePagedLimit(step = 100) {
  const [limit, setLimit] = useState(step);
  return { limit, loadMore: () => setLimit(current => current + step) };
}

/** Affiché uniquement quand la page reçue est pleine : il peut rester des lignes à charger. */
export function LoadMore({ shown, limit, onMore, loading = false }: { shown: number; limit: number; onMore: () => void; loading?: boolean }) {
  if (shown < limit) return null;
  return <div className="flex justify-center pt-2"><Button type="button" variant="outline" onClick={onMore} disabled={loading}>{loading ? "Chargement…" : "Charger plus"}</Button></div>;
}
