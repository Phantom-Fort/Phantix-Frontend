import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FlaskConical, CheckCircle2, Loader2, ArrowLeft, KeyRound } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LANDING_URL, PLATFORM_URL, SANDBOX_PROGRAM_SLUG } from "@/lib/config";
import { api, tokens, type ApiError } from "@/lib/api";
import { cx } from "@/lib/utils";

type Status = {
  max: number;
  seatsUsed: number;
  seatsRemaining: number;
  open: boolean;
  enrolled: number;
};

const defaults: Status = { max: 20, seatsUsed: 0, seatsRemaining: 20, open: true, enrolled: 0 };

function isSignedIn(): boolean {
  return Boolean(tokens.appSession || tokens.orgUser || tokens.platform);
}

/** Sandbox application — must be a registered organization (authenticated). */
export default function SandboxApplyPublic() {
  const [status, setStatus] = useState<Status>(defaults);
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(isSignedIn());
  const [enrolled, setEnrolled] = useState(false);
  const [useCase, setUseCase] = useState("");
  const [hearAbout, setHearAbout] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await api.get<Record<string, unknown>>(`/sandbox/programs/${SANDBOX_PROGRAM_SLUG}`);
        const seats = raw?.seats && typeof raw.seats === "object"
          ? raw.seats as Record<string, unknown>
          : {};
        const max = Number(seats.max ?? raw?.maxMembers ?? raw?.max_members ?? 20);
        const used = Number(seats.used ?? raw?.seatsUsed ?? 0);
        const enrolledCount = Number(raw?.enrolled ?? raw?.enrolledCount ?? used);
        setStatus({
          max,
          seatsUsed: used,
          seatsRemaining: Math.max(0, max - used),
          open: raw?.status !== "closed",
          enrolled: enrolledCount,
        });
      } catch {
        setStatus(defaults);
      }

      if (isSignedIn()) {
        try {
          const me = await api.get<{ enrolled?: boolean }>("/sandbox/me");
          setEnrolled(Boolean(me?.enrolled));
        } catch (err) {
          const e = err as ApiError;
          if (e && e.status === 401) setSignedIn(false);
          else setEnrolled(false);
        }
      }
      setChecking(false);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (status && !status.open) {
      setError("The sandbox cohort is full (20 organizations).");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/sandbox/programs/${SANDBOX_PROGRAM_SLUG}/members`, {
        use_case: useCase.trim(),
        hear_about: hearAbout.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application failed");
    } finally {
      setBusy(false);
    }
  };

  const enrolledCount = status.enrolled;
  const max = status.max;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-phantix-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-32 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-phantix-600/15 blur-[120px]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <a href={LANDING_URL} className="flex items-center gap-2.5">
          <img src="/logo-white.png" alt="Phantix" className="h-9 w-9 object-contain" />
          <div>
            <p className="font-display text-sm font-bold text-white">Phantix</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gold-400">Command Centre</p>
          </div>
        </a>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login" className="btn-secondary !py-1.5 !text-xs">
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-lg px-6 pb-16 pt-4">
        <a href={LANDING_URL} className="mb-5 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-gold-300">
          <ArrowLeft size={12} /> Back to phantix.site
        </a>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-phantix-700/40 bg-phantix-900/60 p-6 shadow-card backdrop-blur-sm sm:p-8"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-300">
              <FlaskConical size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-400">BETA design partners</p>
              <h1 className="font-display text-xl font-bold text-white">Apply for sandbox access</h1>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-white">
                <span className="text-gold-300">{enrolledCount}</span>
                <span className="text-slate-500">/{max}</span>
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">enrolled</p>
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-1.5 flex justify-between text-[11px] text-slate-500">
              <span>{status.seatsUsed}/{max} seats held</span>
              <span>{status.open ? `${Math.max(0, max - status.seatsUsed)} open` : "closed"}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-phantix-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600"
                style={{ width: `${Math.min(100, (status.seatsUsed / max) * 100)}%` }}
              />
            </div>
          </div>

          {checking ? (
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-gold-400" />
            </div>
          ) : done ? (
            <div className="py-10 text-center">
              <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
              <p className="mt-4 font-display text-lg font-semibold text-white">Application submitted</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Phantix staff will review your organization's application. You will be notified when access is approved.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link to="/dashboard" className="btn-primary !text-xs">Command Centre</Link>
                <a href={LANDING_URL} className="btn-secondary !text-xs">Back to site</a>
              </div>
            </div>
          ) : !signedIn ? (
            <div className="py-8 text-center">
              <KeyRound size={28} className="mx-auto text-slate-500" />
              <p className="mt-3 text-sm font-semibold text-slate-200">Sign in to apply</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Sandbox applications are open to registered organizations. Sign in with your organization, or register
                your company on the Platform first.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link to="/login" className="btn-primary !text-xs">Sign in</Link>
                <a href={`${PLATFORM_URL}/register`} className="btn-secondary !text-xs">Register organization</a>
              </div>
            </div>
          ) : enrolled ? (
            <div className="py-8 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
              <p className="mt-3 text-sm font-semibold text-slate-200">Your organization is enrolled</p>
              <p className="mt-2 text-xs text-slate-500">Open BETA sandbox from the sidebar to see updates and rate builds.</p>
            </div>
          ) : !status.open ? (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold text-slate-200">Cohort is full</p>
              <p className="mt-2 text-xs text-slate-500">All {max} sandbox seats are taken.</p>
              <a href={LANDING_URL} className="btn-primary mt-6 inline-flex !text-xs">Back to site</a>
            </div>
          ) : (
            <form className="space-y-3.5" onSubmit={(e) => void submit(e)}>
              <p className="text-[11px] leading-5 text-slate-500">
                Applications are reviewed for registered organizations. Your organization is identified from your session.
              </p>
              <div>
                <label className="label">Why sandbox? What will you test? *</label>
                <textarea
                  className="input min-h-[88px]"
                  required
                  minLength={10}
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  placeholder="SOC, assets, reports…"
                />
              </div>
              <div>
                <label className="label">How did you hear about us?</label>
                <input className="input" value={hearAbout} onChange={(e) => setHearAbout(e.target.value)} />
              </div>
              {error && <p className="text-xs text-severity-critical">{error}</p>}
              <p className="text-[11px] leading-5 text-slate-500">
                Limited to {max} organizations. Staff review submissions in the staff portal.
              </p>
              <button type="submit" className="btn-primary w-full !py-3" disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />} Submit application
              </button>
            </form>
          )}
        </motion.div>
      </main>
    </div>
  );
}