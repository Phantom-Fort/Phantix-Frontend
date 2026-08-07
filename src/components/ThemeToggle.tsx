import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cx } from "@/lib/utils";

/**
 * Light / dark theme toggle. Dark is the product default.
 * Renders a compact icon button suitable for the topbar.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle color theme"
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
        "border-phantix-700/50 bg-phantix-800/40 text-slate-300 hover:bg-phantix-700/50 hover:text-gold-300",
        className,
      )}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
