import { Button } from "@/components/ui/button";
import { useOffline } from "@/contexts/OfflineContext";
import { compressProductImage, type CompressedProductImage } from "@/lib/productImage";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Camera, Download, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type ImageSource = { name: string; reference?: string | null; imageUrl?: string | null; imageThumbUrl?: string | null };

export function ProductImage({ product, full = false, className = "h-10 w-10", rounded = "rounded-lg", zoomable = false }: { product: ImageSource; full?: boolean; className?: string; rounded?: string; zoomable?: boolean }) {
  const src = full ? (product.imageUrl ?? product.imageThumbUrl) : (product.imageThumbUrl ?? product.imageUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  if (src && failedSrc !== src) {
    const image = <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailedSrc(src)} className={`${className} ${rounded} shrink-0 bg-white object-contain ring-1 ring-inset ring-border/60`} />;
    if (!zoomable) return image;
    // Clic sur la photo : agrandissement (sans déclencher le clic de la ligne ou de la carte parente).
    return <>
      <button type="button" aria-label={`Agrandir la photo de ${product.name}`} title="Agrandir la photo" onClick={event => { event.preventDefault(); event.stopPropagation(); setViewerOpen(true); }} onKeyDown={event => event.stopPropagation()} className={`shrink-0 cursor-zoom-in ${rounded} focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>{image}</button>
      <ProductImageViewer product={product} open={viewerOpen} onOpenChange={setViewerOpen} />
    </>;
  }
  return <span aria-hidden="true" className={`${className} ${rounded} grid shrink-0 place-items-center bg-primary-soft font-semibold text-primary`}>{product.name.trim().charAt(0).toUpperCase() || "?"}</span>;
}

function photoFileName(product: ImageSource) {
  const base = (product.reference || product.name || "photo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "photo";
  return `${base}.jpg`;
}

/** Convertit la photo en JPEG (format lu par toutes les galeries). */
async function photoAsJpeg(url: string): Promise<Blob> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("Photo indisponible.");
  const source = await response.blob();
  if (source.type === "image/jpeg") return source;
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  return await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob ?? source), "image/jpeg", 0.92));
}

export function ProductImageViewer({ product, open, onOpenChange }: { product: ImageSource; open: boolean; onOpenChange: (open: boolean) => void }) {
  const src = product.imageUrl ?? product.imageThumbUrl;
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!src) return;
    setSaving(true);
    try {
      const blob = await photoAsJpeg(src);
      const file = new File([blob], photoFileName(product), { type: "image/jpeg" });
      // Téléphone : feuille de partage du système (« Enregistrer l’image » vers la galerie) ; sinon téléchargement.
      const touch = window.matchMedia?.("(pointer: coarse)").matches;
      if (touch && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: product.name }); return; }
        catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file); link.download = file.name;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      toast.success("Photo enregistrée sur l’appareil.");
    } catch {
      toast.error("Impossible d’enregistrer la photo. Vérifiez la connexion puis réessayez.");
    } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl gap-3 border-border bg-popover p-3 text-foreground sm:p-4" onClick={event => event.stopPropagation()}>
      <DialogTitle className="pr-8 text-base">{product.name}</DialogTitle>
      <DialogDescription className="sr-only">Photo du produit en grand format.</DialogDescription>
      {src && <img src={src} alt={product.name} className="max-h-[70vh] w-full rounded-lg bg-white object-contain" />}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Fermer</Button>
        <Button type="button" onClick={() => void save()} disabled={saving || !src} className="bg-primary text-primary-foreground hover:bg-primary/90">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Enregistrer la photo</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

export function ProductImageField({ product, canEdit, onChanged }: { product: ImageSource & { id: number }; canEdit: boolean; onChanged?: () => void }) {
  const { isOnline } = useOffline();
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [action, setAction] = useState<"file" | "camera" | "remove" | null>(null);
  const refresh = () => { void utils.products.invalidate(); void utils.products.detail.invalidate({ id: product.id }); void utils.dashboard.get.invalidate(); onChanged?.(); };
  const upload = trpc.products.uploadImage.useMutation({ onSuccess: () => { toast.success("Photo enregistrée."); refresh(); }, onError: error => toast.error(error.message), onSettled: () => setAction(null) });
  const remove = trpc.products.removeImage.useMutation({ onSuccess: () => { toast.success("Photo retirée."); refresh(); }, onError: error => toast.error(error.message), onSettled: () => setAction(null) });
  const pending = preparing || upload.isPending || remove.isPending;
  const handleFile = async (file: File | undefined, source: "file" | "camera" = "file") => {
    if (!file) return;
    if (!isOnline) { toast.error("Reconnectez-vous pour envoyer une photo. L’envoi hors connexion n’est pas disponible."); return; }
    setPreparing(true); setAction(source);
    try { const compressed = await compressProductImage(file); upload.mutate({ productId: product.id, ...compressed }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Photo illisible."); setAction(null); }
    finally { setPreparing(false); }
  };
  const hasImage = Boolean(product.imageUrl || product.imageThumbUrl);
  const touchDevice = useTouchDevice();
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
    <div className="relative"><ProductImage product={product} full zoomable className="h-28 w-28 text-3xl" rounded="rounded-xl" />{pending && <span className="absolute inset-0 grid place-items-center rounded-xl bg-card/70" aria-label="Traitement de la photo"><Loader2 className="h-6 w-6 animate-spin text-primary" /></span>}</div>
    {canEdit && <div className="flex flex-col gap-2">
      {!isOnline && <p role="status" className="text-xs text-warning ">Envoi de photos indisponible hors connexion.</p>}
      <div className="flex flex-wrap gap-2">
        {touchDevice && <Button type="button" variant="outline" disabled={pending || !isOnline} onClick={() => cameraInput.current?.click()}>{action === "camera" && pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}Prendre une photo</Button>}
        <Button type="button" variant="outline" disabled={pending || !isOnline} onClick={() => fileInput.current?.click()}>{action === "file" && pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{hasImage ? "Remplacer la photo" : "Ajouter une photo"}</Button>
        {hasImage && <Button type="button" variant="ghost" disabled={pending || !isOnline} onClick={() => { setAction("remove"); remove.mutate({ productId: product.id }); }} className="text-destructive hover:bg-destructive-soft hover:text-destructive">{action === "remove" && remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Retirer</Button>}
      </div>
      <p className="text-xs text-faint">JPEG, PNG ou WEBP. La photo est réduite automatiquement avant l’envoi.</p>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { void handleFile(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => { void handleFile(event.target.files?.[0], "camera"); event.target.value = ""; }} />
    </div>}
  </div>;
}

/** Appareil tactile (téléphone, tablette) : l’appareil photo s’ouvre directement via l’attribut capture. */
function useTouchDevice() {
  const [touch] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0));
  return touch;
}

export function NewProductPhotoPicker({ name, value, onChange, onBusyChange }: { name: string; value: CompressedProductImage | null; onChange: (value: CompressedProductImage | null) => void; onBusyChange?: (busy: boolean) => void }) {
  const { isOnline } = useOffline();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const touchDevice = useTouchDevice();
  const [preparing, setPreparing] = useState(false);
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isOnline) { toast.error("Reconnectez-vous pour préparer une photo de produit."); return; }
    setPreparing(true); onBusyChange?.(true);
    try { onChange(await compressProductImage(file)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Photo illisible."); }
    finally { setPreparing(false); onBusyChange?.(false); }
  };
  return <div className="flex items-center gap-3"><ProductImage product={{ name: name || "?", imageUrl: value?.image ?? null }} full className="h-16 w-16 text-xl" rounded="rounded-xl" /><div className="flex flex-wrap gap-2">{touchDevice && <Button type="button" variant="outline" size="sm" disabled={preparing || !isOnline} onClick={() => cameraInput.current?.click()}><Camera className="h-4 w-4" />Prendre une photo</Button>}<Button type="button" variant="outline" size="sm" disabled={preparing || !isOnline} onClick={() => fileInput.current?.click()}>{preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{value ? "Changer la photo" : touchDevice ? "Choisir dans la galerie" : "Ajouter une photo"}</Button>{value && <Button type="button" variant="ghost" size="sm" disabled={!isOnline} onClick={() => onChange(null)} className="text-destructive hover:bg-destructive-soft hover:text-destructive"><Trash2 className="h-4 w-4" />Retirer</Button>}</div><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { void handleFile(event.target.files?.[0]); event.target.value = ""; }} /><input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => { void handleFile(event.target.files?.[0]); event.target.value = ""; }} /></div>;
}
