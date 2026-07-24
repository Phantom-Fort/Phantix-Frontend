import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, ShieldCheck } from "lucide-react";
import { cx, severityMeta, verificationMeta, statusColor, titleCase } from "@/lib/utils";
import type { Severity, VerificationStatus } from "@/lib/types";

// ── Badges ────────────────────────────────────────────────────────────────────
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const m = severityMeta[severity];
  return (
    <span className={cx("chip", m.bg, m.color, m.border, className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", m.color.replace("text-", "bg-"))} />
      {m.label}
    </span>
  );
}

export function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    critical: "text-severity-critical bg-severity-critical/10 border-severity-critical/30",
    high: "text-severity-high bg-severity-high/10 border-severity-high/30",
    medium: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
    low: "text-severity-low bg-severity-low/10 border-severity-low/30",
  };
  return (
    <span className={cx("chip capitalize", colors[level] ?? "text-slate-400 bg-slate-400/10 border-slate-500/30")}>
      {level || "unknown"}
    </span>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const m = verificationMeta[status];
  return (
    <span className={cx("chip", m.className)}>
      {status.includes("verified") && <ShieldCheck size={12} />}
      {m.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls = statusColor[status] ?? "text-slate-400 bg-slate-400/10 border-slate-500/30";
  return (
    <span className={cx("chip capitalize", cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {titleCase(status)}
    </span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({
  children,
  className,
  hover,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cx(
        "card p-5",
        hover && "transition-all duration-300 hover:border-phantix-500/60 hover:shadow-glow-blue hover:-translate-y-0.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="font-display text-[15px] font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </motion.div>
  );
}

// ── Animated counter ──────────────────────────────────────────────────────────
export function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display.toLocaleString()}</>;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  icon,
  hint,
  accent = "gold",
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  hint?: React.ReactNode;
  accent?: "gold" | "blue" | "red" | "green";
  delay?: number;
}) {
  const accents = {
    gold: "from-gold-400/20 to-transparent text-gold-400",
    blue: "from-phantix-500/25 to-transparent text-phantix-300",
    red: "from-severity-critical/20 to-transparent text-severity-critical",
    green: "from-emerald-400/20 to-transparent text-emerald-400",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="card relative overflow-hidden p-5"
    >
      <div className={cx("absolute inset-x-0 top-0 h-24 bg-gradient-to-b", accents[accent])} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <span className="text-slate-500">{icon}</span>
        </div>
        <p className="mt-2 font-display text-[28px] font-bold leading-none text-white">{value}</p>
        {hint && <div className="mt-2 text-xs text-slate-400">{hint}</div>}
      </div>
    </motion.div>
  );
}

// ── Progress ring ─────────────────────────────────────────────────────────────
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color = "#E8B54D",
  track = "rgba(30,51,115,0.5)",
  children,
}: {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [offset, setOffset] = useState(c);
  useEffect(() => {
    const t = setTimeout(() => setOffset(c - (Math.min(100, Math.max(0, value)) / 100) * c), 120);
    return () => clearTimeout(t);
  }, [value, c]);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)", filter: `drop-shadow(0 0 8px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-phantix-950/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={cx("glass-bright w-full rounded-2xl shadow-card", wide ? "max-w-3xl" : "max-w-lg")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-phantix-700/40 px-6 py-4">
              <h3 className="font-display text-base font-semibold text-white">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-phantix-700/50 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Spinner / loading ─────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("h-4 w-4 animate-spin", className)} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-11" style={{ opacity: 1 - i * 0.14 }} />
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-phantix-800/70 text-phantix-300">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold text-slate-200">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-slate-400">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: React.ReactNode; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-1 rounded-xl bg-phantix-900/60 border border-phantix-700/40 p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            active === t.id ? "text-phantix-950" : "text-slate-400 hover:text-slate-100",
          )}
        >
          {active === t.id && (
            <motion.span
              layoutId="tab-pill"
              className="absolute inset-0 rounded-lg bg-gradient-to-b from-gold-400 to-gold-600"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">
            {t.label}
            {t.count !== undefined && (
              <span
                className={cx(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active === t.id ? "bg-phantix-950/20 text-phantix-950" : "bg-phantix-700/60 text-slate-300",
                )}
              >
                {t.count}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, color = "#E8B54D" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-phantix-700/50">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="h-full rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}66` }}
      />
    </div>
  );
}
