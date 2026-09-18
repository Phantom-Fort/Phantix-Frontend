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
  Eye,
} from "lucide-react";
import { PageHeader, Card, Modal, SeverityBadge, VerificationBadge, EmptyState, PageSkeleton, ErrorState } from "@sg/ui";
import { api } from "@sg/api";
import { useResource } from "@sg/useResource";
import { cx, timeAgo } from "@sg/utils";
import type { Severity, VerificationStatus } from "@sg/types";

/**
 * AI remediation page (AV-16).
 *
 * Reads the verified-but-unresolved findings for the org and renders, beside
 * each verdict, why it was verified, how to reproduce it, and its business
 * impact. The AI *fix guidance* opens in an overlay so the list stays scannable.
 *
 * Generation is asynchronous: POST enqueues a job, so after queuing we poll the
 * feed until the guidance actually lands (a fresh generate flips status to
 * "generated"; a regenerate changes the artifact) — then the overlay opens.
 * A finding only leaves this page when it is retested and confirmed fixed.
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

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function isGenerated(rem?: RemediationBlock): boolean {
  return (rem?.status || "") === "generated";
}

/** A stable signature of the fix artifact, so we can tell when a (re)generation
 *  actually produced new guidance rather than just re-queuing the same job. */
function remediationSignature(rem?: RemediationBlock): string {
  return JSON.stringify({
    status: rem?.status ?? "",
    summary: rem?.summary ?? "",
    steps: rem?.steps ?? [],
    validation: rem?.validation ?? "",
    references: rem?.references ?? [],
  });
}

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

function RemediationCard({
  item,
  generating,
  onGenerate,
  onView,
}: {
  item: RemediationItem;
  generating: boolean;
  onGenerate: (item: RemediationItem) => void;
  onView: (item: RemediationItem) => void;
}) {
  const ver = item.verification || {};
  const rem = item.remediation || {};
  const generated = isGenerated(rem);
  const repro = Array.isArray(ver.reproducibility_steps) ? ver.reproducibility_steps : [];

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
        {ver.verified_by ? (
          <span className="chip shrink-0 border-emerald-400/30 bg-emerald-400/10 text-emerald-300" title="Verified by">
            <ShieldCheck size={12} /> {ver.verified_by}
          </span>
        ) : null}
      </div>

      {item.description ? (
        <p className="border-b border-phantix-800/40 px-5 py-3 text-[13px] leading-relaxed text-slate-400">
          {item.description}
        </p>
      ) : null}

      {/* Why it is real — the verification artifact stays inline as list context. */}
      <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
        <section className="space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <ShieldCheck size={13} /> Why it was verified
          </p>
          <p className="text-[13px] leading-relaxed text-slate-300">
            {ver.why_verified || "No verification rationale recorded."}
          </p>
          {ver.business_impact ? (
            <>
              <p className="flex items-center gap-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <AlertTriangle size={13} /> Business impact
              </p>
              <p className="text-[13px] leading-relaxed text-slate-300">{ver.business_impact}</p>
            </>
          ) : null}
        </section>
        <section className="space-y-2 md:border-l md:border-phantix-800/40 md:pl-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <FlaskConical size={13} /> Reproduce it
          </p>
          {numberedSteps(repro) || (
            <p className="text-[13px] text-slate-500">No reproduction steps recorded for this finding.</p>
          )}
        </section>
      </div>

      {/* Fix guidance lives in the overlay — the row here summarizes + opens it. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-phantix-800/40 bg-phantix-950/40 px-5 py-3">
        <p className="flex items-center gap-1.5 text-[12px] text-slate-500">
          <Wrench size={13} className="text-slate-500" />
          {generating
            ? "Generating fix guidance…"
            : generated
            ? "AI fix guidance is ready."
            : "No AI fix guidance yet — queued for the daily sweep, or generate it now."}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {generated && !generating ? (
            <button type="button" onClick={() => onView(item)} className="btn-primary !px-3 !py-1.5 text-xs">
              <Eye size={13} /> View guidance
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onGenerate(item)}
            disabled={generating}
            className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50"
            title="Queue AI remediation guidance for this finding"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {generated ? "Regenerate" : "Generate guidance"}
          </button>
        </div>
      </div>
    </Card>
  );
}

function GuidanceModal({
  item,
  generating,
  onRegenerate,
  onClose,
}: {
  item: RemediationItem;
  generating: boolean;
  onRegenerate: (item: RemediationItem) => void;
  onClose: () => void;
}) {
  const rem = item.remediation || {};
  return (
    <Modal open onClose={onClose} title={`How to fix — ${item.title || "finding"}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={(item.severity || "info") as Severity} />
          {rem.priority ? (
            <span className={cx("chip capitalize", priorityClass(rem.priority))}>{rem.priority}</span>
          ) : null}
          {rem.effort ? (
            <span className="chip capitalize text-slate-400 bg-slate-400/10 border-slate-500/30">effort: {rem.effort}</span>
          ) : null}
          <span className="ml-auto">
            <button
              type="button"
              onClick={() => onRegenerate(item)}
              disabled={generating}
              className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
            </button>
          </span>
        </div>

        {rem.summary ? <p className="text-[13px] leading-relaxed text-slate-200">{rem.summary}</p> : null}

        {numberedSteps(rem.steps) || (
          <p className="text-[13px] text-slate-500">No remediation steps were produced for this finding.</p>
        )}

        {rem.validation ? (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">How to confirm the fix</p>
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
      </div>
    </Modal>
  );
}

export default function Remediation() {
  const { data, loading, error, reload, setData } = useResource<RemediationFeed>(
    () => api.get<RemediationFeed>("/scans/remediation"),
    EMPTY,
    "attack:remediation",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(data.items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = data.items.slice((safePage - 1) * pageSize, safePage * pageSize);
  const viewingItem = viewingId != null ? data.items.find((i) => i.id === viewingId) ?? null : null;

  // Header refresh feedback: `useResource.reload` keeps cached data (no `loading`
  // flip), so track the in-flight refresh locally; cleared when fresh data lands.
  useEffect(() => {
    setRefreshing(false);
  }, [data]);
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    reload();
    window.setTimeout(() => setRefreshing(false), 6000);
  };

  // Generation is async: queue the job, then poll the feed until this finding's
  // guidance actually changes (fresh generate → status "generated"; regenerate →
  // artifact differs). On success push the fresh feed and open the overlay.
  async function generate(item: RemediationItem) {
    if (generatingId != null) return;
    const baseline = remediationSignature(item.remediation);
    setGeneratingId(item.id);
    setGenError(null);
    try {
      await api.post(`/scans/results/${item.id}/remediation`, {});
      for (let attempt = 0; attempt < 20; attempt++) {
        await sleep(3000);
        let feed: RemediationFeed;
        try {
          feed = await api.get<RemediationFeed>("/scans/remediation");
        } catch {
          continue; // transient — keep polling
        }
        const fresh = feed.items.find((x) => x.id === item.id);
        const changed =
          fresh && isGenerated(fresh.remediation) && remediationSignature(fresh.remediation) !== baseline;
        if (changed) {
          setData(feed);
          setViewingId(item.id); // open the guidance overlay when it lands
          return;
        }
      }
      // Timed out waiting for the worker — refresh once so any late result shows.
      reload();
      setGenError("Guidance is taking longer than usual. It will appear here when the worker finishes.");
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "Could not queue generation");
    } finally {
      setGeneratingId(null);
    }
  }

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

      {genError ? (
        <p className="flex items-center gap-1.5 text-[12px] text-severity-high">
          <AlertTriangle size={13} /> {genError}
        </p>
      ) : null}

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
              <RemediationCard
                key={item.id}
                item={item}
                generating={generatingId === item.id}
                onGenerate={generate}
                onView={(it) => setViewingId(it.id)}
              />
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

      {viewingItem ? (
        <GuidanceModal
          item={viewingItem}
          generating={generatingId === viewingItem.id}
          onRegenerate={generate}
          onClose={() => setViewingId(null)}
        />
      ) : null}
    </div>
  );
}
