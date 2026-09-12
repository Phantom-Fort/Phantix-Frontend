import React from "react";
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "@/lib/theme";
import ChartFrame, { tooltipStyles } from "./ChartFrame";
import { CHROME, LIFECYCLE_COLORS, type ChartTheme } from "./palette";
import type { TrackerTimeline } from "@/lib/data";

/*
 * Are we winning? — the backlog over time, with what moved it.
 *
 * The shaded band is the standing backlog (one series, so area is right). The
 * two lines are the flows that change it: detected in, fixed out. One y-axis for
 * all three — they are all counts of findings, so they belong on the same scale,
 * and a second axis would let the shape be chosen rather than observed.
 *
 * Sparse labels: 90 daily ticks cannot be read, so only every nth date is drawn.
 */

export default function MovementTimeline({
  timeline,
  height = 240,
}: {
  timeline: TrackerTimeline;
  height?: number;
}) {
  const { theme } = useTheme();
  const mode = (theme === "light" ? "light" : "dark") as ChartTheme;
  const chrome = CHROME[mode];
  const tips = tooltipStyles(mode);

  const data = timeline.series.map((p) => ({
    ...p,
    // Short label; the tooltip carries the full date.
    label: p.day.slice(5),
  }));
  const step = Math.max(1, Math.floor(data.length / 6));
  const net = timeline.net_change;
  const direction =
    net < 0 ? `backlog down ${Math.abs(net)}` : net > 0 ? `backlog up ${net}` : "backlog flat";

  return (
    <ChartFrame
      title="Findings movement"
      subtitle={`${timeline.days} days · ${direction} · ${timeline.totals.fixed} fixed, ${timeline.totals.detected} detected`}
      legend={[
        { key: "open", label: "Open backlog", color: LIFECYCLE_COLORS.open },
        { key: "detected", label: "Detected", color: LIFECYCLE_COLORS.regressed },
        { key: "fixed", label: "Fixed", color: LIFECYCLE_COLORS.fixed },
      ]}
      tableHead={["Day", "Detected", "Fixed", "Regressed", "Open"]}
      tableRows={timeline.series.map((p) => [
        p.day,
        p.detected,
        p.fixed,
        p.regressed,
        p.cumulative_open,
      ])}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="mt-open" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LIFECYCLE_COLORS.open} stopOpacity={0.28} />
                <stop offset="100%" stopColor={LIFECYCLE_COLORS.open} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={chrome.grid} vertical={false} strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              tick={{ fill: chrome.axis, fontSize: 10 }}
              axisLine={{ stroke: chrome.grid }}
              tickLine={false}
              interval={step - 1}
            />
            <YAxis
              tick={{ fill: chrome.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={38}
            />
            <Tooltip
              {...tips}
              formatter={(value: number, name: string) => [value, name]}
              labelFormatter={(label: string) => {
                const point = timeline.series.find((p) => p.day.slice(5) === label);
                return point?.day ?? label;
              }}
            />
            <Legend wrapperStyle={{ display: "none" }} />
            <Area
              type="monotone"
              dataKey="cumulative_open"
              name="Open backlog"
              stroke={LIFECYCLE_COLORS.open}
              strokeWidth={2}
              fill="url(#mt-open)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="detected"
              name="Detected"
              stroke={LIFECYCLE_COLORS.regressed}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="fixed"
              name="Fixed"
              stroke={LIFECYCLE_COLORS.fixed}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
