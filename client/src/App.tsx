import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Alerts from "./pages/Alerts";
import Home from "./pages/Home";
import Movements from "./pages/Movements";
import Products from "./pages/Products";
import Suppliers from "./pages/Suppliers";
import AuditLog from "./pages/AuditLog";
import UserManagement from "./pages/UserManagement";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/produits"} component={Products} />
        <Route path={"/mouvements"} component={Movements} />
        <Route path={"/fournisseurs"} component={Suppliers} />
        <Route path={"/alertes"} component={Alerts} />
        <Route path={"/journal"} component={AuditLog} />
        <Route path={"/utilisateurs"} component={UserManagement} />
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
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
