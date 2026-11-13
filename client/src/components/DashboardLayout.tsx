import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  readNotificationIds,
  unreadNotificationCount,
  writeNotificationIds,
} from "@/lib/notificationReadState";
import {
  visibleNotificationsForRole,
  type RoleNotification,
} from "@/lib/roleNotifications";
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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ArrowLeftRight,
  Archive,
  Bell,
  Boxes,
  Calculator,
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
  Moon,
  Search,
  Sun,
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
  Warehouse,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@shared/permissions";

type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  /** Droits dont l'un suffit pour voir l'entrée ; absent = tout utilisateur connecté. */
  anyOf?: Permission[];
};

type MenuGroup = { title: string; items: MenuItem[] };

/** Navigation groupée par métier, dans l'ordre du travail quotidien. */
const menuGroups: MenuGroup[] = [
  {
    title: "Pilotage",
    items: [{ icon: LayoutDashboard, label: "Vue d’ensemble", path: "/" }],
  },
  {
    title: "Ventes",
    items: [
      {
        icon: ShoppingCart,
        label: "Vente rapide",
        path: "/pos",
        anyOf: ["sales.create"],
      },
      { icon: ReceiptText, label: "Factures", path: "/factures" },
      { icon: FileText, label: "Devis", path: "/devis" },
      { icon: UserRound, label: "Clients", path: "/clients" },
    ],
  },
  {
    title: "Stock",
    items: [
      { icon: PackageSearch, label: "Produits", path: "/produits" },
      {
        icon: Boxes,
        label: "Catégories",
        path: "/categories",
        anyOf: ["catalog.manage"],
      },
      {
        icon: Ruler,
        label: "Unités",
        path: "/unites",
        anyOf: ["catalog.manage"],
      },
      { icon: ArrowLeftRight, label: "Mouvements", path: "/mouvements" },
      {
        icon: ClipboardCheck,
        label: "Inventaires",
        path: "/inventaires",
        anyOf: ["inventory.manage"],
      },
      {
        icon: Warehouse,
        label: "Dépôts",
        path: "/depots",
        anyOf: ["inventory.manage", "catalog.manage"],
      },
      {
        icon: TriangleAlert,
        label: "Alertes",
        path: "/alertes",
        anyOf: ["catalog.manage", "purchasing.manage"],
      },
    ],
  },
  {
    title: "Achats",
    items: [
      {
        icon: Truck,
        label: "Fournisseurs",
        path: "/fournisseurs",
        anyOf: ["catalog.manage", "purchasing.manage"],
      },
      {
        icon: FileText,
        label: "Bons de commande",
        path: "/bons-commande",
        anyOf: ["purchasing.manage", "accounting.export"],
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        icon: Calculator,
        label: "Caisse & comptabilité",
        path: "/comptabilite",
        anyOf: ["cash.close", "accounting.export"],
      },
      {
        icon: WalletCards,
        label: "Dépenses",
        path: "/depenses",
        anyOf: ["expenses.manage"],
      },
      {
        icon: UsersRound,
        label: "Agents & paie",
        path: "/agents",
        anyOf: ["team.view", "payroll.manage"],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        icon: SlidersHorizontal,
        label: "Paramètres",
        path: "/parametres",
        anyOf: ["settings.manage"],
      },
      {
        icon: Archive,
        label: "Import & export",
        path: "/donnees",
        anyOf: ["catalog.manage"],
      },
      {
        icon: DatabaseBackup,
        label: "Sauvegardes",
        path: "/sauvegardes",
        anyOf: ["backups.manage"],
      },
      {
        icon: ClipboardList,
        label: "Journal",
        path: "/journal",
        anyOf: ["audit.view"],
      },
      {
        icon: CloudUpload,
        label: "Synchronisation",
        path: "/synchronisation",
        anyOf: ["sales.create"],
      },
    ],
  },
];

/** Pages de détail rattachées à une entrée du menu. */
function isMenuItemActive(path: string, location: string) {
  if (path === location) return true;
  return (
    path !== "/" &&
    [
      "/produits",
      "/clients",
      "/fournisseurs",
      "/bons-commande",
      "/devis",
      "/factures",
      "/agents",
      "/parametres",
    ].includes(path) &&
    location.startsWith(`${path}/`)
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Réglages personnels proposés aux rôles qui n'accèdent pas aux paramètres de l'entreprise. */
const personalMenuItems: MenuItem[] = [
  { icon: Settings2, label: "Apparence", path: "/parametres/apparence" },
  {
    icon: LayoutDashboard,
    label: "Mon tableau de bord",
    path: "/parametres/tableau-de-bord",
  },
  { icon: ShieldCheck, label: "Sécurité", path: "/parametres/securite" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  const passwordLogin = trpc.auth.passwordLogin.useMutation({
    onSuccess: returnToDashboard,
  });
  const registerCompany = trpc.auth.registerCompany.useMutation({
    onSuccess: () => window.location.replace("/parametres/identite"),
  });
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  useEffect(() => {
    const timer = window.setTimeout(
      () => setEmailToCheck(email.trim().toLowerCase()),
      500
    );
    return () => window.clearTimeout(timer);
  }, [email]);
  const emailAvailability = trpc.auth.emailAvailability.useQuery(
    { email: emailToCheck || "invalide@example.test" },
    {
      enabled:
        authMode === "register" &&
        emailLooksValid &&
        emailToCheck === email.trim().toLowerCase(),
    }
  );
  useEffect(() => {
    if (!user)
      setAuthMode(publicLocation === "/inscription" ? "register" : "login");
  }, [publicLocation, user]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">StockPilot</p>
              <p className="text-xs text-muted-foreground">
                Operations workspace
              </p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {authMode === "login"
              ? "Accédez à votre espace commercial"
              : "Créez votre entreprise"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {authMode === "login"
              ? "Connectez-vous avec l’adresse e-mail et le mot de passe de votre compte."
              : "Créez le premier compte administrateur de votre espace StockPilot."}
          </p>
          {authMode === "login" && (
            <Link
              href="/inscription"
              className="mt-4 flex items-center justify-between rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/20"
            >
              Nouveau sur StockPilot ?{" "}
              <span className="text-primary">Créer mon entreprise →</span>
            </Link>
          )}
          {authMode === "login" && (
            <LoginForm
              email={email}
              password={password}
              rememberMe={rememberMe}
              pending={passwordLogin.isPending}
              error={passwordLogin.error?.message}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onRememberMeChange={setRememberMe}
              onSubmit={() =>
                passwordLogin.mutate({ email, password, rememberMe })
              }
              onRegister={() => setPublicLocation("/inscription")}
            />
          )}
          {authMode === "register" && (
            <RegistrationForm
              companyName={companyName}
              administratorName={administratorName}
              email={email}
              password={password}
              passwordConfirmation={passwordConfirmation}
              rememberMe={rememberMe}
              emailLooksValid={emailLooksValid}
              emailAvailability={emailAvailability.data?.available}
              emailChecking={
                emailAvailability.isFetching ||
                (emailLooksValid && emailToCheck !== email.trim().toLowerCase())
              }
              pending={registerCompany.isPending}
              error={registerCompany.error?.message}
              onCompanyNameChange={setCompanyName}
              onAdministratorNameChange={setAdministratorName}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onPasswordConfirmationChange={setPasswordConfirmation}
              onRememberMeChange={setRememberMe}
              onSubmit={() =>
                registerCompany.mutate({
                  companyName,
                  administratorName,
                  email,
                  password,
                  rememberMe,
                })
              }
              onBack={() => setPublicLocation("/")}
            />
          )}
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

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        disabled={disabled}
        className="border-border bg-muted/50 pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible(current => !current)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition hover:text-primary"
        aria-label={
          visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
        }
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { score, label } = getPasswordStrength(password);
  const state =
    label === "Faible"
      ? { tone: "bg-destructive", text: "text-destructive" }
      : label === "Moyen"
        ? { tone: "bg-warning", text: "text-warning" }
        : { tone: "bg-success", text: "text-success" };
  return (
    <div className="px-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Force du mot de passe</span>
        <span className={state.text}>{label}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={`h-1 rounded-full ${index < score ? state.tone : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-faint">
        Utilisez au moins 10 caractères, avec majuscule, minuscule, chiffre et
        symbole.
      </p>
    </div>
  );
}

function LoginForm({
  email,
  password,
  rememberMe,
  pending,
  error,
  onEmailChange,
  onPasswordChange,
  onRememberMeChange,
  onSubmit,
  onRegister,
}: {
  email: string;
  password: string;
  rememberMe: boolean;
  pending: boolean;
  error?: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
  onSubmit: () => void;
  onRegister: () => void;
}) {
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
      className="mt-6 space-y-3"
    >
      <Input
        value={email}
        onChange={event => onEmailChange(event.target.value)}
        placeholder="Adresse e-mail"
        type="email"
        autoComplete="email"
        className="border-border bg-muted/50"
      />
      <PasswordField
        value={password}
        onChange={onPasswordChange}
        placeholder="Mot de passe"
        autoComplete="current-password"
        disabled={pending}
      />
      <label
        htmlFor="remember-me-main"
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-left transition hover:border-primary/25"
      >
        <Checkbox
          id="remember-me-main"
          checked={rememberMe}
          onCheckedChange={value => onRememberMeChange(value === true)}
          disabled={pending}
          className="mt-0.5 border-input"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            Se souvenir de moi
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Prolonge la session sur cet appareil.
          </span>
        </span>
      </label>
      <Button
        type="submit"
        disabled={pending || !email || !password}
        className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
      <Link
        href="/mot-de-passe-oublie"
        className="block text-center text-sm text-primary hover:text-primary hover:underline"
      >
        Mot de passe oublié ?
      </Link>
      <div className="relative py-1 text-center text-xs text-faint">
        <span className="relative z-10 bg-card px-3">
          Première utilisation ?
        </span>
        <span className="absolute inset-x-0 top-1/2 border-t border-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onRegister}
        className="h-11 w-full border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
      >
        Créer mon entreprise
      </Button>
    </form>
  );
}

function RegistrationForm({
  companyName,
  administratorName,
  email,
  password,
  passwordConfirmation,
  rememberMe,
  emailLooksValid,
  emailAvailability,
  emailChecking,
  pending,
  error,
  onCompanyNameChange,
  onAdministratorNameChange,
  onEmailChange,
  onPasswordChange,
  onPasswordConfirmationChange,
  onRememberMeChange,
  onSubmit,
  onBack,
}: {
  companyName: string;
  administratorName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  rememberMe: boolean;
  emailLooksValid: boolean;
  emailAvailability: boolean | undefined;
  emailChecking: boolean;
  pending: boolean;
  error?: string;
  onCompanyNameChange: (value: string) => void;
  onAdministratorNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const emailState = !email
    ? null
    : !emailLooksValid
      ? "Adresse e-mail invalide"
      : emailChecking
        ? "Vérification de l’adresse…"
        : emailAvailability
          ? "Adresse e-mail disponible"
          : "Cette adresse e-mail est déjà utilisée";
  const emailTone = !email
    ? ""
    : !emailLooksValid || emailAvailability === false
      ? "text-destructive"
      : emailChecking
        ? "text-muted-foreground"
        : "text-success";
  const canSubmit = Boolean(
    companyName &&
      administratorName &&
      emailLooksValid &&
      emailAvailability &&
      !emailChecking &&
      password.length >= 10 &&
      password === passwordConfirmation
  );
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
      className="mt-6 space-y-3"
    >
      <Input
        value={companyName}
        onChange={event => onCompanyNameChange(event.target.value)}
        placeholder="Nom de l’entreprise"
        autoComplete="organization"
        className="border-border bg-muted/50"
      />
      <Input
        value={administratorName}
        onChange={event => onAdministratorNameChange(event.target.value)}
        placeholder="Votre nom complet"
        autoComplete="name"
        className="border-border bg-muted/50"
      />
      <div>
        <Input
          value={email}
          onChange={event => onEmailChange(event.target.value)}
          placeholder="Adresse e-mail professionnelle"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(
            email && (!emailLooksValid || emailAvailability === false)
          )}
          className="border-border bg-muted/50"
        />
        {emailState && (
          <p className={`mt-1.5 px-1 text-xs ${emailTone}`}>{emailState}</p>
        )}
      </div>
      <PasswordField
        value={password}
        onChange={onPasswordChange}
        placeholder="Mot de passe (10 caractères minimum)"
        autoComplete="new-password"
        disabled={pending}
      />
      <PasswordStrength password={password} />
      <PasswordField
        value={passwordConfirmation}
        onChange={onPasswordConfirmationChange}
        placeholder="Confirmer le mot de passe"
        autoComplete="new-password"
        disabled={pending}
      />
      {passwordConfirmation && password !== passwordConfirmation && (
        <p className="text-xs text-destructive">
          Les mots de passe ne correspondent pas.
        </p>
      )}
      <label
        htmlFor="remember-new-company"
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-left transition hover:border-primary/25"
      >
        <Checkbox
          id="remember-new-company"
          checked={rememberMe}
          onCheckedChange={value => onRememberMeChange(value === true)}
          disabled={pending}
          className="mt-0.5 border-input"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            Se souvenir de moi
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Prolonge la session sur cet appareil.
          </span>
        </span>
      </label>
      <Button
        type="submit"
        disabled={pending || !canSubmit}
        className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {pending ? "Création…" : "Créer mon espace"}
      </Button>
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
      <p className="px-1 text-center text-xs leading-5 text-muted-foreground">
        En créant votre espace, vous acceptez les{" "}
        <Link
          href="/conditions-utilisation"
          className="text-primary hover:underline"
        >
          Conditions d’utilisation
        </Link>{" "}
        et reconnaissez avoir lu la{" "}
        <Link
          href="/politique-confidentialite"
          className="text-primary hover:underline"
        >
          Politique de confidentialité
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={onBack}
        className="w-full pt-1 text-sm font-medium text-primary hover:text-primary hover:underline"
      >
        J’ai déjà un compte
      </button>
    </form>
  );
}

function EmailVerificationBanner() {
  const resend = trpc.auth.resendVerification.useMutation();
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning"
      role="status"
    >
      <span>
        Confirmez votre adresse e-mail pour sécuriser la récupération de votre
        compte.
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={resend.isPending || resend.isSuccess}
        onClick={() => resend.mutate()}
        className="border-warning/40 text-warning"
      >
        {resend.isSuccess
          ? "E-mail envoyé"
          : resend.isPending
            ? "Envoi…"
            : "Renvoyer le lien"}
      </Button>
    </div>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { currency } = usePreferences();
  const { isOnline, pendingCount, sales: offlineSales, syncNow } = useOffline();
  const [location, setLocation] = useLocation();
  const { state, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const { data: companySettings } = trpc.commerce.settings.get.useQuery(
    undefined,
    { staleTime: 5 * 60_000 }
  );
  const [menuSearch, setMenuSearch] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const { can: hasPermission, roleLabel } = usePermissions();
  const { theme, setTheme } = useTheme();
  const { data: subscription } = trpc.company.subscription.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const canSeeItem = (item: MenuItem) =>
    (!item.anyOf || item.anyOf.some(permission => hasPermission(permission))) &&
    // Un vendeur ne voit les produits que s'il peut modifier le coût d'achat (réglage du point de vente).
    !(
      item.path === "/produits" &&
      user?.role === "seller" &&
      !companySettings?.sellerCanEditPurchasePrice
    );
  const visibleGroups: MenuGroup[] = menuGroups
    .map(group => {
      const items = group.items.filter(canSeeItem);
      if (group.title === "Administration") {
        if (!hasPermission("settings.manage")) items.push(...personalMenuItems);
        if (subscription?.isPlatformAdmin)
          items.push({
            icon: ShieldCheck,
            label: "Plateforme",
            path: "/plateforme",
          });
      }
      return { ...group, items };
    })
    .filter(group => group.items.length > 0);
  const visibleMenuItems = visibleGroups.flatMap(group => group.items);
  const searchTerm = normalizeSearch(menuSearch);
  const displayedGroups = searchTerm
    ? visibleGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item =>
            normalizeSearch(`${item.label} ${group.title}`).includes(searchTerm)
          ),
        }))
        .filter(group => group.items.length > 0)
    : visibleGroups;
  const activeGroup =
    visibleGroups.find(group =>
      group.items.some(item => isMenuItemActive(item.path, location))
    ) ?? visibleGroups[0];
  const activeMenuItem =
    activeGroup?.items.find(item => isMenuItemActive(item.path, location)) ??
    visibleMenuItems[0];
  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();
  const isAdmin = hasPermission("backups.manage");
  const canRunBackup = Boolean(user);
  const { data: dashboard } = trpc.dashboard.get.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  const { data: backups } = trpc.backups.get.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  const runBackup = trpc.backups.runNow.useMutation({
    onSuccess: archive =>
      toast.success(`Sauvegarde ${archive.filename} créée.`),
    onError: error => toast.error(error.message),
  });
  const candidateNotifications: RoleNotification[] = [];
  if (isAdmin) {
    if (dashboard?.lowStock?.length)
      candidateNotifications.push({
        id: "stock",
        title: "Stock critique",
        detail: `${dashboard.lowStock.length} produit(s) au seuil minimum`,
        tone: "amber",
        path: "/alertes",
        audience: "admin",
      });
    if ((dashboard?.summary?.duePayrollCents ?? 0) > 0)
      candidateNotifications.push({
        id: "payroll",
        title: "Paie à régler",
        detail: `${dashboard?.summary?.duePayrollCents ?? 0} centimes restent à payer`,
        tone: "violet",
        path: "/agents",
        audience: "admin",
      });
    if (dashboard?.summary?.expenseBudget?.exceeded)
      candidateNotifications.push({
        id: "budget-over",
        title: "Budget dépassé",
        detail: "Les dépenses ont dépassé le plafond mensuel.",
        tone: "rose",
        path: "/depenses",
        audience: "admin",
      });
    else if (dashboard?.summary?.expenseBudget?.warningReached)
      candidateNotifications.push({
        id: "budget-warning",
        title: "Seuil budget atteint",
        detail: "Le seuil d’alerte des dépenses est atteint.",
        tone: "amber",
        path: "/depenses",
        audience: "admin",
      });
    if (backups?.settings.lastBackupStatus === "failed")
      candidateNotifications.push({
        id: "backup",
        title: "Sauvegarde à vérifier",
        detail:
          backups.settings.lastBackupError ||
          "La dernière sauvegarde a échoué.",
        tone: "rose",
        path: "/sauvegardes",
        audience: "admin",
      });
  }
  const notifications = visibleNotificationsForRole(
    user?.role === "admin" ? "admin" : "seller",
    candidateNotifications
  );
  const [readNotificationIdsState, setReadNotificationIdsState] = useState<
    string[]
  >([]);
  useEffect(() => {
    setReadNotificationIdsState(
      readNotificationIds(user?.companyId ?? undefined, user?.id)
    );
  }, [user?.companyId, user?.id]);
  const saveReadNotifications = (ids: string[]) => {
    setReadNotificationIdsState(ids);
    writeNotificationIds(user?.companyId ?? undefined, user?.id, ids);
  };
  const markNotificationRead = (id: string) => {
    if (!readNotificationIdsState.includes(id))
      saveReadNotifications([...readNotificationIdsState, id]);
  };
  const markAllNotificationsRead = () =>
    saveReadNotifications(notifications.map(notification => notification.id));

  const lowStockCount = dashboard?.lowStock?.length ?? 0;
  const companyName = companySettings?.companyName || "StockPilot";
  const goTo = (path: string) => {
    setMenuSearch("");
    setOpenMobile(false);
    setLocation(path);
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="gap-4 px-3 pt-5 pb-2">
          <button
            onClick={() => goTo("/")}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Aller au tableau de bord"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground">
              {companySettings?.companyLogoUrl ? (
                <img
                  src={companySettings.companyLogoUrl}
                  alt=""
                  className="h-8 w-8 rounded-lg bg-card object-contain"
                />
              ) : (
                companyName.slice(0, 1).toUpperCase()
              )}
            </span>
            {!isCollapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold tracking-tight text-foreground">
                  StockPilot
                </span>
                <span className="block truncate text-xs text-faint">
                  {companyName}
                </span>
              </span>
            )}
          </button>
          {!isCollapsed && (
            <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-muted px-2.5 text-faint focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={menuSearch}
                onChange={event => setMenuSearch(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && displayedGroups[0]?.items[0])
                    goTo(displayedGroups[0].items[0].path);
                  if (event.key === "Escape") setMenuSearch("");
                }}
                placeholder="Rechercher…"
                aria-label="Rechercher une page"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-faint"
              />
              <kbd className="hidden rounded border border-border bg-card px-1.5 text-[10px] font-medium text-faint sm:inline">
                Ctrl K
              </kbd>
            </label>
          )}
        </SidebarHeader>

        <SidebarContent className="gap-0 overflow-y-auto px-3 pb-4">
          {displayedGroups.map(group => (
            <SidebarGroup key={group.title} className="shrink-0 px-0 py-2">
              <SidebarGroupLabel className="h-6 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                {group.title}
              </SidebarGroupLabel>
              <SidebarMenu className="gap-0.5">
                {group.items.map(item => {
                  const isActive = isMenuItemActive(item.path, location);
                  const badge =
                    item.path === "/alertes" && lowStockCount > 0
                      ? lowStockCount
                      : null;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.label}
                        onClick={() => goTo(item.path)}
                        className="h-[34px] rounded-lg px-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground data-[active=true]:bg-primary-soft data-[active=true]:font-semibold data-[active=true]:text-primary"
                      >
                        <item.icon className="h-[17px] w-[17px]" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {badge !== null && (
                        <SidebarMenuBadge className="rounded-full bg-destructive-soft px-1.5 text-xs font-semibold text-destructive peer-data-[active=true]/menu-button:text-destructive">
                          {badge > 99 ? "99+" : badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
          {searchTerm && displayedGroups.length === 0 && (
            <p className="px-2.5 py-3 text-sm text-faint">
              Aucune page ne correspond.
            </p>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-3">
          <DropdownMenu
            open={accountMenuOpen}
            onOpenChange={setAccountMenuOpen}
          >
            <DropdownMenuTrigger asChild>
              <button
                // Ouverture au clic complet : un appui prolongé ne doit jamais
                // « glisser » jusqu'à « Se déconnecter » au relâchement.
                onPointerDown={event => event.preventDefault()}
                onClick={() => setAccountMenuOpen(current => !current)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="h-8 w-8 shrink-0 border border-border">
                  <AvatarFallback className="bg-primary-soft text-[11px] font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {user?.name || "Utilisateur"}
                    </span>
                    <span className="block truncate pt-0.5 text-xs text-faint">
                      {roleLabel}
                    </span>
                  </span>
                )}
                {!isCollapsed && (
                  <ChevronDown className="h-3.5 w-3.5 text-faint" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side={isMobile ? "top" : "right"}
              sideOffset={8}
              className="w-60"
            >
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">
                  {user?.name || "Utilisateur"}
                </p>
                <p className="mt-0.5 truncate text-xs text-faint">
                  {user?.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="cursor-pointer"
              >
                {theme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {theme === "dark" ? "Thème clair" : "Thème sombre"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => goTo("/parametres/securite")}
                className="cursor-pointer"
              >
                <ShieldCheck className="mr-2 h-4 w-4" /> Sécurité du compte
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:bg-destructive-soft focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background text-foreground">
        <header className="app-header sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-8">
          <SidebarTrigger className="h-9 w-9 shrink-0 rounded-lg border border-input bg-card text-muted-foreground hover:bg-accent lg:hidden" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-faint">
              {activeGroup?.title ?? "Pilotage"}
            </p>
            <p className="truncate text-[17px] font-semibold tracking-tight text-foreground">
              {activeMenuItem?.label ?? "Vue d’ensemble"}
            </p>
          </div>
          <div className="ml-auto">
            <HeaderActions
              canRunBackup={canRunBackup}
              compact={isMobile}
              pending={runBackup.isPending}
              onBackup={() => runBackup.mutate()}
              notifications={notifications}
              readNotificationIds={readNotificationIdsState}
              onNotification={goTo}
              onMarkNotificationRead={markNotificationRead}
              onMarkAllNotificationsRead={markAllNotificationsRead}
              isOnline={isOnline}
              pendingOfflineSales={pendingCount}
              hasFailedOfflineSale={offlineSales.some(
                sale => sale.status === "failed"
              )}
              onSync={() => void syncNow()}
            />
          </div>
        </header>
        <div
          key={currency}
          className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-8 sm:py-7"
        >
          {subscription && !subscription.writable && (
            <div
              className="mb-4 rounded-xl border border-destructive/25 bg-destructive-soft px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {subscription.reason === "suspended"
                ? "Cet espace est suspendu : les données restent consultables, les nouvelles opérations sont bloquées. Contactez le support."
                : "La période d’essai est terminée : les données restent consultables et exportables. Choisissez une offre pour continuer à enregistrer des opérations."}{" "}
              {hasPermission("settings.manage") && (
                <Link
                  href="/parametres/abonnement"
                  className="font-semibold underline"
                >
                  Voir l’abonnement
                </Link>
              )}
            </div>
          )}
          {user && !user.emailVerifiedAt && <EmailVerificationBanner />}
          {children}
        </div>
      </SidebarInset>
    </>
  );
}

function HeaderActions({
  canRunBackup,
  compact = false,
  pending,
  onBackup,
  notifications,
  readNotificationIds,
  onNotification,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  isOnline,
  pendingOfflineSales,
  hasFailedOfflineSale,
  onSync,
}: {
  canRunBackup: boolean;
  compact?: boolean;
  pending: boolean;
  onBackup: () => void;
  notifications: Array<{
    id: string;
    title: string;
    detail: string;
    tone: "amber" | "violet" | "rose";
    path: string;
  }>;
  readNotificationIds: string[];
  onNotification: (path: string) => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  isOnline: boolean;
  pendingOfflineSales: number;
  hasFailedOfflineSale: boolean;
  onSync: () => void;
}) {
  const unreadCount = unreadNotificationCount(
    notifications.map(notification => notification.id),
    readNotificationIds
  );
  const counter = unreadCount > 9 ? "9+" : String(unreadCount);
  const tones = {
    amber: "bg-warning-soft text-warning",
    violet: "bg-info-soft text-info",
    rose: "bg-destructive-soft text-destructive",
  };
  return (
    <div className="flex items-center gap-2">
      {(!isOnline || pendingOfflineSales > 0) && (
        <Button
          onClick={onSync}
          disabled={!isOnline}
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={`h-9 border-border bg-card ${hasFailedOfflineSale ? "text-destructive" : !isOnline ? "text-warning" : "text-primary"}`}
          aria-label={
            !isOnline
              ? "Mode hors connexion"
              : `${pendingOfflineSales} vente(s) à synchroniser`
          }
        >
          {!isOnline ? (
            <CloudOff className={`h-4 w-4 ${compact ? "" : "mr-2"}`} />
          ) : (
            <CloudUpload className={`h-4 w-4 ${compact ? "" : "mr-2"}`} />
          )}
          {!compact &&
            (!isOnline
              ? "Hors connexion"
              : `${pendingOfflineSales} à synchroniser`)}
        </Button>
      )}
      {canRunBackup && (
        <Button
          onClick={onBackup}
          disabled={pending}
          size={compact ? "icon" : "sm"}
          className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
          aria-label="Créer une sauvegarde maintenant"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className={`h-4 w-4 ${compact ? "" : "mr-2"}`} />
          )}
          {!compact && (pending ? "Sauvegarde…" : "Sauvegarder")}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="relative h-9 w-9 border-border bg-card text-foreground hover:bg-accent"
            aria-label={`${unreadCount} notification(s) non lue(s)`}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[9px] font-bold leading-none text-warning-foreground shadow-sm">
                {counter}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[340px] border-border bg-card p-0 text-foreground shadow-xl"
        >
          <DropdownMenuLabel className="flex items-center justify-between gap-3 px-4 py-3">
            <span>Notifications</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAllNotificationsRead}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tout marquer comme lu
              </button>
            ) : (
              <span className="text-xs font-normal text-faint">
                Tout est à jour
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-muted" />
          {notifications.length ? (
            <div className="max-h-[360px] overflow-y-auto py-1">
              {notifications.map(notification => {
                const unread = !readNotificationIds.includes(notification.id);
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => {
                      onMarkNotificationRead(notification.id);
                      onNotification(notification.path);
                    }}
                    className={`cursor-pointer items-start gap-3 px-4 py-3 focus:bg-accent ${unread ? "bg-primary/5" : ""}`}
                  >
                    <span
                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[notification.tone]}`}
                    >
                      <CircleAlert className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`block text-sm text-foreground ${unread ? "font-semibold" : "font-medium"}`}
                        >
                          {notification.title}
                        </span>
                        {unread && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-primary"
                            aria-label="Non lue"
                          />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-faint">
                        {notification.detail}
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-9 text-center">
              <Bell className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm text-foreground">
                Aucune notification
              </p>
              <p className="mt-1 text-xs text-faint">
                Les alertes importantes apparaîtront ici.
              </p>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
