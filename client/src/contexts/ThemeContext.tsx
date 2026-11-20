import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { readPreference, writePreference } from "@/lib/preferenceStorage";
import { resolveTheme, type Theme, type ThemeMode } from "@/lib/themeRules";

type ThemeSchedule = { darkStartHour: number; lightStartHour: number };

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  schedule: ThemeSchedule;
  toggleTheme?: () => void;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSchedule: (schedule: ThemeSchedule) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const modeValues: readonly ThemeMode[] = ["manual", "system", "schedule"];
const themeValues: readonly Theme[] = ["light", "dark"];
const hourValues = Array.from({ length: 24 }, (_, hour) => String(hour));

function readHour(key: string, fallback: number) {
  const value = readPreference(typeof window === "undefined" ? undefined : localStorage, key, hourValues, String(fallback));
  return Number(value);
}

interface ThemeProviderProps { children: React.ReactNode; defaultTheme?: Theme; switchable?: boolean; }

export function ThemeProvider({ children, defaultTheme = "light", switchable = false }: ThemeProviderProps) {
  const [manualTheme, setManualTheme] = useState<Theme>(() => switchable ? readPreference(typeof window === "undefined" ? undefined : localStorage, "theme", themeValues, defaultTheme) : defaultTheme);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => switchable ? readPreference(typeof window === "undefined" ? undefined : localStorage, "theme-mode", modeValues, "manual") : "manual");
  const [schedule, setScheduleState] = useState<ThemeSchedule>(() => ({ darkStartHour: readHour("theme-dark-start-hour", 19), lightStartHour: readHour("theme-light-start-hour", 7) }));
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystem = () => setSystemPrefersDark(media.matches);
    updateSystem();
    media.addEventListener("change", updateSystem);
    const timer = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => { media.removeEventListener("change", updateSystem); window.clearInterval(timer); };
  }, []);

  const theme = useMemo(() => resolveTheme(themeMode, manualTheme, systemPrefersDark, hour, schedule.darkStartHour, schedule.lightStartHour), [themeMode, manualTheme, systemPrefersDark, hour, schedule]);

  const firstApply = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.classList.toggle("dark", theme === "dark");
    // Passage clair/sombre en fondu, sauf au premier affichage, si rien ne change
    // ou si l'appareil demande de réduire les animations.
    const changes = root.classList.contains("dark") !== (theme === "dark");
    const animate = !firstApply.current && changes && typeof document.startViewTransition === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    firstApply.current = false;
    if (animate) document.startViewTransition(apply);
    else apply();
    if (!switchable) return;
    const storage = typeof window === "undefined" ? undefined : localStorage;
    writePreference(storage, "theme", manualTheme);
    writePreference(storage, "theme-mode", themeMode);
    writePreference(storage, "theme-dark-start-hour", String(schedule.darkStartHour));
    writePreference(storage, "theme-light-start-hour", String(schedule.lightStartHour));
  }, [theme, switchable, manualTheme, themeMode, schedule]);

  const setTheme = (next: Theme) => { setManualTheme(next); setThemeModeState("manual"); };
  const setThemeMode = (mode: ThemeMode) => setThemeModeState(mode);
  const setSchedule = (next: ThemeSchedule) => setScheduleState({ darkStartHour: Math.min(23, Math.max(0, next.darkStartHour)), lightStartHour: Math.min(23, Math.max(0, next.lightStartHour)) });
  const toggleTheme = switchable ? () => setTheme(theme === "light" ? "dark" : "light") : undefined;

  return <ThemeContext.Provider value={{ theme, themeMode, schedule, toggleTheme, setTheme, setThemeMode, setSchedule, switchable }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
