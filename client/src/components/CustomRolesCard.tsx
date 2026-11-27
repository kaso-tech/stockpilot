import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { PERMISSION_GROUPS, PERMISSION_LABELS, ROLE_LABELS, SENSITIVE_PERMISSIONS, permissionsOf, type Permission, type Role } from "@shared/permissions";
import { Pencil, Plus, ShieldPlus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CustomRole = { id: number; name: string; description: string | null; permissions: Permission[]; userCount: number };
const TEMPLATE_ROLES: Role[] = ["manager", "accountant", "seller", "cashier", "storekeeper", "purchaser", "viewer"];
const emptyForm = { id: null as number | null, name: "", description: "", permissions: [] as Permission[] };

/** Rôles personnalisés : l’administrateur choisit un nom et coche les droits accordés. */
export function CustomRolesCard() {
  const utils = trpc.useUtils();
  const { data: roles = [], isLoading } = trpc.customRoles.list.useQuery();
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const refresh = () => { void utils.customRoles.list.invalidate(); void utils.users.list.invalidate(); };
  const create = trpc.customRoles.create.useMutation({ onSuccess: () => { refresh(); setForm(null); toast.success("Rôle créé. Vous pouvez l’attribuer aux utilisateurs et aux membres de l’équipe."); }, onError: error => toast.error(error.message) });
  const update = trpc.customRoles.update.useMutation({ onSuccess: () => { refresh(); setForm(null); toast.success("Rôle mis à jour. Les droits s’appliquent dès la prochaine action des utilisateurs concernés."); }, onError: error => toast.error(error.message) });
  const remove = trpc.customRoles.remove.useMutation({ onSuccess: () => { refresh(); toast.success("Rôle supprimé."); }, onError: error => toast.error(error.message) });
  const toggle = (permission: Permission, checked: boolean) => setForm(current => current && ({ ...current, permissions: checked ? [...current.permissions, permission] : current.permissions.filter(item => item !== permission) }));
  const save = () => {
    if (!form) return;
    if (form.name.trim().length < 2) return toast.error("Donnez un nom au rôle.");
    if (!form.permissions.length) return toast.error("Cochez au moins un droit.");
    const payload = { name: form.name.trim(), description: form.description.trim() || null, permissions: form.permissions };
    if (form.id) update.mutate({ id: form.id, ...payload }); else create.mutate(payload);
  };
  const sensitiveChosen = form?.permissions.filter(permission => SENSITIVE_PERMISSIONS.includes(permission)) ?? [];
  return <Card className="border-border bg-card gap-0 py-0"><CardContent className="p-4 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><ShieldPlus className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="font-semibold text-foreground">Rôles personnalisés</h2><p className="mt-1 text-sm text-muted-foreground">Créez un rôle sur mesure (ex. « Superviseur de caisse ») en cochant ses droits, puis attribuez-le à un utilisateur ou à un membre de l’équipe.</p></div></div><Button onClick={() => setForm({ ...emptyForm })} className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />Nouveau rôle</Button></div>
    <div className="mt-4 divide-y divide-border rounded-xl border border-border">{isLoading ? <p className="p-4 text-sm text-muted-foreground">Chargement…</p> : roles.length ? (roles as CustomRole[]).map(role => <div key={role.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium text-foreground">{role.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{role.description ? `${role.description} · ` : ""}{role.permissions.length} droit(s) · {role.userCount} utilisateur(s)</p></div><div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => setForm({ id: role.id, name: role.name, description: role.description ?? "", permissions: role.permissions })}><Pencil className="h-3.5 w-3.5" />Modifier</Button><Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => { if (window.confirm(`Supprimer le rôle « ${role.name} » ?`)) remove.mutate({ id: role.id }); }} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" />Supprimer</Button></div></div>) : <p className="p-4 text-sm text-muted-foreground">Aucun rôle personnalisé pour le moment.</p>}</div>

    <Dialog open={Boolean(form)} onOpenChange={value => !value && setForm(null)}><DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-popover text-foreground sm:max-w-2xl"><DialogHeader><DialogTitle>{form?.id ? "Modifier le rôle" : "Nouveau rôle personnalisé"}</DialogTitle></DialogHeader>
      {form && <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm"><span className="font-medium">Nom du rôle *</span><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex. Superviseur de caisse" /></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Partir d’un rôle existant</span><select aria-label="Partir d’un rôle existant" value="" onChange={event => { if (event.target.value) setForm({ ...form, permissions: permissionsOf(event.target.value as Role) }); }} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="">Choisir pour pré-cocher…</option>{TEMPLATE_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label></div>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Description</span><Input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Ce que fait ce rôle (facultatif)" /></label>
        <div className="grid gap-3 sm:grid-cols-2">{PERMISSION_GROUPS.map(group => <fieldset key={group.label} className="rounded-xl border border-border p-3"><legend className="px-1 text-xs font-semibold text-primary">{group.label}</legend><div className="space-y-1.5">{group.permissions.map(permission => { const sensitive = SENSITIVE_PERMISSIONS.includes(permission); return <label key={permission} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent/50"><input type="checkbox" checked={form.permissions.includes(permission)} onChange={event => toggle(permission, event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#007B8B]" /><span className="min-w-0 flex-1">{PERMISSION_LABELS[permission]}</span>{sensitive && <Badge className="border-0 bg-warning-soft text-[10px] text-warning">Sensible</Badge>}</label>; })}</div></fieldset>)}</div>
        {sensitiveChosen.length > 0 && <p className="flex gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs text-warning"><TriangleAlert className="h-4 w-4 shrink-0" />Droits sensibles accordés : {sensitiveChosen.map(permission => PERMISSION_LABELS[permission]).join(", ")}. Vérifiez qu’ils sont nécessaires.</p>}
        <p className="text-xs text-muted-foreground">Sans le droit « Modifier les prix et coûts », les prix d’achat restent masqués. S’il peut vendre, les limites de prix et de remise des vendeurs s’appliquent. Les droits sont vérifiés par le serveur.</p>
      </div>}
      <DialogFooter><Button variant="ghost" onClick={() => setForm(null)}>Annuler</Button><Button onClick={save} disabled={create.isPending || update.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">{form?.id ? "Enregistrer" : "Créer le rôle"} · {form?.permissions.length ?? 0} droit(s)</Button></DialogFooter>
    </DialogContent></Dialog>
  </CardContent></Card>;
}
