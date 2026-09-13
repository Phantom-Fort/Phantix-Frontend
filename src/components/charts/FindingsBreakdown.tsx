import React, { useMemo, useState } from "react";
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "@/lib/theme";
import ChartFrame, { tooltipStyles } from "./ChartFrame";
import {
  CHROME, LIFECYCLE_LABELS, LIFECYCLE_ORDER, SEVERITY_ORDER, SURFACE_LABELS,
  lifecycleColor, severityColor, surfaceColor, type ChartTheme,
} from "./palette";

/*
 * Findings, two ways at once: magnitude on the left, share on the right.
 *
 * The bar answers "how many" — the job bars are built for. The ring answers
 * "what proportion", which a bar makes the reader compute. Same data, same
 * colours, side by side, so neither question needs a second click.
 *
 * The framing switch is the point of the component. "37 findings" means nothing
 * until you say 37 *what*: by lifecycle state (is the programme working), by
 * severity (how bad), or by surface (where). Switching reframes both marks
 * together — they are never allowed to disagree.
 *
 * Colour follows the framing's job:
 *   lifecycle + severity → status palette, always beside its label
 *   surface              → validated categorical hues (identity)
 */

export type FindingsFraming = "lifecycle" | "severity" | "surface";

export interface FindingsCounts {
  /** open / in_progress / fixed / retest_failed / regressed / accepted */
  byStatus?: Record<string, number>;
  bySeverity?: Record<string, number>;
  bySurface?: Record<string, number>;
}

const FRAMINGS: Array<{ id: FindingsFraming; label: string; hint: string }> = [
  { id: "lifecycle", label: "State", hint: "Is the programme working — fixed, regressed, accepted" },
  { id: "severity", label: "Severity", hint: "How bad the open work is" },
  { id: "surface", label: "Surface", hint: "Which attack surface carries the exposure" },
];

export default function FindingsBreakdown({
  counts,
  height = 208,
  initialFraming = "lifecycle",
}: {
  counts: FindingsCounts;
  height?: number;
  initialFraming?: FindingsFraming;
}) {
  const { theme } = useTheme();
  const mode = (theme === "light" ? "light" : "dark") as ChartTheme;
  const [framing, setFraming] = useState<FindingsFraming>(initialFraming);
  const chrome = CHROME[mode];
  const tips = tooltipStyles(mode);

  const data = useMemo(() => {
    if (framing === "severity") {
      const src = counts.bySeverity ?? {};
      return SEVERITY_ORDER.filter((k) => Number(src[k]) > 0).map((k) => ({
        key: k,
        name: k[0].toUpperCase() + k.slice(1),
        value: Number(src[k]) || 0,
        color: severityColor(k),
      }));
    }
    if (framing === "surface") {
      const src = counts.bySurface ?? {};
      return Object.entries(src)
        .filter(([, v]) => Number(v) > 0)
        .map(([k, v]) => ({
          key: k,
          name: SURFACE_LABELS[k] ?? k,
          value: Number(v) || 0,
          color: surfaceColor(k, mode),
        }));
    }
    const src = counts.byStatus ?? {};
    return LIFECYCLE_ORDER.filter((k) => Number(src[k]) > 0).map((k) => ({
      key: k,
      name: LIFECYCLE_LABELS[k] ?? k,
      value: Number(src[k]) || 0,
      color: lifecycleColor(k),
    }));
  }, [counts, framing, mode]);

  const total = data.reduce((n, d) => n + d.value, 0);
  const active = FRAMINGS.find((f) => f.id === framing)!;

  const controls = (
    <div
      className="flex items-center gap-0.5 rounded-md border border-phantix-700/40 bg-phantix-900/50 p-0.5"
      role="group"
      aria-label="Findings framing"
    >
      {FRAMINGS.map((f) => (
        <button
          key={f.id}
          onClick={() => setFraming(f.id)}
          title={f.hint}
          aria-pressed={framing === f.id}
          className={
            framing === f.id
              ? "rounded px-2 py-0.5 text-[10.5px] font-medium bg-phantix-800/80 text-slate-100"
              : "rounded px-2 py-0.5 text-[10.5px] font-medium text-slate-500 hover:text-slate-300"
          }
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartFrame
      title="Findings"
      subtitle={total ? `${total} tracked · ${active.hint.toLowerCase()}` : "No tracked findings yet"}
      controls={controls}
      legend={data.map((d) => ({ key: d.key, label: d.name, color: d.color, value: d.value }))}
      tableHead={[active.label, "Findings", "Share"]}
      tableRows={data.map((d) => [
        d.name,
        d.value,
        total ? `${Math.round((d.value / total) * 100)}%` : "—",
      ])}
    >
      {data.length === 0 ? (
        <div className="flex items-center justify-center text-[11px] text-slate-600" style={{ height }}>
          Nothing to show for this framing.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.45fr_1fr]" style={{ minHeight: height }}>
          {/* Magnitude */}
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="26%">
                <XAxis
                  dataKey="name"
                  tick={{ fill: chrome.axis, fontSize: 10 }}
                  axisLine={{ stroke: chrome.grid }}
                  tickLine={false}
                  interval={0}
                  angle={data.length > 4 ? -18 : 0}
                  textAnchor={data.length > 4 ? "end" : "middle"}
                  height={data.length > 4 ? 38 : 22}
                />
                <YAxis
                  tick={{ fill: chrome.axis, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip
                  {...tips}
                  cursor={{ fill: mode === "dark" ? "#ffffff0d" : "#0000000a" }}
                  formatter={(value: number, _n: string, item: any) => [`${value} findings`, item?.payload?.name]}
                />
                {/* 4px rounded ends, anchored to the baseline. */}
                <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Share */}
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="54%"
                  outerRadius="84%"
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {data.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...tips}
                  formatter={(value: number, name: string) => [
                    `${value} (${total ? Math.round((value / total) * 100) : 0}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}
