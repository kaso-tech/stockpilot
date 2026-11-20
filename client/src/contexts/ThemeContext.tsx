import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { readPreference, writePreference } from "@/lib/preferenceStorage";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  setTheme: (theme: Theme) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (switchable) {
      return readPreference(
        typeof window === "undefined" ? undefined : localStorage,
        "theme",
        ["light", "dark"],
        defaultTheme
      );
    }
    return defaultTheme;
  });

  const firstApply = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.classList.toggle("dark", theme === "dark");
    // Passage clair/sombre en fondu, sauf au premier affichage et si l'appareil
    // demande de réduire les animations.
    const animate =
      !firstApply.current &&
      typeof document.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    firstApply.current = false;
    if (animate) document.startViewTransition(apply);
    else apply();

    if (switchable) {
      writePreference(
        typeof window === "undefined" ? undefined : localStorage,
        "theme",
        theme
      );
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setThemeState(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme: setThemeState, toggleTheme, switchable }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
