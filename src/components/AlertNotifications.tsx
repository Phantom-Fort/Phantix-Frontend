import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X, Bell, BellRing, ShieldAlert, ShieldCheck, ShieldQuestion, Info } from "lucide-react";
import { loadAlertsBundle } from "@/lib/data";
import { isDemoMode } from "@/lib/api";
import { timeAgo, cx } from "@/lib/utils";
import type { AlertEvent } from "@/lib/types";

type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface AlertNotice {
  id: number;
  severity: Severity;
  title: string;
  eventType: string;
  createdAt: string;
}

interface InboxNotice extends AlertNotice {
  read: boolean;
}

const SEV_META: Record<Severity, { label: string; chip: string; bar: string; icon: React.ReactNode }> = {
  critical: { label: "Critical", chip: "border-severity-critical/40 bg-severity-critical/15 text-red-200", bar: "bg-severity-critical", icon: <ShieldAlert size={14} /> },
  high: { label: "High", chip: "border-severity-high/40 bg-severity-high/15 text-amber-200", bar: "bg-severity-high", icon: <ShieldCheck size={14} /> },
  medium: { label: "Medium", chip: "border-severity-medium/40 bg-severity-medium/15 text-amber-300", bar: "bg-severity-medium", icon: <AlertTriangle size={14} /> },
  low: { label: "Low", chip: "border-severity-low/40 bg-severity-low/15 text-slate-300", bar: "bg-severity-low", icon: <ShieldQuestion size={14} /> },
  info: { label: "Info", chip: "border-phantix-500/40 bg-phantix-500/15 text-slate-300", bar: "bg-phantix-500", icon: <Info size={14} /> },
};

const TOAST_MS = 3000;

type NotifyCtx = {
  inbox: InboxNotice[];
  unread: number;
  panelOpen: boolean;
  setPanelOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  push: (n: AlertNotice) => void;
  markAllRead: () => void;
  dismissInbox: (id: number) => void;
};

const Ctx = createContext<NotifyCtx | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [inbox, setInbox] = useState<InboxNotice[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const push = useCallback((n: AlertNotice) => {
    setInbox((prev) => (prev.some((x) => x.id === n.id) ? prev : [{ ...n, read: false }, ...prev].slice(0, 50)));
  }, []);

  const markAllRead = useCallback(() => {
    setInbox((prev) => prev.map((x) => ({ ...x, read: true })));
  }, []);

  const dismissInbox = useCallback((id: number) => {
    setInbox((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const unread = useMemo(() => inbox.filter((x) => !x.read).length, [inbox]);

  const value = useMemo(
    () => ({ inbox, unread, panelOpen, setPanelOpen, push, markAllRead, dismissInbox }),
    [inbox, unread, panelOpen, push, markAllRead, dismissInbox],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotifyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications requires NotificationProvider");
  return ctx;
}

export function NotificationBell() {
  const { inbox, unread, panelOpen, setPanelOpen, markAllRead, dismissInbox } = useNotifications();

  useEffect(() => {
    if (panelOpen) markAllRead();
  }, [panelOpen, markAllRead]);

  return (
    <div className="relative">
      <button
        onClick={() => setPanelOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-phantix-700/50 bg-phantix-900 text-slate-300 transition-colors hover:border-phantix-500/50 hover:text-white"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-severity-critical px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80]" onClick={() => setPanelOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="absolute right-0 top-full z-[85] mt-2 w-80 overflow-hidden rounded-xl border border-phantix-700/50 bg-phantix-900 shadow-card"
            >
              <div className="flex items-center justify-between border-b border-phantix-700/40 px-3.5 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notifications</p>
                <span className="text-[10px] text-slate-500">{inbox.length} total</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {inbox.length === 0 && <p className="px-4 py-8 text-center text-xs text-slate-500">No alerts yet.</p>}
                {inbox.map((n) => {
                  const meta = SEV_META[n.severity] ?? SEV_META.info;
                  return (
                    <div key={n.id} className="flex items-start gap-2.5 border-b border-phantix-700/30 px-3.5 py-2.5 last:border-0">
                      <span className={cx("mt-0.5 h-2 w-2 shrink-0 rounded-full", meta.bar)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cx("chip !px-1.5 !py-0 !text-[9px]", meta.chip)}>{meta.label}</span>
                          <span className="text-[10px] text-slate-500">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-4 text-slate-200">{n.title}</p>
                        {n.eventType && <p className="mt-0.5 font-mono text-[10px] text-slate-500">{n.eventType}</p>}
                      </div>
                      <button onClick={() => dismissInbox(n.id)} className="rounded p-1 text-slate-500 hover:text-slate-200" aria-label="Dismiss">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AlertNotifications() {
  const { push } = useNotifications();
  const [stack, setStack] = useState<AlertNotice[]>([]);
  const [blocking, setBlocking] = useState<AlertNotice | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const dismissNotice = (id: number) => setStack((s) => s.filter((x) => x.id !== id));

  const dismissBlocking = () => {
    if (blocking) seenRef.current.add(`${blocking.severity}:${blocking.id}`);
    setBlocking(null);
  };

  const ingest = useCallback((notice: AlertNotice) => {
    push(notice);
    if (notice.severity === "critical") {
      setBlocking((cur) => cur ?? notice);
      return;
    }
    setStack((s) => (s.some((x) => x.id === notice.id) ? s : [notice, ...s].slice(0, 4)));
    window.setTimeout(() => setStack((s) => s.filter((x) => x.id !== notice.id)), TOAST_MS);
  }, [push]);

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
        ingest({ id: e.id, severity: sev, title: e.title, eventType: e.event_type, createdAt: e.created_at });
      }
    } catch { /* transient */ }
  }, [ingest]);

  useEffect(() => {
    void check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [check]);

  const demoSeeded = useRef(false);
  useEffect(() => {
    if (!isDemoMode() || demoSeeded.current) return;
    demoSeeded.current = true;
    const now = Date.now();
    ingest({ id: 9992, severity: "high", title: "New risk: JWT algorithm confusion", eventType: "risk.created", createdAt: new Date(now - 15_000).toISOString() });
    window.setTimeout(() => {
      ingest({ id: 9993, severity: "medium", title: "Scan #87 completed — 23 findings", eventType: "scan.completed", createdAt: new Date(now - 25_000).toISOString() });
    }, 400);
  }, [ingest]);

  return (
    <>
      <div className="pointer-events-none fixed right-4 top-16 z-[90] flex w-80 max-w-[calc(100vw-32px)] flex-col gap-2">
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
                className="pointer-events-auto relative overflow-hidden rounded-xl border border-phantix-700/50 bg-phantix-900 shadow-card"
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

      <AnimatePresence>
        {blocking && (
          <motion.div
            key={blocking.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-severity-critical/90 p-4 backdrop-blur-2xl"
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
