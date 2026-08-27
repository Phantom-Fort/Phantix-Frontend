import { useEffect, useRef, useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { cx } from "@/lib/utils";

/**
 * Light / dark / auto theme picker. Dark is the product default; "auto"
 * follows the OS preference live. Renders a compact icon button that opens a
 * small menu, mirroring the Xalgorix webui theme toggle. Fully self-contained
 * (no shared Menu dependency) so the same component works in every Phantix app.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, mode, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "Auto", icon: Monitor },
  ];

  // The trigger shows what's actually rendered: the OS-resolved icon in system
  // mode, otherwise the chosen mode's icon.
  const TriggerIcon = mode === "system" ? Monitor : theme === "dark" ? Moon : Sun;

  return (
    <div ref={ref} className={cx("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Toggle color theme"
        aria-label="Toggle color theme"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-phantix-700/50 bg-phantix-800/40 text-slate-300 transition-colors hover:bg-phantix-700/50 hover:text-gold-300"
      >
        <TriggerIcon size={15} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-1.5 min-w-[160px] overflow-hidden rounded-xl border border-phantix-700/50 bg-phantix-900 p-1 shadow-lg"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Theme
          </p>
          {options.map((o) => {
            const Icon = o.icon;
            const active = mode === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  setTheme(o.value);
                  setOpen(false);
                }}
                className={cx(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                  active
                    ? "bg-phantix-800 text-gold-200"
                    : "text-slate-300 hover:bg-phantix-800/70 hover:text-white",
                )}
              >
                <Icon size={13} className="shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {active && <Check size={13} className="shrink-0 text-gold-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
