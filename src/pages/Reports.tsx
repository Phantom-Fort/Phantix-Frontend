import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Plus, ShieldCheck, FileDown, KanbanSquare, RefreshCw, Code2, FileCode, ExternalLink } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, Modal, Tabs, ProgressBar, Spinner, EmptyState } from "@/components/ui";
import { loadReportsBundle, patchTrackerFinding } from "@/lib/data";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { timeAgo, formatBytes, titleCase, cx, normalizeReportRow, extractReportFindings, TRACKER_STATUSES } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useSearchParams } from "react-router-dom";
import { isDemoMode } from "@/lib/api";
import { marked } from "marked";
import type { TrackerFinding, TrackerSummary } from "@/lib/types";

marked.setOptions({ breaks: true, gfm: true });

function downloadExt(format: string): string {
  if (format === "markdown") return "md";
  if (format === "docx") return "docx";
  if (format === "xlsx") return "xlsx";
  if (format === "pptx") return "pptx";
  if (format === "html") return "html";
  return format;
}

/** Split output_files into downloadable paths vs error keys (`pptx_error`, etc.). */
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
    if (typeof val === "string" && val.trim() && !val.startsWith("error")) {
      downloads.push({ format: key, path: val });
    }
  }
  return { downloads, errors };
}

function handleDownload(reportId: number, format: string) {
  const ext = downloadExt(format);
  api.download(`/reports/${reportId}/download?format=${format}`).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${reportId}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }).catch(() => {});
}

async function loadMarkdown(reportId: number): Promise<string> {
  try {
    return await api.fetchText(`/reports/${reportId}/download?format=markdown`);
  } catch {
    return "*Could not load markdown content.*";
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
  const [md, setMd] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLoad = async () => {
    if (md !== null) { setOpen(true); return; }
    setLoading(true);
    const text = await loadMarkdown(reportId);
    setMd(text);
    setLoading(false);
    setOpen(true);
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
  const { data, loading, reload, setData } = useResource(
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

  const handleGenerate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAgi && !genForm.campaign_id) {
      toast("error", "Validation", "Please select a campaign.");
      return;
    }
    if (!(await requireDualControl("Generating a report requires a dual-control operate session."))) return;
    setGenSubmitting(true);
    try {
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
        ...(fromAgi ? { source: "phantix_agi", session_id: agiSession ? Number(agiSession) : undefined } : {}),
      });
      setGenOpen(false);
      toast("success", "Report queued", fromAgi ? "Autonomous agent findings submitted to the report engine." : "Poll GET /reports until status=complete. Large PDF/DOCX may take minutes.");
      setTimeout(() => reload(), 800);
    } catch (err: any) {
      toast("error", "Failed", err.message ?? "Report generation failed");
    } finally {
      setGenSubmitting(false);
    }
  }, [genForm, toast, reload, fromAgi, agiSession, params, setData, requireDualControl]);

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
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading reports...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Reports"
        description="Library of generated artifacts (md/json/xlsx/pdf/docx/pptx/html). The tracker tab is a living remediation board — not a report file."
        actions={
          <button className="btn-primary" onClick={() => setGenOpen(true)}>
            <Plus size={15} /> Generate report
          </button>
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
                      {(r.formats_requested || []).map((f: string) => (
                        <button
                          key={f}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDownload(r.id, f); }}
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
                              className="rounded-lg border border-phantix-700/50 bg-phantix-950/70 px-2 py-1 text-xs text-slate-300 outline-none focus:border-gold-400/50"
                            >
                              {trackerStatuses.map((s) => (
                                <option key={s} value={s}>{titleCase(s)}</option>
                              ))}
                            </select>
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
                        onClick={() => handleDownload(detail.id, fmt)}
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
    </div>
  );
}
