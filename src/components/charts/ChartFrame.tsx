import React, { useState } from "react";
import { Table2, BarChart3 } from "lucide-react";
import { cx } from "@/lib/utils";

/*
 * The shell every chart on the dashboard shares: title, an optional control row,
 * a legend, and a table view.
 *
 * The table is not a nicety. The categorical hues this app uses clear every
 * contrast gate on the dark surface but sit at 2.2–2.8:1 on the light one, and
 * that WARN obligates relief — visible labels or a table. Shipping the toggle
 * once here means no individual chart can forget it.
 */

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  value?: number | string;
}

export default function ChartFrame({
  title,
  subtitle,
  legend,
  controls,
  tableRows,
  tableHead,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Present whenever there are 2+ series — identity must never be colour alone. */
  legend?: LegendItem[];
  controls?: React.ReactNode;
  /** Rows for the table view. Omit only for a chart with a single series. */
  tableRows?: Array<Array<string | number>>;
  tableHead?: string[];
  children: React.ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const canTable = Boolean(tableRows && tableRows.length && tableHead?.length);

  return (
    <div className={cx("card flex flex-col p-4", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[13px] font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {controls}
          {canTable && (
            <button
              onClick={() => setAsTable((v) => !v)}
              className="btn-ghost !px-2 !py-1 !text-[11px]"
              title={asTable ? "Show the chart" : "Show the numbers"}
              aria-label={asTable ? "Show the chart" : "Show the numbers"}
            >
              {asTable ? <BarChart3 size={12} /> : <Table2 size={12} />}
            </button>
          )}
        </div>
      </div>

      {asTable && canTable ? (
        <div className="max-h-[240px] overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-phantix-700/40">
                {tableHead!.map((h) => (
                  <th key={h} className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows!.map((row, i) => (
                <tr key={i} className="border-b border-phantix-800/50 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className={cx("px-2 py-1.5 text-[11.5px]", j === 0 ? "text-slate-300" : "font-mono text-slate-400")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="min-w-0 flex-1">{children}</div>
      )}

      {legend && legend.length > 1 && !asTable && (
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-phantix-800/60 pt-2.5">
          {legend.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5">
              {/* The swatch carries identity; the text stays ink, never the series colour. */}
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-[10.5px] text-slate-400">{item.label}</span>
              {item.value != null && (
                <span className="font-mono text-[10.5px] text-slate-500">{item.value}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Shared tooltip: one row per hovered mark, label + value, never bare colour. */
export function tooltipStyles(theme: "dark" | "light") {
  const bg = theme === "dark" ? "#0A0A0A" : "#FFFFFF";
  const border = theme === "dark" ? "#3F3F46" : "#D4D4D8";
  const ink = theme === "dark" ? "#E4E4E7" : "#18181B";
  return {
    contentStyle: {
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 6,
      fontSize: 11.5,
      color: ink,
      padding: "6px 9px",
    },
    labelStyle: { color: ink, fontWeight: 600, marginBottom: 2 },
    itemStyle: { color: ink },
  } as const;
}
