import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Plus, ShieldCheck, ShieldAlert, FileDown, KanbanSquare, RefreshCw, FileCode, ExternalLink } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, Modal, Tabs, ProgressBar, Spinner, EmptyState, PageSkeleton, ErrorState } from "@sg/ui";
import { Pagination, DEFAULT_PAGE_SIZE } from "@sg/components/Pagination";
import DocLink from "@sg/components/DocLink";
import ReportSolutions from "@sg/components/ReportSolutions";
import { loadReportsBundle, loadReportTypes } from "@sg/data";
import type { ReportTypeEntry } from "@sg/types";
import { api, ApiError } from "@sg/api";
import { useResource } from "@sg/useResource";
import { timeAgo, formatBytes, titleCase, cx, normalizeReportRow, extractReportFindings } from "@sg/utils";
import { useStore } from "@sg/store";
import { Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { isDemoMode } from "@sg/api";
import { marked } from "marked";
import type { TrackerSummary } from "@sg/types";

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

/** True when the report has a stored PDF artifact (or was generated asking for one). */
function reportHasPdf(report: any): boolean {
  const { downloads } = parseOutputFiles(report?.output_files);
  if (downloads.some((d) => d.format === "pdf")) return true;
  return Array.isArray(report?.formats_requested) && report.formats_requested.includes("pdf");
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

function JsonPre({ data }: { data: unknown }) {
  return (
    <pre className="mt-2 overflow-auto rounded-xl border border-phantix-700/40 bg-phantix-950/60 p-3 text-[13px] leading-relaxed text-slate-300 max-h-[400px]">
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
          <p className="text-[12px] text-slate-600">{content.length} items</p>
          {content.slice(0, 5).map((item: any, i: number) => (
            <details key={i} className="rounded-xl border border-phantix-700/40 bg-phantix-950/60 p-3 text-xs text-slate-300">
              <summary className="cursor-pointer font-mono font-semibold text-gold-300 hover:text-gold-200">
                {item.title ?? item.name ?? item.finding_key ?? `Item ${i + 1}`}
                {item.severity && <SeverityBadge severity={item.severity} />}
              </summary>
              <JsonPre data={item} />
            </details>
          ))}
          {content.length > 5 && <p className="text-[12px] text-slate-600">+{content.length - 5} more items</p>}
        </div>
      );
    }
    return <JsonPre data={content} />;
  }
  return <JsonPre data={content} />;
}

export default function Reports() {
  const { toast, requireDualControl } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromAgi = params.get("from") === "agi";
  const agiSession = params.get("session");
  const { data, loading, error, reload, setData } = useResource(
    loadReportsBundle,
    { reports: [], trackerFindings: [], trackerSummary: null as TrackerSummary | null, trackerNote: null as string | null },
    "reports",
  );
  const { reports } = data;
  const requestedTab = params.get("tab");
  const initialTab = requestedTab === "reports" ? "reports" : "solutions";
  const [tab, setTab] = useState(initialTab);
  const [reportTypes, setReportTypes] = useState<ReportTypeEntry[]>([]);
  const [retention, setRetention] = useState<{ max_versions_per_type?: number } | null>(null);
  const [typesLoading, setTypesLoading] = useState(true);
  const [genOpen, setGenOpen] = useState(false);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsPageSize, setReportsPageSize] = useState(DEFAULT_PAGE_SIZE);
  const reportsTotalPages = Math.max(1, Math.ceil(reports.length / reportsPageSize));
  const reportsSafePage = Math.min(reportsPage, reportsTotalPages);
  const reportsPageItems = reports.slice((reportsSafePage - 1) * reportsPageSize, reportsSafePage * reportsPageSize);
  const [genSubmitting, setGenSubmitting] = useState(false);
  const [genForm, setGenForm] = useState({ report_type: "vapt_campaign", campaign_id: "", formats: ["markdown", "json", "xlsx", "pdf", "pptx", "html"] as string[], run_inline: false });
  // Only campaign-scoped report types need a campaign (from the backend catalog's
  // `requires_campaign`). All others — compliance, executive, tracker,
  // org_security_overview, audit_activity, … — generate org-wide without one.
  const requiresCampaign = useMemo(() => {
    const t = reportTypes.find((x) => x.report_type === genForm.report_type);
    return t ? !!t.requires_campaign : genForm.report_type === "vapt_campaign";
  }, [reportTypes, genForm.report_type]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const fetchedCampaigns = useRef(false);

  // The catalog is what the page offers; without it there is nothing to pick.
  useEffect(() => {
    let cancelled = false;
    loadReportTypes()
      .then((res) => {
        if (cancelled) return;
        setReportTypes(res.items);
        setRetention(res.retention);
      })
      .catch(() => {
        if (!cancelled) setReportTypes([]);
      })
      .finally(() => {
        if (!cancelled) setTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!fromAgi && requiresCampaign && !genForm.campaign_id) {
      setGate(null);
      setGateError(null);
      return;
    }
    ackRef.current = false;
    void loadGate(genForm.campaign_id, genForm.report_type);
  }, [genOpen, genForm.campaign_id, genForm.report_type, fromAgi, requiresCampaign, loadGate]);

  // Detail modal
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("");

  useEffect(() => {
    if (params.get("id")) setTab("reports");
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
      setCampaignsLoading(true);
      // Reporting answers "what can I report on?" — Core must not call Attack's
      // engine routes, and the application boundary now refuses if it tries.
      api.get<any>("/reports/subjects?report_type=vapt_campaign&limit=50").then((r) => {
        setCampaigns(r.items ?? r.campaigns ?? r ?? []);
      }).catch(() => {}).finally(() => setCampaignsLoading(false));
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
    toast("success", "Report queued", fromAgi ? "Autonomous agent findings submitted to the report engine." : "Large PDF/DOCX exports can take a few minutes — the report status updates as it progresses.");
    setTimeout(() => reload(), 800);
  }, [genForm, toast, reload, fromAgi, agiSession, params, setData]);

  const handleGenerate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAgi && requiresCampaign && !genForm.campaign_id) {
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
  }, [genForm, toast, reload, fromAgi, agiSession, params, setData, requireDualControl, doGenerate, requiresCampaign]);

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

  if (requestedTab === "tracker") {
    const key = params.get("key");
    return <Navigate to={`/tracker${key ? `?key=${encodeURIComponent(key)}` : ""}`} replace />;
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
    <div>
      <PageHeader
        title="Report solutions"
        description="All your reports in one place."
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
          { id: "solutions", label: "Report solutions", count: reportTypes.length || undefined },
          { id: "reports", label: "Report library", count: reports.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "solutions" && (
        <ReportSolutions
          types={reportTypes}
          loading={typesLoading}
          busyType={genSubmitting ? genForm.report_type : null}
          /* Newest complete report per type — the set worth a single click. */
          recent={Object.values(
            reports.reduce((acc: Record<string, any>, r: any) => {
              const key = String(r.report_type ?? "");
              if (!acc[key] || Number(r.report_version ?? 0) > Number(acc[key].report_version ?? 0)) {
                acc[key] = r;
              }
              return acc;
            }, {}),
          ).slice(0, 8)}
          onView={(r) => void openDetail(r)}
          onGenerate={(entry) => {
            setGenForm((prev) => ({
              ...prev,
              report_type: entry.report_type,
              campaign_id: entry.requires_campaign ? prev.campaign_id : "",
            }));
            setGenOpen(true);
          }}
        />
      )}

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

          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Report</th>
                    <th className="th">Type</th>
                    <th className="th">Status</th>
                    <th className="th hidden text-right lg:table-cell">Findings</th>
                    <th className="th hidden text-right lg:table-cell">Verified</th>
                    <th className="th hidden text-right xl:table-cell">Excluded</th>
                    <th className="th hidden xl:table-cell">Size</th>
                    <th className="th">Created</th>
                    <th className="th text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {reportsPageItems.map((r) => {
                    const stats = (r as any).stats ?? {};
                    const version = (r as any).report_version ?? (r as any).version;
                    const downloads = parseOutputFiles(r.output_files).downloads.length > 0
                      ? parseOutputFiles(r.output_files).downloads
                      : (r.formats_requested || []).map((fmt: string) => ({ format: fmt, path: "" }));
                    return (
                      <tr
                        key={r.id}
                        tabIndex={0}
                        onClick={() => openDetail(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDetail(r);
                          }
                        }}
                        className="group h-10 cursor-pointer border-b border-phantix-800/40 hover:bg-phantix-800/35 focus-visible:bg-phantix-800/35"
                      >
                        <td className="td max-w-[22rem]">
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText size={15} className="shrink-0 text-gold-400" aria-hidden="true" />
                            <span className="truncate font-medium text-slate-100" title={r.title}>{r.title}</span>
                            {version != null && <span className="shrink-0 font-mono text-[12px] text-slate-500">v{version}</span>}
                            {r.campaign_id ? <span className="shrink-0 text-[12px] text-slate-500">Campaign #{r.campaign_id}</span> : null}
                          </span>
                        </td>
                        <td className="td whitespace-nowrap text-[13px] text-slate-400">{titleCase(r.report_type)}</td>
                        <td className="td whitespace-nowrap">
                          {r.status === "generating" ? (
                            <span className="flex w-28 items-center gap-2"><ProgressBar value={72} color="#38BDF8" /></span>
                          ) : <StatusBadge status={r.status} />}
                        </td>
                        <td className="td hidden text-right font-mono text-[13px] text-phantix-300 lg:table-cell">{stats.after_dedupe ?? extractReportFindings(r).length}</td>
                        <td className="td hidden text-right font-mono text-[13px] text-emerald-400 lg:table-cell">{stats.after_verification ?? 0}</td>
                        <td className="td hidden text-right font-mono text-[13px] text-slate-400 xl:table-cell">{stats.excluded_from_report ?? 0}</td>
                        <td className="td hidden whitespace-nowrap text-[13px] text-slate-400 xl:table-cell">{(r as any).size_bytes ? formatBytes((r as any).size_bytes) : "—"}</td>
                        <td className="td whitespace-nowrap text-[13px] text-slate-400" title={r.created_at}>{timeAgo(r.created_at)}</td>
                        <td className="td whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          {r.status !== "generating" && (
                            <span className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => navigate(`/reports/${r.id}/view${reportHasPdf(r) ? "?format=pdf" : ""}`)}
                                className="rounded px-2 py-0 text-[13px] font-medium leading-6 text-gold-300 hover:bg-gold-400/10"
                              >
                                {reportHasPdf(r) ? "View PDF" : "View"}
                              </button>
                              {downloads.map(({ format: fmt }) => (
                                <button
                                  key={fmt}
                                  type="button"
                                  onClick={() => handleDownload(r.id, fmt, onDownloadError)}
                                  className="rounded px-1.5 py-0 font-mono text-[12px] font-semibold uppercase leading-6 text-slate-400 hover:bg-phantix-800 hover:text-slate-100"
                                  title={`Download ${fmt === "pptx" ? "board deck" : fmt.toUpperCase()}`}
                                >
                                  {fmt === "pptx" ? "Deck" : fmt}
                                </button>
                              ))}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              totalItems={reports.length}
              page={reportsSafePage}
              pageSize={reportsPageSize}
              onPageChange={setReportsPage}
              onPageSizeChange={setReportsPageSize}
              itemLabel="reports"
            />
          </Card>

          <p className="text-xs text-slate-500">
            Retention is <strong className="text-slate-400">per report type</strong>: each type keeps
            its own {retention?.max_versions_per_type ?? 3} most recent versions and archives its own
            oldest with a ReportArchived alert — generating an overview never displaces a VAPT report.
            For large campaigns, generate in the background to avoid timeouts, then check back as
            the report completes.
          </p>
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
            {/* Driven by the served catalog, so a report type added in the
                backend is selectable here without a frontend change. The old
                hard-coded four silently hid the cross-surface types. */}
            <select className="input" value={genForm.report_type} onChange={(e) => setGenForm((p) => ({ ...p, report_type: e.target.value }))}>
              {(reportTypes.length
                ? reportTypes
                : [{ report_type: genForm.report_type, title: genForm.report_type, audience: "" } as ReportTypeEntry]
              ).map((t) => (
                <option key={t.report_type} value={t.report_type}>
                  {t.title}
                  {t.audience ? ` --- ${t.audience.toLowerCase()}` : ""}
                </option>
              ))}
            </select>
            {(() => {
              const chosen = reportTypes.find((t) => t.report_type === genForm.report_type);
              if (!chosen) return null;
              return (
                <p className="mt-1 text-[13px] leading-4 text-slate-500">
                  {chosen.use_case}
                  {!chosen.requires_campaign && " No campaign needed."}
                </p>
              );
            })()}
          </div>
          {(() => {
            const chosen = reportTypes.find((t) => t.report_type === genForm.report_type);
            // Unknown type (catalog unavailable) keeps the picker rather than
            // hiding a field the request might need.
            const needsCampaign = chosen ? chosen.requires_campaign : true;
            if (!needsCampaign) {
              return (
                <div className="rounded-lg border border-phantix-700/40 bg-phantix-950/40 px-3 py-2">
                  <p className="text-[13px] leading-5 text-slate-500">
                    Organization-scoped — this report reads every engine for the whole org, so there
                    is no campaign to pick.
                  </p>
                </div>
              );
            }
            return (
              <div>
                <label className="label">Campaign</label>
                {campaignsLoading ? (
                  <div className="skeleton h-9 w-full rounded-md" />
                ) : (
                  <select className="input" value={genForm.campaign_id} onChange={(e) => setGenForm((p) => ({ ...p, campaign_id: e.target.value }))}>
                    <option value="">{fromAgi ? "Agent session (no VAPT campaign)" : "Select campaign..."}</option>
                    {campaigns.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        #{c.id} --- {c.label ?? c.campaign_name ?? c.name} ({c.status ?? "unknown"})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })()}

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
              </p>
              {gateError && <p className="mt-1.5 text-[13px] text-severity-critical">{gateError}</p>}
              {gateLoading && !gateError && (
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="rounded-lg bg-phantix-900/60 px-2.5 py-1.5">
                      <div className="skeleton h-4 w-8 rounded" />
                      <div className="skeleton mt-1.5 h-2.5 w-16 rounded" />
                    </div>
                  ))}
                </div>
              )}
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
                        <p className="text-[12px] uppercase tracking-wider text-slate-500">{l}</p>
                      </div>
                    ))}
                  </div>
                  {gate.needs_acknowledgement && (
                    <p className="mt-2 rounded-lg border border-severity-medium/30 bg-severity-medium/10 px-2.5 py-2 text-[13px] leading-5 text-severity-medium">
                      {gate.unverified_pending} finding(s) still need verification and will be excluded (or appendix-only).
                      {" "}{gate.reportable} auto/manual-verified will be included.{" "}
                      <strong>Generate verified-only</strong> excludes findings that are still unverified.
                    </p>
                  )}
                  {gate.message && !gate.needs_acknowledgement && (
                    <p className="mt-1.5 text-[13px] text-slate-500">{gate.message}</p>
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
          <p className="text-[13px] text-slate-500">
            Generate immediately for quick delivery, or run large campaigns in the background to avoid timeouts and check back as the report completes.
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
            {ackGate.message && <p className="text-[13px] leading-5 text-slate-500">{ackGate.message}</p>}
            <div className="flex flex-wrap gap-1.5 text-[13px] text-slate-400">
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
                  navigate("/tracker?evidence=unverified&status=all");
                }}
              >
                <KanbanSquare size={14} /> Verify findings
              </button>
              <button className="btn-primary" disabled={genSubmitting} onClick={() => void confirmVerifiedOnly()}>
                {genSubmitting ? <><RefreshCw size={14} className="animate-spin" /> Generating...</> : <><Download size={14} /> Generate verified-only</>}
              </button>
            </div>
            {ackGate.hint && <p className="text-[12px] text-slate-500">{ackGate.hint}</p>}
          </div>
        )}
      </Modal>

      {/* Report detail modal */}
      <Modal open={!!detail} onClose={() => { setDetail(null); setDetailTab(""); }} title={detail?.title ?? ""} wide>
        {detail && (
          <div className="space-y-4">
            {detailLoading && (
              <div className="space-y-5">
                {[0, 1, 2].map((s) => (
                  <div key={s} className="space-y-2.5" style={{ opacity: 1 - s * 0.18 }}>
                    <div className="skeleton h-4 w-48 rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton h-3 w-3/4 rounded" />
                  </div>
                ))}
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
                          {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="break-all text-[12px] text-gold-300 underline">{it.url}</a>}
                          {it.snippet && <p className="mt-0.5 text-[13px] leading-4 text-slate-500">{it.snippet}</p>}
                        </li>
                      ))}
                    </ul>
                    {detail.ai_narratives.source && (
                      <p className="mt-1.5 text-[12px] text-slate-600">{detail.ai_narratives.source}</p>
                    )}
                  </details>
                )}
              </div>
            )}

            {/* Verification gate chips from GET /reports/{id}.verification_gate */}
            {(detail as any).verification_gate && (
              <div className="flex flex-wrap gap-1.5 text-[13px]">
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
                        className="rounded-lg border border-phantix-700/50 bg-phantix-950/50 px-2.5 py-1.5 font-mono text-[12px] font-semibold uppercase text-gold-300 hover:bg-gold-400/10"
                      >
                        <Download size={10} className="mr-1 inline" /> {fmt === "pptx" ? "Board deck (.pptx)" : fmt}
                      </button>
                    ))}
                  </div>
                  {errors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {errors.map(({ format: fmt, error }) => (
                        <span key={fmt} className="rounded-lg border border-severity-critical/30 bg-severity-critical/10 px-2 py-1 text-[12px] text-red-300" title={error}>
                          {fmt} failed
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Full report, rendered full-page in a sandboxed viewer */}
            <button
              onClick={() => navigate(`/reports/${detail.id}/view${reportHasPdf(detail) ? "?format=pdf" : ""}`)}
              className="flex items-center gap-1.5 rounded-lg border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-xs font-semibold text-gold-300 hover:bg-gold-400/20"
            >
              <ExternalLink size={13} /> {reportHasPdf(detail) ? "View PDF" : "View full report"}
            </button>

            {/* Sections */}
            {detail.sections && (
              <div>
                <div className="flex flex-wrap gap-1.5 mb-3 border-b border-phantix-700/40 pb-3">
                  {Object.keys(detail.sections).filter((k) => !k.startsWith("_")).map((key) => (
                    <button
                      key={key}
                      onClick={() => setDetailTab(key)}
                      className={cx(
                        "rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
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
                      <div className="flex flex-wrap gap-2 text-[12px] text-slate-500">
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

    </div>
  );
}
