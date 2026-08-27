import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Radar, Plus, ShieldCheck, Lock, AlertTriangle, XCircle, Search, CheckCircle2, Ban, ChevronRight, ChevronDown, Github } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, VerificationBadge, ImpactBadge, ImpactPanel, Modal, ProgressBar, Tabs, Spinner, EmptyState } from "@/components/ui";
import { Pagination } from "@/components/Pagination";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import { loadScansBundle, verifyScanResult } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { useOperations } from "@/lib/operations";
import { timeAgo, formatDateTime, cx, severityHex } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { VerificationStatus, ScanResult } from "@/lib/types";

const DEFAULT_PAGE_SIZE = 20;

export default function Scans() {
  const { toast, requireDualControl } = useStore();
  const { data, loading, reload } = useResource(loadScansBundle, {
    scanJobs: [],
    scanResults: [],
    securityDbBlocked: false,
    error: null,
  }, "scans");
  const { scanJobs, scanResults, securityDbBlocked, error: loadError } = data;
  const [tab, setTab] = useState("jobs");
  const [verFilter, setVerFilter] = useState<"all" | VerificationStatus>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<ScanResult | null>(null);
  const [note, setNote] = useState("");
  const [verifyBusy, setVerifyBusy] = useState<VerificationStatus | null>(null);
  /** Network/vuln job that holds the single active scan slot (GITHUB_ANALYSIS_SCAN_JOB_FE.md:
   *  github_analysis is a SEPARATE family and must NOT block network scans). */
  const isGithubAnalysis = (j: { job_type?: string; tools?: string[] }) =>
    j.job_type === "github_analysis" || (j.tools ?? []).includes("github_analysis");
  const runningFilter = (j: { status?: string }) => j.status === "running" || j.status === "queued";
  const active = scanJobs.find((j) => runningFilter(j) && !isGithubAnalysis(j));
  const githubActive = scanJobs.find((j) => runningFilter(j) && isGithubAnalysis(j));

  // Surface the running scan job in the global operations tray (Coolify-style).
  const { register, update } = useOperations();
  const opIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (active) {
      const label = `Scan job #${active.id}`;
      if (!opIdRef.current) {
        opIdRef.current = register({ key: `scan:${active.id}`, label, route: "/scans", detail: `${(active.tools ?? []).join(" + ")} · ${active.progress}%` });
      } else {
        update(opIdRef.current, { label, status: "running", detail: `${(active.tools ?? []).join(" + ")} · ${active.progress}%` });
      }
    } else if (opIdRef.current) {
      update(opIdRef.current, { status: "success", detail: "Scan job completed" });
      opIdRef.current = null;
    }
  }, [active, register, update]);

  // Poll while a job is running so the tray stays live.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (active && !pollTimer.current) {
      pollTimer.current = setInterval(() => { void reload(); }, 5000);
    } else if (!active && !githubActive && pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    return () => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } };
  }, [active, githubActive, reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scanResults.filter((r) => {
      if (verFilter !== "all" && r.verification_status !== verFilter) return false;
      if (!q) return true;
      return [r.title, r.asset_value, r.tool, r.severity, String(r.id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [scanResults, verFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  useEffect(() => { setPage(1); }, [query, verFilter, pageSize]);

  const handleVerify = async (status: VerificationStatus) => {
    if (!selected) return;
    if (!(await requireDualControl("Changing a finding's verification status requires a dual-control operate session."))) return;
    setVerifyBusy(status);
    try {
      const updated = await verifyScanResult(selected.id, { verification_status: status as "manually_verified" | "rejected" | "false_positive", note: note || undefined });
      if (updated) {
        setSelected(updated);
        setNote("");
        toast("success", "Verification updated", `${status.replace(/_/g, " ")} — the reporting gate now reflects this decision.`);
        reload();
      }
    } catch (e: any) {
      toast("error", "Verification failed", e?.message || "Could not update verification");
    } finally {
      setVerifyBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading scans...
      </div>
    );
  }

  const selVer = selected ? ((selected.evidence?.verification ?? {}) as any) : {};
  const selImpact = selected ? (selected.evidence?.impact_analysis ?? {}) : {};

  return (
    <div className="mx-auto max-w-[1400px]">
      {securityDbBlocked && <SecurityDbBanner message={loadError} />}
      <PageHeader
        title="Scans"
        description="On-demand Nmap + Nuclei jobs and separate GitHub analysis jobs. The 409 lock is per job family: one active network/vuln scan plus one active GitHub analysis can run at the same time."
        actions={
          <button
            className="btn-primary"
            onClick={() =>
              void (async () => {
                if (!(await requireDualControl("Launching scans requires a dual-control operate session."))) return;
                if (active) return toast("error", "Scan slot locked", `Job #${active.id} is ${active.status} --- wait or cancel it first.`);
                setNewOpen(true);
              })()
            }
          >
            <Plus size={15} /> New scan job
          </button>
        }
      />

      {/* Active job banner */}
      {active && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <Card className="border-severity-low/30">
            <div className="flex flex-wrap items-center gap-5">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-severity-low/12 text-severity-low">
                <Radar size={19} />
                <span className="absolute inset-0 animate-ping rounded-xl bg-severity-low/20" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <p className="font-semibold text-slate-100">Job #{active.id} --- {(active.tools ?? []).join(" + ")}</p>
                  <StatusBadge status={active.status} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Started {timeAgo(active.started_at)} by {active.initiated_by} · idempotency {active.idempotency_key}
                </p>
                <div className="mt-2.5 max-w-md"><ProgressBar value={active.progress} color="#38BDF8" /></div>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-bold text-white">{active.progress}%</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{active.findings_count} findings</p>
              </div>
              <button
                className="btn-danger !py-2"
                onClick={() =>
                  void (async () => {
                    if (!(await requireDualControl("Cancelling a scan requires a dual-control operate session."))) return;
                    toast("info", "Cancel requested", `POST /scans/jobs/${active.id}/cancel`);
                  })()
                }
              >
                <XCircle size={14} /> Cancel
              </button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Separate GitHub analysis family — does NOT hold the network scan slot. */}
      {githubActive && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <Card className="border-phantix-500/30">
            <div className="flex flex-wrap items-center gap-5">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-phantix-500/12 text-phantix-300">
                <Github size={19} />
                <span className="absolute inset-0 animate-ping rounded-xl bg-phantix-500/20" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <p className="font-semibold text-slate-100">GitHub analysis #{githubActive.id}</p>
                  <StatusBadge status={githubActive.status} />
                  <span className="chip border-phantix-500/30 bg-phantix-500/10 text-phantix-200">separate from network scans</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Secret patterns + OSV/Exploit-DB on pinned versions · started {timeAgo(githubActive.started_at)}
                </p>
                <div className="mt-2.5 max-w-md"><ProgressBar value={githubActive.progress} color="rgb(var(--phantix-400))" /></div>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-bold text-white">{githubActive.progress}%</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{githubActive.findings_count} findings</p>
              </div>
              <a href="/assets" className="btn-secondary !py-2">
                <Github size={14} /> Back to assets
              </a>
            </div>
          </Card>
        </motion.div>
      )}

      <Tabs
        tabs={[
          { id: "jobs", label: "Job history", count: scanJobs.length },
          { id: "results", label: "Results", count: scanResults.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "jobs" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="!p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th">Job</th>
                  <th className="th">Tools</th>
                  <th className="th">Scope</th>
                  <th className="th">Status</th>
                  <th className="th">Findings</th>
                  <th className="th">Initiated by</th>
                  <th className="th">Finished</th>
                </tr>
              </thead>
              <tbody>
                {scanJobs.map((j) => {
                  const isGitHub = isGithubAnalysis(j);
                  return (
                  <tr key={j.id} className="border-b border-phantix-800/40 transition-colors hover:bg-phantix-800/35">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-200">#{j.id}</span>
                        <span className={cx("chip text-[9px]", isGitHub ? "border-phantix-500/30 bg-phantix-500/10 text-phantix-300" : "border-phantix-700/40 bg-phantix-800/50 text-slate-400")}>
                          {isGitHub ? <><Github size={9} /> GitHub analysis</> : "network/vuln"}
                        </span>
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex gap-1.5">
                        {(j.tools ?? []).map((t) => (
                          <span key={t} className="rounded-md bg-phantix-800/80 px-1.5 py-0.5 font-mono text-[10px] text-phantix-300">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="td"><span className="font-mono text-xs text-slate-500">{JSON.stringify(j.target_filter)}</span></td>
                    <td className="td"><StatusBadge status={j.status} /></td>
                    <td className="td font-semibold text-slate-200">{j.findings_count}</td>
                    <td className="td text-xs text-slate-400">{j.initiated_by}</td>
                    <td className="td text-xs text-slate-500">{j.finished_at ? formatDateTime(j.finished_at) : "---"}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </motion.div>
      )}

      {tab === "results" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Verification explainer */}
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-gold-400/20 bg-gold-400/5 px-4 py-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold-400" />
            <p className="text-xs leading-5 text-slate-400">
              Each result carries <span className="font-mono text-slate-300">evidence.verification</span>. Only{" "}
              <strong className="text-emerald-400">verified</strong> rows feed risks and client reports --- unverified
              heuristics are held out by the reporting gate. Click a result to review it and apply a manual decision.
            </p>
          </div>

          {/* Filters + search */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="input !w-64 !py-2 pl-8"
                placeholder="Search title, asset, tool, CVE..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "auto_verified", "manually_verified", "unverified", "rejected", "false_positive"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVerFilter(v)}
                  className={cx(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
                    verFilter === v ? "border-gold-400/40 bg-gold-400/12 text-gold-300" : "border-phantix-700/50 text-slate-400 hover:bg-phantix-800/60",
                  )}
                >
                  {v === "all" ? "All" : v.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {paginated.length === 0 && (
              <Card><EmptyState icon={<Search size={20} />} title="No scan results" body="Adjust filters or run a new scan job." /></Card>
            )}
            {paginated.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <button className="block w-full text-left" onClick={() => { setSelected(r); setNote(""); }}>
                  <Card hover className="!p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: severityHex[r.severity], boxShadow: `0 0 10px ${severityHex[r.severity]}88` }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-100">{r.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          <span className="font-mono">{r.asset_value || "—"}</span> · {r.tool} · job #{r.scan_job_id} · {timeAgo(r.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const conf = r.evidence?.verification?.confidence ?? r.confidence;
                          const reportable = r.evidence?.verification?.reportable ?? r.reportable;
                          const verStatus = r.verification_status;
                          const impact = r.impact_level;
                          const impactScore = r.impact_score;
                          return (
                            <>
                              {conf != null && <span className="hidden font-mono text-xs text-slate-500 sm:block">{conf} conf</span>}
                              {reportable === true && <span className="chip text-[10px] text-emerald-400 bg-emerald-400/10 border-emerald-400/30">Reportable</span>}
                              {reportable === false && <span className="chip text-[10px] text-slate-500 bg-slate-400/10 border-slate-500/30">Held</span>}
                              <SeverityBadge severity={r.severity} />
                              {impact != null && <ImpactBadge level={impact} score={impactScore} />}
                              <VerificationBadge status={verStatus} />
                            </>
                          );
                        })()}
                      </div>
                      <ChevronRight size={15} className="shrink-0 text-slate-600" />
                    </div>
                  </Card>
                </button>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <Pagination
              totalItems={filtered.length}
              page={safePage}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </motion.div>
      )}

      {/* Result detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? "Scan result"} wide>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={selected.severity} />
              <VerificationBadge status={selected.verification_status} />
              {selected.reportable === true && <span className="chip text-[10px] text-emerald-400 bg-emerald-400/10 border-emerald-400/30">Reportable</span>}
              {selected.reportable === false && <span className="chip text-[10px] text-slate-500 bg-slate-400/10 border-slate-500/30">Held from reports</span>}
              {(selected.impact_level as string) && <ImpactBadge level={selected.impact_level} score={selected.impact_score} />}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Asset</p>
                <p className="mt-0.5 font-mono text-slate-200">{selected.asset_value || "—"}</p>
              </div>
              <div className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Tool / Job</p>
                <p className="mt-0.5 font-mono text-slate-200">{selected.tool} · #{selected.scan_job_id}</p>
              </div>
              <div className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Detected</p>
                <p className="mt-0.5 text-slate-200">{formatDateTime(selected.created_at)}</p>
              </div>
              <div className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Result ID</p>
                <p className="mt-0.5 font-mono text-slate-200">#{selected.id}</p>
              </div>
            </div>

            {selected.description && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Description</p>
                <p className="text-sm leading-6 text-slate-300">{selected.description}</p>
              </div>
            )}

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Verification</p>
              <div className="space-y-1.5 rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3 text-xs">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-slate-500">Status: <span className="font-medium text-slate-200">{selected.verification_status}</span></span>
                  {selVer.confidence && <span className="text-slate-500">Confidence: <span className="font-mono text-slate-200">{selVer.confidence}</span></span>}
                  {selVer.method && <span className="text-slate-500">Method: <span className="font-mono text-slate-200">{selVer.method}</span></span>}
                </div>
                {selVer.verification_reason && <p className="text-slate-400">{selVer.verification_reason}</p>}
                {selVer.verified_by && <p className="text-[11px] text-slate-500">Reviewed by {selVer.verified_by}{selVer.verified_at ? ` · ${formatDateTime(selVer.verified_at)}` : ""}</p>}
              </div>
            </div>

            {selImpact?.impact_level && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Impact analysis</p>
                <ImpactPanel impact={selImpact} />
              </div>
            )}

            {(selected as any).evidence && Object.keys((selected as any).evidence).length > 0 && (
              <details className="text-xs">
                <summary className="flex cursor-pointer items-center gap-1 text-slate-500 hover:text-slate-300 text-[11px]">
                  <ChevronDown size={12} /> Raw evidence
                </summary>
                <pre className="mt-2 max-h-60 overflow-auto rounded-lg border border-phantix-700/40 bg-phantix-950/70 p-2.5 font-mono text-[10px] leading-4 text-slate-400">
                  {JSON.stringify((selected as any).evidence, null, 2)}
                </pre>
              </details>
            )}

            <div className="border-t border-phantix-700/40 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Manual review decision</p>
              <textarea
                className="input mb-3 min-h-[64px] w-full resize-y"
                placeholder="Optional note (e.g. evidence confirmed on retest, customer verified, duplicates CVE-XXXX...)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-primary !py-2 text-sm"
                  disabled={verifyBusy !== null || selected.verification_status === "manually_verified"}
                  onClick={() => void handleVerify("manually_verified")}
                >
                  {verifyBusy === "manually_verified" ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 size={14} />} Verify
                </button>
                <button
                  className="btn-danger !py-2 text-sm"
                  disabled={verifyBusy !== null || selected.verification_status === "false_positive"}
                  onClick={() => void handleVerify("false_positive")}
                >
                  {verifyBusy === "false_positive" ? <Spinner className="h-3.5 w-3.5" /> : <AlertTriangle size={14} />} False positive
                </button>
                <button
                  className="btn-secondary !py-2 text-sm"
                  disabled={verifyBusy !== null || selected.verification_status === "rejected"}
                  onClick={() => void handleVerify("rejected")}
                >
                  {verifyBusy === "rejected" ? <Spinner className="h-3.5 w-3.5" /> : <Ban size={14} />} Reject
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                <Lock size={10} className="mr-1 inline text-gold-400" />
                Decision persists via PATCH /scans/results/{selected.id}/verification and is picked up by the reporting gate.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* New scan modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New scan job">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setNewOpen(false);
            toast("success", "Scan job created", "POST /scans/jobs ? run with /jobs/{id}/run. Duplicate idempotency keys return the existing job.");
          }}
        >
          <div>
            <label className="label">Tools</label>
            <div className="flex gap-2">
              {["nmap", "nuclei", "apk"].map((t) => (
                <label key={t} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-phantix-700/50 bg-phantix-950/50 py-2.5 text-sm text-slate-300">
                  <input type="checkbox" defaultChecked={t !== "apk"} className="peer h-3.5 w-3.5 accent-gold-400" />
                  <span className="font-mono transition-colors peer-checked:text-gold-300">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Target filter</label>
            <select className="input">
              <option value="tags:external">tags = external</option>
              <option value="tags:pci-scope">tags = pci-scope</option>
              <option value="types:web_app,api">types = web_app, api</option>
              <option value="all">entire inventory</option>
            </select>
          </div>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3.5 text-xs leading-5 text-slate-500">
            <Lock size={12} className="mr-1.5 inline text-gold-400" />
            SSRF-guarded: http/https only, private ranges and cloud metadata blocked, DNS rebinding defense.
            Tool execution prefers Docker isolation with a per-org asyncio lock.
          </div>
          <button className="btn-primary w-full">Create job</button>
        </form>
      </Modal>
    </div>
  );
}
