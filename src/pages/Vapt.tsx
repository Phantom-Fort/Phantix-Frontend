import React, { useState } from "react";
import { motion } from "framer-motion";
import { Crosshair, Play, Pause, XCircle, GitBranch, ShieldCheck, Sparkles, ChevronRight, UserCheck } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, VerificationBadge, Modal, ProgressBar, Tabs, EmptyState, Spinner } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import { loadVaptBundle } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, titleCase, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { VaptCampaign } from "@/lib/types";

export default function Vapt() {
  const { toast, requireDualControl, dualControl } = useStore();
  const { data, loading } = useResource(loadVaptBundle, {
    campaigns: [],
    findings: [],
    approvals: [],
    securityDbBlocked: false,
    error: null,
  });
  const vaptCampaigns = data.campaigns;
  const vaptFindings = data.findings;
  const vaptApprovals = data.approvals;
  const securityDbBlocked = data.securityDbBlocked;
  const loadError = data.error;
  const [tab, setTab] = useState("campaigns");
  const [selected, setSelected] = useState<VaptCampaign | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const activeSelected = selected && vaptCampaigns.some((c) => c.id === selected.id) ? selected : vaptCampaigns[0] ?? null;
  const campaignFindings = activeSelected ? vaptFindings.filter((f) => f.campaign_id === activeSelected.id) : [];
  const pending = vaptApprovals.filter((a) => a.status === "pending");

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading campaigns…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {securityDbBlocked && <SecurityDbBanner message={loadError} />}
      <PageHeader
        title="VAPT campaigns"
        description="Guided campaigns over the web-scanner pipeline (subfinder → katana → nuclei → sqlmap → gowitness) with rule-based correlation and dual-control gates."
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() =>
                void (async () => {
                  if (!(await requireDualControl("Intelligent plan creation requires a dual-control operate session."))) return;
                  toast("info", "Intelligent plan", "POST /vapt/plan analyzes your inventory and proposes a campaign.");
                })()
              }
            >
              <Sparkles size={15} /> Plan with orchestrator
            </button>
            <button
              className="btn-primary"
              onClick={() =>
                void (async () => {
                  if (await requireDualControl("Campaign creation needs a dual-control operate session.")) setCreateOpen(true);
                })()
              }
            >
              <Crosshair size={15} /> New campaign
            </button>
          </>
        }
      />

      {/* Pending approvals strip */}
      {pending.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <Card className="border-severity-medium/30 bg-severity-medium/5">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-severity-medium/15 text-severity-medium">
                <UserCheck size={18} />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-slate-100">{pending.length} approval{pending.length > 1 ? "s" : ""} waiting</p>
                <p className="text-xs text-slate-400">
                  {pending[0].step} — requires the <strong>{pending[0].role_required}</strong>
                  {(pending[0].role_required === "authorizer"
                    ? dualControl.authorizer?.full_name
                    : dualControl.initiator?.full_name) && (
                    <> ({pending[0].role_required === "authorizer" ? dualControl.authorizer?.full_name : dualControl.initiator?.full_name})</>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary !py-2"
                  onClick={() =>
                    void (async () => {
                      if (!(await requireDualControl("Approving a VAPT step requires the assigned controller's dual-control session."))) return;
                      toast("success", "Decision recorded", "POST /vapt/approvals/{id}/decide");
                    })()
                  }
                >
                  Approve
                </button>
                <button
                  className="btn-danger !py-2"
                  onClick={() =>
                    void (async () => {
                      if (!(await requireDualControl("Rejecting a VAPT step requires the assigned controller's dual-control session."))) return;
                      toast("info", "Rejected", "The campaign step remains blocked.");
                    })()
                  }
                >
                  Reject
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <Tabs
        tabs={[
          { id: "campaigns", label: "Campaigns", count: vaptCampaigns.length },
          { id: "findings", label: "Correlated findings", count: vaptFindings.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "campaigns" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          {/* Campaign list */}
          <div className="space-y-3 xl:col-span-2">
            {vaptCampaigns.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <button onClick={() => setSelected(c)} className={cx("w-full text-left")}>
                  <Card hover className={cx("!p-4 transition-all", activeSelected?.id === c.id && "border-gold-400/50 shadow-glow")}>
                    <div className="flex items-center gap-3">
                      <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", c.status === "active" ? "bg-severity-low/12 text-severity-low" : c.status === "completed" ? "bg-emerald-400/12 text-emerald-400" : "bg-phantix-800/70 text-slate-400")}>
                        <Crosshair size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-100">{c.name}</p>
                        <p className="text-xs text-slate-500">{titleCase(c.campaign_type)} · {c.procedure_key}</p>
                      </div>
                      <StatusBadge status={c.status} />
                      <ChevronRight size={15} className="shrink-0 text-slate-600" />
                    </div>
                    {c.status === "active" && (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                          <span>{c.phase}</span><span className="font-mono">{c.progress}%</span>
                        </div>
                        <ProgressBar value={c.progress} />
                      </div>
                    )}
                  </Card>
                </button>
              </motion.div>
            ))}
          </div>

          {/* Campaign detail */}
          <div className="xl:col-span-3">
            {activeSelected ? (
              <Card>
                <CardHeader
                  title={<span>#{activeSelected.id} · {activeSelected.name}</span>}
                  subtitle={`Created by ${activeSelected.created_by} · ${timeAgo(activeSelected.created_at)}`}
                  action={<StatusBadge status={activeSelected.status} />}
                />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    [activeSelected.asset_count, "Assets in scope"],
                    [activeSelected.findings_count, "Findings"],
                    [activeSelected.requires_approval ? "Yes" : "No", "Approval gate"],
                  ].map(([v, l]) => (
                    <div key={String(l)} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5 text-center">
                      <p className="font-display text-xl font-bold text-white">{v}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{l}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  <p className="label">Lifecycle</p>
                  <div className="flex flex-wrap gap-2">
                    {activeSelected.status === "draft" && (
                      <button
                        className="btn-primary !py-2"
                        onClick={() =>
                          void (async () => {
                            if (!(await requireDualControl("Starting a campaign requires a dual-control operate session."))) return;
                            toast("success", "Campaign starting", "POST /vapt/campaigns/{id}/start → 202 Accepted");
                          })()
                        }
                      >
                        <Play size={14} /> Start
                      </button>
                    )}
                    {activeSelected.status === "active" && (
                      <>
                        <button
                          className="btn-secondary !py-2"
                          onClick={() =>
                            void (async () => {
                              if (!(await requireDualControl("Pausing a campaign requires a dual-control operate session."))) return;
                              toast("info", "Paused", "POST …/pause");
                            })()
                          }
                        >
                          <Pause size={14} /> Pause
                        </button>
                        <button
                          className="btn-danger !py-2"
                          onClick={() =>
                            void (async () => {
                              if (!(await requireDualControl("Cancelling a campaign requires a dual-control operate session."))) return;
                              toast("info", "Cancel requested", "POST …/cancel clears the per-org slot");
                            })()
                          }
                        >
                          <XCircle size={14} /> Cancel
                        </button>
                      </>
                    )}
                    {activeSelected.status === "paused" && (
                      <button
                        className="btn-primary !py-2"
                        onClick={() =>
                          void (async () => {
                            if (!(await requireDualControl("Resuming a campaign requires a dual-control operate session."))) return;
                            toast("success", "Resuming", "POST …/resume (async by default)");
                          })()
                        }
                      >
                        <Play size={14} /> Resume
                      </button>
                    )}
                    {activeSelected.status === "completed" && (
                      <button
                        className="btn-primary !py-2"
                        onClick={() =>
                          void (async () => {
                            if (!(await requireDualControl("Generating a campaign report requires a dual-control operate session."))) return;
                            toast("success", "Report queued", "POST /reports { report_type: vapt_campaign, campaign_id: " + activeSelected.id + " }");
                          })()
                        }
                      >
                        Generate report
                      </button>
                    )}
                  </div>
                  <p className="mt-2.5 text-[11px] leading-4 text-slate-500">
                    State machine: draft → (pending_approval) → active ⇄ paused → completed / failed / cancelled.
                    Starts are async (run_inline=false) to avoid Cloudflare 504s — completion queues an alert.
                  </p>
                </div>

                <div className="mt-5">
                  <p className="label">Correlated findings ({campaignFindings.length})</p>
                  <div className="space-y-2">
                    {campaignFindings.length === 0 && <p className="text-sm text-slate-500">No correlated findings yet — raw tool rows live under Scans → Results.</p>}
                    {campaignFindings.slice(0, 4).map((f) => (
                      <div key={f.id} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{f.title}</p>
                          <SeverityBadge severity={f.severity} />
                          <VerificationBadge status={f.verification_status} />
                        </div>
                        {f.attack_path.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            <GitBranch size={11} className="text-gold-400" />
                            {f.attack_path.map((hop, i) => (
                              <span key={i} className="flex items-center gap-1.5">
                                <span className="rounded-md bg-phantix-800/80 px-1.5 py-0.5 font-mono">{hop}</span>
                                {i < f.attack_path.length - 1 && <ChevronRight size={10} />}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-1.5 flex gap-3 text-[11px] text-slate-500">
                          <span>{f.asset_value}</span>
                          {f.cve && <span className="font-mono text-gold-400">{f.cve}</span>}
                          {f.cvss && <span>CVSS {f.cvss.toFixed(1)}</span>}
                          {f.correlation_rule && <span className="font-mono">{f.correlation_rule}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ) : (
              <Card><EmptyState icon={<Crosshair size={22} />} title="Select a campaign" /></Card>
            )}
          </div>
        </div>
      )}

      {tab === "findings" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2.5">
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-phantix-700/50 bg-phantix-900/50 px-4 py-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold-400" />
            <p className="text-xs leading-5 text-slate-400">
              This table shows <strong className="text-slate-200">correlated attack paths only</strong> (from{" "}
              <span className="font-mono">/vapt/campaigns/{"{id}"}/findings</span>). Attack-path correlations
              auto-verify; heuristic probes do not — see the verification badge on each row.
            </p>
          </div>
          {vaptFindings.map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card hover className="!p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-100">{f.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      campaign #{f.campaign_id} · <span className="font-mono">{f.asset_value}</span>
                      {f.cve && <> · <span className="font-mono text-gold-400">{f.cve}</span></>}
                      {f.cvss && <> · CVSS {f.cvss.toFixed(1)}</>}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500">{f.confidence}% conf</span>
                  <SeverityBadge severity={f.severity} />
                  <VerificationBadge status={f.verification_status} />
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New campaign">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setCreateOpen(false);
            toast("success", "Campaign created", "draft → start when ready. full_vapt requires multi-party approval.");
          }}
        >
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="Q4 external assessment" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input">
                <option value="external">external</option>
                <option value="internal">internal</option>
                <option value="web_scan">web_scan</option>
                <option value="mobile">mobile</option>
              </select>
            </div>
            <div>
              <label className="label">Procedure</label>
              <select className="input">
                <option value="web_scan">web_scan — full web pipeline</option>
                <option value="web_app_scan_only">web_app_scan_only</option>
                <option value="full_vapt">full_vapt (infra + web + gates)</option>
                <option value="infra_scan">infra_scan</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Asset scope</label>
            <select className="input">
              <option>tags = external (18 assets)</option>
              <option>tags = pci-scope (4 assets)</option>
              <option>manual selection…</option>
            </select>
          </div>
          <button className="btn-primary w-full">Create campaign</button>
        </form>
      </Modal>
    </div>
  );
}
