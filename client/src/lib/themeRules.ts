export type Theme = "light" | "dark";
export type ThemeMode = "manual" | "system" | "schedule";

export function isDarkScheduleHour(hour: number, darkStartHour: number, lightStartHour: number) {
  if (darkStartHour === lightStartHour) return false;
  return darkStartHour < lightStartHour
    ? hour >= darkStartHour && hour < lightStartHour
    : hour >= darkStartHour || hour < lightStartHour;
}

export function resolveTheme(mode: ThemeMode, manualTheme: Theme, systemPrefersDark: boolean, hour: number, darkStartHour: number, lightStartHour: number): Theme {
  if (mode === "system") return systemPrefersDark ? "dark" : "light";
  if (mode === "schedule") return isDarkScheduleHour(hour, darkStartHour, lightStartHour) ? "dark" : "light";
  return manualTheme;
}
