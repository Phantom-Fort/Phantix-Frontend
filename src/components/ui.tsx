import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, ShieldCheck, Info, Globe, Building2, Server, ChevronDown, WifiOff, RefreshCw } from "lucide-react";
import { cx, severityMeta, verificationMeta, statusColor, titleCase, impactLevelColor, categoryLabels, blastRadiusLabels, impactLevelRank } from "@/lib/utils";
import type { Severity, VerificationStatus } from "@/lib/types";

// ── Badges ────────────────────────────────────────────────────────────────────
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const key = (severity || "info").toLowerCase() as Severity;
  const m = severityMeta[key] || severityMeta.info;
  return (
    <span className={cx("chip", m.bg, m.color, m.border, className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", m.color.replace("text-", "bg-"))} />
      {m.label}
    </span>
  );
}

export function RiskBadge({ level }: { level: string }) {
  const key = (level || "").toLowerCase();
  const colors: Record<string, string> = {
    critical: "text-severity-critical bg-severity-critical/10 border-severity-critical/30",
    high: "text-severity-high bg-severity-high/10 border-severity-high/30",
    medium: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
    low: "text-severity-low bg-severity-low/10 border-severity-low/30",
  };
  return (
    <span className={cx("chip capitalize", colors[key] ?? "text-slate-400 bg-slate-400/10 border-slate-500/30")}>
      {level || "unknown"}
    </span>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const m = (verificationMeta as Record<string, { label:string; className: string }>)[status || ""] || verificationMeta.unverified;
  return (
    <span className={cx("chip", m.className)}>
      {String(status || "").includes("verified") && <ShieldCheck size={12} />}
      {m.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const cls = statusColor[status ?? ""] ?? "text-slate-400 bg-slate-400/10 border-slate-500/30";
  return (
    <span className={cx("chip capitalize", cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {titleCase(status)}
    </span>
  );
}

export function ImpactBadge({ level, score }: { level?: string; score?: number }) {
  const cls = impactLevelColor(level);
  const label = level ?? "—";
  const num = score != null ? `· ${score}` : "";
  return <span className={cx("chip capitalize", cls)}>{label} {num}</span>;
}

export function ImpactPanel({ impact }: { impact: any }) {
  if (!impact?.impact_level) return <p className="text-xs text-slate-500">Impact not available</p>;
  const catChips = (impact.categories ?? []).map((c: string) => categoryLabels[c] ?? c);
  const blastLabel = blastRadiusLabels[impact.blast_radius] ?? impact.blast_radius;
  const cia = impact.cia;
  return (
    <div className="space-y-3 rounded-md border border-phantix-700 bg-phantix-950/50 p-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ImpactBadge level={impact.impact_level} score={impact.impact_score} />
        {blastLabel && <span className="chip text-slate-300"><Globe size={11} className="mr-1 inline" />{blastLabel}</span>}
      </div>
      {cia && (
        <div className="flex flex-wrap gap-1.5">
          {(["confidentiality","integrity","availability"] as const).map(k => (
            <span key={k} className={cx("chip text-[10px] capitalize", cia[k] === "high" ? "bg-red-500/10 text-red-400 border-red-500/20" : cia[k] === "medium" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : cia[k] === "low" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-slate-500/10 text-slate-500")}>{k.slice(0,1).toUpperCase()}: {cia[k]}</span>
          ))}
        </div>
      )}
      {catChips.length > 0 && <div className="flex flex-wrap gap-1">{catChips.map((c: string) => <span key={c} className="chip text-[10px] bg-phantix-800/70 text-slate-300">{c}</span>)}</div>}
      {impact.business_impact && <p className="text-slate-300 leading-5"><span className="font-semibold text-slate-200">Business impact: </span>{impact.business_impact}</p>}
      {impact.technical_impact && <p className="text-slate-400 leading-5"><span className="font-semibold text-slate-300">Technical: </span>{impact.technical_impact}</p>}
      {impact.regulatory_concerns?.length > 0 && <p className="text-[10px] text-slate-500">Regulatory hints: {impact.regulatory_concerns.join(", ")}</p>}
      {impact.summary && !impact.business_impact && <p className="text-slate-300">{impact.summary}</p>}
    </div>
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
        hover && "transition-colors duration-200 hover:border-phantix-600",
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
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-[15px] font-semibold leading-snug text-slate-100">{title}</h3>
        {subtitle && <p className="mt-1 text-xs leading-5 text-slate-400 break-words">{subtitle}</p>}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
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
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
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
  // Flat cards: the accent is carried by the icon color only (no gradient washes).
  const accents = {
    gold: "text-gold-400",
    blue: "text-zinc-400",
    red: "text-severity-critical",
    green: "text-emerald-400",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="card relative overflow-hidden p-5"
    >
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <span className={accents[accent]}>{icon}</span>
        </div>
        <p className="mt-2 font-mono text-[28px] font-semibold leading-none tracking-tight text-white">{value}</p>
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
  color = "rgb(var(--gold-400))",
  track = "#27272A",
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
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)" }}
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
            className={cx("glass-bright w-full rounded-lg shadow-card", wide ? "max-w-3xl" : "max-w-lg")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-phantix-700/40 px-6 py-4">
              <h3 className="font-display text-base font-semibold text-white">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-slate-400 hover:bg-phantix-700/50 hover:text-white"
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

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cx("card animate-pulse border-phantix-700/40 bg-phantix-900/50 p-5", className)}><div className="skeleton h-4 w-3/4 rounded" /><div className="mt-3 skeleton h-3 w-1/2 rounded" /></div>;
}

export function SkeletonTable({ rows = 3, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => <div key={j} className="skeleton h-8 rounded" style={{ opacity: 1 - i * 0.12 - j * 0.04 }} />)}
        </div>
      ))}
    </div>
  );
}

// ── Optimistic UI / page-layout skeletons ─────────────────────────────────────
// Each skeleton mirrors the real page layout so the loading state feels like
// the page has already rendered (progressive / optimistic). Replace the old
// centered-spinner "Loading X…" screens with the matching variant.

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

/** Page title / subtitle / actions area. */
export function PageHeaderSkeleton({ actions = false }: { actions?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="skeleton mb-2 h-5 w-48 rounded" />
        <div className="skeleton h-8 w-72 max-w-full rounded" />
        <div className="mt-3 skeleton h-3 w-96 max-w-full rounded" />
      </div>
      {actions && <div className="flex gap-2"><div className="skeleton h-9 w-28 rounded-md" /><div className="skeleton h-9 w-32 rounded-md" /></div>}
    </div>
  );
}

/** KPI stat card. */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cx("card animate-pulse border-phantix-700/40 bg-phantix-900/50 p-4", className)}>
      <div className="skeleton h-3 w-16 rounded" />
      <div className="mt-3 skeleton h-7 w-20 rounded" />
      <div className="mt-2 skeleton h-2.5 w-24 rounded" />
    </div>
  );
}

/** A row with icon + two text lines + trailing badge (list/card pages). */
export function CardListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card animate-pulse border-phantix-700/40 bg-phantix-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="skeleton h-10 w-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-4 w-2/3 rounded" />
              <div className="skeleton h-3 w-1/3 rounded" />
            </div>
            <div className="skeleton h-6 w-16 shrink-0 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Card with a header line + table-ish rows (list/report/tracker pages). */
export function TableCardSkeleton({ rows = 5, cols = 4, title = true }: { rows?: number; cols?: number; title?: boolean }) {
  return (
    <div className="card animate-pulse overflow-hidden border-phantix-700/40 bg-phantix-900/50">
      {title && (
        <div className="flex items-center justify-between border-b border-phantix-700/40 px-4 py-3">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-6 w-16 rounded-md" />
        </div>
      )}
      <div className="space-y-0 divide-y divide-phantix-800/40 px-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid items-center gap-4 py-3.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((__, j) => (
              <div key={j} className="skeleton h-3.5 rounded" style={{ width: j === 0 ? "82%" : "100%", opacity: 1 - i * 0.07 - j * 0.05 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Two-column split (list + detail) used by VAPT / SOC / assets detail. */
export function SplitPaneSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="xl:col-span-1">
        <CardListSkeleton rows={rows} />
      </div>
      <div className="xl:col-span-2">
        <SkeletonCard className="h-96" />
      </div>
    </div>
  );
}

/** KPI grid used on dashboards. */
export function StatGridSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cx("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5", className)}>
      {Array.from({ length: count }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
  );
}

/** Full page optimistic loading shell — pick the layout that matches the page. */
export function PageSkeleton({
  variant = "cards",
  rows = 5,
  cols = 4,
  actions = false,
  className,
}: {
  variant?: "cards" | "table" | "list" | "split" | "dashboard";
  rows?: number;
  cols?: number;
  actions?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("mx-auto max-w-[1400px]", className)}>
      <PageHeaderSkeleton actions={actions} />
      {variant === "dashboard" && (
        <>
          <StatGridSkeleton />
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2"><SkeletonCard className="h-80" /></div>
            <SkeletonCard className="h-80" />
          </div>
        </>
      )}
      {variant === "split" && <SplitPaneSkeleton rows={rows} />}
      {variant === "table" && <TableCardSkeleton rows={rows} cols={cols} />}
      {variant === "list" && <CardListSkeleton rows={rows} />}
      {variant === "cards" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: Math.min(rows, 6) }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
    </div>
  );
}

// ── Server not responding / load failure state ───────────────────────────────
export function ErrorState({
  title,
  body,
  onRetry,
  icon,
  className,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-h-[45vh] flex-col items-center justify-center px-6 text-center", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-severity-critical/30 bg-severity-critical/10 text-severity-critical">
        {icon ?? <WifiOff size={22} />}
      </div>
      <h3 className="font-display text-base font-semibold text-slate-200">{title ?? "Server not responding"}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-400">
        {body ?? "We could not reach the Phantix API. Check your connection and retry — your session stays signed in."}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary mt-5 !py-2 text-xs">
          <RefreshCw size={13} className="mr-1.5 inline" /> Retry
        </button>
      )}
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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-phantix-700 bg-phantix-900 text-phantix-300">
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
    <div className="mb-5 flex flex-wrap items-center gap-1 rounded-md bg-phantix-900 border border-phantix-700 p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "relative rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
            active === t.id ? "text-gold-300" : "text-slate-400 hover:text-slate-100",
          )}
        >
          {active === t.id && (
            <motion.span
              layoutId="tab-pill"
              className="absolute inset-0 rounded-md border border-gold-400/40 bg-phantix-800"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">
            {t.label}
            {t.count !== undefined && (
              <span
                className={cx(
                  "rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold",
                  active === t.id ? "bg-phantix-950/60 text-gold-300" : "bg-phantix-700/60 text-slate-300",
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
export function ProgressBar({ value, color = "rgb(var(--gold-400))" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-phantix-800">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="h-full"
        style={{ background: color }}
      />
    </div>
  );
}

// ── Collapsible ─────────────────────────────────────────────────────────────
// Smooth height-animated disclosure built on the `.wb-collapse` grid-rows
// technique. Accessible via a real <button> trigger with aria-expanded.
export function Collapsible({
  title,
  children,
  defaultOpen = true,
  open,
  onOpenChange,
  right,
  className,
  bodyClassName,
  dense = false,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional content rendered on the right of the header (badges, actions). */
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  dense?: boolean;
}) {
  const [internal, setInternal] = useState(defaultOpen);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internal;
  const toggle = () => {
    if (controlled) onOpenChange?.(!isOpen);
    else setInternal((v) => !v);
  };
  return (
    <div className={cx("min-w-0", className)}>
      <div className={cx("flex items-center gap-2", dense ? "py-0.5" : "py-1")}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="group flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none"
        >
          <ChevronDown
            size={dense ? 12 : 14}
            className={cx(
              "shrink-0 text-slate-500 transition-transform duration-200 group-hover:text-gold-300",
              !isOpen && "-rotate-90",
            )}
          />
          <span className="min-w-0 truncate">{title}</span>
        </button>
        {right && <div className="ml-auto flex shrink-0 items-center gap-1.5">{right}</div>}
      </div>
      <div className={cx("wb-collapse", isOpen && "open")}>
        <div className={cx("wb-collapse-inner", bodyClassName)}>{children}</div>
      </div>
    </div>
  );
}

// ── Menu (dropdown) ─────────────────────────────────────────────────────────
// A lightweight popover menu with Escape / outside-click dismissal, designed
// for compact workbench toolbars and pane headers.
export function Menu({
  trigger,
  children,
  align = "right",
  className,
  menuClassName,
  disabled,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "left" | "right";
  className?: string;
  menuClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className={cx("relative inline-block", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cx("inline-flex outline-none", disabled && "pointer-events-none opacity-50")}
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            role="menu"
            className={cx(
              "absolute z-[60] mt-1.5 min-w-[180px] overflow-hidden rounded-md border border-phantix-700 bg-phantix-900 p-1 shadow-card",
              align === "right" ? "right-0" : "left-0",
              menuClassName,
            )}
          >
            {typeof children === "function" ? children(close) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  active,
  danger,
  disabled,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
        danger
          ? "text-severity-critical hover:bg-severity-critical/10"
          : active
            ? "bg-phantix-800 text-gold-200"
            : "text-slate-300 hover:bg-phantix-800/70 hover:text-white",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {icon && <span className="shrink-0 text-slate-500">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold-400" />}
    </button>
  );
}
