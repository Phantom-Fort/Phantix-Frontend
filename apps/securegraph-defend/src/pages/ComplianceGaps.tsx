import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ScanLine, ShieldCheck, Target } from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, StatCard, PageBodySkeleton } from "@sg/ui";
import { api, ApiError } from "@sg/api";
import { EMPTY_GAPS, loadGapAnalysis, type ControlGap, type GapAnalysis } from "@sg/complianceGrc";
import { useStore } from "@sg/store";
import { cx } from "@sg/utils";
import DocLink from "@sg/components/DocLink";
import { Pagination, usePaged } from "@sg/components/Pagination";

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
  const { toast } = useStore();
  const [mapping, setMapping] = useState<any>(null);
  const [mappingBusy, setMappingBusy] = useState(false);

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
  const { pageItems: gapPageItems, pagination: gapPagination } = usePaged(visible, "defend-compliance-gaps", framework);

  const byRisk = useMemo(() => {
    const out: Record<string, number> = {};
    for (const g of data.gaps) {
      const key = String(g.risk ?? "unrated").toLowerCase();
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }, [data.gaps]);

  // Explicit findings→controls mapping (POST /compliance/map). The gaps view
  // already maps implicitly; this records/returns the mapping the org asked for.
  const runMapping = async () => {
    setMappingBusy(true);
    try {
      const id = Number(campaignId);
      const res = await api.post<any>("/compliance/map", {
        use_org_findings: true,
        campaign_id: Number.isFinite(id) && id > 0 ? id : undefined,
        frameworks: framework !== "all" ? [framework] : undefined,
      });
      setMapping(res);
      toast(
        "success",
        "Findings mapped",
        `${res?.findings_in ?? 0} finding(s) mapped across ${(res?.frameworks || []).length || 0} framework(s).`,
      );
    } catch (e: any) {
      toast("error", "Mapping failed", e?.message || "");
    } finally {
      setMappingBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Compliance gaps"
        description="Your live findings mapped onto framework controls."
        actions={<>
            <DocLink docId="howto-app-24" label="Compliance review how-to" />
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
            <button onClick={() => void runMapping()} disabled={mappingBusy} className="btn-ghost text-xs !py-2" title="Map findings to controls">
              {mappingBusy ? <RefreshCw size={13} className="mr-1.5 inline animate-spin" /> : <Target size={13} className="mr-1.5 inline" />} Map findings
            </button>
            <button onClick={() => void load(campaignId)} className="btn-ghost text-xs !py-2" title="Refresh">
              <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
            </button>
          </div>
        </>}
      />

      {loading && !data.gaps.length ? (
        <PageBodySkeleton stats={4} variant="section" rows={4} />
      ) : error ? (
        <ErrorState title="Gap analysis unavailable" body={error} onRetry={() => void load(campaignId)} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Open gaps" value={String(data.gaps.length)} hint="controls not demonstrated" />
            <StatCard label="Controls touched" value={String(data.controls_touched.length)} hint="covered by findings" />
            <StatCard label="Findings mapped" value={String(data.findings_in)} hint="fed into the mapping" />
            <StatCard label="Frameworks" value={String(data.frameworks.length)} hint={data.frameworks.join(", ") || "none resolved"} />
          </div>

          {mapping && (
            <div className="rounded-md border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-xs text-gold-200">
              Mapped <strong>{mapping.findings_in ?? 0}</strong> finding(s) →{" "}
              <strong>{mapping.mappings?.length ?? mapping.summary?.mapping_rows ?? 0}</strong> control mapping(s)
              {Array.isArray(mapping.frameworks) && mapping.frameworks.length > 0
                ? ` across ${mapping.frameworks.join(", ")}`
                : ""}
              .
            </div>
          )}

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
            />
            {/* Full-width, wrapping framework filter. It previously lived in the
                CardHeader `action` slot, which is shrink-0 and so never wrapped —
                more than a couple of frameworks overflowed the card header. */}
            {frameworks.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
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
            )}
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
              <div className="-mx-5 -mb-5 border-t border-phantix-700/40">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-phantix-700/40">
                        <th className="th">Control</th>
                        <th className="th">Framework</th>
                        <th className="th">Reference</th>
                        <th className="th hidden md:table-cell">Category</th>
                        <th className="th">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapPageItems.map((g, i) => <GapRow key={`${g.framework_id}-${g.control_id}-${i}`} gap={g} />)}
                    </tbody>
                  </table>
                </div>
                <Pagination {...gapPagination} itemLabel="controls" />
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
    <tr className="h-10 border-b border-phantix-800/40 hover:bg-phantix-800/35">
      <td className="td max-w-[26rem]">
        <span className="block truncate font-medium text-slate-100" title={text(gap.title ?? gap.control_id, "Untitled control")}>
          {text(gap.title ?? gap.control_id, "Untitled control")}
        </span>
      </td>
      <td className="td whitespace-nowrap text-[13px] uppercase text-phantix-300">{gap.framework_id ? String(gap.framework_id) : "—"}</td>
      <td className="td whitespace-nowrap font-mono text-[13px] text-slate-400">{gap.control_id ? String(gap.control_id) : "—"}</td>
      <td className="td hidden whitespace-nowrap text-[13px] text-slate-400 md:table-cell">{gap.category ? String(gap.category) : "—"}</td>
      <td className="td whitespace-nowrap">
        {risk ? <span className={cx("chip capitalize", RISK_TONE[risk] ?? "border-phantix-700 text-slate-400")}>{risk}</span> : <span className="text-slate-600">—</span>}
      </td>
    </tr>
  );
}
