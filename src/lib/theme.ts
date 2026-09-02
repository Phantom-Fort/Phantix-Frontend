import { useCallback, useSyncExternalStore } from "react";

/**
 * Theme store — light / dark / system (auto).
 *
 * Mirrors the Xalgorix webui store: a tiny useSyncExternalStore-based store so
 * any component can read/set the theme without a context provider. The choice
 * is persisted to localStorage and mirrored onto <html> as the `data-theme`
 * attribute (the Phantix CSS contract, see index.css) plus the `theme-color`
 * meta tag and `color-scheme`.
 *
 * Modes: "light" | "dark" | "system". "system" follows the OS
 * prefers-color-scheme and updates live when it changes. The pre-hydration
 * inline script in index.html applies the same attribute synchronously to
 * avoid a flash of the wrong theme before this module loads.
 */

export type ThemeMode = "light" | "dark" | "system";
/** The concrete theme actually rendered (system is resolved to one of these). */
export type Theme = "dark" | "light";

const THEME_KEY = "phantix_theme";

// Kept in sync with the `--surface` token in index.css so the mobile browser
// chrome matches the app surface.
const THEME_COLOR: Record<Theme, string> = {
  dark: "#000000",
  light: "#F4F6FA",
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((l) => l());
}

function isMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "system";
}

function getInitialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (isMode(stored)) return stored;
  } catch {
    /* storage may be unavailable (private mode) */
  }
  // Dark (navy + gold) is the product default.
  return "dark";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveMode(mode: ThemeMode): Theme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

let currentMode: ThemeMode = getInitialMode();
let currentTheme: Theme = resolveMode(currentMode);

// Cached snapshot object so useSyncExternalStore only re-renders when the
// store actually changes (returning a fresh object each call would loop).
let state: { mode: ThemeMode; resolved: Theme } = {
  mode: currentMode,
  resolved: currentTheme,
};

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.removeAttribute("data-theme");
    root.classList.add("dark");
  } else {
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
  }
  root.style.colorScheme = theme;
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOR[theme]);
  } catch {
    /* ignore */
  }
}
applyTheme(currentTheme);

// While in "system" mode, follow live OS theme changes.
if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (currentMode !== "system") return;
    const next: Theme = systemPrefersDark() ? "dark" : "light";
    if (next === currentTheme) return;
    currentTheme = next;
    state = { mode: currentMode, resolved: next };
    applyTheme(next);
    emit();
  };
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange); // older Safari
}

function setThemeMode(mode: ThemeMode): void {
  currentMode = mode;
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* storage may be unavailable (private mode); UI still switches */
  }
  const resolved = resolveMode(mode);
  currentTheme = resolved;
  state = { mode, resolved };
  applyTheme(resolved);
  emit();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return { mode: "dark" as ThemeMode, resolved: "dark" as Theme };
}

/**
 * React hook exposing the active theme.
 * - `theme` / `resolved`: the concrete theme currently rendered (dark|light).
 * - `mode`: the chosen mode (light|dark|system).
 * - `toggleTheme`: pin an explicit light/dark opposite of the current resolved.
 * - `setTheme`: set an explicit mode (now also accepts "system").
 */
export function useTheme() {
  const { mode, resolved } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggleTheme = useCallback(() => {
    setThemeMode(currentTheme === "dark" ? "light" : "dark");
  }, []);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeMode(t);
  }, []);

  return { theme: resolved, mode, resolved, toggleTheme, setTheme };
}

/** Apply the persisted theme before first paint (call from main.tsx). */
export function bootstrapTheme(): void {
  currentMode = getInitialMode();
  currentTheme = resolveMode(currentMode);
  state = { mode: currentMode, resolved: currentTheme };
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
    muted: "#71717A",
    tooltipBg: "#0A0A0A",
    tooltipBorder: "#27272A",
    tooltipColor: "#E4E4E7",
    grid: "#27272A",
    surface: "#0A0A0A",
  };
}
