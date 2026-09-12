import React, { useMemo, useState } from "react";
import {
  AlertTriangle, ChevronDown, ChevronRight, Crosshair, Info, Layers, Loader2,
  RotateCcw, ShieldCheck, Sparkles, Target,
} from "lucide-react";
import { Modal, SeverityBadge } from "@/components/ui";
import type { PlanStep, PlanSubstep, VaptPlan } from "@/lib/vaptOps";
import { cx } from "@/lib/utils";
import type { Severity } from "@/lib/types";

// ── Plan review — what the campaign will test, and why ───────────────────────
// `POST /vapt/plan` is a proposal: each scan step carries substeps, one per
// vulnerability type, ranked by product context and prior results. The reviewer
// sees that tree, switches off types they do not want, and only then creates the
// campaign — the types they disable travel back as `exclude_vuln_types`.
//
// Every substep's `why` is rendered. An order nobody can account for reads as
// arbitrary, and a plan that reads as arbitrary gets rubber-stamped.

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function severityTotals(steps: PlanStep[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const step of steps) {
    for (const sub of step.substeps ?? []) {
      for (const [sev, n] of Object.entries(sub.severities ?? {})) {
        out[sev] = (out[sev] ?? 0) + Number(n ?? 0);
      }
    }
  }
  return out;
}

function SubstepRow({
  substep,
  enabled,
  onToggle,
}: {
  substep: PlanSubstep;
  enabled: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cx(
        "border-b border-phantix-800/40 py-2 pl-3 last:border-0",
        !enabled && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="mt-1 h-3.5 w-3.5 shrink-0 accent-gold-400"
          aria-label={`Include ${substep.label}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500">{substep.rank}.</span>
            <span className="text-[12.5px] font-medium text-slate-200">{substep.label}</span>
            <SeverityBadge
              severity={(substep.worst_severity || "info") as Severity}
              className="!px-1.5 !py-0 !text-[9px]"
            />
            <span className="text-[10px] text-slate-500">
              {substep.check_count} {substep.check_count === 1 ? "check" : "checks"}
            </span>
            {substep.max_duration_minutes != null && (
              <span className="text-[10px] text-slate-600">~{substep.max_duration_minutes}m</span>
            )}
            {substep.regression && (
              <span className="chip border-severity-critical/30 bg-severity-critical/10 text-[9px] text-severity-critical">
                <RotateCcw size={9} className="mr-1 inline" /> regression
              </span>
            )}
            {substep.accepted_risk && (
              <span className="chip border-amber-400/30 bg-amber-400/10 text-[9px] text-amber-300">
                accepted risk
              </span>
            )}
          </div>
          {substep.why && (
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{substep.why}</p>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300"
          >
            {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {open ? "Hide" : "Show"} checks
          </button>
          {open && (
            <ul className="mt-1 space-y-0.5 border-l border-phantix-700/40 pl-2">
              {(substep.checks ?? []).map((check) => (
                <li key={check.name} className="flex items-center gap-1.5">
                  <span
                    className={cx(
                      "h-1 w-1 shrink-0 rounded-full",
                      check.severity === "critical" || check.severity === "high"
                        ? "bg-severity-high"
                        : "bg-slate-600",
                    )}
                  />
                  <span className="truncate text-[10.5px] text-slate-400">
                    {check.display_name || check.name}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-slate-600">{check.name}</span>
                </li>
              ))}
              {(substep.checks ?? []).length === 0 && (
                <li className="text-[10.5px] text-slate-600">No individual checks listed.</li>
              )}
            </ul>
          )}
          {(substep.vuln_classes ?? []).length > 0 && (
            <p className="mt-1 font-mono text-[9.5px] text-slate-600">
              verifies: {(substep.vuln_classes ?? []).join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StepBlock({
  step,
  disabled,
  onToggle,
}: {
  step: PlanStep;
  disabled: Set<string>;
  onToggle: (key: string) => void;
}) {
  const substeps = step.substeps ?? [];
  const checks = substeps.reduce((n, s) => n + Number(s.check_count ?? 0), 0);
  return (
    <div className="rounded-md border border-phantix-700/40 bg-phantix-900/30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-phantix-700/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Layers size={13} className="shrink-0 text-gold-300" />
          <span className="text-[13px] font-semibold text-slate-100">{step.step_name}</span>
          {substeps.length > 0 && (
            <span className="text-[10.5px] text-slate-500">
              {substeps.length} {substeps.length === 1 ? "type" : "types"} · {checks}{" "}
              {checks === 1 ? "check" : "checks"}
            </span>
          )}
        </div>
        {(step.vuln_focus ?? []).length > 0 && (
          <span className="truncate font-mono text-[9.5px] text-slate-600">
            hunting: {(step.vuln_focus ?? []).slice(0, 3).map((f) => f.vuln_class).join(", ")}
          </span>
        )}
      </div>
      {substeps.length > 0 ? (
        <div>
          {substeps.map((sub) => (
            <SubstepRow
              key={`${step.tool}-${sub.key}`}
              substep={sub}
              enabled={!disabled.has(sub.key)}
              onToggle={() => onToggle(sub.key)}
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-[11px] text-slate-500">
          {step.target || "Runs its own pipeline — no per-type breakdown."}
        </p>
      )}
    </div>
  );
}

export default function VaptPlanReview({
  plan,
  open,
  busy,
  onClose,
  onConfirm,
}: {
  plan: VaptPlan;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (excludeVulnTypes: string[]) => void;
}) {
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const steps = plan.recommended_plan?.steps ?? [];
  const product = plan.based_on?.product_context;
  const intel = plan.based_on?.organization_intelligence;
  const coverage = plan.vuln_coverage;
  const totals = useMemo(() => severityTotals(steps), [steps]);

  const toggle = (key: string) =>
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const activeTypes = steps.reduce(
    (n, s) => n + (s.substeps ?? []).filter((x) => !disabled.has(x.key)).length,
    0,
  );
  const activeChecks = steps.reduce(
    (n, s) =>
      n +
      (s.substeps ?? [])
        .filter((x) => !disabled.has(x.key))
        .reduce((m, x) => m + Number(x.check_count ?? 0), 0),
    0,
  );

  return (
    <Modal open={open} onClose={onClose} title="Review the assessment plan" wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip border-phantix-600/40 bg-phantix-800/50 text-[11px] text-slate-300">
            <Target size={11} className="mr-1 inline" /> {activeTypes} vulnerability types
          </span>
          <span className="chip border-phantix-600/40 bg-phantix-800/50 text-[11px] text-slate-300">
            {activeChecks} checks
          </span>
          {plan.estimated_duration && (
            <span className="chip border-phantix-600/40 bg-phantix-800/50 text-[11px] text-slate-300">
              {plan.estimated_duration}
            </span>
          )}
          {SEV_ORDER.map((sev) =>
            totals[sev] ? (
              <SeverityBadge
                key={sev}
                severity={sev}
                className="!px-1.5 !py-0 !text-[9px]"
              />
            ) : null,
          )}
          {(plan.frameworks?.required ?? []).length > 0 && (
            <span className="chip border-gold-400/30 bg-gold-400/10 text-[11px] text-gold-200">
              {(plan.frameworks?.required ?? []).map((f) => f.toUpperCase()).join(" + ")}
            </span>
          )}
        </div>

        {coverage?.auto_seeded && (
          <p className="flex items-start gap-1.5 text-[11px] leading-4 text-slate-500">
            <Info size={11} className="mt-0.5 shrink-0" />
            Vulnerability types are seeded automatically from the scan catalog
            {coverage.catalog_total_checks
              ? ` (${coverage.catalog_total_checks} checks available)`
              : ""}
            — a newly added check joins the next plan without a code change.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-phantix-700/40 bg-phantix-900/30 p-3">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Crosshair size={11} /> Product context
            </h4>
            {product?.available ? (
              <div className="space-y-0.5 text-[11.5px] leading-5 text-slate-400">
                <p>
                  {product.components} components · {product.flows} flows ·{" "}
                  {product.cross_boundary_flows} crossing a trust boundary
                </p>
                {(product.roles ?? []).length > 0 && (
                  <p>Roles: {(product.roles ?? []).join(", ")}</p>
                )}
                {(product.data_classes ?? []).length > 0 && (
                  <p className="text-amber-300">
                    Sensitive data: {(product.data_classes ?? []).join(", ")}
                  </p>
                )}
                {(product.projects ?? []).length > 0 && (
                  <p className="text-slate-500">
                    From: {(product.projects ?? []).map((p) => p.name).join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11.5px] leading-5 text-slate-500">
                None documented — targeting is inventory-driven. Add components and flows so the
                plan can prioritise by what the software actually does.
              </p>
            )}
          </div>

          <div className="rounded-md border border-phantix-700/40 bg-phantix-900/30 p-3">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <ShieldCheck size={11} /> What we already know
            </h4>
            {intel?.available ? (
              <div className="space-y-0.5 text-[11.5px] leading-5 text-slate-400">
                <p>
                  {intel.prior_open_findings} findings still open across{" "}
                  {intel.targets_with_history} known targets
                </p>
                {(intel.regressions ?? []).length > 0 && (
                  <p className="text-severity-critical">
                    {(intel.regressions ?? []).length} regression(s) tested first —{" "}
                    {(intel.regressions ?? []).join(", ")}
                  </p>
                )}
                {(intel.accepted_risks ?? []).length > 0 && (
                  <p className="text-amber-300">
                    {(intel.accepted_risks ?? []).length} accepted risk(s) still tested, not
                    re-raised
                  </p>
                )}
                {(intel.refuted ?? []).length > 0 && (
                  <p className="text-slate-500">
                    {(intel.refuted ?? []).length} class(es) previously disproved here
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11.5px] leading-5 text-slate-500">
                First assessment for these targets — no priors to apply.
              </p>
            )}
          </div>
        </div>

        {(plan.vuln_focus ?? []).length > 0 && (
          <div className="rounded-md border border-gold-400/20 bg-gold-400/[0.06] p-3">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold-200">
              <Sparkles size={11} /> Hunting first
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(plan.vuln_focus ?? []).slice(0, 10).map((focus) => (
                <span
                  key={focus.vuln_class}
                  title={focus.rationale || undefined}
                  className="chip border-phantix-600/40 bg-phantix-800/50 font-mono text-[10px] text-slate-300"
                >
                  {focus.rank}. {focus.vuln_class}
                  {focus.requires_approval && (
                    <AlertTriangle size={9} className="ml-1 inline text-amber-300" />
                  )}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[10.5px] text-slate-500">
              Classes marked with a warning need an authorizer before the confirming step runs.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Steps &amp; vulnerability types
          </h4>
          {steps.length === 0 ? (
            <p className="text-[11.5px] text-slate-500">This plan has no steps.</p>
          ) : (
            steps
              .filter((s) => s.step_type === "scan" || s.step_type === "web_scan")
              .map((step, i) => (
                <StepBlock
                  key={`${step.tool}-${i}`}
                  step={step}
                  disabled={disabled}
                  onToggle={toggle}
                />
              ))
          )}
        </div>

        {plan.narrative && (
          <details className="rounded-md border border-phantix-700/40 bg-phantix-900/30 p-3">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Full plan summary
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-[11.5px] leading-5 text-slate-400">
              {plan.narrative}
            </pre>
          </details>
        )}

        {disabled.size > 0 && (
          <p className="text-[11px] leading-4 text-amber-300">
            {disabled.size} vulnerability {disabled.size === 1 ? "type" : "types"} switched off —
            their checks will not run. The rest of each step is unaffected.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-phantix-700/40 pt-3">
          <button className="btn-ghost text-xs" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn-primary text-xs"
            disabled={busy || activeTypes === 0}
            onClick={() => onConfirm(Array.from(disabled))}
          >
            {busy && <Loader2 size={12} className="mr-1.5 inline animate-spin" />}
            Create draft campaign
          </button>
        </div>
        <p className="text-[10.5px] leading-4 text-slate-500">
          Creates the campaign as a <strong className="text-slate-400">draft</strong>. Nothing is
          scanned until you start it, and scope is re-validated on every run.
        </p>
      </div>
    </Modal>
  );
}
