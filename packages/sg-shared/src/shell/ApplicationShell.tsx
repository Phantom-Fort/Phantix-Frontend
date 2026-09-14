import React, { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, LogOut } from "lucide-react";
import { useSidebarCollapsed } from "../useSidebarCollapsed";
import { apiGet, appToken } from "./api";
import {
  APPLICATION_LABEL,
  APPLICATION_ORDER,
  type ApplicationKey,
  type NavSection,
} from "./types";

export interface ApplicationShellProps {
  application: ApplicationKey;
  /** Sidebar subtitle, e.g. "Attack" / "Code". */
  subtitle: string;
  nav: NavSection[];
  /** Absolute base URL per application (for the app switcher). */
  hosts: Record<ApplicationKey, string>;
}

/**
 * The shared shell every SecureGraph application renders: a collapsible sidebar
 * (icon rail), section nav, an application switcher, and a topbar. Pages render
 * into <Outlet/>. The operator's collapse preference is shared across apps.
 */
export function ApplicationShell({ application, subtitle, nav, hosts }: ApplicationShellProps) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [me, setMe] = useState<{ full_name?: string; email?: string } | null>(null);

  // Unauthenticated operators are sent to the Core login (which owns the
  // app-session handshake). Cross-app session handoff copies the tokens.
  useEffect(() => {
    if (!appToken()) {
      const login = hosts.core ? `${hosts.core}/login` : "/login";
      window.location.assign(login);
      return;
    }
    let alive = true;
    apiGet<{ full_name?: string; email?: string }>("/app/auth/me")
      .then((v) => alive && setMe(v))
      .catch(() => alive && setMe(null));
    return () => {
      alive = false;
    };
  }, [hosts.core]);

  function openApp(key: ApplicationKey) {
    setSwitcherOpen(false);
    if (key === application) return;
    const base = hosts[key];
    if (base) window.location.assign(base);
  }

  function signOut() {
    try {
      sessionStorage.removeItem("app_session_token");
      sessionStorage.removeItem("app_device_token");
      sessionStorage.removeItem("app_device_id");
    } catch {
      /* ignore */
    }
    window.location.assign(hosts.core ? `${hosts.core}/login` : "/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside
        data-collapsed={collapsed ? "" : undefined}
        className={`sg-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-phantix-700/60 bg-[rgb(var(--surface-sidebar))] lg:flex ${
          collapsed ? "w-[72px]" : "w-[248px]"
        }`}
      >
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <img src="/logo-white.png" alt="SecureGraph" className="h-8 w-8 shrink-0 object-contain" />
          <div className="sg-hide-collapsed">
            <p className="font-display text-[15px] font-bold leading-tight text-white">SecureGraph</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gold-400">
              {subtitle}
            </p>
          </div>
          <button
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-auto rounded-md border border-phantix-700 bg-phantix-900 p-1.5 text-slate-400 transition-colors hover:border-phantix-600 hover:text-white"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-3">
          {nav.map((section) => (
            <div key={section.label}>
              <p className="nav-section-label sg-hide-collapsed">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                  >
                    {item.icon}
                    <span className="sg-hide-collapsed">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Application switcher */}
        <div className="border-t border-phantix-700/60 p-2">
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((v) => !v)}
              title="Switch application"
              aria-haspopup="menu"
              aria-expanded={switcherOpen}
              className="nav-item w-full justify-between"
            >
              <span className="flex items-center gap-3">
                <LayoutGrid size={16} />
                <span className="sg-hide-collapsed">Applications</span>
              </span>
              <ChevronDown size={14} className="sg-hide-collapsed text-slate-500" />
            </button>
            {switcherOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-md border border-phantix-700 bg-phantix-900 p-1 shadow-card">
                {APPLICATION_ORDER.map((key) => (
                  <button
                    key={key}
                    onClick={() => openApp(key)}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs ${
                      key === application
                        ? "text-gold-300"
                        : "text-slate-300 hover:bg-phantix-800"
                    }`}
                  >
                    <span>{APPLICATION_LABEL[key]}</span>
                    {key === application && <span className="text-[10px] uppercase">current</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      <div
        className={`flex min-h-screen flex-1 flex-col ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-[248px]"
        }`}
      >
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-phantix-700/60 bg-phantix-950 px-4 py-3 sm:px-6">
          <span className="text-sm font-semibold text-slate-100">
            {APPLICATION_LABEL[application]}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">
              {me?.full_name || me?.email || ""}
            </span>
            <button
              onClick={signOut}
              title="Sign out"
              className="rounded-md border border-phantix-700 bg-phantix-900 p-2 text-slate-400 transition-colors hover:border-phantix-600 hover:text-white"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
