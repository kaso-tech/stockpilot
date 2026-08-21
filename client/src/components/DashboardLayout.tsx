import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  ArrowLeftRight,
  Boxes,
  ChevronDown,
  ClipboardList,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  UsersRound,
  Settings2,
  ShieldCheck,
  Truck,
  TriangleAlert,
} from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Vue d’ensemble", path: "/" },
  { icon: ShoppingCart, label: "Point de vente", path: "/pos" },
  { icon: ReceiptText, label: "Factures", path: "/factures" },
  { icon: PackageSearch, label: "Produits", path: "/produits" },
  { icon: ArrowLeftRight, label: "Mouvements", path: "/mouvements" },
  { icon: ClipboardCheck, label: "Inventaires", path: "/inventaires" },
  { icon: Truck, label: "Fournisseurs", path: "/fournisseurs" },
  { icon: UsersRound, label: "Agents & paie", path: "/agents" },
  { icon: Settings2, label: "Réglages vente", path: "/parametres-ventes" },
  { icon: TriangleAlert, label: "Alertes", path: "/alertes" },
  { icon: ClipboardList, label: "Journal", path: "/journal" },
  { icon: ShieldCheck, label: "Utilisateurs", path: "/utilisateurs" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

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
          <h1 className="text-2xl font-semibold tracking-tight">Accédez à votre espace stock</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Connectez-vous pour piloter les niveaux de stock, les mouvements et les approvisionnements de votre organisation.
          </p>
          <Button onClick={() => startLogin()} className="mt-8 h-11 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
            Se connecter
          </Button>
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
  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const visibleMenuItems = user?.role === "admin"
    ? menuItems
    : menuItems.filter(item => item.path === "/" || item.path === "/pos" || item.path === "/factures" || item.path === "/mouvements");
  const activeMenuItem = visibleMenuItems.find(item => item.path === location) ?? visibleMenuItems[0];
  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

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
        {isMobile && (
          <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/[0.07] bg-[#090c13]/95 px-4 backdrop-blur">
            <SidebarTrigger className="h-9 w-9 rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]" />
            <div className="flex min-w-0 items-center gap-2">
              <activeMenuItem.icon className="h-4 w-4 shrink-0 text-cyan-300" />
              <span className="truncate text-sm font-semibold">{activeMenuItem.label}</span>
            </div>
          </header>
        )}
        <main className="min-h-screen bg-[radial-gradient(circle_at_80%_-5%,rgba(34,211,238,0.05),transparent_24%),linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:auto,44px_44px,44px_44px] p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
