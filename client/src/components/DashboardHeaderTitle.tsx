import * as React from "react";
import { LayoutDashboard } from "lucide-react";

type DashboardHeaderMenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
};

export function DashboardHeaderTitle({
  activeMenuItem,
}: {
  activeMenuItem?: DashboardHeaderMenuItem;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {activeMenuItem && (
        <activeMenuItem.icon className="h-4 w-4 shrink-0 text-primary" />
      )}
      <span className="truncate text-sm font-semibold text-foreground">
        {activeMenuItem?.label ?? "Vue d’ensemble"}
      </span>
    </div>
  );
}
