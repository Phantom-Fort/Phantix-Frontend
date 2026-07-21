import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Radar, Plus, ShieldCheck, Lock, AlertTriangle, XCircle, Search } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, VerificationBadge, Modal, ProgressBar, Tabs, Spinner } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import { loadScansBundle } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, formatDateTime, cx, severityHex } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { VerificationStatus } from "@/lib/types";

export default function Scans() {
  const { toast, requireDualControl } = useStore();
  const { data, loading } = useResource(loadScansBundle, {
    scanJobs: [],
    scanResults: [],
    securityDbBlocked: false,
    error: null,
  });
  const { scanJobs, scanResults, securityDbBlocked, error: loadError } = data;
  const [tab, setTab] = useState("jobs");
  const [verFilter, setVerFilter] = useState<"all" | VerificationStatus>("all");
  const [newOpen, setNewOpen] = useState(false);
  const active = scanJobs.find((j) => j.status === "running" || j.status === "queued");

  const results = useMemo(
    () => scanResults.filter((r) => verFilter === "all" || r.verification_status === verFilter),
    [scanResults, verFilter],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading scans…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {securityDbBlocked && <SecurityDbBanner message={loadError} />}
      <PageHeader
        title="Scans"
        description="On-demand Nmap + Nuclei jobs. One active job per organization — the lock is enforced with a unique partial index, so 409 means someone else is scanning."
        actions={
          <button
            className="btn-primary"
            onClick={() =>
              void (async () => {
                if (!(await requireDualControl("Launching scans requires a dual-control operate session."))) return;
                if (active) return toast("error", "Scan slot locked", `Job #${active.id} is ${active.status} — wait or cancel it first.`);
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
                  <p className="font-semibold text-slate-100">Job #{active.id} — {active.tools.join(" + ")}</p>
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
                {scanJobs.map((j) => (
                  <tr key={j.id} className="border-b border-phantix-800/40 transition-colors hover:bg-phantix-800/35">
                    <td className="td font-mono font-semibold text-slate-200">#{j.id}</td>
                    <td className="td">
                      <div className="flex gap-1.5">
                        {j.tools.map((t) => (
                          <span key={t} className="rounded-md bg-phantix-800/80 px-1.5 py-0.5 font-mono text-[10px] text-phantix-300">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="td"><span className="font-mono text-xs text-slate-500">{JSON.stringify(j.target_filter)}</span></td>
                    <td className="td"><StatusBadge status={j.status} /></td>
                    <td className="td font-semibold text-slate-200">{j.findings_count}</td>
                    <td className="td text-xs text-slate-400">{j.initiated_by}</td>
                    <td className="td text-xs text-slate-500">{j.finished_at ? formatDateTime(j.finished_at) : "—"}</td>
                  </tr>
                ))}
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
              <strong className="text-emerald-400">verified</strong> rows feed risks and client reports — unverified
              heuristics are held out by the reporting gate.
            </p>
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {(["all", "auto_verified", "manually_verified", "unverified", "rejected"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVerFilter(v)}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
                  verFilter === v ? "border-gold-400/40 bg-gold-400/12 text-gold-300" : "border-phantix-700/50 text-slate-400 hover:bg-phantix-800/60",
                )}
              >
                {v === "all" ? "All" : v.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {results.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card hover className="!p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: severityHex[r.severity], boxShadow: `0 0 10px ${severityHex[r.severity]}88` }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-100">{r.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <span className="font-mono">{r.asset_value}</span> · {r.tool} · job #{r.scan_job_id} · {timeAgo(r.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="hidden font-mono text-xs text-slate-500 sm:block">{r.confidence}% conf</span>
                      <SeverityBadge severity={r.severity} />
                      <VerificationBadge status={r.verification_status} />
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* New scan modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New scan job">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setNewOpen(false);
            toast("success", "Scan job created", "POST /scans/jobs → run with /jobs/{id}/run. Duplicate idempotency keys return the existing job.");
          }}
        >
          <div>
            <label className="label">Tools</label>
            <div className="flex gap-2">
              {["nmap", "nuclei", "apk"].map((t) => (
                <label key={t} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-phantix-700/50 bg-phantix-950/50 py-2.5 text-sm text-slate-300 has-[:checked]:border-gold-400/50 has-[:checked]:bg-gold-400/10 has-[:checked]:text-gold-300">
                  <input type="checkbox" defaultChecked={t !== "apk"} className="h-3.5 w-3.5 accent-gold-400" />
                  <span className="font-mono">{t}</span>
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
