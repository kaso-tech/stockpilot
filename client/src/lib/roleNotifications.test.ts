import { describe, expect, it } from "vitest";
import { visibleNotificationsForRole } from "./roleNotifications";

describe("notifications par rôle", () => {
  const notifications = [
    { id: "stock", title: "Stock critique", detail: "Stock faible", tone: "amber" as const, path: "/alertes", audience: "admin" as const },
    { id: "sync", title: "Synchronisation", detail: "Une vente est en attente", tone: "violet" as const, path: "/synchronisation", audience: "seller" as const },
    { id: "maintenance", title: "Information", detail: "Mise à jour disponible", tone: "rose" as const, path: "/", audience: "all" as const },
  ];

  it("masque les notifications administrateur pour un vendeur", () => {
    expect(visibleNotificationsForRole("seller", notifications).map(notification => notification.id)).toEqual(["sync", "maintenance"]);
  });
});
