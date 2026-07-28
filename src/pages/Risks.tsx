import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Download, ChevronDown, Info } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal, ProgressBar, Tabs, Spinner } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import { loadRisksBundle } from "@/lib/data";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { priorityBandMeta, riskLevelHex, timeAgo, titleCase, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Risk } from "@/lib/types";

export default function Risks() {
  const { toast, requireDualControl, dualControl } = useStore();
  const { data, loading } = useResource(loadRisksBundle, { risks: [], securityDbBlocked: false, error: null });
  const risks = data.risks;
  const securityDbBlocked = data.securityDbBlocked;
  const loadError = data.error;
  const [tab, setTab] = useState("priority");
  const [band, setBand] = useState("all");
  const [selected, setSelected] = useState<Risk | null>(null);

  // Submitting state for buttons
  const [treating, setTreating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignedOwner, setAssignedOwner] = useState("");

  // History
  const [history, setHistory] = useState<any[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const sorted = useMemo(
    () =>
      [...risks]
        .filter((r) => band === "all" || r.priority_band === band)
        .sort((a, b) => (tab === "priority" ? b.priority_score - a.priority_score : b.inherent_score - a.inherent_score)),
    [risks, band, tab],
  );

  const handleProposeTreatment = async () => {
    if (!selected) return;
    if (!(await requireDualControl("Proposing risk treatment requires a dual-control operate session."))) return;
    setTreating(true);
    try {
      await api.post(`/risks/${selected.id}/treatments`, {
        description: "Proposed treatment plan via Phantix UI",
        strategy: "mitigate",
      });
      toast("success", "Treatment proposed", `POST /risks/${selected.id}/treatments — submit → approve → complete; approve needs the authorizer session.`);
    } catch (err: any) {
      toast("error", "Failed", err.message ?? "Proposal failed");
    } finally {
      setTreating(false);
    }
  };

  const handleAssignOwner = async () => {
    if (!selected) return;
    if (!(await requireDualControl("Assigning a risk owner requires a dual-control operate session."))) return;
    const owner = assignedOwner.trim();
    if (!owner) {
      toast("error", "Validation", "Enter an owner email or name.");
      return;
    }
    setAssigning(true);
    try {
      await api.patch(`/risks/${selected.id}`, { owner });
      toast("success", "Owner updated", `PATCH /risks/${selected.id} — ${owner}`);
      setAssignedOwner("");
    } catch (err: any) {
      toast("error", "Failed", err.message ?? "Assignment failed");
    } finally {
      setAssigning(false);
    }
  };

  const handleViewHistory = async () => {
    if (!selected) return;
    setHistoryLoading(true);
    setHistoryOpen(true);
    setHistory(null);
    try {
      const res = await api.get<any>(`/risks/${selected.id}/history`);
      setHistory(res.items ?? res.history ?? res ?? []);
    } catch (err: any) {
      toast("error", "Failed", err.message ?? "Could not load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading risks…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {securityDbBlocked && <SecurityDbBanner message={loadError} />}
      <PageHeader
        title="Risk register"
        description="Auto-created from verified scan results, scored with explainable Likelihood×Impact + rules, prioritized by phantix.risk_priority.v1. Risks are client-owned — Phantix never owns them."
        actions={
          <button className="btn-secondary" onClick={() => {
            const url = `${import.meta.env.VITE_API_BASE ?? ""}/risks/export?format=json`;
            const a = document.createElement("a");
            a.href = url;
            a.download = "risks-export.json";
            a.click();
          }}>
            <Download size={15} /> Export for expert review
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            { id: "priority", label: "Priority order" },
            { id: "score", label: "Inherent score" },
          ]}
          active={tab}
          onChange={setTab}
        />
        <div className="ml-auto flex gap-1.5">
          {["all", "P1", "P2", "P3", "P4", "P5"].map((b) => (
            <button
              key={b}
              onClick={() => setBand(b)}
              className={cx(
                "rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold transition-colors border",
                band === b ? "border-gold-400/40 bg-gold-400/12 text-gold-300" : "border-phantix-700/50 text-slate-500 hover:bg-phantix-800/60",
              )}
            >
              {b === "all" ? "All" : b}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {sorted.map((r, i) => {
          const bm = priorityBandMeta[r.priority_band];
          const color = riskLevelHex[r.level];
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card hover className="!p-0 overflow-hidden" >
                <button onClick={() => setSelected(r)} className="flex w-full items-stretch text-left">
                  <div className="w-1 shrink-0" style={{ background: color, boxShadow: `0 0 12px ${color}66` }} />
                  <div className="flex flex-1 flex-wrap items-center gap-4 p-4">
                    <div className="w-14 text-center">
                      <p className="font-display text-2xl font-bold" style={{ color }}>{r.inherent_score}</p>
                      <p className="text-[9px] uppercase tracking-wider text-slate-600">score</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-100">{r.title}</p>
                        <span className={cx("chip", bm.className)}>{r.priority_band}</span>
                        {r.residual_score !== null && (
                          <span className="chip border-severity-low/30 bg-severity-low/10 text-severity-low">residual {r.residual_score}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <span className="font-mono">{r.asset_value}</span> · {r.owner_department ?? "Unassigned"} · {titleCase(r.status)} · {r.age_days}d old
                      </p>
                    </div>
                    <div className="hidden w-40 md:block">
                      <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                        <span>Priority {r.priority_score.toFixed(1)}</span>
                        <span>{bm.label}</span>
                      </div>
                      <ProgressBar value={r.priority_score} color={color} />
                    </div>
                    <ChevronDown size={15} className="text-slate-600" />
                  </div>
                </button>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setAssignedOwner(""); }} title={selected?.title ?? ""} wide>
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx("chip", priorityBandMeta[selected.priority_band].className)}>{priorityBandMeta[selected.priority_band].label}</span>
              <StatusBadge status={selected.status} />
              {selected.treatment_status && <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-300">treatment: {titleCase(selected.treatment_status)}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Inherent", selected.inherent_score],
                ["Residual", selected.residual_score ?? "—"],
                ["Likelihood", `${selected.likelihood}/4`],
                ["Impact", `${selected.impact}/4`],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3 text-center">
                  <p className="font-display text-xl font-bold text-white">{v}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                </div>
              ))}
            </div>

            {/* Scoring breakdown */}
            <div>
              <p className="label flex items-center gap-1.5"><Info size={12} /> Risk scoring breakdown</p>
              <div className="space-y-2">
                {(() => {
                  const sb = selected.scoring_breakdown;
                  if (!sb) return <p className="text-xs text-slate-500">No breakdown data</p>;
                  const rulesFactors = Array.isArray(sb) ? sb.map((b: any) => ({ component: b.component, contribution: b.contribution, detail: b.detail }))
                    : ((sb as any).rules_factors || []).map((rf: any) => ({ component: rf.factor, contribution: rf.points, detail: rf.note || "" }));
                  return rulesFactors.length > 0 ? rulesFactors.map((b: any) => (
                    <div key={b.component} className="rounded-lg border border-phantix-700/40 bg-phantix-950/50 p-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200 truncate">{b.component}</span>
                        <span className="font-mono text-gold-300 shrink-0 ml-2">+{b.contribution}</span>
                      </div>
                      {b.detail && <p className="mt-0.5 text-[10px] text-slate-500">{b.detail}</p>}
                    </div>
                  )) : (
                    <p className="text-xs text-slate-500">No rule factors</p>
                  );
                })()}
                {selected.scoring_breakdown && !Array.isArray(selected.scoring_breakdown) && (selected.scoring_breakdown as any).findings_counts && (
                  <div className="rounded-lg border border-phantix-700/40 bg-phantix-950/50 p-2.5">
                    <p className="text-xs text-slate-400 mb-1">Findings by severity</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries((selected.scoring_breakdown as any).findings_counts as Record<string, number>).map(([sev, count]) => (
                        <span key={sev} className={cx("chip text-[10px] capitalize", sev === "critical" ? "text-severity-critical bg-severity-critical/10 border-severity-critical/20" : sev === "high" ? "text-severity-high bg-severity-high/10 border-severity-high/20" : sev === "medium" ? "text-severity-medium bg-severity-medium/10 border-severity-medium/20" : "text-severity-low bg-severity-low/10 border-severity-low/20")}>
                          {sev}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Priority factors */}
            <div>
              <p className="label">Priority factors</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(() => {
                  const pf = selected.priority_factors;
                  const comps = (pf as any)?.components ?? pf;
                  if (typeof comps !== "object" || !comps) return null;
                  return Object.entries(comps as Record<string, any>)
                    .filter(([, v]) => typeof v === "number" || typeof v === "string")
                    .map(([k, v]) => (
                      <div key={k} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-2.5 text-center">
                        <p className="font-mono text-sm font-semibold text-slate-200">{typeof v === "number" ? v.toFixed(1) : v}</p>
                        <p className="mt-0.5 text-[8px] uppercase tracking-wider text-slate-600">{titleCase(k)}</p>
                      </div>
                    ));
                })()}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2.5 border-t border-phantix-700/40 pt-4">
              <button className="btn-primary" onClick={handleProposeTreatment} disabled={treating}>
                {treating ? "Proposing…" : "Propose treatment"}
              </button>
              <div className="flex items-center gap-2">
                <input
                  className="input w-40 text-xs"
                  placeholder="Owner email"
                  value={assignedOwner}
                  onChange={(e) => setAssignedOwner(e.target.value)}
                />
                <button className="btn-secondary" onClick={handleAssignOwner} disabled={assigning}>
                  {assigning ? "Saving…" : "Assign owner"}
                </button>
              </div>
              <button className="btn-ghost" onClick={handleViewHistory}>
                View history
              </button>
            </div>
            <p className="text-[11px] leading-4 text-slate-500">
              Treatment approve/reject requires the <strong>authorizer</strong>
              {dualControl.authorizer?.full_name ? ` (${dualControl.authorizer.full_name})` : ""} dual-control session.
              Residual risk is recalculated on propose/approve/complete.
            </p>
          </div>
        )}
      </Modal>

      {/* History modal */}
      <Modal open={historyOpen} onClose={() => { setHistoryOpen(false); setHistory(null); }} title="Risk history" wide>
        {historyLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner className="h-4 w-4" /> Loading history…</div>
        ) : history && history.length > 0 ? (
          <div className="space-y-2 max-h-[500px] overflow-auto">
            {history.map((h: any, i: number) => (
              <div key={i} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-slate-300">{h.action ?? h.event ?? h.change_type ?? "update"}</span>
                  <span className="text-slate-500">{h.timestamp ?? h.created_at ?? h.changed_at ? timeAgo(h.timestamp ?? h.created_at ?? h.changed_at) : ""}</span>
                </div>
                {h.detail && <p className="text-slate-400">{h.detail}</p>}
                {h.old_value != null && h.new_value != null && (
                  <p className="text-slate-500 mt-1"><span className="line-through text-slate-600">{String(h.old_value)}</span> → <span className="text-slate-300">{String(h.new_value)}</span></p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">{history ? "No history entries" : "Failed to load history"}</p>
        )}
      </Modal>
    </div>
  );
}
