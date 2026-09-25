import { useEffect, useState } from "react";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import {
  type AssessmentAction,
  type AssessmentApp,
  type LatestAssessment,
  loadLatestAssessment,
} from "../assessments";
import { api } from "../api";
import { cx } from "../utils";

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEV_CLASS: Record<string, string> = {
  critical: "border-severity-critical/40 bg-severity-critical/10 text-severity-critical",
  high: "border-severity-high/40 bg-severity-high/10 text-severity-high",
  medium: "border-severity-medium/40 bg-severity-medium/10 text-severity-medium",
  low: "border-severity-low/40 bg-severity-low/10 text-severity-low",
  info: "border-phantix-600/40 bg-phantix-800/50 text-slate-400",
};

function when(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

/**
 * "From your last assessment" — one panel rendered by every app from the shared
 * `/assessments/latest` feed. `app` selects which action list leads; the findings
 * list is common. Renders nothing when there is no completed assessment.
 */
export default function LatestAssessmentPanel({
  app = "core",
  className,
  limit = 5,
}: {
  app?: AssessmentApp;
  className?: string;
  limit?: number;
}) {
  const [data, setData] = useState<LatestAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const runAction = async (a: AssessmentAction) => {
    if (!a.endpoint) return;
    setBusy(a.label);
    try {
      await api.post(a.endpoint, {});
      refresh();
    } catch {
      /* best-effort: the panel simply refreshes on the next load */
    } finally {
      setBusy(null);
    }
  };

  const refresh = () => {
    setLoading(true);
    void loadLatestAssessment()
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const summary = data?.assessment;
  if (!summary || (summary.findings_count ?? 0) === 0) return null;

  const actions = (data?.actions_by_app?.[app] ?? []).slice(0, limit);
  const findings = [...(data?.findings ?? [])]
    .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))
    .slice(0, limit);
  const counts = summary.severity_counts || {};

  return (
    <div className={cx("rounded-xl border border-phantix-700/40 bg-phantix-900/50 p-3", className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gold-400/25 bg-gold-400/10 text-gold-300">
          <ClipboardCheck size={13} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-slate-200">
            From your last assessment
            {data?.stale && <span className="ml-2 text-[12px] font-normal text-slate-500">stale</span>}
          </span>
          <span className="block text-[12px] text-slate-500">
            {summary.source.replace(/_/g, " ")} · {when(data?.as_of)} · {summary.findings_count} finding
            {summary.findings_count === 1 ? "" : "s"}
          </span>
        </span>
        <button
          type="button"
          onClick={refresh}
          className="rounded-md border border-phantix-700/50 p-1 text-slate-500 hover:text-gold-300"
          title="Refresh"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {Object.entries(counts)
          .filter(([, n]) => n > 0)
          .sort((a, b) => (SEV_ORDER[a[0]] ?? 9) - (SEV_ORDER[b[0]] ?? 9))
          .map(([sev, n]) => (
            <span key={sev} className={cx("rounded border px-1.5 py-0.5 text-[12px]", SEV_CLASS[sev] || SEV_CLASS.info)}>
              {n} {sev}
            </span>
          ))}
      </div>

      {actions.length > 0 && (
        <div className="mt-2">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Work to do here</p>
          <ul className="mt-1 space-y-0.5">
            {actions.map((a) => (
              <li key={`${a.kind}:${a.label}`} className="flex items-start gap-1.5 text-[12px] leading-snug text-slate-300">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-gold-400" />
                {a.href ? (
                  <a href={a.href} className="min-w-0 hover:text-gold-300 hover:underline">
                    {a.label}
                  </a>
                ) : a.endpoint ? (
                  <button
                    type="button"
                    disabled={busy === a.label}
                    onClick={() => void runAction(a)}
                    className="min-w-0 text-left hover:text-gold-300 disabled:opacity-50"
                  >
                    {busy === a.label ? "Working…" : a.label}
                  </button>
                ) : (
                  <span className="min-w-0">{a.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {findings.length > 0 && (
        <div className="mt-2">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Latest findings</p>
          <ul className="mt-1 space-y-0.5">
            {findings.map((f) => (
              <li key={f.id} className="flex items-center gap-1.5 text-[12px] text-slate-400">
                <span className={cx("rounded border px-1 text-[12px] uppercase", SEV_CLASS[f.severity] || SEV_CLASS.info)}>
                  {f.severity.slice(0, 4)}
                </span>
                {f.cvss?.base_score != null && (
                  <span
                    className="rounded border border-phantix-700/50 px-1 text-[12px] tabular-nums text-slate-400"
                    title={f.cvss.vector}
                  >
                    {f.cvss.base_score.toFixed(1)}
                  </span>
                )}
                {f.case_id ? (
                  <span
                    className="rounded border border-severity-critical/40 px-1 text-[12px] uppercase text-severity-critical"
                    title={`SOC incident #${f.case_id}`}
                  >
                    soc
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate" title={f.title}>
                  {f.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
