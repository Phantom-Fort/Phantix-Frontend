import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  KeyRound,
  LayoutGrid,
  Lock,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useSidebarCollapsed } from "../useSidebarCollapsed";
import { ThemeToggle } from "../ThemeToggle";
import { apiGet, appToken, clearStoredSession, setApplication } from "./api";
import { consumeHandoff, handoffUrl } from "./session";
import { IS_DEV_HOSTS } from "../config";
import { isDemoFlagSet } from "../api";
import {
  APPLICATION_LABEL,
  APPLICATION_ORDER,
  type ApplicationKey,
  type NavSection,
} from "./types";

/** The signed-in operator, as /app/auth/me reports them. */
interface AppPrincipal {
  full_name?: string;
  email?: string;
  organization_name?: string;
  organization_slug?: string;
  effective_role?: string;
}

/** One launcher card as the backend reports it. */
interface ApplicationCard {
  key: ApplicationKey;
  label: string;
  entitled: boolean;
  accessible: boolean;
  reason: string | null;
  open_url: string;
}

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
  const [me, setMe] = useState<AppPrincipal | null>(null);
  const [userMenu, setUserMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  const [cards, setCards] = useState<ApplicationCard[] | null>(null);
  const [opening, setOpening] = useState<ApplicationKey | "">("");

  // Every call from this shell declares which application it comes from.
  setApplication(application);

  // Arriving from another application carries a single-use handoff code in the
  // URL fragment (storage is per-origin, so there is no session here yet).
  // Only an operator with neither a session nor a handoff goes back to the Core
  // login, which owns the app-session handshake.
  useEffect(() => {
    let alive = true;
    (async () => {
      // The guided demo has no session by design — it runs entirely in the
      // browser against fixtures. Bouncing it to a login is exactly the wrong
      // answer for a visitor who asked to look around without signing in.
      const demo = isDemoFlagSet();
      if (!demo && !appToken()) {
        const handed = await consumeHandoff(application);
        if (!handed) {
          window.location.assign(hosts.core ? `${hosts.core}/login` : "/login");
          return;
        }
      }
      if (demo) {
        setMe(null);
        return;
      }
      if (!alive) return;
      apiGet<AppPrincipal>("/app/auth/me")
        .then((v) => alive && setMe(v))
        .catch(() => alive && setMe(null));
      apiGet<{ applications: ApplicationCard[] }>("/app/auth/applications")
        .then((v) => alive && setCards(v?.applications || []))
        .catch(() => alive && setCards(null));
    })();
    return () => {
      alive = false;
    };
  }, [application, hosts.core]);

  // A route change closes whatever is open over the page.
  useEffect(() => {
    setMobileNav(false);
    setUserMenu(false);
    setSwitcherOpen(false);
  }, [location.pathname]);

  // Backend truth when we have it; the static order until then.
  const switcherItems: ApplicationCard[] =
    cards ??
    APPLICATION_ORDER.map((key) => ({
      key,
      label: APPLICATION_LABEL[key],
      entitled: true,
      accessible: true,
      reason: null,
      open_url: hosts[key] || "",
    }));

  async function openApp(card: ApplicationCard) {
    if (card.key === application || !card.accessible) return;
    setOpening(card.key);
    // Mint the handoff before leaving: the target origin cannot see this
    // session, and the code is single-use and expires in seconds. The card's
    // open_url is the deployed host, which is the wrong machine in dev.
    const base = IS_DEV_HOSTS
      ? hosts[card.key] || card.open_url
      : card.open_url || hosts[card.key];
    const url = await handoffUrl(card.key, base || "");
    setSwitcherOpen(false);
    setOpening("");
    if (url) window.location.assign(url);
  }

  // Documentation and the sandbox are Core surfaces. Inside Core they are
  // routes; from Attack / Defend / Code they are links to Core's host, which is
  // where the operator already has a session.
  function coreHref(path: string): string {
    if (application === "core") return path;
    const base = (hosts.core || "").replace(/\/+$/, "");
    return base ? `${base}${path}` : path;
  }

  function CoreLink({
    path,
    title,
    className,
    children,
  }: {
    path: string;
    title: string;
    className?: string;
    children: React.ReactNode;
  }) {
    if (application === "core") {
      return (
        <NavLink to={path} title={title} className={className}>
          {children}
        </NavLink>
      );
    }
    return (
      <a href={coreHref(path)} title={title} className={className}>
        {children}
      </a>
    );
  }

  // One nav definition, two chromes: the rail (which hides labels when
  // collapsed) and the mobile drawer (which never does).
  function renderNav(collapsible: boolean) {
    return nav.map((section) => (
      <div key={section.label}>
        <p className={collapsible ? "nav-section-label sg-hide-collapsed" : "nav-section-label"}>
          {section.label}
        </p>
        <div className="space-y-0.5">
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              title={item.label}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              {item.icon}
              {collapsible ? <span className="sg-hide-collapsed">{item.label}</span> : item.label}
            </NavLink>
          ))}
        </div>
      </div>
    ));
  }

  function signOut() {
    clearStoredSession();
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

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-3">{renderNav(true)}</nav>

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
                {switcherItems.map((card) => (
                  <button
                    key={card.key}
                    onClick={() => openApp(card)}
                    disabled={!card.accessible || opening === card.key}
                    title={card.accessible ? card.label : card.reason || "Not available"}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs ${
                      card.key === application
                        ? "text-gold-300"
                        : card.accessible
                          ? "text-slate-300 hover:bg-phantix-800"
                          : "cursor-not-allowed text-slate-600"
                    }`}
                  >
                    <span>{card.label}</span>
                    {card.key === application ? (
                      <span className="text-[10px] uppercase">current</span>
                    ) : opening === card.key ? (
                      <span className="text-[10px] uppercase text-slate-500">opening</span>
                    ) : !card.accessible ? (
                      <Lock size={11} className="shrink-0 text-slate-600" />
                    ) : null}
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
          <button
            onClick={() => setMobileNav((v) => !v)}
            aria-label={mobileNav ? "Close navigation" : "Open navigation"}
            className="rounded-md border border-phantix-700 bg-phantix-900 p-2 text-slate-400 transition-colors hover:border-phantix-600 hover:text-white lg:hidden"
          >
            {mobileNav ? <X size={18} /> : <Menu size={18} />}
          </button>

          <button
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-md border border-phantix-700 bg-phantix-900 p-2 text-slate-400 transition-colors hover:border-phantix-600 hover:text-white lg:inline-flex"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          <span className="text-sm font-semibold text-slate-100">
            {APPLICATION_LABEL[application]}
          </span>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
            <CoreLink
              path="/docs"
              title="Documentation"
              className="rounded-md border border-phantix-700 bg-phantix-900 p-2 text-slate-400 transition-colors hover:border-phantix-600 hover:text-white"
            >
              <BookOpen size={16} />
            </CoreLink>
            <CoreLink
              path="/sandbox"
              title="Sandbox"
              className="hidden rounded-md border border-phantix-700 bg-phantix-900 p-2 text-slate-400 transition-colors hover:border-phantix-600 hover:text-white sm:inline-flex"
            >
              <FlaskConical size={16} />
            </CoreLink>
            <ThemeToggle />
            {me?.organization_slug && (
              <span className="chip hidden border-phantix-700 bg-phantix-900 font-mono text-slate-300 md:inline-flex">
                <KeyRound size={12} className="text-gold-400" /> {me.organization_slug}
              </span>
            )}

            <div className="relative">
              <button
                onClick={() => setUserMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={userMenu}
                className="flex items-center gap-2.5 rounded-md border border-phantix-700 bg-phantix-900 py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-phantix-600"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gold-400/40 bg-phantix-850 font-display text-xs font-bold text-gold-300">
                  {(me?.full_name || me?.email || "A").slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[120px] truncate text-xs font-semibold leading-tight text-slate-200">
                    {me?.full_name || me?.email || "Operator"}
                  </span>
                  <span className="block max-w-[120px] truncate text-[10px] leading-tight text-slate-500">
                    {me?.organization_name || APPLICATION_LABEL[application]}
                  </span>
                </span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>
              <AnimatePresence>
                {userMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md border border-phantix-700 bg-phantix-900 shadow-card"
                  >
                    <div className="border-b border-phantix-700/40 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {me?.full_name || "Operator"}
                      </p>
                      <p className="truncate text-xs text-slate-500">{me?.email || ""}</p>
                      {me?.effective_role && (
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-600">
                          {me.effective_role}
                        </p>
                      )}
                    </div>
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setUserMenu(false);
                          setSwitcherOpen(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-phantix-800"
                      >
                        <LayoutGrid size={15} /> Switch application
                      </button>
                      <CoreLink
                        path="/docs"
                        title="Documentation"
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-phantix-800"
                      >
                        <BookOpen size={15} /> Documentation
                      </CoreLink>
                      <CoreLink
                        path="/sandbox"
                        title="Sandbox"
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-phantix-800"
                      >
                        <FlaskConical size={15} /> Sandbox
                      </CoreLink>
                      <button
                        onClick={signOut}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-severity-critical hover:bg-severity-critical/10"
                      >
                        <LogOut size={15} /> Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Mobile nav drawer — below lg the rail is hidden, so this is the nav. */}
        <AnimatePresence>
          {mobileNav && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="fixed inset-x-0 top-[57px] z-40 max-h-[calc(100vh-57px)] overflow-y-auto border-b border-phantix-700/60 bg-phantix-950 shadow-card lg:hidden"
            >
              <nav className="space-y-1.5 px-2.5 py-3">{renderNav(false)}</nav>
              <div className="border-t border-phantix-700/40 px-2.5 py-3">
                <p className="nav-section-label">Applications</p>
                <div className="space-y-0.5">
                  {switcherItems
                    .filter((card) => card.key !== application)
                    .map((card) => (
                      <button
                        key={card.key}
                        onClick={() => void openApp(card)}
                        disabled={!card.accessible}
                        className={`nav-item w-full justify-between ${
                          card.accessible ? "" : "cursor-not-allowed opacity-50"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <LayoutGrid size={16} />
                          {card.label}
                        </span>
                        {!card.accessible && <Lock size={12} className="text-slate-600" />}
                      </button>
                    ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <main className="flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
