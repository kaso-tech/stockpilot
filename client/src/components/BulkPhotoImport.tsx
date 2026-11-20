import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/page";
import { StatusPill } from "@/components/StatusPill";
import { compressProductImage } from "@/lib/productImage";
import {
  matchPhotosToProducts,
  type PhotoMatch,
} from "@/lib/productPhotoMatch";
import { trpc } from "@/lib/trpc";
import { Images, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type Product = {
  id: number;
  reference: string;
  name: string;
  imageUrl?: string | null;
};

/**
 * Association en masse : les photos sont nommées d'après la référence
 * (PRD-101.jpg) ou le nom du produit, puis compressées et envoyées une à une.
 */
export function BulkPhotoImport({ products }: { products: Product[] }) {
  const utils = trpc.useUtils();
  const upload = trpc.products.uploadImage.useMutation();
  const input = useRef<HTMLInputElement>(null);
  const [matches, setMatches] = useState<PhotoMatch<Product>[]>([]);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const ready = matches.filter(match => match.product && !match.duplicate);
  const running = progress !== null;

  const choose = (files: FileList | null) => {
    const images = Array.from(files ?? []).filter(file =>
      /^image\//.test(file.type)
    );
    if (!images.length) return;
    setErrors([]);
    setMatches(matchPhotosToProducts(images, products));
  };

  const run = async () => {
    const failures: string[] = [];
    setProgress({ done: 0, total: ready.length });
    for (let index = 0; index < ready.length; index += 1) {
      const match = ready[index];
      try {
        const compressed = await compressProductImage(match.file);
        await upload.mutateAsync({
          productId: match.product!.id,
          ...compressed,
        });
      } catch (error) {
        failures.push(
          `${match.file.name} — ${error instanceof Error ? error.message : "échec"}`
        );
      }
      setProgress({ done: index + 1, total: ready.length });
    }
    await utils.products.list.invalidate();
    setProgress(null);
    setErrors(failures);
    setMatches([]);
    const saved = ready.length - failures.length;
    if (failures.length)
      toast.warning(
        `${saved} photo(s) associée(s), ${failures.length} en échec.`
      );
    else toast.success(`${saved} photo(s) associée(s) aux produits.`);
  };

  return (
    <Panel>
      <PanelHeader
        title="Photos des produits"
        detail="Nommez chaque photo d’après la référence du produit (PRD-101.jpg) ou son nom exact, puis sélectionnez-les toutes d’un coup."
        action={
          <Button
            variant="outline"
            disabled={running}
            onClick={() => input.current?.click()}
          >
            <Images className="h-4 w-4" />
            Choisir des photos
          </Button>
        }
      />
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={event => {
          choose(event.target.files);
          event.target.value = "";
        }}
      />
      {matches.length > 0 && (
        <div className="border-t border-border">
          <div className="max-h-[360px] divide-y divide-border overflow-y-auto">
            {matches.map((match, index) => (
              <div
                key={`${match.file.name}-${index}`}
                className="flex items-center gap-3 px-5 py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {match.file.name}
                </span>
                <span className="hidden min-w-0 flex-1 truncate text-muted-foreground sm:block">
                  {match.product
                    ? `${match.product.reference} · ${match.product.name}`
                    : "—"}
                </span>
                {!match.product ? (
                  <StatusPill tone="danger">Aucun produit</StatusPill>
                ) : match.duplicate ? (
                  <StatusPill tone="neutral">Doublon ignoré</StatusPill>
                ) : match.replaces ? (
                  <StatusPill tone="warning">Remplace</StatusPill>
                ) : (
                  <StatusPill tone="success">Nouvelle photo</StatusPill>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-muted-foreground">
              {ready.length} photo{ready.length > 1 ? "s" : ""} prête
              {ready.length > 1 ? "s" : ""} sur {matches.length}
              {matches.length - ready.length > 0
                ? ` · ${matches.length - ready.length} ignorée(s)`
                : ""}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={running}
                onClick={() => setMatches([])}
              >
                Annuler
              </Button>
              <Button disabled={!ready.length || running} onClick={run}>
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {running
                  ? `Envoi ${progress!.done} / ${progress!.total}`
                  : `Associer ${ready.length} photo${ready.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
          {running && (
            <div className="h-1 bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${(progress!.done / Math.max(progress!.total, 1)) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}
      {errors.length > 0 && (
        <div className="border-t border-border px-5 py-3 text-[13px] text-destructive">
          {errors.slice(0, 8).map(error => (
            <p key={error}>{error}</p>
          ))}
          {errors.length > 8 && <p>… et {errors.length - 8} autre(s).</p>}
        </div>
      )}
    </Panel>
  );
}
