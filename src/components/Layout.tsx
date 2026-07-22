import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Boxes,
  Radar,
  Crosshair,
  ShieldAlert,
  Scale,
  FileText,
  BookOpen,
  ExternalLink,
  Search,
  LogOut,
  Lock,
  Unlock,
  Database,
  ChevronDown,
  Command,
  KeyRound,
  Sparkles,
  LifeBuoy,
  Home,
  Timer,
  FlaskConical,
  Building2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PLATFORM_IDENTITY_URL, PLATFORM_URL } from "@/lib/links";
import { cx, timeAgo } from "@/lib/utils";

// Dual-control unlock uses DualControlOverlay (App root) via requireDualControl() — no Modal here.
// Tenant settings (identity, DB, billing, AI) live on platform.phantix.site.

const navSections: {
  label: string;
  items: { to: string; label: string; icon: React.ReactNode; badge?: string }[];
}[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Home", icon: <Home size={17} /> },
      { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
    ],
  },
  {
    label: "Attack Surface",
    items: [
      { to: "/assets", label: "Assets", icon: <Boxes size={17} /> },
      { to: "/scans", label: "Scans", icon: <Radar size={17} /> },
      { to: "/vapt", label: "VAPT Campaigns", icon: <Crosshair size={17} /> },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/risks", label: "Risks", icon: <ShieldAlert size={17} /> },
      { to: "/compliance", label: "Compliance", icon: <Scale size={17} /> },
      { to: "/reports", label: "Reports", icon: <FileText size={17} /> },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/docs", label: "Documentation", icon: <BookOpen size={17} /> },
    ],
  },
];

const searchIndex = navSections.flatMap((s) => s.items);

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
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-gold-300">
      <Timer size={12} />
      {mm}:{ss}
    </span>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const results = useMemo(() => {
    const needle = q.toLowerCase();
    return searchIndex.filter((i) => i.label.toLowerCase().includes(needle)).slice(0, 8);
  }, [q]);

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
          className="fixed inset-0 z-[95] flex items-start justify-center bg-phantix-950/70 backdrop-blur-sm pt-[14vh] px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass-bright w-full max-w-xl overflow-hidden rounded-2xl shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-phantix-700/40 px-4 py-3.5">
              <Search size={16} className="text-slate-500" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Jump to a surface…"
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <kbd className="rounded-md border border-phantix-600/60 bg-phantix-800/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {(q ? results : searchIndex).map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    navigate(item.to);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-phantix-700/50 hover:text-white"
                >
                  <span className="text-gold-400">{item.icon}</span>
                  {item.label}
                  <span className="ml-auto text-xs text-slate-600">{item.to}</span>
                </button>
              ))}
              {q && results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-500">No surfaces match “{q}”.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Layout() {
  const { session, org, operate, lockOperate, logout, dualControl, demoActive, hasLiveApi, switchToRealOrg, requireDualControl, securityDbReady } = useStore();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const isLanding = location.pathname === "/";
  if (isLanding) return <Outlet />;

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-phantix-700/40 bg-phantix-950/85 backdrop-blur-xl">
        <NavLink to="/" className="flex items-center gap-3 px-5 pb-5 pt-5">
          <img src="/logo-transparent.png" alt="Phantix" className="h-9 w-9 object-contain" />
          <div>
            <p className="font-display text-[15px] font-bold leading-tight text-white">Phantix</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gold-400">Command Centre</p>
          </div>
        </NavLink>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) => cx("nav-item", isActive && "active")}
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              Tenant admin
            </p>
            <a
              href={PLATFORM_IDENTITY_URL}
              className="nav-item"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={17} />
              Platform settings
            </a>
          </div>
        </nav>

        {/* Dual-control widget */}
        <div className="border-t border-phantix-700/40 p-3">
          <div className="rounded-xl bg-phantix-900/70 border border-phantix-700/40 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Dual control</p>
              {operate.unlocked ? (
                <Unlock size={13} className="text-emerald-400" />
              ) : (
                <Lock size={13} className="text-slate-500" />
              )}
            </div>
            {operate.unlocked ? (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs font-medium text-emerald-300">Operating as {operate.actingUser}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] capitalize text-slate-500">{operate.actingRole}</span>
                  {operate.expiresAt && <OperateCountdown expiresAt={operate.expiresAt} />}
                </div>
                <button onClick={lockOperate} className="mt-1 w-full rounded-lg bg-phantix-700/50 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-phantix-700/80">
                  Lock session
                </button>
              </div>
            ) : (
              <div className="mt-2">
                {dualControl.configured ? (
                  <>
                    <p className="text-[11px] leading-4 text-slate-500">
                      {session?.isInitiator || session?.isAuthorizer ? (
                        <>Your role: <span className="text-gold-300">{session.isInitiator ? "Initiator" : "Authorizer"}</span></>
                      ) : (
                        <>Read-only — contact {session?.initiatorName || "the initiator"} or {session?.authorizerName || "the authorizer"} for actions</>
                      )}
                    </p>
                    {(session?.isInitiator || session?.isAuthorizer) && (
                      <button
                        onClick={() => void requireDualControl("Unlock operate mode to perform protected mutations.")}
                        className="btn-primary mt-2 w-full !px-3 !py-1.5 !text-[11px]"
                      >
                        <Unlock size={12} /> Unlock operate
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[11px] leading-4 text-slate-500">Dual control not set up</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-600">Reports & views work without it. Mutations require setup on the Platform.</p>
                    <a
                      href={PLATFORM_IDENTITY_URL}
                      className="btn-secondary mt-2 w-full !px-3 !py-1.5 !text-[11px]"
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
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="ml-[248px] flex min-h-screen flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-phantix-700/40 bg-phantix-950/80 px-6 py-3 backdrop-blur-xl">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-72 items-center gap-2.5 rounded-xl border border-phantix-700/50 bg-phantix-900/60 px-3.5 py-2 text-sm text-slate-500 transition-colors hover:border-phantix-500/50 hover:text-slate-300"
          >
            <Search size={15} />
            <span>Search surfaces…</span>
            <span className="ml-auto flex items-center gap-0.5 rounded-md border border-phantix-600/50 bg-phantix-800/70 px-1.5 py-0.5 text-[10px] font-semibold">
              <Command size={9} />K
            </span>
          </button>

          <div className="ml-auto flex items-center gap-2.5">
            <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <Database size={12} /> Security DB · {securityDbReady ? "ready" : "not ready"}
            </span>
            <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-300">
              <KeyRound size={12} className="text-gold-400" /> {org.slug}
            </span>

            <div className="relative">
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl border border-phantix-700/50 bg-phantix-900/60 py-1.5 pl-1.5 pr-2.5 hover:border-phantix-500/50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 font-display text-xs font-bold text-phantix-950">
                  {(session?.userName ?? "A").slice(0, 1)}
                </span>
                <span className="text-left">
                  <span className="block text-xs font-semibold leading-tight text-slate-200">{session?.userName ?? "Guest"}</span>
                  <span className="block text-[10px] leading-tight text-slate-500">{org.name}</span>
                </span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>
              <AnimatePresence>
                {userMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl glass-bright shadow-card"
                  >
                    <div className="border-b border-phantix-700/40 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-100">{session?.userName ?? "Guest"}</p>
                      <p className="text-xs text-slate-500">{session?.userEmail ?? "demo mode"}</p>
                    </div>
                    <div className="p-1.5">
                      {demoActive && (
                        <button
                          onClick={() => {
                            setUserMenu(false);
                            switchToRealOrg();
                            navigate("/login");
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gold-300 hover:bg-gold-400/10"
                        >
                          <Building2 size={15} /> Switch to real organization
                        </button>
                      )}
                      <a
                        href={PLATFORM_IDENTITY_URL}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-phantix-700/50"
                      >
                        <ExternalLink size={15} /> Platform settings
                      </a>
                      <button
                        onClick={() => navigate("/docs")}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-phantix-700/50"
                      >
                        <BookOpen size={15} /> Documentation
                      </button>
                      <button
                        onClick={() => navigate("/support")}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-phantix-700/50"
                      >
                        <LifeBuoy size={15} /> Support
                      </button>
                      <button
                        onClick={() => {
                          logout();
                          navigate("/login");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-severity-critical hover:bg-severity-critical/10"
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

        {/* Demo banner */}
        {demoActive && (
          <div className="relative z-20 flex flex-wrap items-center gap-3 border-b border-gold-400/25 bg-gradient-to-r from-gold-400/12 via-gold-400/6 to-transparent px-6 py-2.5">
            <span className="chip border-gold-400/40 bg-gold-400/15 text-gold-300">
              <FlaskConical size={11} /> Demo tenant
            </span>
            <p className="text-xs text-slate-400">
              You're exploring <strong className="text-slate-200">Acme Financial Group</strong> — simulated data, full product.
            </p>
            {hasLiveApi && (
              <button
                onClick={() => {
                  switchToRealOrg();
                  navigate("/login");
                }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gold-400/40 bg-gold-400/10 px-3 py-1.5 text-xs font-semibold text-gold-300 transition-colors hover:bg-gold-400/20"
              >
                <Building2 size={12} /> Switch to real organization
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <main className="flex-1 px-6 py-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-phantix-700/30 px-8 py-4 text-[11px] text-slate-600 flex items-center justify-between">
          <span>Phantix Security Solutions · Privacy-first by architecture — security data never leaves your database</span>
          <span className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-gold-500" /> API v1 · {org.plan} plan
          </span>
        </footer>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
