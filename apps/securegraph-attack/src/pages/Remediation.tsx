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
  Eye, ChevronRight } from "lucide-react";
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

function isGenerated(rem?: RemediationBlock): boolean {
  return (rem?.status || "") === "generated";
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
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-phantix-600/50 bg-phantix-800/60 text-[12px] font-semibold text-phantix-200">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function RemediationRow({
  item,
  open,
  onToggle,
  generating,
  onGenerate,
  onView,
}: {
  item: RemediationItem;
  open: boolean;
  onToggle: () => void;
  generating: boolean;
  onGenerate: (item: RemediationItem) => void;
  onView: (item: RemediationItem) => void;
}) {
  const ver = item.verification || {};
  const rem = item.remediation || {};
  const generated = isGenerated(rem);
  const repro = Array.isArray(ver.reproducibility_steps) ? ver.reproducibility_steps : [];

  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={open}
        className={cx("group h-10 cursor-pointer border-b border-phantix-800/40 transition-colors hover:bg-phantix-800/35", open && "bg-phantix-800/25")}
      >
        <td className="td w-8 pr-0 text-slate-500">
          <ChevronRight size={14} className={cx("transition-transform", open && "rotate-90 text-gold-300")} aria-hidden="true" />
        </td>
        <td className="td max-w-[22rem]">
          <span className="block truncate font-medium text-slate-100" title={item.title || undefined}>{item.title || "Untitled finding"}</span>
        </td>
        <td className="td whitespace-nowrap"><SeverityBadge severity={(item.severity || "info") as Severity} /></td>
        <td className="td hidden whitespace-nowrap lg:table-cell"><VerificationBadge status={(ver.status || "unverified") as VerificationStatus} /></td>
        <td className="td max-w-[14rem]">
          <span className="block truncate font-mono text-[13px] text-slate-400" title={item.asset_value || undefined}>{item.asset_value || "—"}</span>
        </td>
        <td className="td hidden whitespace-nowrap text-[13px] text-slate-400 xl:table-cell">{item.tool || "—"}</td>
        <td className="td hidden whitespace-nowrap xl:table-cell">
          {generated && rem.priority ? <span className={cx("chip capitalize", priorityClass(rem.priority))}>{rem.priority}</span> : <span className="text-slate-600">—</span>}
        </td>
        <td className="td hidden whitespace-nowrap text-[13px] capitalize text-slate-400 2xl:table-cell">{generated && rem.effort ? rem.effort : "—"}</td>
        <td className="td hidden whitespace-nowrap text-[13px] text-slate-400 lg:table-cell">{item.created_at ? timeAgo(item.created_at) : "—"}</td>
        <td className="td whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
          <span className="inline-flex items-center justify-end gap-1">
            {generated && !generating ? (
              <button type="button" onClick={() => onView(item)} className="rounded px-2 py-0 text-[13px] font-medium leading-6 text-gold-300 hover:bg-gold-400/10">
                View fix
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onGenerate(item)}
              disabled={generating}
              className="inline-flex items-center gap-1 rounded px-2 py-0 text-[13px] leading-6 text-slate-400 hover:bg-phantix-800 hover:text-slate-100 disabled:opacity-50"
              title={generated ? "Regenerate AI fix guidance" : "Generate AI fix guidance now"}
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {generating ? "Generating" : generated ? "Regenerate" : "Generate"}
            </button>
          </span>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-phantix-800/40 bg-phantix-950/40">
          <td colSpan={10} className="px-5 py-4">
            {item.description ? (
              <p className="mb-3 text-[13px] leading-relaxed text-slate-400">{item.description}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <section className="space-y-2">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-300">
                  <ShieldCheck size={13} /> Why it was verified
                  {ver.verified_by ? <span className="font-normal text-slate-500">· by {ver.verified_by}</span> : null}
                </p>
                <p className="text-[13px] leading-relaxed text-slate-300">{ver.why_verified || "No verification rationale recorded."}</p>
                {ver.business_impact ? (
                  <>
                    <p className="flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-slate-300">
                      <AlertTriangle size={13} /> Business impact
                    </p>
                    <p className="text-[13px] leading-relaxed text-slate-300">{ver.business_impact}</p>
                  </>
                ) : null}
              </section>
              <section className="space-y-2 md:border-l md:border-phantix-800/40 md:pl-4">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-300">
                  <FlaskConical size={13} /> Reproduce it
                </p>
                {numberedSteps(repro) || <p className="text-[13px] text-slate-500">No reproduction steps recorded for this finding.</p>}
              </section>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-slate-500">
              <Wrench size={13} />
              {generating ? "Generating fix guidance…" : generated ? "AI fix guidance is ready — open it with View fix." : "No AI fix guidance yet — queued for the daily sweep, or generate it now."}
            </p>
          </td>
        </tr>
      )}
    </>
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
            <p className="text-[12px] font-semibold uppercase tracking-wider text-emerald-300/80">How to confirm the fix</p>
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

        <p className="flex items-center gap-1.5 text-[12px] text-slate-600">
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
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
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

  // Generation is synchronous: the backend sends the finding's full verified
  // context to the AI engine and returns the persisted guidance in one call. We
  // patch it into the feed and open the overlay — no polling, no worker limbo.
  async function generate(item: RemediationItem) {
    if (generatingId != null) return;
    setGeneratingId(item.id);
    setGenError(null);
    try {
      const res = await api.post<{ ok?: boolean; remediation?: RemediationBlock; error?: string | null }>(
        `/scans/results/${item.id}/remediation`,
        {},
      );
      const rem = res.remediation;
      if (rem && isGenerated(rem)) {
        setData((prev) => ({
          ...prev,
          items: prev.items.map((it) => (it.id === item.id ? { ...it, remediation: rem } : it)),
        }));
        setViewingId(item.id); // open the guidance overlay
      } else {
        setGenError(res.error || "The AI engine could not produce guidance for this finding. Try again.");
      }
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "Could not generate guidance");
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
        description="Verified findings that are not yet retested and fixed."
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
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th w-8"><span className="sr-only">Details</span></th>
                  <th className="th">Finding</th>
                  <th className="th">Severity</th>
                  <th className="th hidden lg:table-cell">Verification</th>
                  <th className="th">Asset</th>
                  <th className="th hidden xl:table-cell">Tool</th>
                  <th className="th hidden xl:table-cell">Priority</th>
                  <th className="th hidden 2xl:table-cell">Effort</th>
                  <th className="th hidden lg:table-cell">Found</th>
                  <th className="th text-right">Fix guidance</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <RemediationRow
                    key={item.id}
                    item={item}
                    open={expandedId === item.id}
                    onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    generating={generatingId === item.id}
                    onGenerate={generate}
                    onView={(it) => setViewingId(it.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            totalItems={data.items.length}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="findings"
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
