import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnimatedNumber } from "../ui";
import { chartColors, useTheme } from "../theme";
import { tooltipStyles } from "../charts/ChartFrame";
import { cx } from "../utils";

const MONO = "'Geist Mono Variable', 'JetBrains Mono', ui-monospace, monospace";

function useChartTheme() {
  const { theme } = useTheme();
  const mode = theme === "light" ? "light" : "dark";
  return { mode, c: chartColors(mode), tip: tooltipStyles(mode) } as const;
}

// ── Delta chip ────────────────────────────────────────────────────────────────
/** `goodWhen` says which direction is an improvement: posture up is good, findings up is bad. */
export function Delta({
  value,
  unit = "%",
  goodWhen = "up",
}: {
  value: number | null;
  unit?: string;
  goodWhen?: "up" | "down";
}) {
  if (value == null || !Number.isFinite(value)) return null;
  const flat = value === 0;
  const good = flat ? null : (value > 0) === (goodWhen === "up");
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-0.5 font-mono text-[12px] font-semibold",
        good == null ? "text-slate-400" : good ? "text-emerald-400" : "text-severity-critical",
      )}
    >
      <Icon size={13} aria-hidden />
      {Math.abs(value)}
      {unit}
    </span>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
export function KpiTile({
  icon,
  label,
  value,
  suffix,
  delta,
  hint,
  to,
  delay = 0,
  size = "md",
  className,
}: {
  className?: string;
  icon: React.ReactNode;
  label: string;
  value: number | null;
  suffix?: string;
  delta?: React.ReactNode;
  hint: React.ReactNode;
  to?: string;
  delay?: number;
  size?: "md" | "lg";
}) {
  const body = (
    <div className="flex items-center gap-4">
      <span
        className={cx(
          "flex shrink-0 items-center justify-center rounded-full border border-gold-400/30 bg-gold-400/10 text-gold-300",
          size === "lg" ? "h-14 w-14" : "h-12 w-12",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-slate-400">{label}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span
            className={cx(
              "font-mono font-semibold leading-none tracking-tight text-white",
              size === "lg" ? "text-[30px]" : "text-[26px]",
            )}
          >
            {value == null ? "—" : <AnimatedNumber value={value} />}
            {value != null && suffix ? <span className="text-[0.6em] text-slate-400">{suffix}</span> : null}
          </span>
          {delta}
        </div>
        <p className="mt-1 truncate text-[12px] text-slate-500">{hint}</p>
      </div>
    </div>
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {to ? (
        <Link to={to} className="card block h-full p-4 transition-colors hover:border-phantix-600">
          {body}
        </Link>
      ) : (
        <div className="card h-full p-4">{body}</div>
      )}
    </motion.div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  delay = 0,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cx("card flex min-w-0 flex-col p-4", className)}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold leading-snug text-slate-100">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cx("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </motion.section>
  );
}

export function ViewAll({ to, label = "View all" }: { to: string; label?: string }) {
  return (
    <Link to={to} className="-my-1 -mr-1.5 inline-flex rounded-md px-1.5 py-1 text-xs font-semibold text-gold-400 hover:bg-gold-400/10 hover:text-gold-300">
      {label}
    </Link>
  );
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="flex h-full min-h-[120px] items-center justify-center px-4 text-center text-sm text-slate-500">{children}</p>;
}

// ── Compact table ─────────────────────────────────────────────────────────────
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export function MiniTable<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, i: number) => string | number;
  rowHref?: (row: T) => string;
  empty: string;
}) {
  if (rows.length === 0) return <PanelEmpty>{empty}</PanelEmpty>;
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-phantix-700/60 text-[12px] font-medium text-slate-500">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cx("whitespace-nowrap px-3 py-2 font-medium first:pl-4 last:pr-4", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-b border-phantix-800/70 last:border-0 hover:bg-phantix-900/70">
              {columns.map((c, ci) => (
                <td
                  key={c.key}
                  className={cx(
                    "px-3 py-2.5 text-slate-300 first:pl-4 last:pr-4",
                    // The first column absorbs the slack and truncates; the rest stay on one line.
                    ci === 0 ? "w-full min-w-[7rem] max-w-0 truncate" : "whitespace-nowrap",
                    c.className,
                  )}
                >
                  {ci === 0 && rowHref ? (
                    <Link to={rowHref(row)} className="block truncate hover:text-gold-300">
                      {c.render(row)}
                    </Link>
                  ) : (
                    c.render(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────
export interface SeriesPoint {
  label: string;
  value: number;
}

/** Single-series area over time — the posture score. */
export function AreaTrend({ points, height = 170, name }: { points: SeriesPoint[]; height?: number; name: string }) {
  const { c, tip } = useChartTheme();
  const id = React.useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 8, right: 6, bottom: 0, left: -6 }}>
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.gold} stopOpacity={0.35} />
            <stop offset="100%" stopColor={c.gold} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: c.muted, fontSize: 12, fontFamily: MONO }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={{ fill: c.muted, fontSize: 12, fontFamily: MONO }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip {...tip} cursor={{ stroke: c.muted, strokeDasharray: "3 3" }} formatter={(v: number) => [v, name]} />
        <Area
          type="monotone"
          dataKey="value"
          name={name}
          stroke={c.gold}
          strokeWidth={2}
          fill={`url(#fill-${id})`}
          dot={{ r: 3, fill: c.gold, stroke: c.surface, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: c.gold, stroke: c.surface, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Single-series column chart; only the latest and the peak columns are labeled. */
export function ColumnTrend({ points, height = 170, name }: { points: SeriesPoint[]; height?: number; name: string }) {
  const { c, tip } = useChartTheme();
  const peak = points.reduce((m, p, i) => (p.value > (points[m]?.value ?? -1) ? i : m), 0);
  const last = points.length - 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} margin={{ top: 18, right: 4, bottom: 0, left: -6 }} barCategoryGap="22%">
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: c.muted, fontSize: 12, fontFamily: MONO }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: c.muted, fontSize: 12, fontFamily: MONO }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip {...tip} cursor={{ fill: c.grid, opacity: 0.5 }} formatter={(v: number) => [v, name]} />
        <Bar
          dataKey="value"
          name={name}
          fill={c.gold}
          radius={[4, 4, 0, 0]}
          maxBarSize={22}
          label={({ x, y, width, value, index }: any) =>
            index === peak || index === last ? (
              <text
                x={x + width / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize={12}
                fontFamily={MONO}
                fill={c.tooltipColor}
              >
                {value}
              </text>
            ) : (
              <g />
            )
          }
        >
          {points.map((p, i) => (
            <Cell key={p.label + i} fillOpacity={i === last ? 1 : 0.7} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Donut with the total in the hole and a labeled legend (never color alone). */
export function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const { c, tip } = useChartTheme();
  const total = slices.reduce((s, x) => s + x.value, 0);
  const shown = slices.filter((s) => s.value > 0);
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-[160px] w-[160px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip {...tip} formatter={(v: number, n: string) => [`${v} (${total ? Math.round((v / total) * 100) : 0}%)`, n]} />
            <Pie
              data={shown.length ? shown : [{ key: "none", label: "None", value: 1, color: c.grid }]}
              dataKey="value"
              nameKey="label"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={shown.length > 1 ? 2 : 0}
              stroke={c.surface}
              strokeWidth={2}
              isAnimationActive
            >
              {(shown.length ? shown : [{ key: "none", color: c.grid }]).map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-semibold text-white">{total.toLocaleString()}</span>
          <span className="text-[12px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="grid w-full min-w-0 grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-slate-300">{s.label}</span>
            <span className="font-mono text-slate-200">{s.value}</span>
            <span className="w-10 text-right font-mono text-[12px] text-slate-500">
              {total ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal meters — one measure across categories, single hue. */
export function RankedBars({
  rows,
}: {
  rows: { key: string; label: string; value: number; icon?: React.ReactNode; to?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const inner = (
          <>
            <div className="flex items-center gap-2.5">
              {r.icon ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-phantix-700 bg-phantix-900 text-gold-300">
                  {r.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-300">{r.label}</span>
              <span className="font-mono text-[13px] font-semibold text-slate-100">{r.value.toLocaleString()}</span>
            </div>
            <div className={cx("mt-1.5 h-1.5 overflow-hidden rounded-full bg-phantix-800", r.icon ? "ml-[38px]" : null)}>
              <motion.div
                className="h-full rounded-full bg-gold-400"
                initial={{ width: 0 }}
                animate={{ width: `${(r.value / max) * 100}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {r.to ? (
              <Link to={r.to} className="block rounded-sm hover:opacity-90" title={`${r.label}: ${r.value}`}>
                {inner}
              </Link>
            ) : (
              <div title={`${r.label}: ${r.value}`}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
