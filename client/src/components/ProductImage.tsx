import { Button } from "@/components/ui/button";
import {
  compressProductImage,
  type CompressedProductImage,
} from "@/lib/productImage";
import { trpc } from "@/lib/trpc";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type ImageSource = {
  name: string;
  imageUrl?: string | null;
  imageThumbUrl?: string | null;
};

/**
 * Photo d'un produit, ou pastille avec son initiale quand il n'en a pas.
 * `full` charge l'image 600 px (fiche produit) ; sinon la miniature.
 */
export function ProductImage({
  product,
  full = false,
  className = "h-10 w-10",
  rounded = "rounded-lg",
}: {
  product: ImageSource;
  full?: boolean;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = full
    ? (product.imageUrl ?? product.imageThumbUrl)
    : (product.imageThumbUrl ?? product.imageUrl);
  if (src && !failed)
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${className} ${rounded} shrink-0 bg-muted object-cover`}
      />
    );
  return (
    <span
      aria-hidden="true"
      className={`${className} ${rounded} grid shrink-0 place-items-center bg-primary-soft font-semibold text-primary`}
    >
      {product.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Ajout, remplacement et retrait de la photo depuis la fiche produit. */
export function ProductImageField({
  product,
  canEdit,
  onChanged,
}: {
  product: ImageSource & { id: number };
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const refresh = () => {
    void utils.products.list.invalidate();
    void utils.products.detail.invalidate({ id: product.id });
    void utils.dashboard.get.invalidate();
    onChanged?.();
  };
  const upload = trpc.products.uploadImage.useMutation({
    onSuccess: () => {
      toast.success("Photo enregistrée.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.products.removeImage.useMutation({
    onSuccess: () => {
      toast.success("Photo retirée.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const pending = preparing || upload.isPending || remove.isPending;
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    try {
      const compressed = await compressProductImage(file);
      upload.mutate({ productId: product.id, ...compressed });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo illisible.");
    } finally {
      setPreparing(false);
    }
  };
  const hasImage = Boolean(product.imageUrl || product.imageThumbUrl);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative">
        <ProductImage
          product={product}
          full
          className="h-28 w-28 text-3xl"
          rounded="rounded-xl"
        />
        {pending && (
          <span className="absolute inset-0 grid place-items-center rounded-xl bg-card/70">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </span>
        )}
      </div>
      {canEdit && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => cameraInput.current?.click()}
              className="sm:hidden"
            >
              <Camera className="h-4 w-4" />
              Prendre une photo
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              {hasImage ? "Remplacer la photo" : "Ajouter une photo"}
            </Button>
            {hasImage && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => remove.mutate({ productId: product.id })}
                className="text-destructive hover:bg-destructive-soft hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Retirer
              </Button>
            )}
          </div>
          <p className="text-xs text-faint">
            JPEG, PNG ou WEBP. La photo est réduite automatiquement avant
            l’envoi.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={event => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={event => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Choix d'une photo pendant la création : elle est envoyée une fois le produit enregistré. */
export function NewProductPhotoPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: CompressedProductImage | null;
  onChange: (value: CompressedProductImage | null) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    try {
      onChange(await compressProductImage(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo illisible.");
    } finally {
      setPreparing(false);
    }
  };
  return (
    <div className="flex items-center gap-3">
      <ProductImage
        product={{ name: name || "?", imageUrl: value?.image ?? null }}
        full
        className="h-16 w-16 text-xl"
        rounded="rounded-xl"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={preparing}
          onClick={() => fileInput.current?.click()}
        >
          {preparing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {value ? "Changer la photo" : "Ajouter une photo"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            className="text-destructive hover:bg-destructive-soft hover:text-destructive"
          >
            Retirer
          </Button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
