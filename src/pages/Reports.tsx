import React, { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Plus, ShieldCheck, FileDown, KanbanSquare } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, Modal, Tabs, ProgressBar, Spinner } from "@/components/ui";
import { loadReportsBundle } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, formatBytes, titleCase, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";

const trackerStatuses = ["open", "in_progress", "resolved", "accepted", "verified", "false_positive"] as const;

export default function Reports() {
  const { toast } = useStore();
  const { data, loading } = useResource(loadReportsBundle, { reports: [], trackerFindings: [] });
  const { reports, trackerFindings } = data;
  const [tab, setTab] = useState("reports");
  const [genOpen, setGenOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading reports…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Reports"
        description="Consolidated, CVSS-enriched, verified-only client packages — PDF/DOCX on the Phantix VAPT template, plus markdown, JSON, XLSX and CSV."
        actions={
          <button className="btn-primary" onClick={() => setGenOpen(true)}>
            <Plus size={15} /> Generate report
          </button>
        }
      />

      <Tabs
        tabs={[
          { id: "reports", label: "Report versions", count: reports.length },
          { id: "tracker", label: "Finding tracker", count: trackerFindings.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "reports" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Verification gate explainer */}
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
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400">
                    <FileText size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-100">{r.title}</p>
                      <StatusBadge status={r.status} />
                      <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-400">v{r.version}</span>
                      <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-400">{titleCase(r.report_type)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {r.campaign_id ? `Campaign #${r.campaign_id} · ` : ""}{timeAgo(r.created_at)} · {formatBytes(r.size_bytes)}
                    </p>
                  </div>

                  {/* Verification stats */}
                  <div className="hidden items-center gap-4 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-2.5 lg:flex">
                    {([
                      [r.stats.after_dedupe, "deduped", "text-phantix-300"],
                      [r.stats.after_verification, "verified", "text-emerald-400"],
                      [r.stats.excluded_from_report, "excluded", "text-severity-critical"],
                    ] as [number, string, string][]).map(([v, l, c]) => (
                      <div key={String(l)} className="text-center">
                        <p className={cx("font-display text-lg font-bold", c)}>{v}</p>
                        <p className="text-[9px] uppercase tracking-wider text-slate-600">{l}</p>
                      </div>
                    ))}
                  </div>

                  {r.status === "generating" ? (
                    <div className="w-40">
                      <p className="mb-1 text-right text-[11px] text-slate-500">rendering…</p>
                      <ProgressBar value={72} color="#38BDF8" />
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      {r.formats.map((f) => (
                        <button
                          key={f}
                          onClick={() => toast("info", `Downloading ${f.toUpperCase()}`, `GET /reports/${r.id}/download?format=${f} — bytes with Content-Disposition.`)}
                          className={cx(
                            "rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase transition-colors",
                            f === "pdf" || f === "docx"
                              ? "border-gold-400/40 bg-gold-400/10 text-gold-300 hover:bg-gold-400/20"
                              : "border-phantix-700/50 text-slate-400 hover:bg-phantix-800/60",
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}

          <p className="text-xs text-slate-500">
            Retention: REPORT_MAX_VERSIONS=3 per type — oldest archives automatically with a ReportArchived
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
              The tracker is org-scoped and survives campaigns. Marking findings{" "}
              <strong className="text-emerald-400">verified</strong> or{" "}
              <strong className="text-slate-200">false_positive</strong> feeds future verification classification.
            </p>
          </div>

          <Card className="!p-0 overflow-hidden">
            <table className="w-full">
              <thead>
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
                  <tr key={f.finding_key} className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                    <td className="td font-mono text-xs font-semibold text-gold-300">{f.finding_key}</td>
                    <td className="td max-w-[280px]">
                      <p className="truncate font-medium text-slate-200">{f.title}</p>
                      <p className="text-xs text-slate-500">{f.campaign_name}</p>
                    </td>
                    <td className="td"><SeverityBadge severity={f.severity} /></td>
                    <td className="td font-mono text-xs text-slate-400">{f.asset_value}</td>
                    <td className="td text-xs text-slate-400">{f.owner ?? <span className="text-slate-600">unassigned</span>}</td>
                    <td className="td">
                      <select
                        defaultValue={f.status}
                        onChange={(e) => toast("success", "Tracker updated", `PATCH /reports/tracker/${f.finding_key} → ${e.target.value}`)}
                        className="rounded-lg border border-phantix-700/50 bg-phantix-950/70 px-2 py-1 text-xs text-slate-300 outline-none focus:border-gold-400/50"
                      >
                        {trackerStatuses.map((s) => (
                          <option key={s} value={s}>{titleCase(s)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="td text-xs text-slate-500">{timeAgo(f.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </motion.div>
      )}

      {/* Generate modal */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate report">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setGenOpen(false);
            toast("success", "Report queued", "POST /reports with run_inline=false — poll until complete. PDF/DOCX use the VAPT deliverable template.");
          }}
        >
          <div>
            <label className="label">Report type</label>
            <select className="input">
              <option value="vapt_campaign">vapt_campaign — full client package</option>
              <option value="executive">executive — board summary</option>
              <option value="compliance">compliance — framework-first</option>
              <option value="tracker">tracker — remediation snapshot</option>
            </select>
          </div>
          <div>
            <label className="label">Campaign</label>
            <select className="input">
              <option value="13">Q3 External Assessment (active)</option>
              <option value="12">Payments API Deep Dive (completed)</option>
              <option value="11">Monthly Infrastructure Sweep (completed)</option>
            </select>
          </div>
          <div>
            <label className="label">Formats</label>
            <div className="grid grid-cols-3 gap-2">
              {["pdf", "docx", "markdown", "json", "xlsx", "csv"].map((f) => (
                <label key={f} className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-phantix-700/50 bg-phantix-950/50 py-2 font-mono text-xs text-slate-300 has-[:checked]:border-gold-400/50 has-[:checked]:bg-gold-400/10 has-[:checked]:text-gold-300">
                  <input type="checkbox" defaultChecked={["pdf", "docx", "markdown", "json"].includes(f)} className="h-3 w-3 accent-gold-400" />
                  {f}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3.5 text-xs leading-5 text-slate-500">
            <FileDown size={12} className="mr-1.5 inline text-gold-400" />
            Executive PDF/DOCX follow the standard deliverable: cover → document control → §§1–9 (exec, scope,
            priority findings with confidence, attack paths, technical catalogue, risk split, compliance, roadmap,
            methodology) → Appendix A evidence IDs.
          </div>
          <button className="btn-primary w-full"><Download size={15} /> Generate</button>
        </form>
      </Modal>
    </div>
  );
}
