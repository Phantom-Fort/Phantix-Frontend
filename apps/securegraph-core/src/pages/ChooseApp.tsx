import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Boxes, Code2, Crosshair, LogOut, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";
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
  core: <Boxes size={22} />,
  attack: <Crosshair size={22} />,
  defend: <ShieldCheck size={22} />,
  code: <Code2 size={22} />,
};

const ACCENTS: Record<ApplicationKey, string> = {
  core: "from-sky-500/20 to-transparent border-sky-500/30",
  attack: "from-rose-500/20 to-transparent border-rose-500/30",
  defend: "from-emerald-500/20 to-transparent border-emerald-500/30",
  code: "from-violet-500/20 to-transparent border-violet-500/30",
};

/**
 * Sign-in application picker — "Where do you want to work today?".
 *
 * Shown after authentication so the operator chooses Core / Attack / Defend
 * before the app shell loads. When only one application is accessible it
 * forwards straight through.
 */
export default function ChooseApp() {
  const navigate = useNavigate();
  const { session, logout } = useStore();
  const [snap, setSnap] = useState<ApplicationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.authenticated) {
      navigate("/login", { replace: true });
    }
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

  const apps = accessibleApplications(snap);
  const last = lastApp();

  async function open(app: ApplicationCard) {
    rememberApp(app.key);
    const target = applicationTarget(app.key);
    if (!target.external) {
      navigate(target.href, { replace: true });
      return;
    }
    // Carry this session across the origin boundary (single-use, seconds-long).
    window.location.assign(await applicationHandoffHref(app.key));
  }

  // Single application: no choice to make — go straight in.
  useEffect(() => {
    if (!loading && apps.length === 1) open(apps[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, apps.length]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(212,164,76,0.10),transparent)]" />
      <div className="relative z-10 w-full max-w-4xl">
        <div className="mb-9 text-center">
          <img
            src="/logo-transparent.png"
            alt=""
            className="mx-auto h-14 w-14 object-contain"
          />
          <p className="mt-4 font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-400">
            SecureGraph
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-white">
            Where do you want to work today?
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {session?.userName || session?.userEmail
              ? `${session.userName || session.userEmail} · choose an application`
              : "Choose an application to enter"}
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-phantix-500 border-t-gold-400" />
            Preparing your applications…
          </div>
        )}

        {!loading && error && (
          <div className="card mx-auto max-w-md p-6 text-center">
            <p className="text-sm text-rose-300">{error}</p>
            <button className="btn-secondary mt-4" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && apps.length > 1 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app, i) => (
              <motion.button
                key={app.key}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => open(app)}
                className={cx(
                  "card group relative flex flex-col gap-3 border bg-gradient-to-b p-6 text-left transition-transform hover:-translate-y-0.5",
                  ACCENTS[app.key],
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-phantix-900/70 text-gold-400">
                  {ICONS[app.key]}
                </span>
                <span className="font-display text-xl font-bold text-white">{app.label}</span>
                <span className="text-xs font-medium text-gold-400">{app.tagline}</span>
                <span className="flex-1 text-[13px] leading-5 text-slate-400">{app.description}</span>
                {app.capabilities.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {app.capabilities.map((c) => (
                      <span
                        key={c}
                        className="rounded-md bg-phantix-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                      >
                        {c}
                      </span>
                    ))}
                  </span>
                )}
                <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-200 group-hover:text-gold-300">
                  Open {app.label} <ArrowRight size={14} />
                  {last === app.key && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">
                      last used
                    </span>
                  )}
                </span>
              </motion.button>
            ))}
          </div>
        )}

        {!loading && !error && apps.length === 0 && (
          <div className="card mx-auto max-w-md p-6 text-center">
            <p className="text-sm text-slate-300">
              No applications are available for your role yet.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Ask an organization admin to enable an application, or contact support.
            </p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500">
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
        </div>
      </div>
    </div>
  );
}
