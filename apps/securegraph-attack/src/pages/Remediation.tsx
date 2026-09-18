import React, { useEffect, useState } from "react";
import { Pagination, DEFAULT_PAGE_SIZE } from "@sg/components/Pagination";
import DocLink from "@sg/components/DocLink";
import {
  Wrench,
  ShieldCheck,
  RefreshCw,
  ListChecks,
  FlaskConical,
  BookOpen,
  Loader2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { PageHeader, Card, SeverityBadge, VerificationBadge, EmptyState, PageSkeleton, ErrorState } from "@sg/ui";
import { api } from "@sg/api";
import { useResource } from "@sg/useResource";
import { cx, timeAgo } from "@sg/utils";
import type { Severity, VerificationStatus } from "@sg/types";

/**
 * AI remediation page (AV-16).
 *
 * Reads the verified-but-unresolved findings for the org and renders the
 * remediation artifact the AI engine produced beside each verdict: why it was
 * verified, how to reproduce it, the business impact, and the fix guidance.
 *
 * A finding only leaves this page when it is retested and confirmed fixed —
 * that is the backend's filter, not this component's.
 */

type RemediationBlock = {
  status?: string;
  summary?: string;
  steps?: string[];
  references?: string[];
  validation?: string;
  effort?: string | null;
  priority?: string | null;
  generated_by?: string;
  model?: string;
  confidence?: number;
};

type RemediationItem = {
  id: number;
  scan_job_id?: number | null;
  asset_id?: number | null;
  asset_value?: string | null;
  tool?: string | null;
  severity?: string | null;
  title?: string | null;
  description?: string | null;
  created_at?: string | null;
  verification?: {
    status?: string | null;
    verified_by?: string | null;
    why_verified?: string | null;
    reproducibility_steps?: string[];
    business_impact?: string | null;
  };
  remediation?: RemediationBlock;
};

type RemediationFeed = {
  items: RemediationItem[];
  counts: { total: number; ai_generated: number; pending: number };
  total: number;
};

const EMPTY: RemediationFeed = { items: [], counts: { total: 0, ai_generated: 0, pending: 0 }, total: 0 };

function priorityClass(priority?: string | null): string {
  switch ((priority || "").toLowerCase()) {
    case "immediate":
      return "text-severity-critical bg-severity-critical/10 border-severity-critical/30";
    case "scheduled":
      return "text-severity-medium bg-severity-medium/10 border-severity-medium/30";
    case "planned":
      return "text-severity-low bg-severity-low/10 border-severity-low/30";
    default:
      return "text-slate-400 bg-slate-400/10 border-slate-500/30";
  }
}

function numberedSteps(steps: string[] | undefined) {
  const list = Array.isArray(steps) ? steps.filter((s) => String(s).trim()) : [];
  if (list.length === 0) return null;
  return (
    <ol className="space-y-2">
      {list.map((step, i) => (
        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-300">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-phantix-600/50 bg-phantix-800/60 text-[11px] font-semibold text-phantix-200">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function RemediationCard({ item, onGenerated }: { item: RemediationItem; onGenerated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ver = item.verification || {};
  const rem = item.remediation || {};
  const generated = (rem.status || "") === "generated";
  const repro = Array.isArray(ver.reproducibility_steps) ? ver.reproducibility_steps : [];

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/scans/results/${item.id}/remediation`, {});
      onGenerated();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not queue generation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-phantix-800/50 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={(item.severity || "info") as Severity} />
            <VerificationBadge status={(ver.status || "unverified") as VerificationStatus} />
            {generated && rem.priority ? (
              <span className={cx("chip capitalize", priorityClass(rem.priority))}>{rem.priority}</span>
            ) : null}
            {generated && rem.effort ? (
              <span className="chip capitalize text-slate-400 bg-slate-400/10 border-slate-500/30">
                effort: {rem.effort}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 font-semibold text-slate-100">{item.title || "Untitled finding"}</h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {item.asset_value || "—"}
            {item.tool ? ` · ${item.tool}` : ""}
            {item.created_at ? ` · ${timeAgo(item.created_at)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {ver.verified_by ? (
            <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300" title="Verified by">
              <ShieldCheck size={12} /> {ver.verified_by}
            </span>
          ) : null}
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50"
            title="Queue AI remediation guidance for this finding"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {generated ? "Regenerate" : "Generate guidance"}
          </button>
        </div>
      </div>

      {item.description ? (
        <p className="border-b border-phantix-800/40 px-5 py-3 text-[13px] leading-relaxed text-slate-400">
          {item.description}
        </p>
      ) : null}

      <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
        {/* Why it is real — the verification artifact. */}
        <section className="space-y-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <ShieldCheck size={13} /> Why it was verified
          </p>
          <p className="text-[13px] leading-relaxed text-slate-300">
            {ver.why_verified || "No verification rationale recorded."}
          </p>

          <p className="flex items-center gap-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <FlaskConical size={13} /> Reproduce it
          </p>
          {numberedSteps(repro) || (
            <p className="text-[13px] text-slate-500">No reproduction steps recorded for this finding.</p>
          )}

          {ver.business_impact ? (
            <>
              <p className="flex items-center gap-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <AlertTriangle size={13} /> Business impact
              </p>
              <p className="text-[13px] leading-relaxed text-slate-300">{ver.business_impact}</p>
            </>
          ) : null}
        </section>

        {/* How to fix it — the remediation artifact. */}
        <section className="space-y-3 md:border-l md:border-phantix-800/40 md:pl-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Wrench size={13} /> How to fix it
          </p>
          {generated ? (
            <>
              {rem.summary ? (
                <p className="text-[13px] leading-relaxed text-slate-200">{rem.summary}</p>
              ) : null}
              {numberedSteps(rem.steps)}
              {rem.validation ? (
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
                    How to confirm the fix
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-emerald-100/90">{rem.validation}</p>
                </div>
              ) : null}
              {Array.isArray(rem.references) && rem.references.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <BookOpen size={13} className="text-slate-500" />
                  {rem.references.map((r, i) => (
                    <span key={i} className="chip border-slate-500/30 bg-slate-500/10 text-slate-400">
                      {r}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <Sparkles size={11} /> Generated by AI{rem.model ? ` · ${rem.model}` : ""}
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-phantix-700/40 bg-phantix-900/40 px-3 py-4 text-center">
              <Sparkles size={16} className="mx-auto text-phantix-300" />
              <p className="mt-1.5 text-[13px] text-slate-400">
                AI remediation guidance has not been generated for this finding yet.
              </p>
              <p className="text-[12px] text-slate-600">
                It is queued for the daily sweep, or generate it now above.
              </p>
            </div>
          )}
          {err ? <p className="text-[12px] text-severity-high">{err}</p> : null}
        </section>
      </div>
    </Card>
  );
}

export default function Remediation() {
  const { data, loading, error, reload } = useResource<RemediationFeed>(
    () => api.get<RemediationFeed>("/scans/remediation"),
    EMPTY,
    "attack:remediation",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const totalPages = Math.max(1, Math.ceil(data.items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = data.items.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Header refresh feedback: `useResource.reload` keeps the cached data (no
  // `loading` flip), so track the in-flight refresh locally. Cleared as soon as
  // a fresh payload lands; a timeout backstops a same-value error response.
  useEffect(() => {
    setRefreshing(false);
  }, [data]);
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    reload();
    window.setTimeout(() => setRefreshing(false), 6000);
  };

  if (loading && data.total === 0) return <PageSkeleton variant="list" rows={5} actions />;
  if (error && data.total === 0) return <ErrorState title="Remediation" body={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Remediation"
        description="Verified findings that are not yet retested and fixed. Each carries the AI verification rationale, reproduction steps, business impact and fix guidance."
        actions={
          <>
            <DocLink docId="howto-app-12" label="Remediation how-to" />
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="chip border-phantix-600/40 bg-phantix-800/50 text-slate-300">
          <ListChecks size={12} /> {data.counts.total} open
        </span>
        <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <ShieldCheck size={12} /> {data.counts.ai_generated} with AI guidance
        </span>
        {data.counts.pending > 0 ? (
          <span className="chip border-severity-medium/30 bg-severity-medium/10 text-severity-medium">
            <Sparkles size={12} /> {data.counts.pending} awaiting generation
          </span>
        ) : null}
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={22} />}
          title="Nothing to remediate"
          body="Every verified finding has been retested and fixed. New verified findings appear here until their fix is confirmed."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="space-y-4 p-4">
            {pageItems.map((item) => (
              <RemediationCard key={item.id} item={item} onGenerated={reload} />
            ))}
          </div>
          <Pagination
            totalItems={data.items.length}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}
    </div>
  );
}
