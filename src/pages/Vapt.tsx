import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Crosshair, Play, Pause, XCircle, GitBranch, ShieldCheck, Sparkles, ChevronRight, UserCheck, Radar, Globe, Activity, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, VerificationBadge, Modal, ProgressBar, Tabs, EmptyState, Spinner } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import { loadVaptBundle } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, titleCase, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { VaptCampaign } from "@/lib/types";

export default function Vapt() {
  const { toast, requireDualControl, dualControl } = useStore();
  const { data, loading, reload } = useResource(loadVaptBundle, {
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
  const [planning, setPlanning] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", campaign_type: "web_scan", procedure_key: "web_scan" });

  const activeSelected = selected && vaptCampaigns.some((c) => c.id === selected.id) ? selected : vaptCampaigns[0] ?? null;
  const campaignFindings = activeSelected ? vaptFindings.filter((f) => f.campaign_id === activeSelected.id) : [];
  const pending = vaptApprovals.filter((a) => a.status === "pending");

  // Campaign action handlers
  const handleCampaignAction = async (id: number, action: string, extra?: Record<string, unknown>) => {
    if (!(await requireDualControl(`${action} campaign requires a dual-control operate session.`))) return;
    try {
      await api.post(`/vapt/campaigns/${id}/${action}`, extra || {});
      toast("success", `${action}`, `Campaign #${id} ${action} requested`);
      reload();
    } catch (e: any) {
      if (e.status === 409) {
        toast("warning", "Concurrent campaign", "Another campaign is already running. Pause or cancel it first.");
      } else {
        toast("error", `${action} failed`, e.message || "");
      }
    }
  };

  const handleApprove = async (approvalId: number, approve: boolean) => {
    if (!(await requireDualControl("Approval requires the assigned controller's dual-control session."))) return;
    try {
      await api.post(`/vapt/approvals/${approvalId}/decide`, approve
        ? { approve: true, notes: "Approved" }
        : { approve: false, rejection_reason: "Rejected" });
      toast("success", approve ? "Approved" : "Rejected");
      reload();
    } catch (e: any) { toast("error", "Decision failed", e.message || ""); }
  };

  const handleCreate = async () => {
    if (!createForm.name) { toast("error", "Enter a campaign name"); return; }
    if (!(await requireDualControl("Campaign creation needs a dual-control operate session."))) return;
    try {
      const res = await api.post("/vapt/campaigns", {
        campaign_name: createForm.name,
        campaign_type: createForm.campaign_type,
        procedure_key: createForm.procedure_key,
        run_inline: false,
      });
      toast("success", "Campaign created", "draft → start when ready");
      setCreateOpen(false);
      setCreateForm({ name: "", campaign_type: "web_scan", procedure_key: "web_scan" });
      reload();
    } catch (e: any) {
      if (e.status === 409) {
        toast("warning", "Another campaign is already running", "Pause or cancel the active campaign before creating a new one.");
      } else {
        toast("error", "Create failed", e.message || "");
      }
    }
  };

  const handlePlan = async () => {
    if (!(await requireDualControl("Intelligent plan requires a dual-control operate session."))) return;
    setPlanning(true);
    try {
      const plan = await api.post<{ plan_id: string; recommended_scans?: string[] }>("/vapt/plan", {});
      if (plan.plan_id) {
        // Execute but do NOT auto-start --- let the initiator review the draft first
        await api.post("/vapt/plan/execute", { plan_id: plan.plan_id, start: false }).catch((e: any) => {
          if (e.status === 400) toast("warning", "Draft created", "Review the plan and start when ready.");
          else throw e;
        });
        toast("success", "Plan generated", "Review the draft and submit for approval or start");
        reload();
      }
    } catch (e: any) {
      if (e.status === 409) toast("warning", "Another campaign is already running", "Pause or cancel it first.");
      else toast("error", "Plan failed", e.message || "");
    }
    finally { setPlanning(false); }
  };

  // Poll when campaigns are live --- follows same pattern as Assets discovery polling
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeCampaigns = React.useMemo(() =>
    vaptCampaigns.filter((c) => c.status === "active" || c.status === "pending_approval" || c.status === "paused"),
    [vaptCampaigns]
  );

  const pollCampaigns = React.useCallback(async () => {
    try {
      const raw = await api.get<any>("/vapt/campaigns?limit=50");
      const campaigns = Array.isArray(raw) ? raw : (raw?.items ?? raw?.value ?? []);
      const stillActive = campaigns.filter((c: any) =>
        c.status === "active" || c.status === "pending_approval" || c.status === "paused"
      );
      if (stillActive.length === 0) {
        if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
        reload();
      }
    } catch { /* silent */ }
  }, [reload]);

  useEffect(() => {
    if (activeCampaigns.length > 0 && !pollTimer.current) {
      pollTimer.current = setInterval(pollCampaigns, 5000);
    } else if (activeCampaigns.length === 0 && pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    return () => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } };
  }, [activeCampaigns.length, pollCampaigns]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading campaigns...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {securityDbBlocked && <SecurityDbBanner message={loadError} />}
      <PageHeader
        title="VAPT campaigns"
        description="Create VAPT campaigns manually or generate an intelligent assessment plan. Review the draft, then submit for authorizer approval or start directly."
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={handlePlan}
              disabled={planning}
            >
              <Sparkles size={15} /> {planning ? "Planning..." : "Intelligent Plan"}
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
                  {pending[0].step} --- requires the <strong>{pending[0].role_required}</strong>
                  {(pending[0].role_required === "authorizer"
                    ? dualControl.authorizer?.full_name
                    : dualControl.initiator?.full_name) && (
                    <> ({pending[0].role_required === "authorizer" ? dualControl.authorizer?.full_name : dualControl.initiator?.full_name})</>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary !py-2" onClick={() => handleApprove(pending[0].id, true)}>Approve</button>
                <button className="btn-danger !py-2" onClick={() => handleApprove(pending[0].id, false)}>Reject</button>
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
                      <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", c.status === "active" ? "bg-emerald-400/12 text-emerald-400" : c.status === "pending_approval" ? "bg-severity-medium/12 text-severity-medium" : c.status === "completed" ? "bg-emerald-400/12 text-emerald-400" : "bg-phantix-800/70 text-slate-400")}>
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
                  title={<span className="text-base font-display font-semibold">{activeSelected.name}</span>}
                  subtitle={
                    <span className="text-xs">
                      #{activeSelected.id} · {titleCase(activeSelected.campaign_type)} · {activeSelected.procedure_key} · {timeAgo(activeSelected.created_at)}
                    </span>
                  }
                  action={<StatusBadge status={activeSelected.status} />}
                />

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    [activeSelected.asset_count ?? "---", "Assets", "text-blue-400"],
                    [activeSelected.findings_count ?? "---", "Findings", "text-emerald-400"],
                    [(activeSelected as any).procedure_snapshot?.steps?.length ?? "---", "Steps", "text-phantix-300"],
                    [activeSelected.requires_approval ? "Yes" : "No", "Approval", activeSelected.requires_approval ? "text-severity-medium" : "text-slate-400"],
                  ].map(([v, l, c]) => (
                    <div key={String(l)} className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2.5 text-center">
                      <p className={cx("font-display text-lg font-bold", c)}>{v}</p>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500">{l}</p>
                    </div>
                  ))}
                </div>

                {/* Intelligent plan steps */}
                {((activeSelected as any).procedure_snapshot?.steps?.length > 0) && (
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      {(activeSelected as any).procedure_snapshot.display_name || "Assessment Plan"}
                      {activeSelected.campaign_type === "intelligent_assessment" && (activeSelected as any).procedure_snapshot.description && (
                        <span className="block font-normal text-[11px] text-slate-500 normal-case tracking-normal mt-0.5">
                          ~1.1 hours · network_scan, dns_scan, web_scan, vuln_scan
                        </span>
                      )}
                    </p>
                    {(activeSelected as any).procedure_snapshot.description && (
                      <p className="text-[11px] text-slate-500 mb-2">{(activeSelected as any).procedure_snapshot.description}</p>
                    )}

                    {/* Plan summary: frameworks + duration */}
                    {((activeSelected as any).asset_scope?.intelligent_plan_id) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[10px] text-slate-500">
                        {(activeSelected as any).asset_scope?.asset_types?.length > 0 && (
                          <span>{((activeSelected as any).asset_scope?.asset_types as string[])?.length ?? 0} asset types</span>
                        )}
                      </div>
                    )}

                    {/* Progress for active campaigns */}
                    {activeSelected.status === "active" && (
                      <div className="mb-3 p-3 rounded-lg bg-blue-400/5 border border-blue-400/20">
                        <div className="flex items-center gap-2 text-xs mb-2">
                          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse-soft" />
                          <span className="text-blue-400 font-medium">Phase: {(activeSelected as any).current_phase || `Step ${((activeSelected as any).current_step_index || 0) + 1}`}</span>
                          <span className="text-slate-500">
                            Step {((activeSelected as any).current_step_index || 0) + 1} of {((activeSelected as any).procedure_snapshot?.steps?.length ?? 0)}
                          </span>
                        </div>
                        <ProgressBar value={(((activeSelected as any).current_step_index || 0) + 1) / (((activeSelected as any).procedure_snapshot?.steps?.length || 1)) * 100} color="#38BDF8" />
                      </div>
                    )}

                    <div className="space-y-0">
                      {((activeSelected as any).procedure_snapshot?.steps || []).map((step: any, i: number) => {
                        const stepType = step.step_type as string;
                        const stepIdx = (activeSelected as any).current_step_index ?? -1;
                        const isCurrent = activeSelected.status === "active" && i === stepIdx;
                        const isCompleted = activeSelected.status === "completed" || (activeSelected.status === "active" && i < stepIdx);
                        const isFailed = activeSelected.status === "failed" && i === stepIdx;
                        const icon = stepType === "scan" ? <Radar size={12} className={isCompleted ? "text-emerald-400" : isCurrent ? "text-blue-400" : "text-slate-500"} />
                          : stepType === "web_scan" ? <Globe size={12} className={isCompleted ? "text-emerald-400" : isCurrent ? "text-blue-400" : "text-slate-500"} />
                          : stepType === "correlate" ? <GitBranch size={12} className={isCompleted ? "text-emerald-400" : isCurrent ? "text-gold-400" : "text-slate-500"} />
                          : stepType === "analyze" ? <Sparkles size={12} className={isCompleted ? "text-emerald-400" : isCurrent ? "text-purple-400" : "text-slate-500"} />
                          : <Activity size={12} className={isCompleted ? "text-emerald-400" : isCurrent ? "text-blue-400" : "text-slate-500"} />;
                        return (
                          <div key={i} className={cx("flex items-start gap-3 py-2 border-b border-phantix-800/40 last:border-0", isCurrent && "bg-blue-400/5 -mx-2 px-2 rounded")}>
                            <div className="flex flex-col items-center shrink-0">
                              <div className={cx("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold", isCompleted ? "bg-emerald-400/20 text-emerald-400" : isCurrent ? "bg-blue-400/20 text-blue-400" : isFailed ? "bg-severity-critical/20 text-severity-critical" : "bg-phantix-800/70 text-slate-300")}>
                                {isCompleted ? <CheckCircle2 size={12} /> : isFailed ? <XCircle size={12} /> : isCurrent ? <Loader2 size={12} className="animate-spin" /> : i + 1}
                              </div>
                              {i < (((activeSelected as any).procedure_snapshot?.steps?.length ?? 0) - 1) && (
                                <div className={cx("w-px h-4 mt-0.5", isCompleted ? "bg-emerald-400/30" : "bg-phantix-700/50")} />
                              )}
                            </div>
                            <div className="min-w-0 pb-1">
                              <p className={cx("text-sm font-medium flex items-center gap-1.5", isCurrent ? "text-blue-300" : isCompleted ? "text-emerald-300" : "text-slate-200")}>
                                {icon} {step.step_name}
                                {step.config?.max_duration_minutes && (
                                  <span className="text-[9px] text-slate-500 font-normal ml-1">~{step.config.max_duration_minutes}m</span>
                                )}
                                {isCurrent && <span className="text-[10px] text-blue-400 font-normal">running</span>}
                                {isCompleted && <span className="text-[10px] text-emerald-400 font-normal">complete</span>}
                              </p>
                              <p className={cx("text-[11px] leading-relaxed", isCurrent ? "text-slate-400" : "text-slate-500")}>{step.step_description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Plan metadata footer */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 bg-phantix-950/50 rounded-lg px-3 py-2">
                      {(activeSelected as any).asset_scope?.asset_types?.length > 0 && (
                        <><span className="w-1 h-1 rounded-full bg-slate-500" />{(activeSelected as any).asset_scope?.asset_types?.length ?? 0} asset types</>
                      )}
                      {(activeSelected as any).procedure_snapshot?.source && (
                        <><span className="w-1 h-1 rounded-full bg-slate-500" />{(activeSelected as any).procedure_snapshot.source.replace(/_/g, " ")}</>
                      )}
                      {activeSelected.campaign_type === "intelligent_assessment" && (
                        <><span className="w-1 h-1 rounded-full bg-slate-500" />auto-generated</>
                      )}
                      {((activeSelected as any).procedure_snapshot?.steps || []).some((s: any) => s.config?.max_duration_minutes) && (
                        <><span className="w-1 h-1 rounded-full bg-slate-500" />time-budgeted</>
                      )}
                      {((activeSelected as any).procedure_snapshot?.steps || []).some((s: any) => s.config?.dedupe_hosts) && (
                        <><span className="w-1 h-1 rounded-full bg-slate-500" />host dedupe</>
                      )}
                    </div>
                    <div className="mt-2 text-[10px] text-slate-600 bg-phantix-950/30 rounded-lg px-3 py-2 leading-relaxed">
                      Each subdomain scanned separately. Domain IPs not re-scanned on vuln steps. Time budgets apply --- partial completion is not a failure.
                    </div>
                  </div>
                )}

                {/* Scan coverage --- for completed/active campaigns with step output */}
                {((activeSelected as any).status === "completed" || (activeSelected as any).status === "active") && (
                  <div className="mb-4">
                    {((activeSelected as any).procedure_snapshot?.steps || []).filter((s: any) => s.output_summary || s.finding_count > 0).length > 0 && (
                      <div className="p-3 rounded-lg bg-phantix-800/30 border border-phantix-700/30 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Scan Results</p>
                        {((activeSelected as any).procedure_snapshot?.steps || []).filter((s: any) => s.output_summary || s.finding_count > 0).slice(0, 3).map((step: any, i: number) => {
                          const summary = step.output_summary || {};
                          const isPartial = summary.budget_exhausted || summary.partial;
                          const uniqueHosts = summary.unique_hosts;
                          const skipped = summary.skipped_count || (summary.skipped_already_scanned?.length || 0);
                          const scanned = summary.targets_scanned?.length || uniqueHosts || "---";
                          return (
                            <div key={i} className="flex items-start gap-2 text-xs border-t border-phantix-700/30 pt-2 first:border-0 first:pt-0">
                              <div className={cx("w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5", isPartial ? "bg-severity-medium/20 text-severity-medium" : "bg-emerald-400/20 text-emerald-400")}>
                                {isPartial ? <AlertTriangle size={10} /> : <CheckCircle2 size={12} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-slate-300 font-medium">{step.step_name}</p>
                                <p className="text-slate-500">
                                  {uniqueHosts != null ? `${uniqueHosts} hosts` : `${scanned} targets`}
                                  {step.finding_count > 0 && <span className="text-slate-400"> · {step.finding_count} findings</span>}
                                  {skipped > 0 && <span className="text-slate-500"> · {skipped} skipped (CDN IPs)</span>}
                                </p>
                                {isPartial && <p className="text-severity-medium text-[10px] mt-0.5">Partial --- time budget reached</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Lifecycle controls */}
                <div className="border-t border-phantix-700/40 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {activeSelected.status === "draft" && (
                      <>
                        <button className="btn-primary !py-2 text-sm" onClick={() => handleCampaignAction(activeSelected.id, "start")}>
                          <Play size={14} /> Start Campaign
                        </button>
                        <p className="w-full text-[10px] text-slate-500">
                          Review the plan above, then start. Full VAPT requires authorizer approval before execution.
                        </p>
                      </>
                    )}
                    {activeSelected.status === "pending_approval" && (
                      <div className="w-full rounded-lg bg-severity-medium/5 border border-severity-medium/30 p-3 text-xs space-y-1.5">
                        <p className="text-severity-medium font-semibold flex items-center gap-1"><UserCheck size={14} /> Awaiting Authorizer Approval</p>
                        <p className="text-slate-300">Campaign submitted for approval --- will start automatically once the authorizer approves.</p>
                        <p className="text-slate-500">Authorize from the <a href="/authorizations" className="text-gold-400 hover:text-gold-300">Authorizations inbox</a>.</p>
                        <button className="btn-danger !py-1.5 text-xs" onClick={() => handleCampaignAction(activeSelected.id, "cancel")}>
                          <XCircle size={12} /> Cancel Request
                        </button>
                      </div>
                    )}
                    {activeSelected.status === "active" && (
                      <>
                        <button className="btn-secondary !py-2 text-sm" onClick={() => handleCampaignAction(activeSelected.id, "pause")}>
                          <Pause size={14} /> Pause
                        </button>
                        <button className="btn-danger !py-2 text-sm" onClick={() => handleCampaignAction(activeSelected.id, "cancel")}>
                          <XCircle size={14} /> Cancel
                        </button>
                      </>
                    )}
                    {activeSelected.status === "paused" && (
                      <button className="btn-primary !py-2 text-sm" onClick={() => handleCampaignAction(activeSelected.id, "resume")}>
                        <Play size={14} /> Resume
                      </button>
                    )}
                    {activeSelected.status === "failed" && (
                      <button className="btn-primary !py-2 text-sm" onClick={() => handleCampaignAction(activeSelected.id, "start")}>
                        <Play size={14} /> Retry
                      </button>
                    )}
                    {activeSelected.status === "cancelled" && (
                      <p className="text-xs text-slate-500">Campaign was cancelled. Create a new one.</p>
                    )}
                    {activeSelected.status === "completed" && (
                      <button className="btn-primary !py-2 text-sm" onClick={() => toast("info", "Report", "Available from /reports")}>
                        Generate Report
                      </button>
                    )}
                  </div>
                </div>

                {/* Findings */}
                <div className="border-t border-phantix-700/40 mt-4 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Findings ({campaignFindings.length})</p>
                  <div className="space-y-2">
                    {campaignFindings.length === 0 && <p className="text-xs text-slate-500">No correlated attack paths yet. Raw findings are under Scans → Results.</p>}
                    {campaignFindings.slice(0, 4).map((f) => (
                      <div key={f.id} className="rounded-lg border border-phantix-700/40 bg-phantix-950/50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 flex-1 text-sm text-slate-200 truncate">{f.title}</p>
                          <SeverityBadge severity={f.severity} />
                          <VerificationBadge status={f.verification_status} />
                        </div>
                        {f.attack_path?.length > 0 && (
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
              auto-verify; heuristic probes do not --- see the verification badge on each row.
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
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="Q4 external assessment" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={createForm.campaign_type} onChange={(e) => setCreateForm((f) => ({ ...f, campaign_type: e.target.value, procedure_key: e.target.value }))}>
                <option value="web_scan">Web Scan</option>
                <option value="infra_scan">Infra Scan</option>
                <option value="api_scan">API Scan</option>
                <option value="full_vapt">Full VAPT</option>
                <option value="mobile_dynamic">Mobile Dynamic</option>
              </select>
            </div>
            <div>
              <label className="label">Procedure</label>
              <select className="input" value={createForm.procedure_key} onChange={(e) => setCreateForm((f) => ({ ...f, procedure_key: e.target.value }))}>
                <option value="web_scan">web_scan --- full web pipeline</option>
                <option value="web_app_scan_only">web_app_scan_only</option>
                <option value="full_vapt">full_vapt (infra + web + gates)</option>
                <option value="infra_scan">infra_scan</option>
                <option value="api_scan">api_scan</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 p-2 rounded-lg bg-phantix-800/40">
            Campaign starts as a <strong>draft</strong> --- you can review and start it from the campaign detail view. Full VAPT requires dual-control approval.
          </p>
          <button className="btn-primary w-full" type="submit">Create campaign</button>
        </form>
      </Modal>
    </div>
  );
}
