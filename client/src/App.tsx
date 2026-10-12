import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import { OfflineProvider } from "./contexts/OfflineContext";

// Chaque page est chargée à la demande (P1) ; le service worker précache tous les fragments pour le mode hors connexion.
const Alerts = lazy(() => import("./pages/Alerts"));
const Agents = lazy(() => import("./pages/Agents"));
const AgentDetail = lazy(() => import("./pages/AgentDetail"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Home = lazy(() => import("./pages/Home"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const InvoiceCreate = lazy(() => import("./pages/InvoiceCreate"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Inventories = lazy(() => import("./pages/Inventories"));
const Movements = lazy(() => import("./pages/Movements"));
const PointOfSale = lazy(() => import("./pages/PointOfSale"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const SupplierDetail = lazy(() => import("./pages/SupplierDetail"));
const PurchaseOrderDetail = lazy(() => import("./pages/PurchaseOrderDetail"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const SettingsIndex = lazy(() => import("./pages/SettingsIndex"));
const SettingsAppearance = lazy(() => import("./pages/SettingsAppearance"));
const SettingsCurrency = lazy(() => import("./pages/SettingsCurrency"));
const SettingsIdentity = lazy(() => import("./pages/SettingsIdentity"));
const SettingsPrinting = lazy(() => import("./pages/SettingsPrinting"));
const SettingsFiscal = lazy(() => import("./pages/SettingsFiscal"));
const Backups = lazy(() => import("./pages/Backups"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Categories = lazy(() => import("./pages/Categories"));
const Units = lazy(() => import("./pages/Units"));
const SettingsPos = lazy(() => import("./pages/SettingsPos"));
const SettingsPosSection = lazy(() => import("./pages/SettingsPosSection"));
const SettingsHistory = lazy(() => import("./pages/SettingsHistory"));
const SettingsDashboard = lazy(() => import("./pages/SettingsDashboard"));
const SettingsSecurity = lazy(() => import("./pages/SettingsSecurity"));
const DataExchange = lazy(() => import("./pages/DataExchange"));
const SyncJournal = lazy(() => import("./pages/SyncJournal"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

function PageFallback() {
  return <div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground" role="status">Chargement…</div>;
}

function DashboardRouter() {
  return (
    <DashboardLayout>
      <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/pos"} component={PointOfSale} />
        <Route path={"/clients/:id"} component={CustomerDetail} />
        <Route path={"/clients"} component={Customers} />
        <Route path={"/factures/nouvelle"} component={() => <InvoiceCreate />} />
        <Route path={"/devis/nouveau"} component={() => <InvoiceCreate documentType="quote" />} />
        <Route path={"/factures/:id"} component={InvoiceDetail} />
        <Route path={"/factures"} component={Invoices} />
        <Route path={"/devis"} component={Quotes} />
        <Route path={"/inventaires"} component={Inventories} />
        <Route path={"/agents/:beneficiaryType/:id"} component={AgentDetail} />
        <Route path={"/agents"} component={Agents} />
        <Route path={"/parametres"} component={SettingsIndex} />
        <Route path={"/parametres/apparence"} component={SettingsAppearance} />
        <Route path={"/parametres/devise"} component={SettingsCurrency} />
        <Route path={"/parametres/fiscalite"} component={SettingsFiscal} />
        <Route path={"/parametres/identite"} component={SettingsIdentity} />
        <Route path={"/parametres/impression"} component={SettingsPrinting} />
        <Route path={"/parametres/pos/rattachement"} component={() => <SettingsPosSection section="assignment" />} />
        <Route path={"/parametres/pos/tickets"} component={() => <SettingsPosSection section="ticket" />} />
        <Route path={"/parametres/pos/paiements"} component={() => <SettingsPosSection section="payments" />} />
        <Route path={"/parametres/pos/actions-vendeurs"} component={() => <SettingsPosSection section="seller" />} />
        <Route path={"/parametres/pos"} component={SettingsPos} />
        <Route path={"/parametres/tableau-de-bord"} component={SettingsDashboard} />
        <Route path={"/parametres/securite"} component={SettingsSecurity} />
        <Route path={"/parametres/historique"} component={SettingsHistory} />
        <Route path={"/sauvegardes"} component={Backups} />
        <Route path={"/depenses"} component={Expenses} />
        <Route path={"/produits/:id"} component={ProductDetail} />
        <Route path={"/produits"} component={Products} />
        <Route path={"/categories"} component={Categories} />
        <Route path={"/unites"} component={Units} />
        <Route path={"/mouvements"} component={Movements} />
        <Route path={"/bons-commande"} component={PurchaseOrders} />
        <Route path={"/bons-commande/:id"} component={PurchaseOrderDetail} />
        <Route path={"/fournisseurs/:id"} component={SupplierDetail} />
        <Route path={"/fournisseurs"} component={Suppliers} />
        <Route path={"/alertes"} component={Alerts} />
        <Route path={"/journal"} component={AuditLog} />
        <Route path={"/synchronisation"} component={SyncJournal} />
        <Route path={"/donnees"} component={DataExchange} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </DashboardLayout>
  );
}

function Router() {
  return <Suspense fallback={<PageFallback />}><Switch><Route path="/conditions-utilisation" component={TermsOfUse} /><Route path="/politique-confidentialite" component={PrivacyPolicy} /><Route component={DashboardRouter} /></Switch></Suspense>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <PreferencesProvider><OfflineProvider><Toaster richColors closeButton position="top-right" /><Router /></OfflineProvider></PreferencesProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
