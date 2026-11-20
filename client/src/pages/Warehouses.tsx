import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/usePermissions";
import { trpc } from "@/lib/trpc";
import {
  ArrowRightLeft,
  CalendarClock,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  Warehouse,
} from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/page";
import { StatusPill } from "@/components/StatusPill";
import {
  WarehouseDangerDialog,
  type WarehouseDangerAction,
} from "@/components/WarehouseDangerDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/** Dépôts, stock par dépôt, transferts et lots à péremption proche (9.7). */
export default function Warehouses() {
  const { can } = usePermissions();
  const canManage = can("inventory.manage");
  // Réinitialisation et suppression : actions irréversibles, réservées aux administrateurs.
  const canDestroy = can("settings.manage");
  const [danger, setDanger] = useState<{
    warehouse: { id: number; name: string; isDefault: boolean };
    action: WarehouseDangerAction;
  } | null>(null);
  const utils = trpc.useUtils();
  const { data: warehouses = [] } = trpc.warehouses.list.useQuery();
  const { data: stock = [] } = trpc.warehouses.stock.useQuery();
  const { data: expiring = [] } = trpc.warehouses.expiringLots.useQuery({
    days: 30,
  });
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [transfer, setTransfer] = useState({
    productId: "",
    from: "",
    to: "",
    quantity: "",
  });
  const refresh = () =>
    Promise.all([
      utils.warehouses.list.invalidate(),
      utils.warehouses.stock.invalidate(),
      utils.products.list.invalidate(),
    ]);
  const create = trpc.warehouses.create.useMutation({
    onSuccess: () => {
      setNewName("");
      refresh();
      toast.success("Dépôt créé.");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.warehouses.update.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Dépôt mis à jour.");
    },
    onError: error => toast.error(error.message),
  });
  const move = trpc.warehouses.transfer.useMutation({
    onSuccess: () => {
      setTransfer({ productId: "", from: "", to: "", quantity: "" });
      refresh();
      toast.success("Transfert enregistré.");
    },
    onError: error => toast.error(error.message),
  });
  const active = warehouses.filter(item => item.active);
  const rows = useMemo(
    () =>
      stock.filter(product =>
        `${product.name} ${product.reference}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      ),
    [stock, search]
  );
  const unitsByWarehouse = useMemo(() => {
    const totals = new Map<number, number>();
    for (const product of stock)
      for (const item of product.stocks)
        totals.set(
          item.warehouseId,
          (totals.get(item.warehouseId) ?? 0) + item.quantity
        );
    return totals;
  }, [stock]);
  const nameOf = (id: number) =>
    warehouses.find(item => item.id === id)?.name ?? "—";
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <PageHeader
        title="Dépôts"
        description="Ventes, réceptions et corrections utilisent le dépôt par défaut, sauf choix contraire. La valorisation se fait au coût moyen pondéré, mis à jour à chaque réception."
      />
      <Panel>
        <PanelHeader
          title="Dépôts et magasins"
          detail={`${warehouses.length} dépôt${warehouses.length > 1 ? "s" : ""}`}
        />
        <div className="divide-y divide-border border-t border-border">
          {warehouses.map(item => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                <Warehouse className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {item.name}
                  </span>
                  {item.isDefault && (
                    <StatusPill tone="info">Par défaut</StatusPill>
                  )}
                  {!item.active && (
                    <StatusPill tone="neutral">Inactif</StatusPill>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-faint">
                  {(unitsByWarehouse.get(item.id) ?? 0).toLocaleString("fr-FR")}{" "}
                  unité(s) en stock
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-1.5">
                  {!item.isDefault && item.active && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        update.mutate({
                          id: item.id,
                          name: item.name,
                          active: true,
                          isDefault: true,
                        })
                      }
                    >
                      Définir par défaut
                    </Button>
                  )}
                  {!item.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        update.mutate({
                          id: item.id,
                          name: item.name,
                          active: !item.active,
                          isDefault: false,
                        })
                      }
                    >
                      {item.active ? "Désactiver" : "Réactiver"}
                    </Button>
                  )}
                  {canDestroy && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Autres actions pour ${item.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuItem
                          onClick={() =>
                            setDanger({ warehouse: item, action: "reset" })
                          }
                          className="cursor-pointer"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Réinitialiser (vider toutes les données)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={item.isDefault}
                          onClick={() =>
                            setDanger({ warehouse: item, action: "remove" })
                          }
                          className="cursor-pointer text-destructive focus:bg-destructive-soft focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {item.isDefault
                            ? "Suppression impossible (dépôt par défaut)"
                            : "Supprimer définitivement"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {canManage && (
          <form
            className="flex gap-2 border-t border-border p-4"
            onSubmit={event => {
              event.preventDefault();
              create.mutate({ name: newName });
            }}
          >
            <Input
              placeholder="Nom du nouveau dépôt"
              value={newName}
              onChange={event => setNewName(event.target.value)}
            />
            <Button
              type="submit"
              disabled={newName.trim().length < 2 || create.isPending}
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </form>
        )}
      </Panel>
      <WarehouseDangerDialog
        warehouse={danger?.warehouse ?? null}
        action={danger?.action ?? "reset"}
        onClose={() => setDanger(null)}
        onDone={() => {
          setDanger(null);
          void Promise.all([
            refresh(),
            utils.warehouses.expiringLots.invalidate(),
            utils.movements.list.invalidate(),
            utils.dashboard.get.invalidate(),
          ]);
        }}
      />
      {canManage && active.length > 1 && (
        <Card className="border-border bg-card gap-0 py-0">
          <CardContent className="space-y-3 p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <ArrowRightLeft className="h-4 w-4" />
              Transfert entre dépôts
            </h2>
            <form
              className="grid gap-2 sm:grid-cols-5"
              onSubmit={event => {
                event.preventDefault();
                move.mutate({
                  productId: Number(transfer.productId),
                  fromWarehouseId: Number(transfer.from),
                  toWarehouseId: Number(transfer.to),
                  quantity: Number(transfer.quantity),
                });
              }}
            >
              <select
                aria-label="Produit"
                value={transfer.productId}
                onChange={event =>
                  setTransfer({ ...transfer, productId: event.target.value })
                }
                className="h-10 rounded-md border border-border bg-background px-3 text-sm sm:col-span-2"
              >
                <option value="">Produit…</option>
                {stock.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.reference})
                  </option>
                ))}
              </select>
              <select
                aria-label="Depuis"
                value={transfer.from}
                onChange={event =>
                  setTransfer({ ...transfer, from: event.target.value })
                }
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Depuis…</option>
                {active.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Vers"
                value={transfer.to}
                onChange={event =>
                  setTransfer({ ...transfer, to: event.target.value })
                }
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Vers…</option>
                {active.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="Qté"
                  value={transfer.quantity}
                  onChange={event =>
                    setTransfer({ ...transfer, quantity: event.target.value })
                  }
                />
                <Button
                  type="submit"
                  disabled={
                    !transfer.productId ||
                    !transfer.from ||
                    !transfer.to ||
                    !Number(transfer.quantity) ||
                    move.isPending
                  }
                >
                  OK
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <Card className="border-border bg-card gap-0 py-0">
        <CardContent className="space-y-3 p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <CalendarClock className="h-4 w-4" />
            Lots périmés ou à péremption sous 30 jours
          </h2>
          {expiring.length ? (
            <ul className="space-y-1 text-sm">
              {expiring.map(lot => (
                <li
                  key={lot.id}
                  className="flex flex-wrap justify-between gap-2"
                >
                  <span>
                    {lot.productName} · lot {lot.lotNumber} ·{" "}
                    {nameOf(lot.warehouseId)}
                  </span>
                  <span
                    className={
                      lot.expired ? "text-destructive" : "text-warning"
                    }
                  >
                    {lot.quantity} {lot.unit} ·{" "}
                    {lot.expired ? "périmé le" : "expire le"} {lot.expiryDate}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun lot concerné.</p>
          )}
        </CardContent>
      </Card>
      <Card className="border-border bg-card gap-0 py-0">
        <CardContent className="overflow-x-auto p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Stock par dépôt</h2>
            <Input
              className="w-64"
              placeholder="Rechercher un produit"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Produit</th>
                {active.map(item => (
                  <th
                    key={item.id}
                    className="px-2 py-2 text-right font-medium"
                  >
                    {item.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(product => (
                <tr key={product.id} className="border-t border-border">
                  <td className="py-2 pr-3">
                    {product.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      {product.reference}
                    </span>
                  </td>
                  {active.map(item => (
                    <td key={item.id} className="px-2 py-2 text-right">
                      {product.stocks.find(
                        entry => entry.warehouseId === item.id
                      )?.quantity ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
