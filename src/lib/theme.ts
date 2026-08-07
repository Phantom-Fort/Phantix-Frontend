import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const THEME_KEY = "phantix_theme";

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((l) => l());
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* ignore */ }
  // Dark (navy + gold) is the product default.
  return "dark";
}

/** In-memory theme — single source of truth for all useTheme() subscribers. */
let currentTheme: Theme = getInitialTheme();

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", "light");
  root.style.colorScheme = theme;
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0D1B3D" : "#F4F6FA");
  } catch { /* ignore */ }
}

function setThemeValue(theme: Theme): void {
  if (currentTheme === theme) {
    applyTheme(theme);
    return;
  }
  currentTheme = theme;
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { /* ignore */ }
  emit();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return currentTheme;
}

function getServerSnapshot(): Theme {
  return "dark";
}

/**
 * Light / dark theme. Dark (navy + gold) is the product default.
 * Shared across the whole app so BrandLogo / ThemeToggle update together
 * without a full page reload.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    setThemeValue(currentTheme === "dark" ? "light" : "dark");
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeValue(t);
  }, []);

  return { theme, toggleTheme, setTheme };
}

/** Apply the persisted theme before first paint (call from main.tsx / index.html). */
export function bootstrapTheme(): void {
  currentTheme = getInitialTheme();
  applyTheme(currentTheme);
}

/** Chart / SVG colors that cannot use Tailwind utilities (Recharts, ProgressRing stroke). */
export function chartColors(theme: Theme = currentTheme) {
  if (theme === "light") {
    return {
      gold: "#C49428",
      goldSoft: "#B88A28",
      emerald: "#059669",
      sky: "#0284C7",
      orange: "#EA741E",
      muted: "#64748B",
      tooltipBg: "#FFFFFF",
      tooltipBorder: "#D6DEEE",
      tooltipColor: "#0F172A",
      grid: "#E2E8F0",
      surface: "#FFFFFF",
    };
  }
  return {
    gold: "#E8B54D",
    goldSoft: "#E8B54D",
    emerald: "#34D399",
    sky: "#38BDF8",
    orange: "#FB923C",
    muted: "#64748B",
    tooltipBg: "#0D1B3D",
    tooltipBorder: "#1E3350",
    tooltipColor: "#E2E8F0",
    grid: "#1E3350",
    surface: "#0D1B3D",
  };
}
