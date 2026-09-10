import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, ScanLine, ShieldCheck, Target } from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, Spinner, StatCard, PageBodySkeleton } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { EMPTY_GAPS, loadGapAnalysis, type ControlGap, type GapAnalysis } from "@/lib/complianceGrc";
import { cx } from "@/lib/utils";

// ── Compliance gap analysis ──────────────────────────────────────────────────
// GET /compliance/gaps maps the org's current findings onto framework controls
// and returns the controls nothing covers. Optionally scoped to one VAPT
// campaign, which is how you answer "did this engagement close the gap?".

const RISK_TONE: Record<string, string> = {
  critical: "border-severity-critical/30 bg-severity-critical/10 text-severity-critical",
  high: "border-severity-high/30 bg-severity-high/10 text-severity-high",
  medium: "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
  low: "border-severity-low/30 bg-severity-low/10 text-severity-low",
};

function text(v: unknown, fallback = "—"): string {
  return v == null || v === "" ? fallback : String(v);
}

export default function ComplianceGaps() {
  const [data, setData] = useState<GapAnalysis>(EMPTY_GAPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [framework, setFramework] = useState("all");

  const load = useCallback(async (campaign?: string) => {
    setLoading(true);
    setError(null);
    try {
      const id = Number(campaign);
      setData(await loadGapAnalysis(Number.isFinite(id) && id > 0 ? { campaignId: id } : {}));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? "Security storage is not activated, so findings cannot be read for mapping."
          : e instanceof Error ? e.message : "Failed to run gap analysis.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const frameworks = useMemo(() => {
    const set = new Set<string>(data.frameworks.map(String));
    for (const g of data.gaps) if (g.framework_id) set.add(String(g.framework_id));
    return ["all", ...[...set].sort()];
  }, [data]);

  const visible = useMemo(
    () => (framework === "all" ? data.gaps : data.gaps.filter((g) => String(g.framework_id) === framework)),
    [data.gaps, framework],
  );

  const byRisk = useMemo(() => {
    const out: Record<string, number> = {};
    for (const g of data.gaps) {
      const key = String(g.risk ?? "unrated").toLowerCase();
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }, [data.gaps]);

  return (
    <div>
      <PageHeader
        title="Compliance gaps"
        description="Your live findings mapped onto framework controls. What is left is the set of controls nothing in your current security posture demonstrates."
        actions={
          <div className="flex items-center gap-2">
            <input
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value.replace(/\D/g, ""))}
              placeholder="Campaign id (optional)"
              className="input w-44 !py-1.5 !text-xs"
              aria-label="Scope to a VAPT campaign"
            />
            <button onClick={() => void load(campaignId)} className="btn-secondary text-xs !py-2">
              <ScanLine size={13} className="mr-1.5 inline" /> Run
            </button>
            <button onClick={() => void load(campaignId)} className="btn-ghost text-xs !py-2" title="Refresh">
              <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
            </button>
          </div>
        }
      />

      {loading && !data.gaps.length ? (
        <PageBodySkeleton stats={4} variant="section" rows={4} />
      ) : error ? (
        <ErrorState title="Gap analysis unavailable" body={error} onRetry={() => void load(campaignId)} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Open gaps" value={String(data.gaps.length)} icon={<AlertTriangle size={18} />} hint="controls not demonstrated" />
            <StatCard label="Controls touched" value={String(data.controls_touched.length)} icon={<ShieldCheck size={18} />} hint="covered by findings" />
            <StatCard label="Findings mapped" value={String(data.findings_in)} icon={<Target size={18} />} hint="fed into the mapping" />
            <StatCard label="Frameworks" value={String(data.frameworks.length)} icon={<ShieldCheck size={18} />} hint={data.frameworks.join(", ") || "none resolved"} />
          </div>

          {Object.keys(byRisk).length > 0 && (
            <Card>
              <CardHeader title="Gaps by risk" subtitle="Where the uncovered controls concentrate" />
              <div className="flex flex-wrap gap-2">
                {Object.entries(byRisk)
                  .sort((a, b) => b[1] - a[1])
                  .map(([risk, count]) => (
                    <span key={risk} className={cx("chip capitalize", RISK_TONE[risk] ?? "border-phantix-700 text-slate-400")}>
                      {risk} · {count}
                    </span>
                  ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Uncovered controls"
              subtitle={`${visible.length} shown${data.gaps.length !== visible.length ? ` of ${data.gaps.length}` : ""}`}
              action={
                <div className="flex flex-wrap gap-1.5">
                  {frameworks.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFramework(f)}
                      className={cx(
                        "chip uppercase transition-colors",
                        framework === f ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-phantix-700 text-slate-400 hover:text-slate-200",
                      )}
                    >
                      {f === "all" ? "All" : f}
                    </button>
                  ))}
                </div>
              }
            />
            {!visible.length ? (
              <EmptyState
                icon={<ShieldCheck size={22} />}
                title={data.gaps.length ? "No gaps in this framework" : "No gaps found"}
                body={
                  data.gaps.length
                    ? "Every control in this framework is demonstrated by at least one finding."
                    : "Either your findings cover every mapped control, or no findings have been collected yet."
                }
              />
            ) : (
              <div className="space-y-2">
                {visible.map((g, i) => <GapRow key={`${g.framework_id}-${g.control_id}-${i}`} gap={g} />)}
              </div>
            )}
          </Card>

          {data.recommendations.length > 0 && (
            <Card>
              <CardHeader title="Recommended remediation" subtitle={`${data.recommendations.length} suggestions derived from the mapping`} />
              <div className="space-y-2">
                {data.recommendations.slice(0, 25).map((r, i) => {
                  const rec = (r ?? {}) as Record<string, unknown>;
                  return (
                    <div key={i} className="rounded-md border border-phantix-700 bg-phantix-900/60 p-3">
                      <p className="text-sm text-slate-200">
                        {text(rec.title ?? rec.recommendation ?? rec.action ?? rec.summary, "Recommendation")}
                      </p>
                      {(rec.detail ?? rec.description) != null && (
                        <p className="mt-1 text-xs leading-5 text-slate-400">{text(rec.detail ?? rec.description)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function GapRow({ gap }: { gap: ControlGap }) {
  const risk = String(gap.risk ?? "").toLowerCase();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-phantix-700 bg-phantix-900/60 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200">{text(gap.title ?? gap.control_id, "Untitled control")}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {gap.framework_id && <span className="chip border-phantix-700 uppercase text-phantix-300">{String(gap.framework_id)}</span>}
          {gap.control_id && <span className="chip border-phantix-700 font-mono text-slate-400">{String(gap.control_id)}</span>}
          {gap.category && <span className="chip border-phantix-700 text-slate-400">{String(gap.category)}</span>}
        </div>
      </div>
      {risk && <span className={cx("chip shrink-0 capitalize", RISK_TONE[risk] ?? "border-phantix-700 text-slate-400")}>{risk}</span>}
    </div>
  );
}
