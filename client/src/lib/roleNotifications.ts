export type NotificationAudience = "admin" | "seller" | "all";

export type RoleNotification = {
  id: string;
  title: string;
  detail: string;
  tone: "amber" | "violet" | "rose";
  path: string;
  audience: NotificationAudience;
};

export function visibleNotificationsForRole(role: "admin" | "seller" | undefined, notifications: RoleNotification[]) {
  return notifications.filter(notification => notification.audience === "all" || notification.audience === role);
}
