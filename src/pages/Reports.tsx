import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Plus, ShieldCheck, ShieldAlert, FileDown, KanbanSquare, RefreshCw, Code2, FileCode, ExternalLink, Lock } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, Modal, Tabs, ProgressBar, Spinner, EmptyState, PageSkeleton, ErrorState } from "@/components/ui";
import DocLink from "@/components/DocLink";
import { loadReportsBundle, patchTrackerFinding, retestTrackerFinding } from "@/lib/data";
import { api, ApiError } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { timeAgo, formatBytes, titleCase, cx, normalizeReportRow, extractReportFindings, TRACKER_STATUSES } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useSearchParams } from "react-router-dom";
import { isDemoMode } from "@/lib/api";
import { marked } from "marked";
import type { TrackerFinding, TrackerSummary } from "@/lib/types";

marked.setOptions({ breaks: true, gfm: true });

/** Verification gate (GET /reports/verification-gate) --- counts before generate. */
type VerificationGate = {
  organization_id: number;
  campaign_id?: number | null;
  report_type: string;
  require_verified: boolean;
  candidates_after_dedupe: number;
  reportable: number;
  auto_verified: number;
  manually_verified: number;
  unverified_pending: number;
  rejected: number;
  excluded_from_report: number;
  by_status?: Record<string, number>;
  severity_counts?: Record<string, number>;
  needs_acknowledgement: boolean;
  message?: string;
  hint?: string;
  acknowledged?: boolean | null;
};

function gateQuery(campaignId: string, reportType: string): string {
  const p = new URLSearchParams({ report_type: reportType });
  if (campaignId) p.set("campaign_id", campaignId);
  return `/reports/verification-gate?${p.toString()}`;
}

function downloadExt(format: string): string {
  if (format === "markdown") return "md";
  if (format === "docx") return "docx";
  if (format === "xlsx") return "xlsx";
  if (format === "pptx") return "pptx";
  if (format === "html") return "html";
  return format;
}

/** Split output_files into downloadable paths vs error keys (`pptx_error`, etc.).
 *  A value is downloadable when it's a storage path/URL string, or an inline
 *  object (`{ inline: "<text>" }`, e.g. AGI session reports). */
function parseOutputFiles(files: Record<string, unknown> | null | undefined): {
  downloads: Array<{ format: string; path: string }>;
  errors: Array<{ format: string; error: string }>;
} {
  const downloads: Array<{ format: string; path: string }> = [];
  const errors: Array<{ format: string; error: string }> = [];
  if (!files || typeof files !== "object") return { downloads, errors };
  for (const [key, val] of Object.entries(files)) {
    if (key.endsWith("_error")) {
      const format = key.slice(0, -"_error".length);
      if (typeof val === "string" && val.trim()) errors.push({ format, error: val });
      continue;
    }
    const isInline = !!val && typeof val === "object" && typeof (val as { inline?: unknown }).inline === "string" && !!(val as { inline?: string }).inline?.trim();
    const isString = typeof val === "string" && val.trim() && !val.startsWith("error");
    if (isInline || isString) {
      downloads.push({
        format: key,
        path: typeof val === "string" ? val : (val as { inline: string }).inline,
      });
    }
  }
  return { downloads, errors };
}

async function handleDownload(
  reportId: number,
  format: string,
  onError?: (msg: string, artifactMissing: boolean) => void,
) {
  const ext = downloadExt(format);
  try {
    const blob = await api.download(`/reports/${reportId}/download?format=${format}`);
    if (!blob || blob.size === 0) throw new Error("Server returned an empty file");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${reportId}.${ext}`;
    // Anchor must be in the DOM for the download to fire in some browsers.
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    // Backend re-renders from stored sections when possible; when the artifact
    // is gone entirely it answers 404 { detail: { code: "report_artifact_missing",
    // available_formats, hint } } --- offer regenerate instead of a dead button.
    const artifactMissing =
      err instanceof ApiError && err.status === 404 &&
      err.detail && typeof err.detail === "object" &&
      (err.detail as { code?: string }).code === "report_artifact_missing";
    const msg =
      artifactMissing && err.detail && typeof err.detail === "object"
        ? ((err.detail as { hint?: string }).hint || err.message)
        : err instanceof Error ? err.message : "Could not download this report format";
    if (onError) onError(msg, !!artifactMissing);
    else console.error("Report download failed:", msg);
  }
}

async function loadMarkdown(reportId: number): Promise<string> {
  try {
    return await api.fetchText(`/reports/${reportId}/download?format=markdown`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not load markdown content";
    throw new Error(msg);
  }
}

const trackerStatuses = TRACKER_STATUSES;

function JsonPre({ data }: { data: unknown }) {
  return (
    <pre className="mt-2 overflow-auto rounded-xl border border-phantix-700/40 bg-phantix-950/60 p-3 text-[11px] leading-relaxed text-slate-300 max-h-[400px]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => (content ? (marked.parse(content) as string) : ""), [content]);
  return (
    <div
      className="prose-doc max-w-none mt-2 rounded-xl border border-phantix-700/40 bg-phantix-950/60 p-4 max-h-[500px] overflow-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function SectionRenderer({ section }: { section: any }) {
  if (!section) return <p className="text-xs text-slate-500">No data</p>;
  const ct = section.content_type;
  const content = section.content;

  if (ct === "markdown" && typeof content === "string") {
    return <MarkdownContent content={content} />;
  }
  if (ct === "json" || ct === "structured") {
    if (Array.isArray(content)) {
      return (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] text-slate-600">{content.length} items</p>
          {content.slice(0, 5).map((item: any, i: number) => (
            <details key={i} className="rounded-xl border border-phantix-700/40 bg-phantix-950/60 p-3 text-xs text-slate-300">
              <summary className="cursor-pointer font-mono font-semibold text-gold-300 hover:text-gold-200">
                {item.title ?? item.name ?? item.finding_key ?? `Item ${i + 1}`}
                {item.severity && <SeverityBadge severity={item.severity} />}
              </summary>
              <JsonPre data={item} />
            </details>
          ))}
          {content.length > 5 && <p className="text-[10px] text-slate-600">+{content.length - 5} more items</p>}
        </div>
      );
    }
    return <JsonPre data={content} />;
  }
  return <JsonPre data={content} />;
}

function MarkdownReportView({ reportId }: { reportId: number }) {
  const { toast } = useStore();
  const [md, setMd] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLoad = async () => {
    if (md !== null) { setOpen(true); return; }
    setLoading(true);
    try {
      const text = await loadMarkdown(reportId);
      setMd(text);
      setOpen(true);
    } catch (err) {
      toast("error", "Could not load report", err instanceof Error ? err.message : "Markdown content unavailable");
      setMd("*Could not load markdown content.*");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={handleLoad} className="flex items-center gap-1.5 rounded-lg border border-phantix-700/50 bg-phantix-950/50 px-3 py-2 text-xs text-slate-300 hover:bg-phantix-800/60">
        <Code2 size={13} /> {loading ? "Loading..." : "View formatted report"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Formatted Report" wide>
        {md && (
          <div
            className="prose-doc max-w-none overflow-auto rounded-xl border border-phantix-700/40 bg-phantix-950/60 p-6 max-h-[70vh]"
            dangerouslySetInnerHTML={{ __html: marked.parse(md) as string }}
          />
        )}
      </Modal>
    </>
  );
}

export default function Reports() {
  const { toast, requireDualControl } = useStore();
  const [params] = useSearchParams();
  const fromAgi = params.get("from") === "agi";
  const agiSession = params.get("session");
  const { data, loading, error, reload, setData } = useResource(
    loadReportsBundle,
    { reports: [], trackerFindings: [], trackerSummary: null as TrackerSummary | null, trackerNote: null as string | null },
    "reports",
  );
  const { reports, trackerFindings, trackerSummary } = data;
  const initialTab = params.get("tab") === "tracker" ? "tracker" : "reports";
  const [tab, setTab] = useState(initialTab);
  const [genOpen, setGenOpen] = useState(false);
  const [genSubmitting, setGenSubmitting] = useState(false);
  const [genForm, setGenForm] = useState({ report_type: "vapt_campaign", campaign_id: "", formats: ["markdown", "json", "xlsx", "pdf", "pptx", "html"] as string[], run_inline: false });
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const fetchedCampaigns = useRef(false);
  const highlightKey = params.get("key") || "";

  // Verification gate (AUGUST_2026_REPORTING…_FE.md §A): preview verified vs
  // pending counts before generate; 409 verification_pending must be acked.
  const [gate, setGate] = useState<VerificationGate | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [ackOpen, setAckOpen] = useState(false);
  const [ackGate, setAckGate] = useState<VerificationGate | null>(null);
  const ackRef = useRef(false);

  const loadGate = useCallback(async (campaignId: string, reportType: string) => {
    if (!campaignId || fromAgi) return;
    if (isDemoMode()) {
      // Demo tenants have no backend session for the gate endpoint.
      setGate({
        organization_id: 0,
        report_type: reportType,
        require_verified: true,
        candidates_after_dedupe: 5,
        reportable: 4,
        auto_verified: 4,
        manually_verified: 0,
        unverified_pending: 0,
        rejected: 1,
        excluded_from_report: 1,
        needs_acknowledgement: false,
      });
      return;
    }
    setGateLoading(true);
    setGateError(null);
    try {
      const g = await api.get<VerificationGate>(gateQuery(campaignId, reportType));
      setGate(g);
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "Verification gate unavailable");
    } finally {
      setGateLoading(false);
    }
  }, [fromAgi]);

  useEffect(() => {
    if (!genOpen) return;
    if (!fromAgi && !genForm.campaign_id) {
      setGate(null);
      setGateError(null);
      return;
    }
    ackRef.current = false;
    void loadGate(genForm.campaign_id, genForm.report_type);
  }, [genOpen, genForm.campaign_id, genForm.report_type, fromAgi, loadGate]);

  // Unit retest state
  const [retestTarget, setRetestTarget] = useState<TrackerFinding | null>(null);
  const [retestBusy, setRetestBusy] = useState(false);
  const [retestForm, setRetestForm] = useState({ tool: "", note: "" });

  const runRetest = async () => {
    if (!retestTarget) return;
    if (!(await requireDualControl("Running a unit retest requires a dual-control operate session."))) return;
    setRetestBusy(true);
    const key = retestTarget.finding_key;
    const previous = data;
    try {
      const updated = await retestTrackerFinding(key, {
        tool: retestForm.tool.trim() || undefined,
        note: retestForm.note.trim() || undefined,
      });
      const status = updated?.status ?? "retest_failed";
      setData((bundle) => ({
        ...bundle,
        trackerFindings: bundle.trackerFindings.map((tf) =>
          tf.finding_key === key
            ? ({ ...tf, ...(updated ?? {}), status: status as TrackerFinding["status"] } as TrackerFinding)
            : tf,
        ),
      }));
      toast(
        status === "fixed" ? "success" : status === "retest_failed" ? "error" : "info",
        status === "fixed" ? "Fix confirmed — finding closed" : "Retest complete",
        status === "fixed"
          ? `${key} re-scanned clean — auto-closed as fixed`
          : status === "retest_failed"
            ? `${key} still matches — remains open for remediation`
            : `${key} retest inconclusive — status unchanged`,
      );
      setRetestTarget(null);
      setRetestForm({ tool: "", note: "" });
      reload();
    } catch (err: any) {
      setData(previous);
      if (err?.status === 403) {
        toast("error", "Dual-control required", err.message ?? "Unlock operate and retry");
      } else {
        toast("error", "Retest failed", err?.message ?? "Could not run retest");
      }
    } finally {
      setRetestBusy(false);
    }
  };

  // Detail modal
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("");

  useEffect(() => {
    const t = params.get("tab");
    if (t === "tracker") setTab("tracker");
    else if (params.get("id")) setTab("reports");
  }, [params]);

  useEffect(() => {
    if (!fromAgi) return;
    setTab("reports");
    setGenOpen(true);
    setGenForm((p) => ({ ...p, report_type: "vapt_campaign" }));
  }, [fromAgi]);

  useEffect(() => {
    if (genOpen && !fetchedCampaigns.current && api) {
      fetchedCampaigns.current = true;
      api.get<any>("/vapt/campaigns?limit=50").then((r) => {
        setCampaigns(r.items ?? r.campaigns ?? r ?? []);
      }).catch(() => {});
    }
  }, [genOpen]);

  const doGenerate = useCallback(async (acknowledgeUnverified: boolean) => {
    if (isDemoMode() && fromAgi) {
      const queued = {
        id: Number(params.get("report")) || Date.now() % 100000,
        report_type: genForm.report_type as "vapt_campaign",
        title: `Autonomous pentest · session #${agiSession ?? "—"}`,
        status: "generating" as const,
        formats_requested: genForm.formats,
        campaign_id: genForm.campaign_id ? Number(genForm.campaign_id) : null,
        version: 1,
        stats: { after_dedupe: 4, after_verification: 4, excluded_from_report: 0, impact_analyzed: 4 },
        created_at: new Date().toISOString(),
        size_bytes: 0,
      };
      setData((prev) => ({ ...prev, reports: [queued, ...prev.reports] }));
      setGenOpen(false);
      toast("success", "Report queued", "phantix_agi findings are in the report engine.");
      window.setTimeout(() => {
        setData((prev) => ({
          ...prev,
          reports: prev.reports.map((r) => r.id === queued.id ? { ...r, status: "complete" as const, size_bytes: 1_280_000 } : r),
        }));
      }, 1600);
      return;
    }
    await api.post("/reports", {
      report_type: genForm.report_type,
      campaign_id: genForm.campaign_id ? Number(genForm.campaign_id) : undefined,
      formats: genForm.formats,
      run_inline: genForm.run_inline,
      // Required when gate.needs_acknowledgement === true (409 otherwise).
      acknowledge_unverified: acknowledgeUnverified,
      ...(fromAgi ? { source: "phantix_agi", session_id: agiSession ? Number(agiSession) : undefined } : {}),
    });
    setGenOpen(false);
    toast("success", "Report queued", fromAgi ? "Autonomous agent findings submitted to the report engine." : "Poll GET /reports until status=complete. Large PDF/DOCX may take minutes.");
    setTimeout(() => reload(), 800);
  }, [genForm, toast, reload, fromAgi, agiSession, params, setData]);

  const handleGenerate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAgi && !genForm.campaign_id) {
      toast("error", "Validation", "Please select a campaign.");
      return;
    }
    if (!(await requireDualControl("Generating a report requires a dual-control operate session."))) return;
    setGenSubmitting(true);
    try {
      // Gate before generate: auto/manual-verified always enter the client
      // report; pending rows need the operator to acknowledge the exclusion.
      if (!fromAgi && !isDemoMode()) {
        const g = await api.get<VerificationGate>(gateQuery(genForm.campaign_id, genForm.report_type));
        setGate(g);
        if (g.needs_acknowledgement && !ackRef.current) {
          setAckGate(g);
          setAckOpen(true);
          return;
        }
      }
      await doGenerate(ackRef.current || false);
    } catch (err: any) {
      // POST /reports 409 { detail: { code: "verification_pending", gate, hint } }
      if (err?.status === 409 && err?.detail?.code === "verification_pending") {
        const g = err.detail.gate as VerificationGate;
        if (g) { setGate(g); setAckGate(g); }
        setAckOpen(true);
        return;
      }
      toast("error", "Failed", err.message ?? "Report generation failed");
    } finally {
      setGenSubmitting(false);
    }
  }, [genForm, toast, reload, fromAgi, agiSession, params, setData, requireDualControl, doGenerate]);

  const confirmVerifiedOnly = useCallback(async () => {
    if (!ackGate) return;
    ackRef.current = true;
    setAckOpen(false);
    setGenSubmitting(true);
    try {
      await doGenerate(true);
    } catch (err: any) {
      if (err?.status === 409 && err?.detail?.code === "verification_pending") {
        setAckGate(err.detail.gate as VerificationGate);
        setAckOpen(true);
        return;
      }
      toast("error", "Failed", err.message ?? "Report generation failed");
    } finally {
      setGenSubmitting(false);
    }
  }, [ackGate, doGenerate, toast]);

  // Download failures: a missing artifact (report_artifact_missing) means the
  // backend can't re-render --- offer regenerate rather than a dead button.
  const onDownloadError = useCallback((m: string, artifactMissing: boolean) => {
    if (artifactMissing) {
      toast("error", "Report artifact missing", m);
      setGenOpen(true);
    } else {
      toast("error", "Download failed", m);
    }
  }, [toast]);

  const openDetail = useCallback(async (report: any) => {
    setDetail(report);
    setDetailLoading(true);
    setDetailTab("");
    try {
      const full = await api.get<any>(`/reports/${report.id}`);
      const merged = normalizeReportRow({ ...report, ...full });
      setDetail(merged);
      const keys = Object.keys(merged.sections ?? {});
      setDetailTab(keys[0] ?? "");
    } catch {
      // fallback --- detail stays as the list item
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = params.get("id");
    if (!id || loading) return;
    const match = reports.find((r) => String(r.id) === id);
    if (match) void openDetail(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, loading, reports.length, openDetail]);

  const toggleFormat = (f: string) => {
    setGenForm((prev) => ({
      ...prev,
      formats: prev.formats.includes(f) ? prev.formats.filter((x) => x !== f) : [...prev.formats, f],
    }));
  };

  if (loading) {
    return <PageSkeleton variant="list" rows={5} actions />;
  }

  if (error && reports.length === 0) {
    return (
      <ErrorState
        onRetry={reload}
        body="We could not load the report library. Check your connection and retry — your session stays signed in."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Reports"
        description="Library of generated artifacts (md/json/xlsx/pdf/docx/pptx/html). The tracker tab is a living remediation board — not a report file."
        actions={
          <>
          <DocLink docId="howto-app-11" label="Reports how-to" />
          <button className="btn-primary" onClick={() => setGenOpen(true)}>
            <Plus size={15} /> Generate report
          </button>
          </>
        }
      />

      <Tabs
        tabs={[
          { id: "reports", label: "Report library", count: reports.length },
          { id: "tracker", label: "Findings tracker", count: trackerFindings.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "reports" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-gold-400/20 bg-gold-400/5 px-4 py-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold-400" />
            <p className="text-xs leading-5 text-slate-400">
              <strong className="text-slate-200">Verified-only by default.</strong> auto_verified and
              manually_verified findings enter executive rollups; unverified heuristics are appendix-only;
              rejected / false_positive / reachability rows are excluded entirely.
            </p>
          </div>

          {reports.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetail(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(r);
                    }
                  }}
                  className="flex w-full flex-wrap cursor-pointer items-center gap-4 text-left"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400">
                    <FileText size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-100">{r.title}</p>
                      <StatusBadge status={r.status} />
                      {(r as any).report_version != null && <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-400">v{(r as any).report_version ?? (r as any).version}</span>}
                      <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-400">{titleCase(r.report_type)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {r.campaign_id ? `Campaign #${r.campaign_id} � ` : ""}{timeAgo(r.created_at)}{(r as any).size_bytes ? ` � ${formatBytes((r as any).size_bytes)}` : ""}
                    </p>
                  </div>

                  <div className="hidden items-center gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-3.5 py-2 lg:flex">
                    {([
                      [(r as any).stats?.after_dedupe ?? extractReportFindings(r).length, "findings", "text-phantix-300"],
                      [(r as any).stats?.after_verification ?? 0, "verified", "text-emerald-400"],
                      [(r as any).stats?.candidates ?? null, "candidate", "text-amber-400"],
                      [(r as any).stats?.impact_analyzed ?? null, "impact", "text-blue-400"],
                      [(r as any).stats?.excluded_from_report ?? 0, "excluded", "text-severity-critical"],
                    ] as [number | null, string, string][]).map(([v, l, c]) => (
                      <div key={String(l)} className="min-w-[3rem] text-center">
                        <p className={cx("font-display text-lg font-bold tabular-nums", v == null ? "text-slate-600" : c)}>{v == null ? "—" : v}</p>
                        <p className="text-[9px] uppercase tracking-wider text-slate-600">{l}</p>
                      </div>
                    ))}
                  </div>

                  {r.status === "generating" ? (
                    <div className="w-40">
                      <p className="mb-1 text-right text-[11px] text-slate-500">rendering...</p>
                      <ProgressBar value={72} color="#38BDF8" />
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      {(parseOutputFiles(r.output_files).downloads.length > 0
                        ? parseOutputFiles(r.output_files).downloads
                        : (r.formats_requested || []).map((f: string) => ({ format: f, path: "" }))
                      ).map(({ format: f }) => (
                        <button
                          key={f}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDownload(r.id, f, onDownloadError); }}
                          className={cx(
                            "rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase transition-colors",
                            f === "pdf" || f === "docx" || f === "pptx" || f === "html"
                              ? "border-gold-400/40 bg-gold-400/10 text-gold-300 hover:bg-gold-400/20"
                              : "border-phantix-700/50 text-slate-400 hover:bg-phantix-800/60",
                          )}
                        >
                          {f === "pptx" ? "Board deck" : f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}

          <p className="text-xs text-slate-500">
            Retention: REPORT_MAX_VERSIONS=3 per type --- oldest archives automatically with a ReportArchived
            alert. Prefer run_inline=false for large campaigns to avoid gateway timeouts; poll GET /reports/{"{id}"}
            until status=complete.
          </p>
        </motion.div>
      )}

      {tab === "tracker" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-phantix-700/50 bg-phantix-900/50 px-4 py-3">
            <KanbanSquare size={16} className="mt-0.5 shrink-0 text-gold-400" />
            <p className="text-xs leading-5 text-slate-400">
              Living remediation board (not a download). Statuses:{" "}
              <strong className="text-slate-200">open → in_progress → fixed</strong> (or{" "}
              <strong className="text-slate-200">accepted</strong>). Backend sets{" "}
              <strong className="text-severity-critical">regressed</strong> when a fixed finding reappears. PATCH needs dual-control when configured.
            </p>
          </div>

          {trackerSummary && (
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              {(
                [
                  ["open", trackerSummary.open],
                  ["in_progress", trackerSummary.in_progress],
                  ["fixed", trackerSummary.fixed],
                  ["accepted", trackerSummary.accepted],
                  ["retest_failed", trackerSummary.retest_failed],
                  ["regressed", trackerSummary.regressed],
                  ["unassigned", trackerSummary.unassigned],
                ] as const
              ).map(([k, v]) =>
                v != null ? (
                  <span key={k} className="chip border-phantix-600/50 bg-phantix-800/50 text-slate-300">
                    {titleCase(k)}: <strong className="ml-1 text-slate-100">{v}</strong>
                  </span>
                ) : null,
              )}
            </div>
          )}

          <Card className="!p-0 overflow-hidden">
            {trackerFindings.length === 0 ? (
              <EmptyState
                icon={<KanbanSquare size={24} />}
                title="No tracker findings"
                body="Findings appear here from GET /reports/tracker, or from completed report sessions when the tracker API is empty. Never render PDF/HTML in this tab."
              />
            ) : (
              <div className="max-h-[min(70vh,720px)] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-phantix-900/95 backdrop-blur-sm">
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Key</th>
                      <th className="th">Finding</th>
                      <th className="th">Severity</th>
                      <th className="th">Asset</th>
                      <th className="th">Owner</th>
                      <th className="th">Status</th>
                      <th className="th">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackerFindings.map((f) => (
                      <tr
                        key={f.finding_key}
                        id={`tracker-${f.finding_key}`}
                        className={cx(
                          "border-b border-phantix-800/40 hover:bg-phantix-800/35",
                          highlightKey === f.finding_key && "bg-gold-400/10 ring-1 ring-inset ring-gold-400/30",
                        )}
                      >
                        <td className="td font-mono text-xs font-semibold text-gold-300 max-w-[120px] truncate" title={f.finding_key}>{f.finding_key}</td>
                        <td className="td max-w-[280px]">
                          <p className="truncate font-medium text-slate-200">{f.title}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {f.campaign_name}
                            {f.priority ? ` · ${f.priority}` : ""}
                            {f.surface ? ` · ${f.surface}` : ""}
                          </p>
                        </td>
                        <td className="td"><SeverityBadge severity={f.severity} /></td>
                        <td className="td font-mono text-xs text-slate-400 max-w-[160px] truncate" title={f.asset_value}>
                          {f.asset_id != null ? (
                            <a href={`/assets?id=${f.asset_id}`} className="hover:text-gold-300">{f.asset_value}</a>
                          ) : (
                            f.asset_value
                          )}
                        </td>
                        <td className="td text-xs text-slate-400">{f.owner ?? <span className="text-slate-600">unassigned</span>}</td>
                        <td className="td">
                          <div className="flex items-center gap-1.5">
                            {f.status === "regressed" && (
                              <span className="chip border-severity-critical/40 bg-severity-critical/10 text-[10px] text-severity-critical">regressed</span>
                            )}
                            <select
                              value={trackerStatuses.includes(f.status as any) ? f.status : "open"}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                if (!(await requireDualControl("Updating tracker status requires a dual-control operate session."))) return;
                                const previous = data;
                                setData((bundle) => ({
                                  ...bundle,
                                  trackerFindings: bundle.trackerFindings.map((tf) =>
                                    tf.finding_key === f.finding_key ? { ...tf, status: newStatus as TrackerFinding["status"] } : tf,
                                  ),
                                }));
                                try {
                                  await patchTrackerFinding(f.finding_key, { status: newStatus });
                                  toast("success", "Tracker updated", `${f.finding_key} → ${newStatus}`);
                                } catch (err: any) {
                                  setData(previous);
                                  if (err?.status === 403) {
                                    toast("error", "Dual-control required", err.message ?? "Unlock operate and retry");
                                  } else {
                                    toast("error", "Failed", err.message ?? "Status update failed");
                                  }
                                }
                              }}
                              className="input !w-auto !py-1 text-xs"
                            >
                              {trackerStatuses.map((s) => (
                                <option key={s} value={s}>{titleCase(s)}</option>
                              ))}
                            </select>
                            <button
                              title="Run a targeted unit retest of just this finding's asset; auto-closes when the fix is confirmed"
                              className="rounded-lg border border-gold-400/30 bg-gold-400/10 px-2 py-1 text-xs font-medium text-gold-300 transition-colors hover:bg-gold-400/20 disabled:opacity-50"
                              disabled={f.status === "fixed" || f.status === "accepted"}
                              onClick={() => {
                                setRetestTarget(f);
                                setRetestForm({ tool: "", note: "" });
                              }}
                            >
                              <RefreshCw size={12} className="mr-1 inline" /> Retest
                            </button>
                            {f.retest_status && (
                              <span
                                title={f.retest_status}
                                className={cx(
                                  "chip text-[9px]",
                                  f.retest_status === "confirmed"
                                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                                    : f.retest_status === "failed"
                                      ? "border-severity-critical/40 bg-severity-critical/10 text-severity-critical"
                                      : "border-slate-500/40 bg-slate-500/10 text-slate-400",
                                )}
                              >
                                {f.retest_status}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="td text-xs text-slate-500 whitespace-nowrap">{timeAgo(f.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* Generate modal */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate report">
        <form className="space-y-4" onSubmit={handleGenerate}>
          {fromAgi && (
            <div className="rounded-xl border border-gold-400/30 bg-gold-400/10 px-3.5 py-2.5 text-xs leading-5 text-gold-200">
              Autonomous Pentest Agent submitted session #{agiSession ?? "—"} (tag <span className="font-mono">phantix_agi</span>). Generate the client package from those verified findings.
            </div>
          )}
          <div>
            <label className="label">Report type</label>
            <select className="input" value={genForm.report_type} onChange={(e) => setGenForm((p) => ({ ...p, report_type: e.target.value }))}>
              <option value="vapt_campaign">vapt_campaign --- full client package</option>
              <option value="executive">executive --- board summary</option>
              <option value="compliance">compliance --- framework-first</option>
              <option value="tracker">tracker --- remediation snapshot</option>
            </select>
          </div>
          <div>
            <label className="label">Campaign</label>
            <select className="input" value={genForm.campaign_id} onChange={(e) => setGenForm((p) => ({ ...p, campaign_id: e.target.value }))}>
              <option value="">{fromAgi ? "Agent session (no VAPT campaign)" : "Select campaign..."}</option>
              {campaigns.map((c: any) => (
                <option key={c.id} value={c.id}>
                  #{c.id} --- {c.campaign_name ?? c.name} ({c.status ?? "unknown"})
                </option>
              ))}
            </select>
          </div>

          {/* Verification gate preview --- counts before generate */}
          {!fromAgi && (
            <div className={cx(
              "rounded-xl border p-3.5 text-xs",
              gate?.needs_acknowledgement
                ? "border-severity-medium/40 bg-severity-medium/8"
                : "border-phantix-700/50 bg-phantix-950/50",
            )}>
              <p className="flex items-center gap-1.5 font-semibold text-slate-300">
                {gate?.needs_acknowledgement
                  ? <><ShieldAlert size={13} className="text-severity-medium" /> Verification pending</>
                  : <><ShieldCheck size={13} className="text-emerald-400" /> Verification gate</>}
                {gateLoading && <Spinner className="h-3 w-3" />}
              </p>
              {gateError && <p className="mt-1.5 text-[11px] text-severity-critical">{gateError}</p>}
              {!gateLoading && gate && !gateError && (
                <>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {([
                      [gate.reportable, "will enter report", "text-emerald-400"],
                      [gate.auto_verified, "auto-verified", "text-emerald-300"],
                      [gate.manually_verified, "manual", "text-phantix-300"],
                      [gate.unverified_pending, "unverified", "text-severity-medium"],
                      [gate.rejected, "rejected", "text-slate-500"],
                      [gate.excluded_from_report, "excluded", "text-severity-critical"],
                    ] as [number, string, string][]).map(([v, l, c]) => (
                      <div key={String(l)} className="rounded-lg bg-phantix-900/60 px-2.5 py-1.5">
                        <p className={cx("font-display text-base font-bold tabular-nums", c)}>{v}</p>
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">{l}</p>
                      </div>
                    ))}
                  </div>
                  {gate.needs_acknowledgement && (
                    <p className="mt-2 rounded-lg border border-severity-medium/30 bg-severity-medium/10 px-2.5 py-2 text-[11px] leading-5 text-severity-medium">
                      {gate.unverified_pending} finding(s) still need verification and will be excluded (or appendix-only).
                      {" "}{gate.reportable} auto/manual-verified will be included.{" "}
                      <strong>Generate verified-only</strong> sends acknowledge_unverified=true.
                    </p>
                  )}
                  {gate.message && !gate.needs_acknowledgement && (
                    <p className="mt-1.5 text-[11px] text-slate-500">{gate.message}</p>
                  )}
                </>
              )}
            </div>
          )}
          <div>
            <label className="label">Formats</label>
            <div className="grid grid-cols-3 gap-2">
              {["markdown", "json", "csv", "xlsx", "pdf", "docx", "pptx", "html"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFormat(f)}
                  className={cx(
                    "rounded-xl border px-2.5 py-2 font-mono text-xs font-semibold uppercase transition-colors",
                    genForm.formats.includes(f)
                      ? "border-gold-400/50 bg-gold-400/10 text-gold-300"
                      : "border-phantix-700/50 bg-phantix-950/50 text-slate-400 hover:bg-phantix-800/60",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={genForm.run_inline}
              onChange={(e) => setGenForm((p) => ({ ...p, run_inline: e.target.checked }))}
              className="h-3.5 w-3.5 accent-gold-400"
            />
            Run inline (waits for completion --- may time out for large campaigns)
          </label>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3.5 text-xs leading-5 text-slate-500">
            <FileDown size={12} className="mr-1.5 inline text-gold-400" />
            Reports include only auto- or manually verified findings. Each verified finding is analyzed for business and technical impact (CIA triad, blast radius) before it is added to the deliverable. PDF/DOCX follow the standard VAPT template.
          </div>
          <p className="text-[11px] text-slate-500">
            Generate report with <strong>run_inline=true</strong> for immediate delivery; use <strong>run_inline=false</strong> for large campaigns to avoid gateway timeouts. Poll GET /reports/{"{id}"} until status=complete.
          </p>
          <button className="btn-primary w-full" disabled={genSubmitting}>
            {genSubmitting ? <><RefreshCw size={15} className="animate-spin" /> Generating...</> : <><Download size={15} /> Generate</>}
          </button>
        </form>
      </Modal>

      {/* Unverified findings ack modal */}
      <Modal open={ackOpen} onClose={() => setAckOpen(false)} title="Unverified findings remain">
        {ackGate && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-severity-medium/30 bg-severity-medium/8 px-3.5 py-3">
              <ShieldAlert size={17} className="mt-0.5 shrink-0 text-severity-medium" />
              <p className="text-xs leading-5 text-slate-300">
                <strong className="text-severity-medium">{ackGate.unverified_pending} finding(s)</strong> still need
                verification and will be <strong>excluded</strong> (or appendix-only) from this report.{" "}
                <strong className="text-emerald-300">{ackGate.reportable} auto/manual-verified finding(s)</strong>{" "}
                will be included. Auto-verified findings are always included.
              </p>
            </div>
            {ackGate.message && <p className="text-[11px] leading-5 text-slate-500">{ackGate.message}</p>}
            <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-400">
              <span className="chip border-phantix-600/50 bg-phantix-800/60">reportable: <strong className="text-emerald-300">{ackGate.reportable}</strong></span>
              <span className="chip border-phantix-600/50 bg-phantix-800/60">auto-verified: <strong className="text-emerald-300">{ackGate.auto_verified}</strong></span>
              <span className="chip border-phantix-600/50 bg-phantix-800/60">manual: <strong className="text-slate-200">{ackGate.manually_verified}</strong></span>
              <span className="chip border-severity-medium/40 bg-severity-medium/10 text-severity-medium">unverified: <strong>{ackGate.unverified_pending}</strong></span>
              <span className="chip border-phantix-600/50 bg-phantix-800/60">rejected: <strong className="text-slate-400">{ackGate.rejected}</strong></span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => setAckOpen(false)}>Cancel</button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setAckOpen(false);
                  setGenOpen(false);
                  setTab("tracker");
                }}
              >
                <KanbanSquare size={14} /> Verify findings
              </button>
              <button className="btn-primary" disabled={genSubmitting} onClick={() => void confirmVerifiedOnly()}>
                {genSubmitting ? <><RefreshCw size={14} className="animate-spin" /> Generating...</> : <><Download size={14} /> Generate verified-only</>}
              </button>
            </div>
            {ackGate.hint && <p className="text-[10px] text-slate-500">{ackGate.hint}</p>}
          </div>
        )}
      </Modal>

      {/* Report detail modal */}
      <Modal open={!!detail} onClose={() => { setDetail(null); setDetailTab(""); }} title={detail?.title ?? ""} wide>
        {detail && (
          <div className="space-y-4">
            {detailLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Spinner className="h-4 w-4" /> Loading report sections...
              </div>
            )}

            {/* AI narratives banner */}
            {detail.ai_narratives && (
              <div className="rounded-2xl border border-gold-400/20 bg-gold-400/5 px-4 py-3 space-y-3">
                <p className="text-xs font-semibold text-gold-300">
                  AI Executive Summary
                  {detail.ai_narratives.model_name && <span className="ml-1.5 text-slate-500 font-normal">via {detail.ai_narratives.model_name}</span>}
                  {detail.ai_narratives.confidence != null && <span className="ml-2 text-slate-500 font-normal">confidence {(detail.ai_narratives.confidence * 100).toFixed(0)}%</span>}
                </p>
                <div className="text-xs leading-5 text-slate-300 max-h-[300px] overflow-auto">
                  <p>{detail.ai_narratives.executive_summary}</p>
                  {detail.ai_narratives.overall_posture && (
                    <p className="mt-3 text-slate-400 italic">Posture: {detail.ai_narratives.overall_posture}</p>
                  )}
                </div>
                {detail.ai_narratives.remediation_guidance && (
                  <details className="text-xs text-slate-400">
                    <summary className="cursor-pointer font-semibold text-slate-300">Remediation Guidance</summary>
                    <div
                      className="prose-doc max-w-none mt-2"
                      dangerouslySetInnerHTML={{ __html: marked.parse(detail.ai_narratives.remediation_guidance) as string }}
                    />
                  </details>
                )}
                {detail.ai_narratives.web_research?.items?.length > 0 && (
                  <details className="text-xs text-slate-400">
                    <summary className="cursor-pointer font-semibold text-slate-300">Sources consulted</summary>
                    <ul className="mt-2 space-y-1.5">
                      {(detail.ai_narratives.web_research.items as Array<{ title?: string; url?: string; snippet?: string }>).map((it, i) => (
                        <li key={i} className="rounded-lg border border-phantix-700/30 px-2.5 py-1.5">
                          <p className="font-medium text-slate-300">{it.title || it.url || "Source"}</p>
                          {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="break-all text-[10px] text-gold-300 underline">{it.url}</a>}
                          {it.snippet && <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{it.snippet}</p>}
                        </li>
                      ))}
                    </ul>
                    {detail.ai_narratives.source && (
                      <p className="mt-1.5 text-[10px] text-slate-600">{detail.ai_narratives.source}</p>
                    )}
                  </details>
                )}
              </div>
            )}

            {/* Verification gate chips from GET /reports/{id}.verification_gate */}
            {(detail as any).verification_gate && (
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-300">
                  reportable: <strong className="text-emerald-300">{(detail as any).verification_gate.reportable}</strong>
                </span>
                <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-300">
                  auto-verified: <strong className="text-emerald-300">{(detail as any).verification_gate.auto_verified}</strong>
                </span>
                <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-300">
                  unverified pending: <strong className="text-severity-medium">{(detail as any).verification_gate.unverified_pending}</strong>
                </span>
                {((detail as any).verification_gate.acknowledged === true || (detail as any).verification_gate.needs_acknowledgement === false) && (
                  <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                    acknowledged: <strong>{(detail as any).verification_gate.acknowledged === true ? "yes" : "not required"}</strong>
                  </span>
                )}
              </div>
            )}

            {/* Output files — skip *_error keys; show failures as chips */}
            {(detail as any).output_files && (() => {
              const { downloads, errors } = parseOutputFiles((detail as any).output_files);
              return (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileCode size={13} className="text-slate-500" />
                    {downloads.map(({ format: fmt }) => (
                      <button
                        key={fmt}
                        onClick={() => handleDownload(detail.id, fmt, onDownloadError)}
                        className="rounded-lg border border-phantix-700/50 bg-phantix-950/50 px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase text-gold-300 hover:bg-gold-400/10"
                      >
                        <Download size={10} className="mr-1 inline" /> {fmt === "pptx" ? "Board deck (.pptx)" : fmt}
                      </button>
                    ))}
                  </div>
                  {errors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {errors.map(({ format: fmt, error }) => (
                        <span key={fmt} className="rounded-lg border border-severity-critical/30 bg-severity-critical/10 px-2 py-1 text-[10px] text-red-300" title={error}>
                          {fmt} failed
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Markdown viewer */}
            <MarkdownReportView reportId={detail.id} />

            {/* Sections */}
            {detail.sections && (
              <div>
                <div className="flex flex-wrap gap-1.5 mb-3 border-b border-phantix-700/40 pb-3">
                  {Object.keys(detail.sections).filter((k) => !k.startsWith("_")).map((key) => (
                    <button
                      key={key}
                      onClick={() => setDetailTab(key)}
                      className={cx(
                        "rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                        detailTab === key
                          ? "bg-gold-400/12 border border-gold-400/30 text-gold-200"
                          : "border border-transparent text-slate-500 hover:text-slate-300 hover:bg-phantix-800/60",
                      )}
                    >
                      {titleCase(detail.sections[key].title ?? key.replace(/_/g, " "))}
                    </button>
                  ))}
                </div>
                {detailTab && detail.sections[detailTab] && (
                  <div className="space-y-3">
                    {detail.sections[detailTab].metadata && (
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                        {detail.sections[detailTab].metadata.count != null && (
                          <span className="chip border-phantix-600/50 bg-phantix-800/60">{detail.sections[detailTab].metadata.count} entries</span>
                        )}
                        {detail.sections[detailTab].metadata.ai_insight && (
                          <span className="rounded-md border border-gold-400/20 bg-gold-400/5 px-2 py-1 text-gold-300/80">AI: {detail.sections[detailTab].metadata.ai_insight}</span>
                        )}
                      </div>
                    )}
                    <SectionRenderer section={detail.sections[detailTab]} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Unit retest modal */}
      <Modal
        open={!!retestTarget}
        onClose={() => setRetestTarget(null)}
        title={retestTarget ? `Unit retest — ${retestTarget.finding_key}` : "Unit retest"}
      >
        {retestTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3 text-sm">
              <p className="font-medium text-slate-100">{retestTarget.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <SeverityBadge severity={retestTarget.severity} />
                {retestTarget.asset_value && <span className="font-mono">{retestTarget.asset_value}</span>}
                {retestTarget.priority && <span>· {retestTarget.priority}</span>}
              </div>
            </div>
            <p className="rounded-lg bg-phantix-800/40 p-2.5 text-[11px] leading-5 text-slate-500">
              Runs a targeted scan of only this finding's asset with the tool family that originally flagged it
              (or the override below). If the retest comes back clean, the finding is{" "}
              <strong className="text-emerald-300">closed automatically (fixed)</strong>.
            </p>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void runRetest();
              }}
            >
              <div>
                <label className="label">Tool override (optional)</label>
                <input
                  className="input"
                  placeholder="nmap · nuclei · api_scan · apk ..."
                  value={retestForm.tool}
                  onChange={(e) => setRetestForm((f) => ({ ...f, tool: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <textarea
                  className="input min-h-[64px] w-full resize-y"
                  placeholder="e.g. patch applied 2026-08-19, expecting clean retest"
                  value={retestForm.note}
                  onChange={(e) => setRetestForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
              <button className="btn-primary w-full" type="submit" disabled={retestBusy}>
                {retestBusy ? <Spinner className="h-4 w-4" /> : <RefreshCw size={14} />} Run unit retest
              </button>
              <p className="text-[10px] text-slate-500">
                <Lock size={10} className="mr-1 inline text-gold-400" />
                POST /reports/tracker/{retestTarget.finding_key}/retest — needs dual-control when configured.
              </p>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
