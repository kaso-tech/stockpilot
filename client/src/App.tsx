import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import Alerts from "./pages/Alerts";
import Agents from "./pages/Agents";
import Customers from "./pages/Customers";
import Home from "./pages/Home";
import Invoices from "./pages/Invoices";
import InvoiceCreate from "./pages/InvoiceCreate";
import Inventories from "./pages/Inventories";
import Movements from "./pages/Movements";
import PointOfSale from "./pages/PointOfSale";
import Products from "./pages/Products";
import Suppliers from "./pages/Suppliers";
import AuditLog from "./pages/AuditLog";
import SettingsIndex from "./pages/SettingsIndex";
import SettingsAppearance from "./pages/SettingsAppearance";
import SettingsCurrency from "./pages/SettingsCurrency";
import SettingsIdentity from "./pages/SettingsIdentity";
import Backups from "./pages/Backups";
import Expenses from "./pages/Expenses";
import SettingsPos from "./pages/SettingsPos";
import SettingsHistory from "./pages/SettingsHistory";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/pos"} component={PointOfSale} />
        <Route path={"/clients"} component={Customers} />
        <Route path={"/factures"} component={Invoices} />
        <Route path={"/factures/nouvelle"} component={InvoiceCreate} />
        <Route path={"/inventaires"} component={Inventories} />
        <Route path={"/agents"} component={Agents} />
        <Route path={"/parametres"} component={SettingsIndex} />
        <Route path={"/parametres/apparence"} component={SettingsAppearance} />
        <Route path={"/parametres/devise"} component={SettingsCurrency} />
        <Route path={"/parametres/identite"} component={SettingsIdentity} />
        <Route path={"/parametres/pos"} component={SettingsPos} />
        <Route path={"/parametres/historique"} component={SettingsHistory} />
        <Route path={"/sauvegardes"} component={Backups} />
        <Route path={"/depenses"} component={Expenses} />
        <Route path={"/produits"} component={Products} />
        <Route path={"/mouvements"} component={Movements} />
        <Route path={"/fournisseurs"} component={Suppliers} />
        <Route path={"/alertes"} component={Alerts} />
        <Route path={"/journal"} component={AuditLog} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <PreferencesProvider><Toaster /><Router /></PreferencesProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
