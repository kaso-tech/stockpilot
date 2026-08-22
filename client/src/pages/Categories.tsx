import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { FolderPlus, Pencil, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Restricted } from "./AuditLog";

type Category = { id: number; name: string };

export default function Categories() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } = trpc.categories.list.useQuery(undefined, { enabled: isAdmin });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const refresh = () => { utils.categories.list.invalidate(); utils.products.list.invalidate(); };
  const close = () => { setOpen(false); setEditing(null); setName(""); };
  const create = trpc.categories.create.useMutation({ onSuccess: () => { refresh(); close(); toast.success("Catégorie créée."); }, onError: error => toast.error(error.message) });
  const update = trpc.categories.update.useMutation({ onSuccess: () => { refresh(); close(); toast.success("Catégorie renommée et produits mis à jour."); }, onError: error => toast.error(error.message) });
  const remove = trpc.categories.remove.useMutation({ onSuccess: () => { refresh(); toast.success("Catégorie supprimée."); }, onError: error => toast.error(error.message) });
  const save = () => { if (name.trim().length < 2) return toast.error("Saisissez un nom de catégorie d’au moins deux caractères."); if (editing) update.mutate({ id: editing.id, name: name.trim() }); else create.mutate({ name: name.trim() }); };

  if (!isAdmin) return <Restricted title="Catégories" description="La gestion des catégories est réservée aux administrateurs." />;
  return <div className="mx-auto max-w-5xl space-y-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Catalogue</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Catégories</h1></div><Button onClick={() => { setEditing(null); setName(""); setOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90"><FolderPlus className="mr-2 h-4 w-4" />Nouvelle catégorie</Button></header><Card className="border-white/[0.07] bg-[#111722]"><CardContent className="p-0">{isLoading ? <div className="px-6 py-16 text-center text-sm text-slate-500">Chargement des catégories…</div> : categories.length ? <div className="divide-y divide-white/[0.06]">{categories.map(category => <div key={category.id} className="flex items-center justify-between gap-4 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Tags className="h-4 w-4" /></span><p className="truncate font-medium text-slate-100">{category.name}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Modifier ${category.name}`} onClick={() => { setEditing(category); setName(category.name); setOpen(true); }} className="text-primary"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Supprimer ${category.name}`} onClick={() => { if (window.confirm(`Supprimer la catégorie ${category.name} ? Elle ne peut être supprimée que si aucun produit ne l’utilise.`)) remove.mutate({ id: category.id }); }} className="text-rose-300"><Trash2 className="h-4 w-4" /></Button></div></div>)}</div> : <div className="px-6 py-16 text-center"><Tags className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-3 font-medium text-slate-300">Aucune catégorie</p><p className="mt-1 text-sm text-slate-500">Créez une catégorie avant d’ajouter un produit.</p></div>}</CardContent></Card><Dialog open={open} onOpenChange={value => !value && close()}><DialogContent className="border-white/10 bg-[#141b27] text-slate-100"><DialogHeader><DialogTitle>{editing ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle></DialogHeader><div className="space-y-2"><Label className="text-xs text-slate-300">Nom de la catégorie</Label><Input autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === "Enter" && save()} placeholder="Ex. Électronique" /></div><DialogFooter><Button variant="ghost" onClick={close}>Annuler</Button><Button onClick={save} disabled={create.isPending || update.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">{editing ? "Enregistrer" : "Créer"}</Button></DialogFooter></DialogContent></Dialog></div>;
}
