import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendPoint {
  label: string;
  value: number;
  secondary?: number | null;
}

interface Props {
  /** Time series ordered oldest → newest (natural x-axis direction). */
  points: TrendPoint[];
  color?: string;
  secondaryColor?: string;
  height?: number;
}

const MONO = "'Geist Mono Variable', 'JetBrains Mono', ui-monospace, monospace";

/** Compact dark-themed line time-series used across dashboards.
 *  Flat dev-tool styling: thin high-contrast plots, no area-fill glow. */
export default function TrendChart({ points, color = "#E8B54D", secondaryColor = "#F43F5E", height = 180 }: Props) {
  const data = points.map((p) => ({
    label: p.label,
    value: p.value,
    ...(p.secondary != null ? { secondary: p.secondary } : {}),
  }));
  const hasSecondary = data.some((d) => d.secondary != null);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-600" style={{ height }}>
        No trend data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
        <CartesianGrid stroke="rgba(113,113,122,0.12)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#71717A", fontSize: 10, fontFamily: MONO }}
          axisLine={{ stroke: "#3F3F46" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          tick={{ fill: "#71717A", fontSize: 10, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
          width={42}
          domain={["auto", "auto"]}
        />
        <Tooltip
          cursor={{ stroke: "rgba(232,181,77,0.4)", strokeWidth: 1 }}
          contentStyle={{
            background: "#0A0A0A",
            border: "1px solid #27272A",
            borderRadius: 6,
            fontSize: 12,
            padding: "6px 10px",
            fontFamily: MONO,
          }}
          labelStyle={{ color: "#A1A1AA", fontSize: 11, marginBottom: 2 }}
          itemStyle={{ color: "#E4E4E7" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name="value"
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          dot={false}
          activeDot={{ r: 3, fill: color, stroke: "#000000" }}
        />
        {hasSecondary && (
          <Area
            type="monotone"
            dataKey="secondary"
            name="critical+high"
            stroke={secondaryColor}
            strokeWidth={1.25}
            strokeDasharray="4 3"
            fill="none"
            dot={false}
            activeDot={{ r: 2.5, fill: secondaryColor, stroke: "#000000" }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
