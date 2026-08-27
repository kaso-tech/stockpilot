import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ClipboardList, CreditCard, Headphones, LayoutDashboard, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";
import { useState } from "react";

type PlatformRole = "super_admin" | "operator" | "operations" | "support" | "billing";
type PlatformSection = { id: string; label: string; icon: LucideIcon; roles?: PlatformRole[]; badge?: number };

function roleLabel(role: PlatformRole) {
  return { super_admin: "Super administrateur", operator: "Opérateur", operations: "Opérations", support: "Support", billing: "Facturation" }[role];
}

export function PlatformConsoleShell({ role, openSupportCount, onExit, children }: { role: PlatformRole; openSupportCount: number; onExit: () => void; children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState("overview");
  const sections: PlatformSection[] = [
    { id: "overview", label: "Vue d’ensemble", icon: LayoutDashboard },
    { id: "companies", label: "Entreprises", icon: Building2, roles: ["super_admin", "operator", "operations"] as PlatformRole[] },
    { id: "support", label: "Support", icon: Headphones, roles: ["super_admin", "operator", "support"] as PlatformRole[], badge: openSupportCount },
    { id: "operators", label: "Opérateurs", icon: UsersRound, roles: ["super_admin"] as PlatformRole[] },
    { id: "subscriptions", label: "Abonnements", icon: CreditCard, roles: ["super_admin", "operator", "billing"] as PlatformRole[] },
    { id: "audit", label: "Journal d’audit", icon: ClipboardList },
  ].filter(section => !section.roles || section.roles.includes(role));
  const goTo = (id: string) => { setActiveSection(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const NavItems = ({ compact = false }: { compact?: boolean }) => <>{sections.map(section => { const Icon = section.icon; const active = activeSection === section.id; return <button type="button" key={section.id} onClick={() => goTo(section.id)} className={`flex ${compact ? "shrink-0" : "w-full"} items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="h-4 w-4" /><span>{section.label}</span>{section.badge ? <span className={`ml-auto grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-primary-foreground text-primary" : "bg-rose-600 text-white"}`}>{section.badge > 99 ? "99+" : section.badge}</span> : null}</button>; })}</>;
  return <div className="min-h-screen bg-muted/25 text-foreground">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex"><div className="flex h-[73px] items-center gap-3 border-b border-border px-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-sm font-bold tracking-tight text-card-foreground">StockPilot</p><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Console SaaS</p></div></div><nav aria-label="Navigation plateforme" className="flex-1 space-y-1 overflow-y-auto p-3"><p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pilotage plateforme</p><NavItems /></nav><div className="border-t border-border p-4"><Badge variant="outline" className="mb-3 border-primary/35 bg-primary/10 text-primary">{roleLabel(role)}</Badge><Button variant="outline" size="sm" className="w-full justify-start" onClick={onExit}>Espace entreprise</Button></div></aside>
    <div className="min-h-screen lg:pl-64"><header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-foreground">Administration plateforme</p><p className="hidden text-xs text-muted-foreground sm:block">Pilotage sécurisé des entreprises, abonnements et support</p></div><div className="flex items-center gap-2"><Badge variant="outline" className="hidden border-border bg-card text-muted-foreground sm:inline-flex"><ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-primary" />Accès restreint</Badge><Button variant="outline" size="sm" className="lg:hidden" onClick={onExit}>Quitter</Button></div></div><nav aria-label="Navigation plateforme mobile" className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:hidden"><NavItems compact /></nav></header><main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main></div>
  </div>;
}
