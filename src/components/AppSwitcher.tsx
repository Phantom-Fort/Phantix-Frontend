import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Boxes, ChevronDown, Code2, Crosshair, LayoutGrid, ShieldCheck } from "lucide-react";
import { cx } from "@/lib/utils";
import { useResource } from "@/lib/useResource";
import {
  accessibleApplications,
  applicationHandoffHref,
  applicationTarget,
  loadApplications,
  lastApp,
  rememberApp,
  type ApplicationCard,
  type ApplicationKey,
  type ApplicationsSnapshot,
} from "@/lib/applications";

const ICONS: Record<string, React.ReactNode> = {
  core: <Boxes size={15} />,
  attack: <Crosshair size={15} />,
  defend: <ShieldCheck size={15} />,
  code: <Code2 size={15} />,
};

/**
 * Dashboard routing function — open another application (Core / Attack / Defend)
 * without re-authenticating. Renders nothing when the principal can enter only
 * one application.
 */
export default function AppSwitcher({ current = "core" }: { current?: ApplicationKey }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { data } = useResource<ApplicationsSnapshot | null>(loadApplications, null, "applications");

  const apps = accessibleApplications(data);
  const currentCard = apps.find((a) => a.key === current);
  const last = lastApp();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (apps.length <= 1) return null;

  async function go(app: ApplicationCard) {
    rememberApp(app.key);
    setOpen(false);
    if (app.key === current) return;
    const target = applicationTarget(app.key);
    if (!target.external) {
      navigate(target.href);
      return;
    }
    // Carry this session across the origin boundary (single-use, seconds-long).
    window.location.assign(await applicationHandoffHref(app.key));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary flex items-center gap-2 !py-2"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch application"
      >
        <LayoutGrid size={15} />
        <span className="hidden sm:inline">{currentCard?.label || "Applications"}</span>
        <ChevronDown size={14} className={cx("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-phantix-700/50 bg-phantix-900/95 p-1.5 shadow-2xl backdrop-blur"
        >
          {apps.map((app) => {
            const isCurrent = app.key === current;
            return (
              <button
                key={app.key}
                role="menuitem"
                type="button"
                onClick={() => go(app)}
                className={cx(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  isCurrent ? "bg-phantix-800/70" : "hover:bg-phantix-800/50",
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-phantix-800/70 text-gold-400">
                  {ICONS[app.key]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                    {app.label}
                    {isCurrent ? (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-gold-400">
                        current
                      </span>
                    ) : (
                      <ArrowUpRight size={12} className="text-slate-500" />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{app.tagline}</span>
                </span>
              </button>
            );
          })}
          <div className="mt-1 border-t border-phantix-700/40 px-3 py-2 text-[11px] text-slate-500">
            {last ? `Last used: ${last}` : "Switch without signing in again"}
          </div>
        </div>
      )}
    </div>
  );
}
