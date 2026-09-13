import React from "react";
import {
  Clipboard, Crosshair, Eye, FileText, Gauge, ListChecks, Scale, Shield, Terminal, Loader2, Play,
} from "lucide-react";
import { Card, EmptyState, Spinner } from "@/components/ui";
import type { ReportTypeEntry } from "@/lib/types";
import { cx } from "@/lib/utils";

/*
 * Report solutions — pick the report by the question it answers.
 *
 * The library lists artifacts that already exist; this lists what the platform
 * can produce and who each one is for, because "generate a report" is only a
 * useful action once you know which of eight you meant. Featured types come
 * first and are the ones most organizations want; the rest stay one row down
 * rather than behind a dropdown.
 *
 * The catalog is served by GET /reports/types, so a report type added in the
 * backend appears here without a frontend change — and the section list shown
 * on each card is the assembler's own, so a card can never advertise a chapter
 * the report will not contain.
 */

const ICONS: Record<string, React.ReactNode> = {
  shield: <Shield size={15} />,
  crosshair: <Crosshair size={15} />,
  scale: <Scale size={15} />,
  gauge: <Gauge size={15} />,
  clipboard: <Clipboard size={15} />,
  terminal: <Terminal size={15} />,
  "file-text": <FileText size={15} />,
  "list-checks": <ListChecks size={15} />,
};

function SectionChips({ sections }: { sections: string[] }) {
  const shown = sections.slice(0, 4);
  return (
    <div className="mt-2.5 flex flex-wrap gap-1">
      {shown.map((s) => (
        <span key={s} className="chip !px-1.5 !py-0 border-phantix-700/40 bg-phantix-900/60 text-[9.5px] text-slate-500">
          {s.replace(/_/g, " ")}
        </span>
      ))}
      {sections.length > shown.length && (
        <span className="chip !px-1.5 !py-0 border-phantix-700/40 text-[9.5px] text-slate-600">
          +{sections.length - shown.length}
        </span>
      )}
    </div>
  );
}

function TypeCard({
  entry,
  busy,
  onGenerate,
}: {
  entry: ReportTypeEntry;
  busy: boolean;
  onGenerate: (entry: ReportTypeEntry) => void;
}) {
  return (
    <div className={cx("card flex flex-col p-4", entry.featured && "border-gold-400/25")}>
      <div className="flex items-start gap-2.5">
        <span
          className={cx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            entry.featured ? "bg-gold-400/10 text-gold-300" : "bg-phantix-800/70 text-slate-400",
          )}
        >
          {ICONS[entry.icon ?? ""] ?? <FileText size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold leading-5 text-slate-100">{entry.title}</h3>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {entry.audience}
          </p>
        </div>
      </div>

      <p className="mt-2.5 flex-1 text-[11.5px] leading-5 text-slate-400">{entry.use_case}</p>
      <SectionChips sections={entry.sections} />

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-phantix-800/60 pt-2.5">
        <span className="text-[10.5px] text-slate-600">
          {entry.section_count} sections
          {entry.requires_campaign && " · needs a campaign"}
        </span>
        <button
          className={entry.featured ? "btn-primary !px-2.5 !py-1 !text-[11px]" : "btn-secondary !px-2.5 !py-1 !text-[11px]"}
          disabled={busy}
          onClick={() => onGenerate(entry)}
        >
          {busy ? <Loader2 size={11} className="mr-1 inline animate-spin" /> : <Play size={11} className="mr-1 inline" />}
          Generate
        </button>
      </div>
    </div>
  );
}

export interface RecentReport {
  id: number;
  title?: string;
  report_type?: string;
  report_version?: number;
  status?: string;
  created_at?: string;
}

export default function ReportSolutions({
  types,
  loading,
  busyType,
  onGenerate,
  recent = [],
  onView,
}: {
  types: ReportTypeEntry[];
  loading?: boolean;
  busyType?: string | null;
  onGenerate: (entry: ReportTypeEntry) => void;
  /** Latest generated report per type — the readily-viewable set. */
  recent?: RecentReport[];
  onView?: (report: RecentReport) => void;
}) {
  if (loading) {
    return (
      <Card>
        <div className="p-6">
          <Spinner />
        </div>
      </Card>
    );
  }
  if (!types.length) {
    return (
      <Card>
        <EmptyState
          icon={<FileText size={22} />}
          title="No report types available"
          body="The reporting engine did not return a catalog. Existing reports are still listed under Report library."
        />
      </Card>
    );
  }

  const featured = types.filter((t) => t.featured);
  const rest = types.filter((t) => !t.featured);
  const titleFor = (rtype?: string) =>
    types.find((t) => t.report_type === rtype)?.title ?? rtype ?? "Report";

  return (
    <div className="space-y-5">
      {/* Ready to read. Generating is the slow path; the newest of each type is
          one click from here so the common case never runs a report at all. */}
      {recent.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Ready to view
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map((r) => (
              <button
                key={r.id}
                onClick={() => onView?.(r)}
                className="card flex items-center gap-2.5 p-3 text-left transition-colors hover:border-phantix-600/60"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-phantix-800/70 text-slate-400">
                  <Eye size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-slate-200">
                    {titleFor(r.report_type)}
                  </span>
                  <span className="block truncate text-[10.5px] text-slate-500">
                    v{r.report_version ?? 1}
                    {r.status && r.status !== "complete" ? ` · ${r.status}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Most used
          </h2>
          <p className="text-[10.5px] text-slate-600">Generated on demand from live engine data</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {featured.map((entry) => (
            <TypeCard
              key={entry.report_type}
              entry={entry}
              busy={busyType === entry.report_type}
              onGenerate={onGenerate}
            />
          ))}
        </div>
      </section>

      {rest.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            More report types
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {rest.map((entry) => (
              <TypeCard
                key={entry.report_type}
                entry={entry}
                busy={busyType === entry.report_type}
                onGenerate={onGenerate}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
