import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useOffline } from "@/contexts/OfflineContext";
import {
  ArrowLeftRight,
  Archive,
  Bell,
  Boxes,
  ChevronDown,
  CircleAlert,
  CloudOff,
  CloudUpload,
  ClipboardList,
  ClipboardCheck,
  DatabaseBackup,
  Loader2,
  WalletCards,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  ReceiptText,
  Ruler,
  ShoppingCart,
  UsersRound,
  Settings2,
  SlidersHorizontal,
  Truck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Vue d’ensemble", path: "/" },
  { icon: ShoppingCart, label: "Point de vente", path: "/pos" },
  { icon: ReceiptText, label: "Factures", path: "/factures" },
  { icon: UserRound, label: "Clients", path: "/clients" },
  { icon: PackageSearch, label: "Produits", path: "/produits" },
  { icon: Boxes, label: "Catégories", path: "/categories" },
  { icon: Ruler, label: "Unités", path: "/unites" },
  { icon: ArrowLeftRight, label: "Mouvements", path: "/mouvements" },
  { icon: ClipboardCheck, label: "Inventaires", path: "/inventaires" },
  { icon: Truck, label: "Fournisseurs", path: "/fournisseurs" },
  { icon: UsersRound, label: "Agents & paie", path: "/agents" },
  { icon: WalletCards, label: "Dépenses", path: "/depenses" },
  { icon: Archive, label: "Import & export", path: "/donnees" },
  { icon: SlidersHorizontal, label: "Paramètres", path: "/parametres" },
  { icon: DatabaseBackup, label: "Sauvegardes", path: "/sauvegardes" },
  { icon: TriangleAlert, label: "Alertes", path: "/alertes" },
  { icon: ClipboardList, label: "Journal", path: "/journal" },
  { icon: CloudUpload, label: "Synchronisation", path: "/synchronisation" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const sellerLogin = trpc.auth.localLogin.useMutation({ onSuccess: () => window.location.reload() });

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#090c13] px-6 text-slate-100">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111722] p-8 shadow-2xl shadow-black/30">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400 text-slate-950">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">StockPilot</p>
              <p className="text-xs text-slate-400">Operations workspace</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Accédez à votre espace commercial</h1>
          <Button onClick={() => startLogin()} className="mt-6 h-11 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">Connexion administrateur</Button>
          <div className="my-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"><span className="h-px flex-1 bg-white/10" />ou vendeur<span className="h-px flex-1 bg-white/10" /></div>
          <form onSubmit={event => { event.preventDefault(); sellerLogin.mutate({ username, password }); }} className="space-y-3"><Input value={username} onChange={event => setUsername(event.target.value)} placeholder="Nom d’utilisateur" autoComplete="username" className="border-white/10 bg-white/[0.04]" /><Input value={password} onChange={event => setPassword(event.target.value)} placeholder="Mot de passe" type="password" autoComplete="current-password" className="border-white/10 bg-white/[0.04]" /><Button type="submit" disabled={sellerLogin.isPending || !username || !password} variant="outline" className="h-10 w-full border-white/10 text-slate-200">{sellerLogin.isPending ? "Connexion…" : "Se connecter comme vendeur"}</Button>{sellerLogin.error && <p className="text-center text-xs text-rose-300">{sellerLogin.error.message}</p>}</form>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { currency } = usePreferences();
  const { isOnline, pendingCount, sales: offlineSales, syncNow } = useOffline();
  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const { data: sellerPermissions } = trpc.commerce.settings.get.useQuery(undefined, { enabled: user?.role === "seller" });
  const sellerMenuItems = [
    ...menuItems.filter(item => item.path === "/" || item.path === "/pos" || item.path === "/factures" || item.path === "/clients" || item.path === "/mouvements" || item.path === "/synchronisation" || (item.path === "/produits" && sellerPermissions?.sellerCanEditPurchasePrice)),
    { icon: Settings2, label: "Apparence", path: "/parametres/apparence" },
    { icon: LayoutDashboard, label: "Mon tableau de bord", path: "/parametres/tableau-de-bord" },
  ];
  const visibleMenuItems = user?.role === "admin" ? menuItems : sellerMenuItems;
  const activeMenuItem = visibleMenuItems.find(item => item.path === location || (item.path === "/produits" && location.startsWith("/produits/"))) ?? visibleMenuItems[0];
  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();
  const isAdmin = user?.role === "admin";
  const canRunBackup = Boolean(user);
  const { data: dashboard } = trpc.dashboard.get.useQuery(undefined, { enabled: isAdmin, refetchInterval: 60_000 });
  const { data: backups } = trpc.backups.get.useQuery(undefined, { enabled: isAdmin, refetchInterval: 60_000 });
  const runBackup = trpc.backups.runNow.useMutation({ onSuccess: archive => toast.success(`Sauvegarde ${archive.filename} créée.`), onError: error => toast.error(error.message) });
  const notifications: Array<{ id: string; title: string; detail: string; tone: "amber" | "violet" | "rose"; path: string }> = [];
  if (dashboard?.lowStock?.length) notifications.push({ id: "stock", title: "Stock critique", detail: `${dashboard.lowStock.length} produit(s) au seuil minimum`, tone: "amber", path: "/alertes" });
  if ((dashboard?.summary?.duePayrollCents ?? 0) > 0) notifications.push({ id: "payroll", title: "Paie à régler", detail: `${dashboard?.summary?.duePayrollCents ?? 0} centimes restent à payer`, tone: "violet", path: "/agents" });
  if (dashboard?.summary?.expenseBudget?.exceeded) notifications.push({ id: "budget-over", title: "Budget dépassé", detail: "Les dépenses ont dépassé le plafond mensuel.", tone: "rose", path: "/depenses" });
  else if (dashboard?.summary?.expenseBudget?.warningReached) notifications.push({ id: "budget-warning", title: "Seuil budget atteint", detail: "Le seuil d’alerte des dépenses est atteint.", tone: "amber", path: "/depenses" });
  if (backups?.settings.lastBackupStatus === "failed") notifications.push({ id: "backup", title: "Sauvegarde à vérifier", detail: backups.settings.lastBackupError || "La dernière sauvegarde a échoué.", tone: "rose", path: "/sauvegardes" });

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-white/[0.07] bg-[#0e141f] text-slate-300">
        <SidebarHeader className="h-20 justify-center border-b border-white/[0.07] px-3">
          <button
            onClick={() => setLocation("/")}
            className="flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            aria-label="Aller au tableau de bord"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/20">
              <Boxes className="h-5 w-5" />
            </span>
            {!isCollapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight text-white">StockPilot</span>
                <span className="block truncate text-[10px] font-medium uppercase tracking-[0.16em] text-cyan-300/70">B2B Operations</span>
              </span>
            )}
          </button>
        </SidebarHeader>

        <SidebarContent className="px-3 py-5">
          {!isCollapsed && <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pilotage</p>}
          <SidebarMenu className="gap-1">
            {visibleMenuItems.map(item => {
              const isActive = location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    tooltip={item.label}
                    onClick={() => setLocation(item.path)}
                    className="h-10 rounded-xl px-3 text-slate-400 hover:bg-white/[0.06] hover:text-white data-[active=true]:bg-cyan-400 data-[active=true]:text-slate-950"
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                    <span className="font-medium">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-white/[0.07] p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                <Avatar className="h-8 w-8 shrink-0 border border-white/10">
                  <AvatarFallback className="bg-slate-700 text-[11px] font-semibold text-cyan-200">{initials}</AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-100">{user?.name || "Utilisateur"}</span>
                    <span className="block truncate pt-0.5 text-[11px] text-slate-500">{user?.email || "Compte membre"}</span>
                  </span>
                )}
                {!isCollapsed && <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 border-white/10 bg-[#141b27] text-slate-200">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">{user?.name || "Utilisateur"}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem className="cursor-default focus:bg-transparent">
                <Badge className="border-0 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/10">{user?.role === "admin" ? "Administrateur" : "Opérateur"}</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-rose-300 focus:bg-rose-400/10 focus:text-rose-200">
                <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-[#090c13] text-slate-100">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 text-slate-900 shadow-sm backdrop-blur sm:px-6"><div className="lg:hidden"><SidebarTrigger className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100" /></div><div className="flex min-w-0 items-center gap-2"><activeMenuItem.icon className="h-4 w-4 shrink-0 text-primary" /><span className="truncate text-sm font-semibold text-slate-800">{activeMenuItem.label}</span></div><div className="ml-auto"><HeaderActions canRunBackup={canRunBackup} compact={isMobile} pending={runBackup.isPending} onBackup={() => runBackup.mutate()} notifications={notifications} onNotification={setLocation} isOnline={isOnline} pendingOfflineSales={pendingCount} hasFailedOfflineSale={offlineSales.some(sale => sale.status === "failed")} onSync={() => void syncNow()} /></div></header>
        <main key={currency} className="min-h-screen bg-[radial-gradient(circle_at_80%_-5%,rgba(34,211,238,0.05),transparent_24%),linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:auto,44px_44px,44px_44px] p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}

function HeaderActions({ canRunBackup, compact = false, pending, onBackup, notifications, onNotification, isOnline, pendingOfflineSales, hasFailedOfflineSale, onSync }: { canRunBackup: boolean; compact?: boolean; pending: boolean; onBackup: () => void; notifications: Array<{ id: string; title: string; detail: string; tone: "amber" | "violet" | "rose"; path: string }>; onNotification: (path: string) => void; isOnline: boolean; pendingOfflineSales: number; hasFailedOfflineSale: boolean; onSync: () => void }) {
  const counter = notifications.length > 9 ? "9+" : String(notifications.length);
  const tones = { amber: "bg-amber-400/10 text-amber-300", violet: "bg-violet-400/10 text-violet-300", rose: "bg-rose-400/10 text-rose-300" };
  return <div className="flex items-center gap-2">{(!isOnline || pendingOfflineSales > 0) && <Button onClick={onSync} disabled={!isOnline} variant="outline" size={compact ? "icon" : "sm"} className={`h-9 border-slate-200 bg-white ${hasFailedOfflineSale ? "text-rose-600" : !isOnline ? "text-amber-700" : "text-primary"}`} aria-label={!isOnline ? "Mode hors connexion" : `${pendingOfflineSales} vente(s) à synchroniser`}>{!isOnline ? <CloudOff className={`h-4 w-4 ${compact ? "" : "mr-2"}`} /> : <CloudUpload className={`h-4 w-4 ${compact ? "" : "mr-2"}`} />}{!compact && (!isOnline ? "Hors connexion" : `${pendingOfflineSales} à synchroniser`)}</Button>}{canRunBackup && <Button onClick={onBackup} disabled={pending} size={compact ? "icon" : "sm"} className="h-9 bg-primary text-primary-foreground hover:bg-primary/90" aria-label="Créer une sauvegarde maintenant">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className={`h-4 w-4 ${compact ? "" : "mr-2"}`} />}{!compact && (pending ? "Sauvegarde…" : "Sauvegarder")}</Button>}<DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="outline" className="relative h-9 w-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-100" aria-label={`${notifications.length} notification(s)`}><Bell className="h-4 w-4" />{notifications.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm">{counter}</span>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-[340px] border-slate-200 bg-white p-0 text-slate-800 shadow-xl"><DropdownMenuLabel className="flex items-center justify-between px-4 py-3"><span>Notifications</span><span className="text-xs font-normal text-slate-500">{notifications.length ? `${notifications.length} à consulter` : "Tout est à jour"}</span></DropdownMenuLabel><DropdownMenuSeparator className="bg-slate-100" />{notifications.length ? <div className="max-h-[360px] overflow-y-auto py-1">{notifications.map(notification => <DropdownMenuItem key={notification.id} onClick={() => onNotification(notification.path)} className="cursor-pointer items-start gap-3 px-4 py-3 focus:bg-slate-50"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[notification.tone]}`}><CircleAlert className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-medium text-slate-800">{notification.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{notification.detail}</span></span></DropdownMenuItem>)}</div> : <div className="px-5 py-9 text-center"><Bell className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-2 text-sm text-slate-700">Aucune notification</p><p className="mt-1 text-xs text-slate-500">Les alertes importantes apparaîtront ici.</p></div>}</DropdownMenuContent></DropdownMenu></div>;
}
