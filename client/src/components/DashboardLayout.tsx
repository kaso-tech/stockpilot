import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { readNotificationIds, unreadNotificationCount, writeNotificationIds } from "@/lib/notificationReadState";
import { visibleNotificationsForRole, type RoleNotification } from "@/lib/roleNotifications";
import { getPasswordStrength } from "@/lib/passwordStrength";
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
import { useIsMobile } from "@/hooks/useMobile";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useOffline } from "@/contexts/OfflineContext";
import {
  ArrowLeftRight,
  Archive,
  Bell,
  Boxes,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  CloudOff,
  CloudUpload,
  ClipboardList,
  ClipboardCheck,
  FileText,
  DatabaseBackup,
  Eye,
  EyeOff,
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
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Vue d’ensemble", path: "/" },
  { icon: ShoppingCart, label: "Vente Rapide", path: "/pos" },
  { icon: ReceiptText, label: "Factures", path: "/factures" },
  { icon: UserRound, label: "Clients", path: "/clients" },
  { icon: PackageSearch, label: "Produits", path: "/produits" },
  { icon: Boxes, label: "Catégories", path: "/categories" },
  { icon: Ruler, label: "Unités", path: "/unites" },
  { icon: ArrowLeftRight, label: "Mouvements", path: "/mouvements" },
  { icon: ClipboardCheck, label: "Inventaires", path: "/inventaires" },
  { icon: Truck, label: "Fournisseurs", path: "/fournisseurs" },
  { icon: FileText, label: "Bons de commande", path: "/bons-commande" },
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
  const [publicLocation, setPublicLocation] = useLocation();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [companyName, setCompanyName] = useState("");
  const [administratorName, setAdministratorName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [emailToCheck, setEmailToCheck] = useState("");
  const returnToDashboard = () => window.location.replace("/");
  const passwordLogin = trpc.auth.passwordLogin.useMutation({ onSuccess: returnToDashboard });
  const registerCompany = trpc.auth.registerCompany.useMutation({ onSuccess: () => window.location.replace("/parametres/identite") });
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  useEffect(() => { const timer = window.setTimeout(() => setEmailToCheck(email.trim().toLowerCase()), 500); return () => window.clearTimeout(timer); }, [email]);
  const emailAvailability = trpc.auth.emailAvailability.useQuery({ email: emailToCheck || "invalide@example.test" }, { enabled: authMode === "register" && emailLooksValid && emailToCheck === email.trim().toLowerCase() });
  useEffect(() => { if (!user) setAuthMode(publicLocation === "/inscription" ? "register" : "login"); }, [publicLocation, user]);

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
          <h1 className="text-2xl font-semibold tracking-tight">{authMode === "login" ? "Accédez à votre espace commercial" : "Créez votre entreprise"}</h1>
          <p className="mt-2 text-sm text-slate-400">{authMode === "login" ? "Connectez-vous avec l’adresse e-mail et le mot de passe de votre compte." : "Créez le premier compte administrateur de votre espace StockPilot."}</p>
          {authMode === "login" && <Link href="/inscription" className="mt-4 flex items-center justify-between rounded-xl border border-cyan-400/35 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20">Nouveau sur StockPilot ? <span className="text-cyan-300">Créer mon entreprise →</span></Link>}
          {authMode === "login" && <LoginForm email={email} password={password} rememberMe={rememberMe} pending={passwordLogin.isPending} error={passwordLogin.error?.message} onEmailChange={setEmail} onPasswordChange={setPassword} onRememberMeChange={setRememberMe} onSubmit={() => passwordLogin.mutate({ email, password, rememberMe })} onRegister={() => setPublicLocation("/inscription")} />}
          {authMode === "register" && <RegistrationForm companyName={companyName} administratorName={administratorName} email={email} password={password} passwordConfirmation={passwordConfirmation} rememberMe={rememberMe} emailLooksValid={emailLooksValid} emailAvailability={emailAvailability.data?.available} emailChecking={emailAvailability.isFetching || (emailLooksValid && emailToCheck !== email.trim().toLowerCase())} pending={registerCompany.isPending} error={registerCompany.error?.message} onCompanyNameChange={setCompanyName} onAdministratorNameChange={setAdministratorName} onEmailChange={setEmail} onPasswordChange={setPassword} onPasswordConfirmationChange={setPasswordConfirmation} onRememberMeChange={setRememberMe} onSubmit={() => registerCompany.mutate({ companyName, administratorName, email, password, rememberMe })} onBack={() => setPublicLocation("/")} />}
          <div className="hidden">
          {authMode === "login" ? <form onSubmit={event => { event.preventDefault(); passwordLogin.mutate({ email, password, rememberMe }); }} className="mt-6 space-y-3"><Input value={email} onChange={event => setEmail(event.target.value)} placeholder="Adresse e-mail" type="email" autoComplete="email" className="border-white/10 bg-white/[0.04]" /><Input value={password} onChange={event => setPassword(event.target.value)} placeholder="Mot de passe" type="password" autoComplete="current-password" className="border-white/10 bg-white/[0.04]" /><label htmlFor="remember-me" className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-cyan-400/35"><Checkbox id="remember-me" checked={rememberMe} onCheckedChange={value => setRememberMe(value === true)} disabled={passwordLogin.isPending} className="mt-0.5 border-slate-500" /><span><span className="block text-sm font-medium text-slate-200">Se souvenir de moi</span><span className="mt-0.5 block text-xs text-slate-400">Prolonge la session sur cet appareil.</span></span></label><Button type="submit" disabled={passwordLogin.isPending || !email || !password} className="h-11 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">{passwordLogin.isPending ? "Connexion…" : "Se connecter"}</Button>{passwordLogin.error && <p className="text-center text-xs text-rose-300">{passwordLogin.error.message}</p>}<div className="relative py-1 text-center text-xs text-slate-500"><span className="relative z-10 bg-[#111722] px-3">Première utilisation ?</span><span className="absolute inset-x-0 top-1/2 border-t border-white/10" /></div><Button type="button" variant="outline" onClick={() => setPublicLocation("/inscription")} className="h-11 w-full border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 hover:text-cyan-100">Créer mon entreprise</Button></form> : <form onSubmit={event => { event.preventDefault(); if (password !== passwordConfirmation) return; registerCompany.mutate({ companyName, administratorName, email, password, rememberMe }); }} className="mt-6 space-y-3"><Input value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder="Nom de l’entreprise" autoComplete="organization" className="border-white/10 bg-white/[0.04]" /><Input value={administratorName} onChange={event => setAdministratorName(event.target.value)} placeholder="Votre nom complet" autoComplete="name" className="border-white/10 bg-white/[0.04]" /><Input value={email} onChange={event => setEmail(event.target.value)} placeholder="Adresse e-mail professionnelle" type="email" autoComplete="email" className="border-white/10 bg-white/[0.04]" /><Input value={password} onChange={event => setPassword(event.target.value)} placeholder="Mot de passe (10 caractères minimum)" type="password" autoComplete="new-password" className="border-white/10 bg-white/[0.04]" /><Input value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} placeholder="Confirmer le mot de passe" type="password" autoComplete="new-password" className="border-white/10 bg-white/[0.04]" /><label htmlFor="remember-new-company" className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-cyan-400/35"><Checkbox id="remember-new-company" checked={rememberMe} onCheckedChange={value => setRememberMe(value === true)} disabled={registerCompany.isPending} className="mt-0.5 border-slate-500" /><span><span className="block text-sm font-medium text-slate-200">Se souvenir de moi</span><span className="mt-0.5 block text-xs text-slate-400">Prolonge la session sur cet appareil.</span></span></label>{passwordConfirmation && password !== passwordConfirmation && <p className="text-xs text-rose-300">Les mots de passe ne correspondent pas.</p>}<Button type="submit" disabled={registerCompany.isPending || !companyName || !administratorName || !email || password.length < 10 || password !== passwordConfirmation} className="h-11 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">{registerCompany.isPending ? "Création…" : "Créer mon espace"}</Button>{registerCompany.error && <p className="text-center text-xs text-rose-300">{registerCompany.error.message}</p>}<p className="px-1 text-center text-xs leading-5 text-slate-400">En créant votre espace, vous acceptez les <Link href="/conditions-utilisation" className="text-cyan-300 hover:underline">Conditions d’utilisation</Link> et reconnaissez avoir lu la <Link href="/politique-confidentialite" className="text-cyan-300 hover:underline">Politique de confidentialité</Link>.</p><button type="button" onClick={() => setPublicLocation("/")} className="w-full pt-1 text-sm font-medium text-cyan-300 hover:text-cyan-200 hover:underline">J’ai déjà un compte</button></form>}
          </div>
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

function PasswordField({ value, onChange, placeholder, autoComplete, disabled = false }: { value: string; onChange: (value: string) => void; placeholder: string; autoComplete: string; disabled?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><Input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} type={visible ? "text" : "password"} autoComplete={autoComplete} disabled={disabled} className="border-white/10 bg-white/[0.04] pr-11" /><button type="button" onClick={() => setVisible(current => !current)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 transition hover:text-cyan-200" aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>;
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { score, label } = getPasswordStrength(password);
  const state = label === "Faible" ? { tone: "bg-rose-400", text: "text-rose-300" } : label === "Moyen" ? { tone: "bg-amber-400", text: "text-amber-300" } : { tone: "bg-emerald-400", text: "text-emerald-300" };
  return <div className="px-1"><div className="flex items-center justify-between text-xs"><span className="text-slate-400">Force du mot de passe</span><span className={state.text}>{label}</span></div><div className="mt-1.5 grid grid-cols-5 gap-1">{Array.from({ length: 5 }, (_, index) => <span key={index} className={`h-1 rounded-full ${index < score ? state.tone : "bg-white/10"}`} />)}</div><p className="mt-1.5 text-[11px] text-slate-500">Utilisez au moins 10 caractères, avec majuscule, minuscule, chiffre et symbole.</p></div>;
}

function LoginForm({ email, password, rememberMe, pending, error, onEmailChange, onPasswordChange, onRememberMeChange, onSubmit, onRegister }: { email: string; password: string; rememberMe: boolean; pending: boolean; error?: string; onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void; onRememberMeChange: (value: boolean) => void; onSubmit: () => void; onRegister: () => void }) {
  return <form onSubmit={event => { event.preventDefault(); onSubmit(); }} className="mt-6 space-y-3"><Input value={email} onChange={event => onEmailChange(event.target.value)} placeholder="Adresse e-mail" type="email" autoComplete="email" className="border-white/10 bg-white/[0.04]" /><PasswordField value={password} onChange={onPasswordChange} placeholder="Mot de passe" autoComplete="current-password" disabled={pending} /><label htmlFor="remember-me-main" className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-cyan-400/35"><Checkbox id="remember-me-main" checked={rememberMe} onCheckedChange={value => onRememberMeChange(value === true)} disabled={pending} className="mt-0.5 border-slate-500" /><span><span className="block text-sm font-medium text-slate-200">Se souvenir de moi</span><span className="mt-0.5 block text-xs text-slate-400">Prolonge la session sur cet appareil.</span></span></label><Button type="submit" disabled={pending || !email || !password} className="h-11 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">{pending ? "Connexion…" : "Se connecter"}</Button>{error && <p className="text-center text-xs text-rose-300">{error}</p>}<div className="relative py-1 text-center text-xs text-slate-500"><span className="relative z-10 bg-[#111722] px-3">Première utilisation ?</span><span className="absolute inset-x-0 top-1/2 border-t border-white/10" /></div><Button type="button" variant="outline" onClick={onRegister} className="h-11 w-full border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 hover:text-cyan-100">Créer mon entreprise</Button></form>;
}

function RegistrationForm({ companyName, administratorName, email, password, passwordConfirmation, rememberMe, emailLooksValid, emailAvailability, emailChecking, pending, error, onCompanyNameChange, onAdministratorNameChange, onEmailChange, onPasswordChange, onPasswordConfirmationChange, onRememberMeChange, onSubmit, onBack }: { companyName: string; administratorName: string; email: string; password: string; passwordConfirmation: string; rememberMe: boolean; emailLooksValid: boolean; emailAvailability: boolean | undefined; emailChecking: boolean; pending: boolean; error?: string; onCompanyNameChange: (value: string) => void; onAdministratorNameChange: (value: string) => void; onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void; onPasswordConfirmationChange: (value: string) => void; onRememberMeChange: (value: boolean) => void; onSubmit: () => void; onBack: () => void }) {
  const emailState = !email ? null : !emailLooksValid ? "Adresse e-mail invalide" : emailChecking ? "Vérification de l’adresse…" : emailAvailability ? "Adresse e-mail disponible" : "Cette adresse e-mail est déjà utilisée";
  const emailTone = !email ? "" : !emailLooksValid || emailAvailability === false ? "text-rose-300" : emailChecking ? "text-slate-400" : "text-emerald-300";
  const canSubmit = Boolean(companyName && administratorName && emailLooksValid && emailAvailability && !emailChecking && password.length >= 10 && password === passwordConfirmation);
  return <form onSubmit={event => { event.preventDefault(); if (canSubmit) onSubmit(); }} className="mt-6 space-y-3"><Input value={companyName} onChange={event => onCompanyNameChange(event.target.value)} placeholder="Nom de l’entreprise" autoComplete="organization" className="border-white/10 bg-white/[0.04]" /><Input value={administratorName} onChange={event => onAdministratorNameChange(event.target.value)} placeholder="Votre nom complet" autoComplete="name" className="border-white/10 bg-white/[0.04]" /><div><Input value={email} onChange={event => onEmailChange(event.target.value)} placeholder="Adresse e-mail professionnelle" type="email" autoComplete="email" aria-invalid={Boolean(email && (!emailLooksValid || emailAvailability === false))} className="border-white/10 bg-white/[0.04]" />{emailState && <p className={`mt-1.5 px-1 text-xs ${emailTone}`}>{emailState}</p>}</div><PasswordField value={password} onChange={onPasswordChange} placeholder="Mot de passe (10 caractères minimum)" autoComplete="new-password" disabled={pending} /><PasswordStrength password={password} /><PasswordField value={passwordConfirmation} onChange={onPasswordConfirmationChange} placeholder="Confirmer le mot de passe" autoComplete="new-password" disabled={pending} />{passwordConfirmation && password !== passwordConfirmation && <p className="text-xs text-rose-300">Les mots de passe ne correspondent pas.</p>}<label htmlFor="remember-new-company" className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-cyan-400/35"><Checkbox id="remember-new-company" checked={rememberMe} onCheckedChange={value => onRememberMeChange(value === true)} disabled={pending} className="mt-0.5 border-slate-500" /><span><span className="block text-sm font-medium text-slate-200">Se souvenir de moi</span><span className="mt-0.5 block text-xs text-slate-400">Prolonge la session sur cet appareil.</span></span></label><Button type="submit" disabled={pending || !canSubmit} className="h-11 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">{pending ? "Création…" : "Créer mon espace"}</Button>{error && <p className="text-center text-xs text-rose-300">{error}</p>}<p className="px-1 text-center text-xs leading-5 text-slate-400">En créant votre espace, vous acceptez les <Link href="/conditions-utilisation" className="text-cyan-300 hover:underline">Conditions d’utilisation</Link> et reconnaissez avoir lu la <Link href="/politique-confidentialite" className="text-cyan-300 hover:underline">Politique de confidentialité</Link>.</p><button type="button" onClick={onBack} className="w-full pt-1 text-sm font-medium text-cyan-300 hover:text-cyan-200 hover:underline">J’ai déjà un compte</button></form>;
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
    { icon: ShieldCheck, label: "Sécurité", path: "/parametres/securite" },
  ];
  const visibleMenuItems = user?.role === "admin" ? menuItems : sellerMenuItems;
  const activeMenuItem = visibleMenuItems.find(item => item.path === location || (item.path === "/produits" && location.startsWith("/produits/")) || (item.path === "/clients" && location.startsWith("/clients/")) || (item.path === "/fournisseurs" && location.startsWith("/fournisseurs/")) || (item.path === "/bons-commande" && location.startsWith("/bons-commande/"))) ?? visibleMenuItems[0];
  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();
  const isAdmin = user?.role === "admin";
  const canRunBackup = Boolean(user);
  const { data: dashboard } = trpc.dashboard.get.useQuery(undefined, { enabled: isAdmin, refetchInterval: 60_000 });
  const { data: backups } = trpc.backups.get.useQuery(undefined, { enabled: isAdmin, refetchInterval: 60_000 });
  const runBackup = trpc.backups.runNow.useMutation({ onSuccess: archive => toast.success(`Sauvegarde ${archive.filename} créée.`), onError: error => toast.error(error.message) });
  const candidateNotifications: RoleNotification[] = [];
  if (isAdmin) {
    if (dashboard?.lowStock?.length) candidateNotifications.push({ id: "stock", title: "Stock critique", detail: `${dashboard.lowStock.length} produit(s) au seuil minimum`, tone: "amber", path: "/alertes", audience: "admin" });
    if ((dashboard?.summary?.duePayrollCents ?? 0) > 0) candidateNotifications.push({ id: "payroll", title: "Paie à régler", detail: `${dashboard?.summary?.duePayrollCents ?? 0} centimes restent à payer`, tone: "violet", path: "/agents", audience: "admin" });
    if (dashboard?.summary?.expenseBudget?.exceeded) candidateNotifications.push({ id: "budget-over", title: "Budget dépassé", detail: "Les dépenses ont dépassé le plafond mensuel.", tone: "rose", path: "/depenses", audience: "admin" });
    else if (dashboard?.summary?.expenseBudget?.warningReached) candidateNotifications.push({ id: "budget-warning", title: "Seuil budget atteint", detail: "Le seuil d’alerte des dépenses est atteint.", tone: "amber", path: "/depenses", audience: "admin" });
    if (backups?.settings.lastBackupStatus === "failed") candidateNotifications.push({ id: "backup", title: "Sauvegarde à vérifier", detail: backups.settings.lastBackupError || "La dernière sauvegarde a échoué.", tone: "rose", path: "/sauvegardes", audience: "admin" });
  }
  const notifications = visibleNotificationsForRole(user?.role === "admin" ? "admin" : "seller", candidateNotifications);
  const [readNotificationIdsState, setReadNotificationIdsState] = useState<string[]>([]);
  useEffect(() => { setReadNotificationIdsState(readNotificationIds(user?.companyId ?? undefined, user?.id)); }, [user?.companyId, user?.id]);
  const saveReadNotifications = (ids: string[]) => { setReadNotificationIdsState(ids); writeNotificationIds(user?.companyId ?? undefined, user?.id, ids); };
  const markNotificationRead = (id: string) => { if (!readNotificationIdsState.includes(id)) saveReadNotifications([...readNotificationIdsState, id]); };
  const markAllNotificationsRead = () => saveReadNotifications(notifications.map(notification => notification.id));

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
              const isActive = location === item.path || (item.path === "/clients" && location.startsWith("/clients/")) || (item.path === "/fournisseurs" && location.startsWith("/fournisseurs/")) || (item.path === "/bons-commande" && location.startsWith("/bons-commande/"));
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
        <header className="app-header sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 text-slate-900 shadow-sm shadow-slate-950/5 backdrop-blur dark:border-white/[0.07] dark:bg-[#0e141f]/95 dark:text-slate-100 dark:shadow-black/20 sm:px-6"><div className="lg:hidden"><SidebarTrigger className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-[#111722] dark:text-slate-200 dark:hover:bg-white/[0.07]" /></div><div className="flex min-w-0 items-center gap-2"><activeMenuItem.icon className="h-4 w-4 shrink-0 text-primary" /><span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{activeMenuItem.label}</span></div><div className="ml-auto"><HeaderActions canRunBackup={canRunBackup} compact={isMobile} pending={runBackup.isPending} onBackup={() => runBackup.mutate()} notifications={notifications} readNotificationIds={readNotificationIdsState} onNotification={setLocation} onMarkNotificationRead={markNotificationRead} onMarkAllNotificationsRead={markAllNotificationsRead} isOnline={isOnline} pendingOfflineSales={pendingCount} hasFailedOfflineSale={offlineSales.some(sale => sale.status === "failed")} onSync={() => void syncNow()} /></div></header>
        <main key={currency} className="min-h-screen bg-[radial-gradient(circle_at_80%_-5%,rgba(34,211,238,0.05),transparent_24%),linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:auto,44px_44px,44px_44px] p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}

function HeaderActions({ canRunBackup, compact = false, pending, onBackup, notifications, readNotificationIds, onNotification, onMarkNotificationRead, onMarkAllNotificationsRead, isOnline, pendingOfflineSales, hasFailedOfflineSale, onSync }: { canRunBackup: boolean; compact?: boolean; pending: boolean; onBackup: () => void; notifications: Array<{ id: string; title: string; detail: string; tone: "amber" | "violet" | "rose"; path: string }>; readNotificationIds: string[]; onNotification: (path: string) => void; onMarkNotificationRead: (id: string) => void; onMarkAllNotificationsRead: () => void; isOnline: boolean; pendingOfflineSales: number; hasFailedOfflineSale: boolean; onSync: () => void }) {
  const unreadCount = unreadNotificationCount(notifications.map(notification => notification.id), readNotificationIds);
  const counter = unreadCount > 9 ? "9+" : String(unreadCount);
  const tones = { amber: "bg-amber-400/10 text-amber-300", violet: "bg-violet-400/10 text-violet-300", rose: "bg-rose-400/10 text-rose-300" };
  return <div className="flex items-center gap-2">{(!isOnline || pendingOfflineSales > 0) && <Button onClick={onSync} disabled={!isOnline} variant="outline" size={compact ? "icon" : "sm"} className={`h-9 border-slate-200 bg-white ${hasFailedOfflineSale ? "text-rose-600" : !isOnline ? "text-amber-700" : "text-primary"}`} aria-label={!isOnline ? "Mode hors connexion" : `${pendingOfflineSales} vente(s) à synchroniser`}>{!isOnline ? <CloudOff className={`h-4 w-4 ${compact ? "" : "mr-2"}`} /> : <CloudUpload className={`h-4 w-4 ${compact ? "" : "mr-2"}`} />}{!compact && (!isOnline ? "Hors connexion" : `${pendingOfflineSales} à synchroniser`)}</Button>}{canRunBackup && <Button onClick={onBackup} disabled={pending} size={compact ? "icon" : "sm"} className="h-9 bg-primary text-primary-foreground hover:bg-primary/90" aria-label="Créer une sauvegarde maintenant">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className={`h-4 w-4 ${compact ? "" : "mr-2"}`} />}{!compact && (pending ? "Sauvegarde…" : "Sauvegarder")}</Button>}<DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="outline" className="relative h-9 w-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-100" aria-label={`${unreadCount} notification(s) non lue(s)`}><Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm">{counter}</span>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-[340px] border-slate-200 bg-white p-0 text-slate-800 shadow-xl"><DropdownMenuLabel className="flex items-center justify-between gap-3 px-4 py-3"><span>Notifications</span>{unreadCount > 0 ? <button type="button" onClick={onMarkAllNotificationsRead} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"><CheckCheck className="h-3.5 w-3.5" />Tout marquer comme lu</button> : <span className="text-xs font-normal text-slate-500">Tout est à jour</span>}</DropdownMenuLabel><DropdownMenuSeparator className="bg-slate-100" />{notifications.length ? <div className="max-h-[360px] overflow-y-auto py-1">{notifications.map(notification => { const unread = !readNotificationIds.includes(notification.id); return <DropdownMenuItem key={notification.id} onClick={() => { onMarkNotificationRead(notification.id); onNotification(notification.path); }} className={`cursor-pointer items-start gap-3 px-4 py-3 focus:bg-slate-50 ${unread ? "bg-cyan-50/70" : ""}`}><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[notification.tone]}`}><CircleAlert className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className={`block text-sm text-slate-800 ${unread ? "font-semibold" : "font-medium"}`}>{notification.title}</span>{unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Non lue" />}</span><span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{notification.detail}</span></span></DropdownMenuItem>; })}</div> : <div className="px-5 py-9 text-center"><Bell className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-2 text-sm text-slate-700">Aucune notification</p><p className="mt-1 text-xs text-slate-500">Les alertes importantes apparaîtront ici.</p></div>}</DropdownMenuContent></DropdownMenu></div>;
}
