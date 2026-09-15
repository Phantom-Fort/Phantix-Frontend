import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  Database,
  ExternalLink,
  FlaskConical,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  Lock,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Unlock,
  X,
} from "lucide-react";
import { useSidebarCollapsed } from "../useSidebarCollapsed";
import { ThemeToggle } from "../ThemeToggle";
import { BrandLogo } from "../components/BrandLogo";
import { NotificationBell, NotificationProvider } from "../components/AlertNotifications";
import AgentAssistant from "../components/AgentAssistant";
import OperationsWidget from "../components/OperationsWidget";
import { OperationsProvider } from "../operations";
import SandboxBanner from "../components/SandboxBanner";
import { useStore } from "../store";
import { shortName } from "../utils";
import { loadSandboxMe } from "../sandbox";
import { PLATFORM_IDENTITY_URL } from "../links";
import { apiGet, appToken, clearStoredSession, setApplication } from "./api";
import { isDemoFlagSet, setActiveApplication } from "../api";
import { consumeHandoff, handoffUrl, signOutEverywhere } from "./session";
import { IS_DEV_HOSTS } from "../config";
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

/** mm:ss countdown for an active operate session. */
function OperateCountdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(1, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[13px] text-gold-300">
      <Timer size={12} />
      {mm}:{ss}
    </span>
  );
}

/** ⌘K command palette over the current application's surfaces. */
function CommandPalette({
  open,
  onClose,
  index,
}: {
  open: boolean;
  onClose: () => void;
  index: { to: string; label: string; icon: React.ReactNode }[];
}) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const results = useMemo(() => {
    const needle = q.toLowerCase();
    return index.filter((i) => i.label.toLowerCase().includes(needle)).slice(0, 8);
  }, [q, index]);

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] flex items-start justify-center bg-phantix-950/70 px-4 pt-[14vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass-bright w-full max-w-xl overflow-hidden rounded-lg shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-phantix-700/40 px-4 py-3.5">
              <Search size={16} className="text-slate-500" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Jump to a surface..."
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <kbd className="rounded-sm border border-phantix-600/60 bg-phantix-850 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-slate-400">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {(q ? results : index).map((item) => (
                <button
                  key={item.to + item.label}
                  onClick={() => {
                    navigate(item.to);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-300 hover:bg-phantix-800 hover:text-white"
                >
                  <span className="text-gold-400">{item.icon}</span>
                  {item.label}
                  <span className="ml-auto font-mono text-xs text-slate-600">{item.to}</span>
                </button>
              ))}
              {q && results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-500">
                  No surfaces match "{q}".
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The shared shell every SecureGraph application renders: a collapsible sidebar
 * (icon rail) with the dual-control widget, section nav, an application
 * switcher, the operator topbar (search, notifications, security-DB status, user
 * menu), the demo-tenant banner and the sandbox banner. Pages render into
 * <Outlet/>. Chrome is identical across Core / Attack / Defend / Code.
 */
export function ApplicationShell({ application, subtitle, nav, hosts }: ApplicationShellProps) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const {
    session,
    org,
    operate,
    lockOperate,
    dualControl,
    demoActive,
    hasLiveApi,
    switchToRealOrg,
    requireDualControl,
    securityDbReady,
  } = useStore();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [me, setMe] = useState<AppPrincipal | null>(null);
  const [userMenu, setUserMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sandboxEnrolled, setSandboxEnrolled] = useState(false);
  const location = useLocation();
  const [cards, setCards] = useState<ApplicationCard[] | null>(null);
  const [opening, setOpening] = useState<ApplicationKey | "">("");
  // Nothing (not even the shell) renders until identity + this application's
  // access are verified — no flash of the app before the redirect.
  const [authReady, setAuthReady] = useState(false);

  // Every call from this shell declares which application it comes from — both
  // the shell's own client and the shared @sg/api client used by pages.
  setApplication(application);
  setActiveApplication(application);

  useEffect(() => {
    let alive = true;
    setAuthReady(false);
    (async () => {
      let demo = isDemoFlagSet();
      if (!demo && !appToken()) {
        // The arriving fragment carries either a session handoff or the demo,
        // whose flag cannot cross an origin in storage.
        const handed = await consumeHandoff(application);
        demo = isDemoFlagSet();
        if (!handed && !demo) {
          // Replace (not push) so Back cannot land on the gated page.
          window.location.replace(coreLoginUrl(application));
          return;
        }
      }
      if (demo) {
        setMe(null);
        if (alive) setAuthReady(true);
        return;
      }
      // Verify identity AND this application's access before rendering anything.
      const [meRes, appsRes] = await Promise.all([
        apiGet<AppPrincipal>("/app/auth/me").catch(() => null),
        apiGet<{ applications: ApplicationCard[] }>("/app/auth/applications").catch(() => null),
      ]);
      if (!alive) return;
      if (!meRes) {
        // Session invalid/expired — go to login without flashing the app.
        window.location.replace(coreLoginUrl());
        return;
      }
      setMe(meRes);
      const list = appsRes?.applications || [];
      setCards(list);
      const current = list.find((c) => c.key === application);
      if (current && !current.accessible) {
        // Authenticated but not authorized for this application.
        const base = (hosts.core || "").replace(/\/+$/, "");
        window.location.replace(`${base}/choose-app`);
        return;
      }
      void loadSandboxMe().then((m) => alive && setSandboxEnrolled(!!m?.enrolled));
      setAuthReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [application, hosts.core]);

  useEffect(() => {
    setMobileNav(false);
    setUserMenu(false);
    setSwitcherOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const searchIndex = useMemo(() => {
    const flat: { to: string; label: string; icon: React.ReactNode }[] = [];
    for (const s of nav) {
      for (const item of s.items) flat.push({ to: item.to, label: item.label, icon: item.icon });
    }
    flat.push({ to: "/docs", label: "Documentation", icon: <BookOpen size={15} /> });
    flat.push({ to: "/sandbox", label: "Sandbox", icon: <FlaskConical size={15} /> });
    return flat;
  }, [nav]);

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
    const base = IS_DEV_HOSTS ? hosts[card.key] || card.open_url : card.open_url || hosts[card.key];
    const url = await handoffUrl(card.key, base || "");
    setSwitcherOpen(false);
    setOpening("");
    if (url) window.location.assign(url);
  }

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

  /** Core owns sign-in. Send an unauthenticated visitor there, remembering the
   *  application they wanted so Core hands the session back after login. */
  function coreLoginUrl(next?: ApplicationKey): string {
    const base = (hosts.core || "").replace(/\/+$/, "");
    return `${base}/login${next ? `?next=${next}` : ""}`;
  }

  function signOut() {
    // Revokes on the backend, empties every token store, and lands on Core's
    // login — the same from all four applications, and from the demo.
    void signOutEverywhere(hosts.core);
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-phantix-950">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-phantix-600 border-t-gold-400" />
          <p className="mt-3 text-sm text-slate-500">Verifying access…</p>
        </div>
      </div>
    );
  }

  return (
    <OperationsProvider>
      <NotificationProvider>
      <div className="flex min-h-screen">
        <aside
          data-collapsed={collapsed ? "" : undefined}
          className={`sg-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-phantix-700/60 bg-[rgb(var(--surface-sidebar))] lg:flex ${
            collapsed ? "w-[72px]" : "w-[248px]"
          }`}
        >
          <div className="flex items-center gap-3 px-4 pb-3 pt-4">
            <BrandLogo className="h-8 w-8 shrink-0" />
            <div className="sg-hide-collapsed">
              <p className="font-display text-[15px] font-bold leading-tight text-white">
                SecureGraph
              </p>
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-gold-400">
                {subtitle}
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-3">{renderNav(true)}</nav>

          {/* Dual-control widget — present on every page of every application. */}
          <div className="sg-hide-collapsed border-t border-phantix-700/60 p-2">
            <div className="rounded-md border border-phantix-700 bg-phantix-900 p-2">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-500">Dual control</p>
                {operate.unlocked ? (
                  <Unlock size={13} className="text-emerald-400" />
                ) : (
                  <Lock size={13} className="text-slate-500" />
                )}
              </div>
              {operate.unlocked ? (
                <div className="mt-1 space-y-1">
                  <p
                    className="truncate text-xs font-medium text-emerald-300"
                    title={operate.actingUser ?? undefined}
                  >
                    Operating as {shortName(operate.actingUser)}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] capitalize text-slate-500">
                      {operate.actingRole}
                    </span>
                    {operate.expiresAt && <OperateCountdown expiresAt={operate.expiresAt} />}
                  </div>
                  <button
                    onClick={lockOperate}
                    className="mt-1 w-full rounded-md border border-phantix-700 bg-phantix-850 py-1 text-[13px] font-medium text-slate-300 hover:bg-phantix-800"
                  >
                    Lock session
                  </button>
                </div>
              ) : (
                <div className="mt-1">
                  {dualControl.configured ? (
                    <>
                      <p className="text-[13px] leading-4 text-slate-500">
                        {session?.isInitiator || session?.isAuthorizer ? (
                          <>
                            Your role:{" "}
                            <span className="text-gold-300">
                              {session.isInitiator ? "Initiator" : "Authorizer"}
                            </span>
                          </>
                        ) : (
                          <>
                            Read-only view. Request an operate session —{" "}
                            {session?.initiatorName || "the initiator"} or{" "}
                            {session?.authorizerName || "the authorizer"} approves by OTP.
                          </>
                        )}
                      </p>
                      <button
                        onClick={() =>
                          void requireDualControl(
                            "Unlock operate mode to perform protected mutations.",
                          )
                        }
                        className="btn-primary mt-1 w-full !px-3 !py-1 !text-[13px]"
                      >
                        <Unlock size={12} />{" "}
                        {session?.isInitiator || session?.isAuthorizer
                          ? "Unlock operate"
                          : "Request dual control"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] leading-4 text-slate-500">Dual control not set up</p>
                      <p className="mt-0.5 text-[12px] leading-4 text-slate-600">
                        Reports &amp; views work without it. Mutations require setup on the Platform.
                      </p>
                      <a
                        href={PLATFORM_IDENTITY_URL}
                        className="btn-secondary mt-1 w-full !px-3 !py-1 !text-[13px]"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Lock size={12} /> Configure on Platform
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

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
                        <span className="text-[12px] uppercase">current</span>
                      ) : opening === card.key ? (
                        <span className="text-[12px] uppercase text-slate-500">opening</span>
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
          {/* Topbar */}
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

            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden w-72 items-center gap-2.5 rounded-md border border-phantix-700 bg-phantix-900 px-3.5 py-2 text-sm text-slate-500 transition-colors hover:border-phantix-600 hover:text-slate-300 sm:flex"
            >
              <Search size={15} />
              <span>Search surfaces...</span>
              <span className="ml-auto flex items-center gap-0.5 rounded-sm border border-phantix-600/60 bg-phantix-850 px-1.5 py-0.5 font-mono text-[12px] font-semibold">
                <Command size={9} />K
              </span>
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="rounded-md border border-phantix-700 bg-phantix-900 p-2 text-slate-400 transition-colors hover:border-phantix-600 hover:text-white sm:hidden"
            >
              <Search size={16} />
            </button>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
              {sandboxEnrolled && (
                <CoreLink
                  path="/sandbox"
                  title="BETA sandbox"
                  className="relative rounded-md border border-phantix-700 bg-phantix-900 p-2 text-slate-400 transition-colors hover:border-phantix-600 hover:text-white"
                >
                  <FlaskConical size={16} />
                  <span className="absolute -right-1 -top-1 rounded-full bg-gold-400 px-1 font-mono text-[11px] font-bold leading-[1.2] text-phantix-950">
                    β
                  </span>
                </CoreLink>
              )}
              <ThemeToggle />
              <NotificationBell />
              <span
                className={`chip hidden md:inline-flex ${
                  securityDbReady
                    ? "border-gold-400/30 bg-gold-400/10 text-gold-300"
                    : "border-severity-medium/30 bg-severity-medium/10 text-severity-medium"
                }`}
              >
                <Database size={12} /> Security DB · {securityDbReady ? "ready" : "not ready"}
              </span>
              <span className="chip hidden border-phantix-700 bg-phantix-900 font-mono text-slate-300 md:inline-flex">
                <KeyRound size={12} className="text-gold-400" /> {org.slug}
              </span>

              <div className="relative">
                <button
                  onClick={() => setUserMenu((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={userMenu}
                  className="flex items-center gap-2.5 rounded-md border border-phantix-700 bg-phantix-900 py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-phantix-600"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gold-400/40 bg-phantix-850 font-display text-xs font-bold text-gold-300">
                    {(session?.userName ?? me?.full_name ?? "A").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-[120px] truncate text-xs font-semibold leading-tight text-slate-200">
                      {session?.userName ?? me?.full_name ?? me?.email ?? "Guest"}
                    </span>
                    <span className="block max-w-[120px] truncate text-[12px] leading-tight text-slate-500">
                      {org.name || me?.organization_name || APPLICATION_LABEL[application]}
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
                          {session?.userName ?? me?.full_name ?? "Guest"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {session?.userEmail ?? me?.email ?? "demo mode"}
                        </p>
                        {me?.effective_role && (
                          <p className="mt-1 font-mono text-[12px] uppercase tracking-wider text-slate-600">
                            {me.effective_role === "no_session"
                              ? "view only · no operate session"
                              : me.effective_role}
                          </p>
                        )}
                      </div>
                      <div className="p-1.5">
                        {demoActive && (
                          <button
                            onClick={() => {
                              setUserMenu(false);
                              switchToRealOrg();
                              window.location.assign(coreLoginUrl());
                            }}
                            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gold-300 hover:bg-gold-400/10"
                          >
                            <Building2 size={15} /> Switch to real organization
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setUserMenu(false);
                            setSwitcherOpen(true);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-phantix-800"
                        >
                          <LayoutGrid size={15} /> Switch application
                        </button>
                        <a
                          href={PLATFORM_IDENTITY_URL}
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-phantix-800"
                        >
                          <ExternalLink size={15} /> Platform settings
                        </a>
                        <CoreLink
                          path="/settings/privacy"
                          title="Privacy & data requests"
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-phantix-800"
                        >
                          <ShieldCheck size={15} /> Privacy &amp; data requests
                        </CoreLink>
                        <CoreLink
                          path="/docs"
                          title="Documentation"
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-phantix-800"
                        >
                          <BookOpen size={15} /> Documentation
                        </CoreLink>
                        <CoreLink
                          path="/support"
                          title="Support"
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-phantix-800"
                        >
                          <LifeBuoy size={15} /> Support
                        </CoreLink>
                        <button
                          onClick={() => {
                            setUserMenu(false);
                            signOut();
                          }}
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

          {/* Mobile nav drawer */}
          <AnimatePresence>
            {mobileNav && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="fixed inset-x-0 top-[57px] z-40 max-h-[calc(100vh-57px)] overflow-y-auto border-b border-phantix-700/60 bg-phantix-950 shadow-card lg:hidden"
              >
                <nav className="space-y-1.5 px-2.5 py-3">{renderNav(false)}</nav>
                <div className="border-t border-phantix-700/40 px-2.5 pb-3">
                  <div className="rounded-md border border-phantix-700 bg-phantix-900 p-2">
                    <p className="text-[13px] font-semibold text-slate-500">Dual control</p>
                    {operate.unlocked ? (
                      <p className="mt-1 text-xs font-medium text-emerald-300">
                        Operating as {shortName(operate.actingUser)}
                      </p>
                    ) : dualControl.configured ? (
                      <button
                        onClick={() =>
                          void requireDualControl(
                            "Unlock operate mode to perform protected mutations.",
                          )
                        }
                        className="btn-primary mt-1 w-full !px-3 !py-1 !text-[13px]"
                      >
                        <Unlock size={12} />{" "}
                        {session?.isInitiator || session?.isAuthorizer
                          ? "Unlock operate"
                          : "Request dual control"}
                      </button>
                    ) : (
                      <p className="mt-1 text-[13px] text-slate-500">
                        Not set up — configure on the Platform
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Demo tenant banner */}
          {demoActive && (
            <div className="relative z-20 flex flex-wrap items-center gap-3 border-b border-phantix-700/60 bg-phantix-950 px-4 py-2.5 sm:px-6">
              <span className="chip border-gold-400/40 bg-transparent text-gold-300">
                <FlaskConical size={11} /> Demo tenant
              </span>
              <p className="text-xs text-slate-400">
                You're exploring{" "}
                <strong className="text-slate-200">Acme Financial Group</strong> --- simulated data,
                full product.
              </p>
              {hasLiveApi && (
                <button
                  onClick={() => {
                    switchToRealOrg();
                    window.location.assign(coreLoginUrl());
                  }}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-gold-400/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-gold-300 transition-colors hover:bg-gold-400/10"
                >
                  <Building2 size={12} /> Switch to real organization
                </button>
              )}
            </div>
          )}

          {/* Content */}
          {/* The window scrolls, so the footer sits after the content instead of
              being pinned to the viewport. A page that asks for h-full still
              fills the space left between the header and the footer. */}
          <main className="flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
            {/* The one content measure, defined here so page, skeleton and
                shell cannot drift apart. 1600px is a backstop: an ultrawide
                display should not stretch a table across a metre of glass. */}
            <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col">
              {session?.authenticated && !demoActive && <SandboxBanner />}
              <Outlet />
            </div>
          </main>

          <footer className="flex items-center justify-between border-t border-phantix-700/60 px-6 py-4 text-[13px] text-slate-600 lg:px-8">
            <span>
              Phantix Security Solutions · Privacy-first by architecture --- security data never
              leaves your database
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-gold-500" /> API v1 · {org.plan} plan
            </span>
          </footer>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} index={searchIndex} />

      {/* SecureGraph Agent — the floating assistant, and the way to the support
          desk from any application. It was mounted by the Command Centre layout
          and was lost when the shells replaced it. */}
      <AgentAssistant />

      {/* Running operations tray — pages start long jobs through useOperations,
          so the provider has to wrap the shell or they throw on mount. */}
      <OperationsWidget />
      </NotificationProvider>
    </OperationsProvider>
  );
}
