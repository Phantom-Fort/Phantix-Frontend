import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Download, ChevronDown, Info } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal, ProgressBar, Tabs } from "@/components/ui";
import { risks } from "@/lib/demo-data";
import { priorityBandMeta, riskLevelHex, timeAgo, titleCase, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Risk } from "@/lib/types";

export default function Risks() {
  const { toast, operate } = useStore();
  const [tab, setTab] = useState("priority");
  const [band, setBand] = useState("all");
  const [selected, setSelected] = useState<Risk | null>(null);

  const sorted = useMemo(
    () =>
      [...risks]
        .filter((r) => band === "all" || r.priority_band === band)
        .sort((a, b) => (tab === "priority" ? b.priority_score - a.priority_score : b.inherent_score - a.inherent_score)),
    [band, tab],
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Risk register"
        description="Auto-created from verified scan results, scored with explainable Likelihood×Impact + rules, prioritized by phantix.risk_priority.v1. Risks are client-owned — Phantix never owns them."
        actions={
          <button className="btn-secondary" onClick={() => toast("info", "Export", "GET /risks/export?format=json — marked purpose: expert_review_billable.")}>
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
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ""} wide>
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
              <p className="label flex items-center gap-1.5"><Info size={12} /> Explainable scoring — scoring_breakdown</p>
              <div className="space-y-2">
                {selected.scoring_breakdown.map((b) => (
                  <div key={b.component} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-200">{b.component}</span>
                      <span className="font-mono text-gold-300">+{b.contribution}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{b.detail}</p>
                    <div className="mt-2"><ProgressBar value={b.contribution} color="#E8B54D" /></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority factors */}
            <div>
              <p className="label">Priority factors — 0.35·severity + 0.25·treatment + 0.15·status + 0.15·asset + 0.10·age</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {Object.entries(selected.priority_factors).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-2.5 text-center">
                    <p className="font-mono text-sm font-semibold text-slate-200">{v}</p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">{titleCase(k)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2.5 border-t border-phantix-700/40 pt-4">
              <button className="btn-primary" onClick={() => toast("success", "Treatment proposed", "propose → submit → approve → complete; approve needs the authorizer session.")}>
                Propose treatment
              </button>
              <button className="btn-secondary" onClick={() => (operate.unlocked ? toast("info", "Owner assigned", "PATCH /risks/{id}") : toast("warning", "Operate mode required"))}>
                Assign owner
              </button>
              <button className="btn-ghost" onClick={() => toast("info", "History", "GET /risks/{id}/history — every score change is audited.")}>
                View history
              </button>
            </div>
            <p className="text-[11px] leading-4 text-slate-500">
              Treatment approve/reject requires the <strong>authorizer</strong> (Chidi Eze) dual-control session.
              Residual risk is recalculated on propose/approve/complete.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
