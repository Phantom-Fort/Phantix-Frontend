import React from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "@/lib/theme";
import ChartFrame, { tooltipStyles } from "./ChartFrame";
import { CHROME, type ChartTheme } from "./palette";

/*
 * Comparative analysis — several categories, several series, one axis.
 *
 * Horizontal because the categories are named things (surfaces, frameworks,
 * engines) whose labels need room; a vertical axis would either truncate them or
 * rotate them to 45°. Stacked when the series are parts of one total (a surface's
 * severity mix), grouped when they are separate measures being compared side by
 * side (open vs fixed).
 *
 * One axis, always. Two measures on different scales get two charts, never a
 * second y-axis — a dual axis lets the author choose the story by choosing the
 * scales, which is the single most misleading thing a chart can do.
 */

export interface ComparativeSeries {
  key: string;
  label: string;
  color: string;
}

export default function ComparativeBars({
  title,
  subtitle,
  rows,
  series,
  stacked = true,
  height,
  valueLabel = "findings",
}: {
  title: string;
  subtitle?: string;
  /** One entry per category: `{ name, [seriesKey]: number }`. */
  rows: Array<Record<string, string | number>>;
  series: ComparativeSeries[];
  stacked?: boolean;
  height?: number;
  valueLabel?: string;
}) {
  const { theme } = useTheme();
  const mode = (theme === "light" ? "light" : "dark") as ChartTheme;
  const chrome = CHROME[mode];
  const tips = tooltipStyles(mode);

  // Room per category rather than a fixed height, so eight rows do not squeeze
  // into the space two would use.
  const computed = height ?? Math.max(150, rows.length * (stacked ? 34 : 26 * series.length + 12) + 34);

  const hasData = rows.some((r) => series.some((s) => Number(r[s.key]) > 0));

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={series.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
      tableHead={["Category", ...series.map((s) => s.label)]}
      tableRows={rows.map((r) => [
        String(r.name ?? ""),
        ...series.map((s) => Number(r[s.key]) || 0),
      ])}
    >
      {!hasData ? (
        <div className="flex items-center justify-center text-[11px] text-slate-600" style={{ height: 120 }}>
          Nothing recorded across these categories yet.
        </div>
      ) : (
        <div style={{ height: computed }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 2, right: 12, bottom: 2, left: 2 }}
              barCategoryGap={stacked ? "28%" : "22%"}
            >
              <CartesianGrid stroke={chrome.grid} horizontal={false} strokeDasharray="2 4" />
              <XAxis
                type="number"
                tick={{ fill: chrome.axis, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: chrome.axis, fontSize: 10.5 }}
                axisLine={false}
                tickLine={false}
                width={78}
              />
              <Tooltip
                {...tips}
                cursor={{ fill: mode === "dark" ? "#ffffff0d" : "#0000000a" }}
                formatter={(value: number, name: string) => [`${value} ${valueLabel}`, name]}
              />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId={stacked ? "a" : undefined}
                  fill={s.color}
                  /* 2px of surface between segments so adjacent fills never touch,
                     and a 4px rounded end only on the outermost segment. */
                  stroke={mode === "dark" ? "#0A0A0A" : "#FFFFFF"}
                  strokeWidth={stacked ? 2 : 0}
                  radius={stacked ? (i === series.length - 1 ? [0, 4, 4, 0] : 0) : [0, 4, 4, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  );
}
