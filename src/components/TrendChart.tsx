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

/** Compact dark-themed area time-series used across dashboards. */
export default function TrendChart({ points, color = "#E8B54D", secondaryColor = "#F43F5E", height = 180 }: Props) {
  const data = points.map((p) => ({
    label: p.label,
    value: p.value,
    ...(p.secondary != null ? { secondary: p.secondary } : {}),
  }));
  const id = `trend-fill-${color.replace("#", "")}`;
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
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#64748B", fontSize: 10 }}
          axisLine={{ stroke: "rgba(148,163,184,0.15)" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          tick={{ fill: "#64748B", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={42}
          domain={["auto", "auto"]}
        />
        <Tooltip
          cursor={{ stroke: "rgba(232,181,77,0.35)", strokeWidth: 1 }}
          contentStyle={{
            background: "rgba(10,14,22,0.95)",
            border: "1px solid rgba(124,140,248,0.25)",
            borderRadius: 10,
            fontSize: 12,
            padding: "6px 10px",
          }}
          labelStyle={{ color: "#94A3B8", fontSize: 11, marginBottom: 2 }}
          itemStyle={{ color: "#F1F5F9" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${id})`}
          dot={false}
          activeDot={{ r: 3.5, fill: color, stroke: "#0B1220" }}
        />
        {hasSecondary && (
          <Area
            type="monotone"
            dataKey="secondary"
            name="critical+high"
            stroke={secondaryColor}
            strokeWidth={1.6}
            strokeDasharray="4 3"
            fill="none"
            dot={false}
            activeDot={{ r: 3, fill: secondaryColor, stroke: "#0B1220" }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
