import React from "react";
import { SURFACES, SURFACE_LABELS, scoreTone, surfaceColor, type ChartTheme } from "./palette";
import { useTheme } from "@/lib/theme";
import { cx } from "@/lib/utils";

/*
 * Per-surface posture — five independent scores, one row.
 *
 * Deliberately not a chart. Five headline numbers are a KPI row; drawing them as
 * a five-bar bar chart would spend a chart slot to say less, and comparing five
 * ratios-against-100 is what a meter does better than an axis.
 *
 * Each tile carries a meter track (the ratio against its own limit of 100) in the
 * score's status colour, plus a small categorical dot that ties the tile to its
 * slice in the posture ring.
 */

export interface SurfaceScore {
  surface: string;
  score: number;
  total: number;
  reportable?: number;
  critical?: number;
  high?: number;
}

export default function SurfaceScoreRow({
  surfaces,
  onSelect,
  selected,
}: {
  surfaces: SurfaceScore[];
  onSelect?: (surface: string) => void;
  selected?: string | null;
}) {
  const { theme } = useTheme();
  const mode = (theme === "light" ? "light" : "dark") as ChartTheme;

  // Fixed surface order so a tile never moves when counts change.
  const byName = new Map(surfaces.map((s) => [String(s.surface).toLowerCase(), s]));
  const ordered = SURFACES.map(
    (name) => byName.get(name) ?? { surface: name, score: 100, total: 0 },
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ordered.map((s) => {
        const score = Number(s.score ?? 0);
        const tone = scoreTone(score);
        const isSelected = selected === s.surface;
        const untested = Number(s.total) === 0;
        return (
          <button
            key={s.surface}
            type="button"
            onClick={() => onSelect?.(s.surface)}
            className={cx(
              "card p-3 text-left transition-colors",
              onSelect && "hover:border-phantix-600/60",
              isSelected && "border-gold-400/40",
            )}
            aria-label={`${SURFACE_LABELS[s.surface]} posture ${score}`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: surfaceColor(s.surface, mode) }}
              />
              <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {SURFACE_LABELS[s.surface] ?? s.surface}
              </span>
            </div>

            <p className="mt-1.5 font-display text-2xl font-semibold leading-none" style={{ color: untested ? undefined : tone.color }}>
              {untested ? <span className="text-slate-600">—</span> : score}
            </p>

            {/* Meter: the ratio against the limit, on the same ramp as the value. */}
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-phantix-800">
              {!untested && (
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(2, Math.min(100, score))}%`, backgroundColor: tone.color }}
                />
              )}
            </div>

            <p className="mt-1.5 text-[10.5px] text-slate-500">
              {untested ? (
                "not assessed"
              ) : (
                <>
                  {s.total} open
                  {Number(s.critical) > 0 && (
                    <span className="text-severity-critical"> · {s.critical} critical</span>
                  )}
                </>
              )}
            </p>
          </button>
        );
      })}
    </div>
  );
}
