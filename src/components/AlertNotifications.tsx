import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X, BellRing, ShieldAlert, ShieldCheck, ShieldQuestion, Info } from "lucide-react";
import { loadAlertsBundle } from "@/lib/data";
import { isDemoMode } from "@/lib/api";
import type { AlertEvent } from "@/lib/types";

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface AlertNotice {
  id: number;
  severity: Severity;
  title: string;
  eventType: string;
  createdAt: string;
}

const SEV_META: Record<Severity, { label: string; chip: string; bar: string; icon: React.ReactNode }> = {
  critical: { label: "Critical", chip: "border-severity-critical/40 bg-severity-critical/15 text-red-200", bar: "bg-severity-critical", icon: <ShieldAlert size={14} /> },
  high: { label: "High", chip: "border-severity-high/40 bg-severity-high/15 text-amber-200", bar: "bg-severity-high", icon: <ShieldCheck size={14} /> },
  medium: { label: "Medium", chip: "border-severity-medium/40 bg-severity-medium/15 text-amber-300", bar: "bg-severity-medium", icon: <AlertTriangle size={14} /> },
  low: { label: "Low", chip: "border-severity-low/40 bg-severity-low/15 text-slate-300", bar: "bg-severity-low", icon: <ShieldQuestion size={14} /> },
  info: { label: "Info", chip: "border-phantix-500/40 bg-phantix-500/15 text-slate-300", bar: "bg-phantix-500", icon: <Info size={14} /> },
};

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * App-wide alert notifications for ALL org users.
 *
 * - Every delivered alert (any severity) surfaces as an in-app notification
 *   toast with the alert level clearly indicated (color-coded badge + side bar).
 * - Critical alerts additionally trigger a blocking, manually-dismissed overlay.
 * - Non-critical toasts auto-dismiss after 9s or are closed manually; dismissed
 *   alerts stay hidden for this session; new alerts pop again.
 */
export default function AlertNotifications() {
  const [stack, setStack] = useState<AlertNotice[]>([]);
  const [blocking, setBlocking] = useState<AlertNotice | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const dismissNotice = (id: number) => setStack((s) => s.filter((x) => x.id !== id));

  const dismissBlocking = () => {
    if (blocking) seenRef.current.add(`${blocking.severity}:${blocking.id}`);
    setBlocking(null);
  };

  const check = useCallback(async () => {
    try {
      const bundle = await loadAlertsBundle();
      const events: AlertEvent[] = bundle?.events ?? [];
      const delivered = events.filter((e) => e.status !== "failed");
      if (!delivered.length) return;
      const sorted = [...delivered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const fresh = sorted.filter((e) => !seenRef.current.has(`${e.severity}:${e.id}`));
      for (const e of fresh) {
        seenRef.current.add(`${e.severity}:${e.id}`);
        const sev = (["critical", "high", "medium", "low", "info"].includes(e.severity) ? e.severity : "info") as Severity;
        const notice: AlertNotice = { id: e.id, severity: sev, title: e.title, eventType: e.event_type, createdAt: e.created_at };
        if (sev === "critical") {
          setBlocking((cur) => cur ?? notice);
        } else {
          setStack((s) => (s.some((x) => x.id === e.id) ? s : [notice, ...s].slice(0, 6)));
          window.setTimeout(() => setStack((s) => s.filter((x) => x.id !== e.id)), 9000);
        }
      }
    } catch { /* transient — keep app usable */ }
  }, []);

  useEffect(() => {
    void check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [check]);

  // Demo mode: surface a few alerts so the notifications are visible.
  const demoSeeded = useRef(false);
  useEffect(() => {
    if (!isDemoMode() || demoSeeded.current) return;
    demoSeeded.current = true;
    const now = Date.now();
    const demoHigh: AlertNotice = { id: 9992, severity: "high", title: "New risk: JWT algorithm confusion", eventType: "risk.created", createdAt: new Date(now - 15_000).toISOString() };
    const demoMedium: AlertNotice = { id: 9993, severity: "medium", title: "Scan #87 completed — 23 findings", eventType: "scan.completed", createdAt: new Date(now - 25_000).toISOString() };
    setStack([demoHigh, demoMedium]);
    const t1 = window.setTimeout(() => setStack((s) => s.filter((x) => x.id !== 9992)), 9000);
    const t2 = window.setTimeout(() => setStack((s) => s.filter((x) => x.id !== 9993)), 9000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <>
      {/* Notification stack (top-right) — all severities */}
      <div className="pointer-events-none fixed right-4 top-4 z-[95] flex w-80 max-w-[calc(100vw-32px)] flex-col gap-2">
        <AnimatePresence>
          {stack.map((n) => {
            const meta = SEV_META[n.severity] ?? SEV_META.info;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className="pointer-events-auto relative overflow-hidden rounded-xl border border-phantix-700/50 bg-phantix-900/95 shadow-card backdrop-blur-xl"
              >
                <span className={cx("absolute inset-y-0 left-0 w-1", meta.bar)} />
                <div className="flex items-start gap-3 p-3 pl-4">
                  <span className={cx("chip shrink-0 !text-[10px]", meta.chip)}>{meta.icon} {meta.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-5 text-slate-100">{n.title}</p>
                    {n.eventType && <p className="mt-0.5 font-mono text-[10px] text-slate-500">{n.eventType}</p>}
                  </div>
                  <button onClick={() => dismissNotice(n.id)} className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-phantix-800/70 hover:text-slate-200" aria-label="Dismiss notification">
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Critical blocking overlay */}
      <AnimatePresence>
        {blocking && (
          <motion.div
            key={blocking.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-severity-critical/95 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="relative w-full max-w-lg text-center"
            >
              <button
                onClick={dismissBlocking}
                aria-label="Dismiss critical alert"
                className="absolute -right-1 -top-1 rounded-full border border-white/30 bg-severity-critical p-2 text-white/90 transition-colors hover:bg-white/10"
              >
                <X size={18} />
              </button>

              <div className="relative mx-auto h-24 w-24">
                <span className="absolute inset-0 animate-ping rounded-full bg-red-300/40" />
                <span className="absolute inset-0 animate-pulse rounded-full bg-red-200/30" />
                <span className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-white/60 bg-gradient-to-br from-red-500 to-red-700 shadow-glow-red">
                  <AlertTriangle size={44} className="text-white" />
                </span>
              </div>

              <p className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-100/90">
                <BellRing size={13} /> Critical security alert
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold leading-tight text-white">{blocking.title}</h2>
              <p className="mt-3 text-sm text-red-100/80">
                A critical alert was sent to your organization's email recipients. Review it immediately.
                {blocking.eventType && <span className="mt-1 block font-mono text-xs text-red-200/70">{blocking.eventType}</span>}
              </p>

              <button
                onClick={dismissBlocking}
                className="mt-8 rounded-xl border border-white/40 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                Dismiss
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
