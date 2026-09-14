import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, Boxes, Code2, Crosshair, Lock, LogOut, ShieldCheck } from "lucide-react";
import { useStore } from "@sg/store";
import { cx } from "@sg/utils";
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
} from "@sg/applications";

/**
 * Sign-in application picker — "Where do you want to work today?".
 *
 * The layout is the product's own shape: Core is the security graph everything
 * hangs off, so it is the hub card, and the three specialized applications sit
 * beneath it on spines that draw themselves in. An application the org or the
 * operator's role does not include is still shown — dimmed, with the reason —
 * because "ask your admin to enable Attack" is a more useful answer than a
 * shorter list.
 *
 * Motion is doing work here rather than decorating: the constellation says
 * "graph", the spines say "these hang off Core", and choosing an application
 * pulls the chosen card forward while the rest recede, which covers the
 * cross-origin handoff with something better than a frozen page. Every ambient
 * loop is dropped when the operator prefers reduced motion.
 */

const ICONS: Record<ApplicationKey, React.ReactNode> = {
  core: <Boxes size={20} />,
  attack: <Crosshair size={20} />,
  defend: <ShieldCheck size={20} />,
  code: <Code2 size={20} />,
};

/** One accent per application, drawn from the existing severity palette. */
const ACCENT: Record<ApplicationKey, { ring: string; glow: string; text: string; dot: string }> = {
  core: {
    ring: "border-gold-400/40 hover:border-gold-400/70",
    glow: "from-gold-400/10",
    text: "text-gold-300",
    dot: "bg-gold-400",
  },
  attack: {
    ring: "border-severity-critical/30 hover:border-severity-critical/60",
    glow: "from-severity-critical/10",
    text: "text-severity-critical",
    dot: "bg-severity-critical",
  },
  defend: {
    ring: "border-severity-low/30 hover:border-severity-low/60",
    glow: "from-severity-low/10",
    text: "text-severity-low",
    dot: "bg-severity-low",
  },
  code: {
    ring: "border-severity-info/30 hover:border-severity-info/60",
    glow: "from-severity-info/10",
    text: "text-severity-info",
    dot: "bg-severity-info",
  },
};

/** Decorative node field — a graph, slowly breathing, behind the content. */
const NODES = [
  { x: 12, y: 22, r: 2.4 },
  { x: 27, y: 58, r: 1.6 },
  { x: 44, y: 16, r: 2 },
  { x: 58, y: 70, r: 1.8 },
  { x: 71, y: 34, r: 2.6 },
  { x: 86, y: 62, r: 1.5 },
  { x: 92, y: 20, r: 2 },
  { x: 8, y: 78, r: 1.7 },
];
const EDGES: [number, number][] = [
  [0, 2],
  [2, 4],
  [4, 6],
  [1, 3],
  [3, 5],
  [0, 1],
  [4, 3],
  [7, 1],
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 30 } },
};

export default function ChooseApp() {
  const navigate = useNavigate();
  const calm = useReducedMotion();
  const { session, logout } = useStore();
  const [snap, setSnap] = useState<ApplicationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<ApplicationKey | "">("");

  useEffect(() => {
    if (!session?.authenticated) navigate("/login", { replace: true });
  }, [session?.authenticated, navigate]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadApplications()
      .then((s) => {
        if (!alive) return;
        setSnap(s);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load applications");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const all = useMemo(
    () => (snap?.applications || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [snap],
  );
  const core = all.find((a) => a.key === "core") || null;
  const specialized = all.filter((a) => a.key !== "core");
  const reachable = accessibleApplications(snap);
  const last = lastApp();

  const open = useCallback(
    async (app: ApplicationCard) => {
      if (!app.accessible || opening) return;
      rememberApp(app.key);
      const target = applicationTarget(app.key);
      if (!target.external) {
        navigate(target.href, { replace: true });
        return;
      }
      setOpening(app.key);
      // Carry this session across the origin boundary (single-use, seconds-long).
      window.location.assign(await applicationHandoffHref(app.key));
    },
    [navigate, opening],
  );

  // Single application: no choice to make — go straight in.
  useEffect(() => {
    if (!loading && reachable.length === 1) void open(reachable[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, reachable.length]);

  // Arriving from an app that bounced here for sign-in (`?next=attack`): open it
  // as soon as we know this role may reach it. RBAC still decides — an app the
  // operator cannot enter simply leaves the picker on screen.
  useEffect(() => {
    if (loading) return;
    const next = new URLSearchParams(window.location.search).get("next");
    if (!next) return;
    const app = reachable.find((a) => a.key === next);
    if (app) void open(app);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, reachable.length]);

  // 1–4 opens the nth application, so a returning operator never reaches for
  // the mouse. The order matches what is on screen.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = Number(e.key) - 1;
      if (!Number.isInteger(i) || i < 0 || i >= all.length) return;
      const target = all[i];
      if (target?.accessible) void open(target);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [all, open]);

  function shortcutFor(app: ApplicationCard): string {
    return String(all.findIndex((a) => a.key === app.key) + 1);
  }

  function subtitle(app: ApplicationCard): string {
    if (app.accessible) return app.tagline;
    return app.reason || "Not available for your role";
  }

  /** Dim and recede everything that is not the card being opened. */
  function leaving(key: ApplicationKey): Record<string, number> {
    if (!opening) return {};
    return opening === key ? { scale: 1.02 } : { opacity: 0.25, scale: 0.97 };
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12 sm:px-6">
      {/* Ambient: two slow glows and a breathing graph. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(212,164,76,0.10),transparent)]" />
      {!calm && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-40 top-10 h-[28rem] w-[28rem] rounded-full bg-gold-400/[0.06] blur-3xl"
            animate={{ x: [0, 60, 0], y: [0, 30, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-40 bottom-0 h-[26rem] w-[26rem] rounded-full bg-severity-info/[0.05] blur-3xl"
            animate={{ x: [0, -50, 0], y: [0, -40, 0] }}
            transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
          />
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.5]"
          >
            {EDGES.map(([a, b], i) => (
              <motion.line
                key={`e${i}`}
                x1={NODES[a].x}
                y1={NODES[a].y}
                x2={NODES[b].x}
                y2={NODES[b].y}
                stroke="rgb(var(--gold-400))"
                strokeWidth={0.08}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: [0, 0.35, 0.12, 0.3] }}
                transition={{
                  pathLength: { duration: 1.6, delay: 0.2 + i * 0.12, ease: "easeOut" },
                  opacity: { duration: 9, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" },
                }}
              />
            ))}
            {NODES.map((n, i) => (
              <motion.circle
                key={`n${i}`}
                cx={n.x}
                cy={n.y}
                r={n.r / 6}
                fill="rgb(var(--gold-400))"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0.25, 0.6, 0.25], scale: 1 }}
                transition={{
                  scale: { duration: 0.6, delay: 0.1 + i * 0.08 },
                  opacity: { duration: 5 + i, repeat: Infinity, ease: "easeInOut" },
                }}
              />
            ))}
          </svg>
        </>
      )}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full max-w-5xl"
      >
        {/* Identity */}
        <motion.div variants={rise} className="mb-8 text-center">
          <motion.img
            src="/logo-transparent.png"
            alt=""
            className="mx-auto h-12 w-12 object-contain"
            animate={calm ? undefined : { y: [0, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <p className="mt-3 font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-400">
            SecureGraph
          </p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight text-white sm:text-3xl">
            Where do you want to work today?
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {session?.userName || session?.userEmail
              ? `${session.userName || session.userEmail} · one security graph, four applications`
              : "One security graph, four applications"}
          </p>
        </motion.div>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-400">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-phantix-500 border-t-gold-400" />
            Preparing your applications…
          </div>
        )}

        {!loading && error && (
          <motion.div variants={rise} className="card mx-auto max-w-md p-6 text-center">
            <p className="text-sm text-severity-critical">{error}</p>
            <button className="btn-secondary mt-4" onClick={() => window.location.reload()}>
              Retry
            </button>
          </motion.div>
        )}

        {!loading && !error && all.length > 0 && (
          <>
            {/* The hub: Core is the graph the other three hang off. */}
            {core && (
              <motion.button
                type="button"
                variants={rise}
                animate={opening ? leaving("core") : undefined}
                whileHover={core.accessible && !opening ? "hover" : undefined}
                whileTap={core.accessible && !opening ? { scale: 0.995 } : undefined}
                onClick={() => void open(core)}
                disabled={!core.accessible}
                className={cx(
                  "card group relative w-full overflow-hidden border bg-gradient-to-br to-transparent p-6 text-left",
                  ACCENT.core.ring,
                  ACCENT.core.glow,
                  !core.accessible && "cursor-not-allowed opacity-60",
                )}
              >
                {/* Light sweep on hover */}
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-gold-400/10 to-transparent"
                  variants={{ hover: { left: ["-33%", "120%"] } }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                />
                <div className="relative flex flex-wrap items-center gap-3">
                  <motion.span
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold-400/30 bg-phantix-900/70 text-gold-400"
                    variants={{ hover: { scale: 1.08, rotate: -6 } }}
                  >
                    {ICONS.core}
                  </motion.span>
                  <div className="min-w-0">
                    <p className="font-display text-xl font-bold text-white">{core.label}</p>
                    <p className={cx("text-xs font-medium", ACCENT.core.text)}>{subtitle(core)}</p>
                  </div>
                  <span className="ml-auto flex items-center gap-2">
                    {last === "core" && (
                      <span className="chip border-phantix-700 bg-phantix-900 text-[10px] uppercase tracking-wider text-slate-400">
                        last used
                      </span>
                    )}
                    <kbd className="hidden rounded border border-phantix-600/60 bg-phantix-850 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline-block">
                      {shortcutFor(core)}
                    </kbd>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 group-hover:text-gold-300">
                      {opening === "core" ? "Opening…" : "Enter"}
                      <motion.span variants={{ hover: { x: 4 } }} className="inline-flex">
                        <ArrowRight size={14} />
                      </motion.span>
                    </span>
                  </span>
                </div>
                <p className="relative mt-3 max-w-2xl text-[13px] leading-5 text-slate-400">
                  {core.description}
                </p>
                {core.capabilities?.length > 0 && (
                  <div className="relative mt-3 flex flex-wrap gap-1.5">
                    {core.capabilities.map((c) => (
                      <span
                        key={c}
                        className="rounded-md bg-phantix-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </motion.button>
            )}

            {/* Spines — drawn after the hub lands, so they read as connections. */}
            <div aria-hidden className="hidden lg:flex" role="presentation">
              {specialized.map((app, i) => (
                <div key={app.key} className="flex flex-1 justify-center">
                  <motion.span
                    className={cx(
                      "h-7 w-px origin-top bg-gradient-to-b to-transparent",
                      app.accessible ? "from-phantix-600" : "from-phantix-800",
                    )}
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ delay: 0.32 + i * 0.08, duration: 0.35, ease: "easeOut" }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-0 lg:grid-cols-3">
              {specialized.map((app) => {
                const accent = ACCENT[app.key];
                const live = app.accessible && !opening;
                return (
                  <motion.button
                    key={app.key}
                    type="button"
                    variants={rise}
                    animate={opening ? leaving(app.key) : undefined}
                    whileHover={live ? "hover" : undefined}
                    whileTap={live ? { scale: 0.99 } : undefined}
                    onClick={() => void open(app)}
                    disabled={!app.accessible}
                    title={app.accessible ? `Open ${app.label}` : subtitle(app)}
                    className={cx(
                      "card group relative flex flex-col gap-3 overflow-hidden border bg-gradient-to-b to-transparent p-5 text-left",
                      accent.ring,
                      accent.glow,
                      !app.accessible && "cursor-not-allowed opacity-55",
                    )}
                  >
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      variants={{ hover: { opacity: [0, 1, 0] } }}
                      initial={{ opacity: 0 }}
                      transition={{ duration: 1.1 }}
                    />
                    <span className="relative flex items-center gap-2.5">
                      <motion.span
                        className={cx(
                          "flex h-10 w-10 items-center justify-center rounded-xl border border-phantix-700/60 bg-phantix-900/70",
                          accent.text,
                        )}
                        variants={{ hover: { scale: 1.1, rotate: -8 } }}
                        transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      >
                        {ICONS[app.key]}
                      </motion.span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-lg font-bold leading-tight text-white">
                          {app.label}
                        </span>
                        <span className={cx("block text-[11px] font-medium", accent.text)}>
                          {subtitle(app)}
                        </span>
                      </span>
                      {app.accessible ? (
                        <kbd className="hidden shrink-0 rounded border border-phantix-600/60 bg-phantix-850 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline-block">
                          {shortcutFor(app)}
                        </kbd>
                      ) : (
                        <Lock size={13} className="shrink-0 text-slate-600" />
                      )}
                    </span>

                    <span className="relative flex-1 text-[13px] leading-5 text-slate-400">
                      {app.description}
                    </span>

                    {app.surfaces && app.surfaces.length > 0 && (
                      <span className="relative flex flex-wrap items-center gap-1.5">
                        {app.surfaces.slice(0, 4).map((s, si) => (
                          <motion.span
                            key={s.path}
                            className="rounded-md bg-phantix-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                            variants={{ hover: { y: -2, color: "rgb(var(--slate-300))" } }}
                            transition={{ delay: si * 0.03 }}
                          >
                            {s.label}
                          </motion.span>
                        ))}
                        {app.surfaces.length > 4 && (
                          <span className="text-[10px] text-slate-600">
                            +{app.surfaces.length - 4} more
                          </span>
                        )}
                      </span>
                    )}

                    <span className="relative mt-1 flex items-center gap-1.5 border-t border-phantix-700/40 pt-3 text-sm font-semibold text-slate-200 group-hover:text-white">
                      <motion.span
                        className={cx("h-1.5 w-1.5 rounded-full", accent.dot)}
                        animate={
                          calm || last !== app.key ? undefined : { scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }
                        }
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                      {!app.accessible
                        ? "Unavailable"
                        : opening === app.key
                          ? "Opening…"
                          : `Open ${app.label}`}
                      {app.accessible && (
                        <motion.span variants={{ hover: { x: 4 } }} className="inline-flex">
                          <ArrowRight size={14} />
                        </motion.span>
                      )}
                      {last === app.key && (
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">
                          last used
                        </span>
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </>
        )}

        {!loading && !error && all.length === 0 && (
          <motion.div variants={rise} className="card mx-auto max-w-md p-6 text-center">
            <p className="text-sm text-slate-300">
              No applications are available for your role yet.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Ask an organization admin to enable an application, or contact support.
            </p>
          </motion.div>
        )}

        <motion.div
          variants={rise}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500"
        >
          <span className="hidden sm:inline">
            Press <kbd className="rounded border border-phantix-700 px-1 font-mono">1</kbd>–
            <kbd className="rounded border border-phantix-700 px-1 font-mono">
              {Math.max(all.length, 1)}
            </kbd>{" "}
            to open
          </span>
          <Link to="/docs" className="hover:text-slate-300">
            Documentation
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
            className="flex items-center gap-1.5 hover:text-slate-300"
          >
            <LogOut size={12} /> Sign out
          </button>
        </motion.div>
      </motion.div>

      {/* Handoff is a full page navigation — cover the wait with a progress sweep. */}
      <AnimatePresence>
        {opening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-phantix-800"
          >
            <motion.span
              className="block h-full w-1/3 bg-gold-400"
              initial={{ x: "-100%" }}
              animate={{ x: "400%" }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
