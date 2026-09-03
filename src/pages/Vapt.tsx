import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Crosshair, Play, Pause, XCircle, GitBranch, ShieldCheck, Sparkles, ChevronRight, UserCheck, Radar, Globe, Activity, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, VerificationBadge, ImpactBadge, ImpactPanel, Modal, ProgressBar, Tabs, EmptyState, Spinner, PageSkeleton, ErrorState } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import DocLink from "@/components/DocLink";
import { loadVaptBundle } from "@/lib/data";
import { api, isDemoMode } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useOperations } from "@/lib/operations";
import { timeAgo, titleCase, cx, isReportable, impactLevelRank, formatDateTime } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { VaptCampaign, VaptFinding } from "@/lib/types";

/** Multi-tool correlation chips from a web step's output_summary.multi_tool_correlation. */
function CorrelationChips({ correlation }: { correlation: any }) {
  const stats = correlation?.stats;
  const groups: any[] = Array.isArray(correlation?.groups) ? correlation.groups : [];
  if (!stats && groups.length === 0) return null;
  const consensus = stats?.consensus_groups ?? groups.filter((g) => g.consensus).length;
  const singletons = stats?.singleton_groups ?? groups.filter((g) => !g.consensus).length;
  const tools: string[] = Array.isArray(stats?.tools_run) ? stats.tools_run : [];
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="chip text-[10px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300" title="Findings confirmed by more than one tool">
          {consensus} consensus
        </span>
        <span className="chip text-[10px] border-slate-500/30 bg-slate-500/10 text-slate-400" title="Findings seen by a single tool only">
          {singletons} single-tool
        </span>
        {tools.length > 0 && <span className="text-[10px] text-slate-600">tools: {tools.join(", ")}</span>}
      </div>
      {groups.length > 0 && (
        <details className="text-[10px] text-slate-500">
          <summary className="cursor-pointer hover:text-slate-300">Confirmed by tool</summary>
          <div className="mt-1 space-y-1">
            {groups.map((g, i) => (
              <div key={i} className="rounded-lg border border-phantix-700/30 bg-phantix-900/40 px-2 py-1.5">
                <p className="flex flex-wrap items-center gap-1.5 text-slate-300">
                  {g.title || g.issue_family || "Group"}
                  {g.consensus
                    ? <span className="chip text-[9px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300">consensus</span>
                    : <span className="chip text-[9px] border-severity-medium/30 bg-severity-medium/10 text-severity-medium">single-tool</span>}
                </p>
                {(Array.isArray(g.confirmed_by_tools) && g.confirmed_by_tools.length > 0) && (
                  <p className="mt-0.5 text-[10px] text-emerald-300/90">confirmed: {g.confirmed_by_tools.join(", ")}</p>
                )}
                {(Array.isArray(g.missed_by_tools) && g.missed_by_tools.length > 0) && (
                  <p className="mt-0.5 text-[10px] text-severity-medium/90">missed by: {g.missed_by_tools.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** ROE summary from a web step's output_summary.roe --- booleans only, never secrets. */
function RoeChips({ roe }: { roe: any }) {
  if (!roe || typeof roe !== "object") return null;
  const chips: Array<[string, boolean]> = [
    ["allow_poc", !!roe.allow_poc],
    ["bruteforce ack", !!roe.acknowledge_bruteforce],
    ["creds", !!roe.credentials_provided],
    ["alt session", !!roe.credentials_alt_provided],
  ];
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {chips.map(([label, on]) => (
        <span key={label} className={cx("chip text-[9px]", on ? "border-gold-400/30 bg-gold-400/10 text-gold-300" : "border-phantix-700/40 bg-phantix-900/50 text-slate-600")}>
          {label}: {on ? "on" : "off"}
        </span>
      ))}
    </div>
  );
}

export default function Vapt() {
  const { toast, requireDualControl, dualControl } = useStore();
  const { data, loading, error, reload } = useResource(loadVaptBundle, {
    campaigns: [],
    findings: [],
    approvals: [],
    securityDbBlocked: false,
    error: null,
  }, "vapt");
  const vaptCampaigns = data.campaigns;
  const vaptFindings = data.findings;
  const vaptApprovals = data.approvals;
  const securityDbBlocked = data.securityDbBlocked;
  const loadError = data.error;
  const [tab, setTab] = useState("campaigns");
  const [selected, setSelected] = useState<VaptCampaign | null>(null);
  const [findingSelected, setFindingSelected] = useState<VaptFinding | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", campaign_type: "web_scan", procedure_key: "web_scan", researchDepth: "standard" as "standard" | "poc", bruteforceAcked: false });
  const [bfConfirmOpen, setBfConfirmOpen] = useState(false);
  const [bfConfirmText, setBfConfirmText] = useState("");
  const [creds, setCreds] = useState({ username: "", password: "", token: "" });
  const [altCreds, setAltCreds] = useState({ username: "", password: "", token: "" });

  const resetCreateForm = () => {
    setCreateForm({ name: "", campaign_type: "web_scan", procedure_key: "web_scan", researchDepth: "standard", bruteforceAcked: false });
    setCreds({ username: "", password: "", token: "" });
    setAltCreds({ username: "", password: "", token: "" });
    setBfConfirmText("");
  };

  /** Web research ROE config (VAPT_RESEARCH_ROE_TOGGLES_FE.md §1) passed on the
   *  campaign/step config: allow_poc + bruteforce ack are opt-in, credentials
   *  are never echoed back (only credentials_provided from output_summary.roe). */
  const buildWebResearchConfig = (): Record<string, unknown> | null => {
    const isWeb = ["web_scan", "api_scan", "full_vapt"].includes(createForm.campaign_type) || ["web_scan", "web_app_scan_only", "api_scan", "full_vapt"].includes(createForm.procedure_key);
    if (!isWeb) return null;
    const clean = (c: typeof creds): Record<string, string> => {
      const out: Record<string, string> = {};
      if (c.username?.trim()) out.username = c.username.trim();
      if (c.password?.trim()) out.password = c.password;
      if (c.token?.trim()) out.token = c.token.trim();
      return out;
    };
    const cfg: Record<string, unknown> = {
      tools: ["web"],
      allow_poc: createForm.researchDepth === "poc",
      acknowledge_bruteforce: createForm.bruteforceAcked,
      run_follow_on: true,
    };
    const primary = clean(creds);
    if (Object.keys(primary).length) cfg.credentials = primary;
    const alt = clean(altCreds);
    if (Object.keys(alt).length) cfg.credentials_alt = alt;
    return cfg;
  };

  const activeSelected = selected && vaptCampaigns.some((c) => c.id === selected.id) ? selected : vaptCampaigns[0] ?? null;
  const campaignFindings = activeSelected ? vaptFindings.filter((f) => f.campaign_id === activeSelected.id) : [];
  const pending = vaptApprovals.filter((a) => a.status === "pending");
  const selectedFinding = findingSelected;
  const selectedSteps = selectedFinding?.attack_path_object?.steps;

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
      if (isDemoMode()) {
        // Demo dual control is auto-provisioned: flip the local approval so the
        // gate visibly passes without any backend contact.
        const target = data.approvals.find((a) => a.id === approvalId);
        if (target) target.status = approve ? "approved" : "rejected";
        toast("success", approve ? "Approved" : "Rejected", "Demo dual-control session auto-provisioned");
        reload();
        return;
      }
      await api.post(`/vapt/approvals/${approvalId}/decide`, approve
        ? { approve: true, notes: "Approved" }
        : { approve: false, rejection_reason: "Rejected" });
      toast("success", approve ? "Approved" : "Rejected");
      reload();
    } catch (e: any) { toast("error", "Decision failed", e.message || ""); }
  };

  const handleCreate = async () => {
    if (!createForm.name) { toast("error", "Enter a campaign name"); return; }
    if (createForm.bruteforceAcked && !bfConfirmText.trim()) {
      toast("warning", "Bruteforce authorization", "Type BRUTEFORCE to confirm the capped login bruteforce.");
      setBfConfirmOpen(true);
      return;
    }
    if (!(await requireDualControl("Campaign creation needs a dual-control operate session."))) return;
    try {
      const webConfig = buildWebResearchConfig();
      const res = await api.post("/vapt/campaigns", {
        campaign_name: createForm.name,
        campaign_type: createForm.campaign_type,
        procedure_key: createForm.procedure_key,
        run_inline: false,
        ...(webConfig ? { config: webConfig } : {}),
      });
      toast("success", "Campaign created", "draft → start when ready");
      setCreateOpen(false);
      resetCreateForm();
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
    if (document.hidden) return; // pause while the tab is hidden
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
      pollTimer.current = setInterval(pollCampaigns, 10_000);
    } else if (activeCampaigns.length === 0 && pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    return () => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } };
  }, [activeCampaigns.length, pollCampaigns]);

  // Surface running campaigns in the global operations tray.
  const { register, update } = useOperations();
  const opIdsRef = useRef<Record<number, string>>({});
  useEffect(() => {
    const running = vaptCampaigns.filter((c) => c.status === "active" || c.status === "paused" || c.status === "pending_approval");
    const finished = vaptCampaigns.filter((c) => c.status === "completed" || c.status === "failed" || c.status === "cancelled");

    running.forEach((c) => {
      const existing = opIdsRef.current[c.id];
      const label = "VAPT scan";
      if (!existing) {
        opIdsRef.current[c.id] = register({ key: `vapt:${c.id}`, label, route: "/vapt", detail: `${c.name} · ${c.progress ?? 0}%` });
      } else {
        update(existing, { label, status: "running", detail: `${c.name} · ${c.progress ?? 0}%` });
      }
    });

    finished.forEach((c) => {
      const id = opIdsRef.current[c.id];
      if (!id) return;
      update(id, {
        status: c.status === "failed" ? "error" : "success",
        detail: c.status === "failed" ? `${c.name} failed` : `${c.name} completed`,
      });
      delete opIdsRef.current[c.id];
    });
  }, [vaptCampaigns, register, update]);

  if (loading) {
    return <PageSkeleton variant="split" rows={4} actions />;
  }

  if (error && vaptCampaigns.length === 0) {
    return (
      <ErrorState
        onRetry={reload}
        body="We could not load VAPT campaigns. Check your connection and retry — your session stays signed in."
      />
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
            <DocLink docId="howto-app-06" label="VAPT how-to" />
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
                      <div className="mb-3 p-3 rounded-lg bg-severity-low/5 border border-severity-low/20">
                        <div className="flex items-center gap-2 text-xs mb-2">
                          <span className="h-2 w-2 rounded-full bg-severity-low animate-pulse-soft" />
                          <span className="text-severity-low font-medium">Phase: {(activeSelected as any).current_phase || `Step ${((activeSelected as any).current_step_index || 0) + 1}`}</span>
                          <span className="text-slate-500">
                            Step {((activeSelected as any).current_step_index || 0) + 1} of {((activeSelected as any).procedure_snapshot?.steps?.length ?? 0)}
                          </span>
                        </div>
                        <ProgressBar value={(((activeSelected as any).current_step_index || 0) + 1) / (((activeSelected as any).procedure_snapshot?.steps?.length || 1)) * 100} color="rgb(var(--severity-low))" />
                      </div>
                    )}

                    <div className="space-y-0">
                      {((activeSelected as any).procedure_snapshot?.steps || []).map((step: any, i: number) => {
                        const stepType = step.step_type as string;
                        const stepIdx = (activeSelected as any).current_step_index ?? -1;
                        const isCurrent = activeSelected.status === "active" && i === stepIdx;
                        const isCompleted = activeSelected.status === "completed" || (activeSelected.status === "active" && i < stepIdx);
                        const isFailed = activeSelected.status === "failed" && i === stepIdx;
                        const icon = stepType === "scan" ? <Radar size={12} className={isCompleted ? "text-emerald-400" : isCurrent ? "text-severity-low" : "text-slate-500"} />
                          : stepType === "web_scan" ? <Globe size={12} className={isCompleted ? "text-emerald-400" : isCurrent ? "text-severity-low" : "text-slate-500"} />
                          : stepType === "correlate" ? <GitBranch size={12} className={isCompleted ? "text-emerald-400" : isCurrent ? "text-gold-400" : "text-slate-500"} />
                          : stepType === "analyze" ? <Sparkles size={12} className={isCompleted ? "text-emerald-400" : isCurrent ? "text-purple-400" : "text-slate-500"} />
                          : <Activity size={12} className={isCompleted ? "text-emerald-400" : isCurrent ? "text-severity-low" : "text-slate-500"} />;
                        return (
                          <div key={i} className={cx("flex items-start gap-3 py-2 border-b border-phantix-800/40 last:border-0", isCurrent && "bg-severity-low/5 -mx-2 px-2 rounded")}>
                            <div className="flex flex-col items-center shrink-0">
                              <div className={cx("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold", isCompleted ? "bg-emerald-400/20 text-emerald-400" : isCurrent ? "bg-severity-low/20 text-severity-low" : isFailed ? "bg-severity-critical/20 text-severity-critical" : "bg-phantix-800/70 text-slate-300")}>
                                {isCompleted ? <CheckCircle2 size={12} /> : isFailed ? <XCircle size={12} /> : isCurrent ? <Loader2 size={12} className="animate-spin" /> : i + 1}
                              </div>
                              {i < (((activeSelected as any).procedure_snapshot?.steps?.length ?? 0) - 1) && (
                                <div className={cx("w-px h-4 mt-0.5", isCompleted ? "bg-emerald-400/30" : "bg-phantix-700/50")} />
                              )}
                            </div>
                            <div className="min-w-0 pb-1">
                              <p className={cx("text-sm font-medium flex items-center gap-1.5", isCurrent ? "text-severity-low" : isCompleted ? "text-emerald-300" : "text-slate-200")}>
                                {icon} {step.step_name}
                                {step.config?.max_duration_minutes && (
                                  <span className="text-[9px] text-slate-500 font-normal ml-1">~{step.config.max_duration_minutes}m</span>
                                )}
                                {isCurrent && <span className="text-[10px] text-severity-low font-normal">running</span>}
                                {isCompleted && <span className="text-[10px] text-emerald-400 font-normal">complete</span>}
                              </p>
                              <p className={cx("text-[11px] leading-relaxed", isCurrent ? "text-slate-400" : "text-slate-500")}>{step.step_description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Follow-on research steps + PoC-ack banner (research pipeline) */}
                    {(() => {
                      const stepsList = ((activeSelected as any).procedure_snapshot?.steps || []) as any[];
                      const followOnSteps = stepsList.flatMap((s: any) =>
                        (s.output_summary?.follow_on?.enqueued || []).map((e: any) => ({ ...e, fromStep: s.step_name })),
                      );
                      const awaitingAck = stepsList.flatMap((s: any) =>
                        (s.output_summary?.follow_on?.awaiting_poc_ack || []).map((e: any) => e),
                      );
                      if (followOnSteps.length === 0 && awaitingAck.length === 0) return null;
                      return (
                        <div className="mt-1 space-y-2">
                          {followOnSteps.length > 0 && (
                            <div className="rounded-xl border border-phantix-700/40 bg-phantix-900/50 p-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Auto-enqueued follow-on research</p>
                              {followOnSteps.map((e, i) => (
                                <div key={i} className="flex items-center gap-2 py-1 text-xs">
                                  <GitBranch size={12} className="shrink-0 text-gold-400" />
                                  <span className="text-slate-300">Auto: {e.step_name}</span>
                                  {e.tool && <span className="font-mono text-[10px] text-slate-500">{e.tool}</span>}
                                  {e.fromStep && <span className="text-[10px] text-slate-600">after {e.fromStep}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {awaitingAck.length > 0 && (
                            <div className="flex items-start gap-2 rounded-xl border border-severity-medium/30 bg-severity-medium/8 px-3 py-2.5 text-xs text-severity-medium">
                              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                              <p className="leading-5">
                                {awaitingAck.length} technique{awaitingAck.length > 1 ? "s" : ""} need PoC acknowledgment
                                {awaitingAck.length === 1 && awaitingAck[0]?.tool ? ` (${awaitingAck[0].tool})` : ""} —
                                re-run with <strong>Extended PoC</strong> to allow controlled proofs.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
                        {((activeSelected as any).procedure_snapshot?.steps || []).filter((s: any) => s.output_summary || s.finding_count > 0).slice(0, 5).map((step: any, i: number) => {
                          const summary = step.output_summary || {};
                          const isPartial = summary.budget_exhausted || summary.partial;
                          const uniqueHosts = summary.unique_hosts;
                          const skipped = summary.skipped_count || (summary.skipped_already_scanned?.length || 0);
                          const scanned = summary.targets_scanned?.length || uniqueHosts || "---";
                          const budgetSec = Number(summary.time_budget_seconds ?? 0);
                          const elapsedSec = Number(summary.elapsed_seconds ?? 0);
                          const budgetPct = budgetSec > 0 ? Math.min(100, (elapsedSec / budgetSec) * 100) : null;
                          const skipReasons: string[] = Array.isArray(summary.skipped_already_scanned) ? summary.skipped_already_scanned : [];
                          const tools: string[] = Array.isArray(summary.tools) ? summary.tools : [];
                          return (
                            <div key={i} className="flex items-start gap-2 text-xs border-t border-phantix-700/30 pt-2 first:border-0 first:pt-0">
                              <div className={cx("w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5", isPartial ? "bg-severity-medium/20 text-severity-medium" : "bg-emerald-400/20 text-emerald-400")}>
                                {isPartial ? <AlertTriangle size={10} /> : <CheckCircle2 size={12} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-slate-300 font-medium">{step.step_name}</p>
                                <p className="text-slate-500">
                                  {uniqueHosts != null ? `${uniqueHosts} hosts` : `${scanned} targets`}
                                  {step.finding_count > 0 && <span className="text-slate-400"> · {step.finding_count} findings</span>}
                                  {typeof summary.assets_resolved === "number" && summary.assets_resolved !== uniqueHosts && (
                                    <span className="text-slate-500"> · {summary.assets_resolved} resolved → {summary.unique_hosts} unique</span>
                                  )}
                                  {typeof summary.results_written === "number" && <span className="text-slate-400"> · {summary.results_written} written</span>}
                                  {skipped > 0 && (
                                    <span className="text-slate-500">
                                      {' '}· {skipped} skipped (already scanned / domain IP)
                                      {skipReasons.length > 0 && (
                                        <span className="block text-[10px] text-slate-600">
                                          {skipReasons.slice(0, 3).map((r) => <span key={r} className="block">{r}</span>)}
                                          {skipReasons.length > 3 && <span>+{skipReasons.length - 3} more</span>}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  {tools.length > 0 && <span className="block text-[10px] text-slate-600">tools: {tools.join(", ")}</span>}
                                </p>
                                {summary.multi_tool_correlation && <CorrelationChips correlation={summary.multi_tool_correlation} />}
                                {summary.roe && <RoeChips roe={summary.roe} />}
                                {budgetPct !== null && (
                                  <div className="mt-1 flex items-center gap-2">
                                    <div className="h-1 flex-1 rounded-full bg-phantix-800">
                                      <div className={cx("h-full rounded-full", isPartial ? "bg-severity-medium" : "bg-emerald-400")} style={{ width: `${budgetPct}%` }} />
                                    </div>
                                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                      {Math.round(elapsedSec / 60)}m / {Math.round(budgetSec / 60)}m
                                    </span>
                                  </div>
                                )}
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
                    {campaignFindings.slice(0, 5).map((f) => (
                      <button key={f.id} className="block w-full text-left" onClick={() => setFindingSelected(f)}>
                        <div className="rounded-lg border border-phantix-700/40 bg-phantix-950/50 p-3 transition-colors hover:border-gold-400/30 hover:bg-phantix-900/50">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 flex-1 text-sm text-slate-200 truncate">{f.title}</p>
                            <SeverityBadge severity={f.severity} />
                            <VerificationBadge status={f.verification_status} />
                            {f.impact_level && <ImpactBadge level={f.impact_level} score={f.impact_score} />}
                            {isReportable(f) ? <span className="chip text-[10px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300">Reportable</span> : <span className="chip text-[10px] border-slate-500/30 bg-slate-500/10 text-slate-500">Held</span>}
                            <ChevronRight size={14} className="shrink-0 text-slate-600" />
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
                          <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-500">
                            {f.asset_value && <span className="font-mono">{f.asset_value}</span>}
                            {f.cve && <span className="font-mono text-gold-400">{f.cve}</span>}
                            {f.cvss != null && <span>CVSS {f.cvss.toFixed(1)}</span>}
                            {f.correlation_rule && <span className="font-mono">{f.correlation_rule}</span>}
                          </div>
                        </div>
                      </button>
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
              Correlated attack paths with verification and impact analysis. Only <strong className="text-slate-200">reportable</strong> findings are collated into client reports.
            </p>
          </div>
          {vaptFindings.slice().sort((a, b) => impactLevelRank(b.impact_level) - impactLevelRank(a.impact_level) || b.id - a.id).map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <button className="block w-full text-left" onClick={() => setFindingSelected(f)}>
                <Card hover className="!p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-100">{f.title}</p>
                        {isReportable(f) ? <span className="chip text-[9px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300">reportable</span> : <span className="chip text-[9px] border-slate-500/30 bg-slate-500/10 text-slate-500">held</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">campaign #{f.campaign_id} · <span className="font-mono">{f.asset_value || "—"}</span>{f.cve && <> · <span className="font-mono text-gold-400">{f.cve}</span></>}{f.cvss != null && <> · CVSS {f.cvss.toFixed(1)}</>}{f.correlation_rule && <> · <span className="font-mono">{f.correlation_rule}</span></>}</p>
                    </div>
                    {f.impact_level ? <ImpactBadge level={f.impact_level} score={f.impact_score} /> : <SeverityBadge severity={f.severity} />}
                    <VerificationBadge status={f.verification_status} />
                    <ChevronRight size={15} className="shrink-0 text-slate-600" />
                  </div>
                </Card>
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Finding detail modal */}
      <Modal open={!!findingSelected} onClose={() => setFindingSelected(null)} title={findingSelected?.title ?? "Finding"} wide>
        {findingSelected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={findingSelected.severity} />
              <VerificationBadge status={findingSelected.verification_status} />
              {findingSelected.impact_level && <ImpactBadge level={findingSelected.impact_level} score={findingSelected.impact_score} />}
              {isReportable(findingSelected)
                ? <span className="chip text-[10px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300">Reportable</span>
                : <span className="chip text-[10px] border-slate-500/30 bg-slate-500/10 text-slate-500">Held from reports</span>}
              {findingSelected.requires_human_review && <span className="chip text-[10px] border-severity-medium/30 bg-severity-medium/10 text-severity-medium">Human review</span>}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {findingSelected.asset_value && (
                <div className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Asset</p>
                  <p className="mt-0.5 truncate font-mono text-slate-200">{findingSelected.asset_value}</p>
                </div>
              )}
              {findingSelected.correlation_rule && (
                <div className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Correlation rule</p>
                  <p className="mt-0.5 truncate font-mono text-gold-300">{findingSelected.correlation_rule}</p>
                </div>
              )}
              <div className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Campaign</p>
                <p className="mt-0.5 font-mono text-slate-200">#{findingSelected.campaign_id}</p>
              </div>
              {findingSelected.cve && (
                <div className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">CVE</p>
                  <p className="mt-0.5 truncate font-mono text-gold-400">{findingSelected.cve}</p>
                </div>
              )}
              {findingSelected.cvss != null && (
                <div className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">CVSS</p>
                  <p className="mt-0.5 font-mono text-slate-200">{findingSelected.cvss.toFixed(1)}</p>
                </div>
              )}
              <div className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Detected</p>
                <p className="mt-0.5 text-slate-200">{formatDateTime(findingSelected.created_at)}</p>
              </div>
            </div>

            {findingSelected.description && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Description</p>
                <p className="text-sm leading-6 text-slate-300">{findingSelected.description}</p>
              </div>
            )}

            {findingSelected.attack_path_object?.risk_summary && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Risk summary</p>
                <p className="text-xs leading-5 text-slate-400">{findingSelected.attack_path_object.risk_summary}</p>
              </div>
            )}

            {selectedSteps && selectedSteps.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Attack path</p>
                <div className="flex flex-col gap-1">
                  {selectedSteps.map((s, i, arr) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-phantix-800/70 font-mono text-[10px] font-bold text-slate-300">{i + 1}</span>
                      <span className="rounded-lg border border-phantix-700/40 bg-phantix-950/50 px-2.5 py-1.5 font-mono text-[11px] text-slate-200">
                        {s.title || `Asset #${s.asset_id}`}
                      </span>
                      {s.severity && <span className="text-[10px] text-slate-500">{s.severity}</span>}
                      {i < arr.length - 1 && <ChevronRight size={12} className="shrink-0 text-slate-600" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!selectedFinding?.impact_analysis?.impact_level && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Impact analysis</p>
                <ImpactPanel impact={selectedFinding.impact_analysis} />
              </div>
            )}

            {findingSelected.verification_status && (
              <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3 text-xs">
                <p className="text-slate-500">
                  Verification: <span className="font-medium text-slate-200">{findingSelected.verification_status}</span>
                  {findingSelected.confidence != null && <> · Confidence: <span className="font-mono text-slate-200">{findingSelected.confidence}</span></>}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Auto-classified by the verification engine from the correlated attack path and its underlying scan evidence.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

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
                <option value="caido">caido --- advanced proxy (history, Replay, workflows)</option>
              </select>
            </div>
          </div>

          {/* Research depth + ROE gates (VAPT_RESEARCH_ROE_TOGGLES_FE.md §2) */}
          {["web_scan", "api_scan", "full_vapt"].includes(createForm.campaign_type) && (
            <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3.5 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Research depth</p>
                <div className="space-y-1.5">
                  <label className={cx("flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2", createForm.researchDepth === "standard" ? "border-gold-400/40 bg-gold-400/8" : "border-phantix-700/40 bg-phantix-900/50")}>
                    <input type="radio" name="researchDepth" className="mt-0.5 accent-gold-400" checked={createForm.researchDepth === "standard"} onChange={() => setCreateForm((f) => ({ ...f, researchDepth: "standard" }))} />
                    <span className="text-xs leading-5">
                      <strong className="text-slate-200">Standard</strong> <span className="text-slate-500">(safe corroboration) --- default</span>
                    </span>
                  </label>
                  <label className={cx("flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2", createForm.researchDepth === "poc" ? "border-gold-400/40 bg-gold-400/8" : "border-phantix-700/40 bg-phantix-900/50")}>
                    <input type="radio" name="researchDepth" className="mt-0.5 accent-gold-400" checked={createForm.researchDepth === "poc"} onChange={() => setCreateForm((f) => ({ ...f, researchDepth: "poc" }))} />
                    <span className="text-xs leading-5">
                      <strong className="text-slate-200">Extended PoC</strong> <span className="text-slate-500">(allow_poc=true)</span>
                    </span>
                  </label>
                  {createForm.researchDepth === "poc" && (
                    <p className="text-[10px] leading-4 text-severity-medium/90 px-1">
                      Controlled proofs (upload polyglot, SSRF OOB) may interact with the live app. Ensure ROE / dual-control is unlocked.
                    </p>
                  )}
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" className="h-3.5 w-3.5 accent-gold-400" checked={createForm.bruteforceAcked} onChange={(e) => setCreateForm((f) => ({ ...f, bruteforceAcked: e.target.checked }))} />
                Authorize login bruteforce <span className="text-slate-500">(acknowledge_bruteforce=true)</span>
              </label>
              <details className="text-[11px]">
                <summary className="cursor-pointer text-slate-400 hover:text-slate-200">Credentials panel (optional)</summary>
                <div className="mt-2 space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Primary session --- priv-esc + JWT + BOLA bearer</p>
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input !py-1.5 text-xs" placeholder="username" value={creds.username} onChange={(e) => setCreds((c) => ({ ...c, username: e.target.value }))} />
                      <input className="input !py-1.5 text-xs" type="password" placeholder="password" value={creds.password} onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))} />
                      <input className="input !py-1.5 text-xs" placeholder="token / bearer / jwt" value={creds.token} onChange={(e) => setCreds((c) => ({ ...c, token: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Alternate session --- dual-session BOLA comparison</p>
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input !py-1.5 text-xs" placeholder="username" value={altCreds.username} onChange={(e) => setAltCreds((c) => ({ ...c, username: e.target.value }))} />
                      <input className="input !py-1.5 text-xs" type="password" placeholder="password" value={altCreds.password} onChange={(e) => setAltCreds((c) => ({ ...c, password: e.target.value }))} />
                      <input className="input !py-1.5 text-xs" placeholder="token / bearer / jwt" value={altCreds.token} onChange={(e) => setAltCreds((c) => ({ ...c, token: e.target.value }))} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600">Secrets are never echoed back by the API --- findings show only credentials_provided.</p>
                </div>
              </details>
            </div>
          )}

          <p className="text-xs text-slate-500 p-2 rounded-lg bg-phantix-800/40">
            Campaign starts as a <strong>draft</strong> --- you can review and start it from the campaign detail view. Full VAPT requires dual-control approval. Brute-force uses a tiny built-in wordlist and stops on first hit.
          </p>
          <button className="btn-primary w-full" type="submit">Create campaign</button>
        </form>
      </Modal>

      {/* Bruteforce typed confirmation modal */}
      <Modal open={bfConfirmOpen} onClose={() => setBfConfirmOpen(false)} title="Authorize login bruteforce">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-severity-medium/30 bg-severity-medium/8 px-3.5 py-3">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-severity-medium" />
            <p className="text-xs leading-5 text-slate-300">
              You are authorizing a <strong>capped</strong> login bruteforce using a tiny built-in wordlist that
              stops on the first hit. It is not credential stuffing. Requires an active dual-control operate session.
            </p>
          </div>
          <div>
            <label className="label">Type <span className="font-mono text-gold-300">BRUTEFORCE</span> to confirm</label>
            <input className="input font-mono" value={bfConfirmText} onChange={(e) => setBfConfirmText(e.target.value)} placeholder="BRUTEFORCE" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => { setBfConfirmOpen(false); setCreateForm((f) => ({ ...f, bruteforceAcked: false })); }}>Cancel</button>
            <button
              className="btn-primary"
              disabled={bfConfirmText.trim().toUpperCase() !== "BRUTEFORCE"}
              onClick={() => { setBfConfirmOpen(false); toast("success", "Bruteforce authorized", "Cap applied --- tiny wordlist, stops on first hit."); }}
            >
              Confirm authorization
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
