import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "@/lib/theme";
import ChartFrame, { tooltipStyles } from "./ChartFrame";
import { SURFACE_LABELS, scoreTone, surfaceColor, type ChartTheme } from "./palette";

/*
 * Posture across all surfaces.
 *
 * A note on the form, because it is easy to get wrong: five posture *scores* are
 * five independent ratios out of 100. They do not sum to anything, so a pie of
 * scores would be meaningless — the slices would encode no quantity. What *is*
 * part-to-whole is where the open findings actually are, so that is what the ring
 * encodes, with the overall posture score as the hero figure in the hole.
 *
 * One object, two honest readings: "how are we doing" (the number) and "where is
 * the exposure" (the ring). Colour is categorical — surface identity — from the
 * validated theme, and every slice is legended with its count so identity never
 * rests on hue alone.
 */

export interface SurfaceDatum {
  surface: string;
  score: number;
  total: number;
  reportable?: number;
  critical?: number;
  high?: number;
}

export default function PostureDonut({
  surfaces,
  overallScore,
  height = 208,
}: {
  surfaces: SurfaceDatum[];
  overallScore: number | null | undefined;
  height?: number;
}) {
  const { theme } = useTheme();
  const mode = (theme === "light" ? "light" : "dark") as ChartTheme;

  const slices = surfaces
    .filter((s) => Number(s.total) > 0)
    .map((s) => ({
      key: s.surface,
      name: SURFACE_LABELS[s.surface] ?? s.surface,
      value: Number(s.total) || 0,
      color: surfaceColor(s.surface, mode),
    }));

  const totalFindings = slices.reduce((n, s) => n + s.value, 0);
  const tone = scoreTone(Number(overallScore ?? 0));
  const tips = tooltipStyles(mode);

  return (
    <ChartFrame
      title="Posture across all surfaces"
      subtitle={
        totalFindings
          ? `${totalFindings} open findings · ring shows where they are`
          : "No open findings recorded"
      }
      legend={slices.map((s) => ({ key: s.key, label: s.name, color: s.color, value: s.value }))}
      tableHead={["Surface", "Open findings", "Score"]}
      tableRows={surfaces.map((s) => [
        SURFACE_LABELS[s.surface] ?? s.surface,
        Number(s.total) || 0,
        Number(s.score ?? 0),
      ])}
    >
      <div className="relative" style={{ height }}>
        {slices.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <span className="font-display text-4xl font-semibold" style={{ color: tone.color }}>
              {overallScore ?? "—"}
            </span>
            <span className="mt-1 text-[11px] text-slate-500">nothing outstanding</span>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="88%"
                  /* 2px of surface between segments, so adjacent hues never touch. */
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...tips}
                  formatter={(value: number, name: string) => [`${value} open`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Hero figure in the hole — the one number the dashboard leads with. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[34px] font-semibold leading-none" style={{ color: tone.color }}>
                {overallScore ?? "—"}
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {tone.label}
              </span>
            </div>
          </>
        )}
      </div>
    </ChartFrame>
  );
}
