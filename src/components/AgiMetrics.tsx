import React, { useState } from "react";
import { AlertTriangle, ChevronDown, Clock, Gauge, Lock, ShieldCheck, Target } from "lucide-react";
import type { AgiAccess, AgiSession, AiUsage } from "@/lib/types";
import { cx } from "@/lib/utils";

/*
 * Pentest agent metrics — the standard strip every view of this module carries.
 *
 * An autonomous agent that runs for half an hour against production, spends a
 * token budget and pauses for approvals cannot be reported on with a single
 * "running" chip. The module already held every number needed and surfaced
 * almost none of them: `AgiAccess.agi.limits` was loaded and only read for
 * blockers, and `GET /ai/usage` had no consumer at all.
 *
 * Three groups, in the order an operator asks about them:
 *   run      — is it working, how far in, what has it produced
 *   usage    — will it be allowed to finish (tokens, spend)
 *   scope    — what it is permitted to do at all
 *
 * Rendered the same way in the page and in the drawer; `compact` only drops to
 * one column and trims labels, so the drawer is never a different contract.
 */

function pct(used: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
}

function fmtInt(n: number | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";
}

function fmtUsd(n: number | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

/** Elapsed run time. Ends at `ended_at` so a finished run stops counting up. */
export function sessionElapsed(session: AgiSession | null): string {
  if (!session?.started_at) return "—";
  const start = new Date(session.started_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  if (!Number.isFinite(start) || end < start) return "—";
  const mins = Math.floor((end - start) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function Metric({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "gold" | "warn" | "bad";
  title?: string;
}) {
  return (
    <div className="min-w-0" title={title}>
      <p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>
      <p
        className={cx(
          "mt-0.5 truncate font-display text-[13px] font-semibold",
          tone === "gold" && "text-gold-300",
          tone === "warn" && "text-amber-300",
          tone === "bad" && "text-severity-critical",
          (!tone || tone === "default") && "text-slate-200",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** A budget bar. Turns amber past 75% and red past 90% — before it bites. */
function Budget({
  label,
  used,
  total,
  render,
}: {
  label: string;
  used: number | undefined;
  total: number | undefined;
  render: (n: number | undefined) => string;
}) {
  const hasBudget = typeof total === "number" && total > 0;
  const percentage = hasBudget ? pct(used ?? 0, total) : 0;
  const tone =
    percentage >= 90 ? "bg-severity-critical" : percentage >= 75 ? "bg-amber-400" : "bg-gold-400";
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          {label}
        </p>
        <p className="shrink-0 font-mono text-[10.5px] text-slate-500">
          {render(used)}
          {hasBudget ? ` / ${render(total)}` : ""}
        </p>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-phantix-800">
        {hasBudget ? (
          <div className={cx("h-full rounded-full transition-all", tone)} style={{ width: `${percentage}%` }} />
        ) : null}
      </div>
      {!hasBudget && <p className="mt-0.5 text-[9.5px] text-slate-600">no ceiling set</p>}
    </div>
  );
}

export default function AgiMetrics({
  access,
  session,
  usage,
  findingCount,
  pendingCount,
  running,
  compact = false,
  collapsible = false,
  defaultCollapsed = false,
  className,
}: {
  access: AgiAccess | null;
  session: AgiSession | null;
  usage: AiUsage | null;
  findingCount: number;
  pendingCount: number;
  running: boolean;
  compact?: boolean;
  /** Lets the whole strip fold down to a one-line summary — for the narrow
   * drawer, where the full run/usage/scope detail otherwise crowds out the
   * live transcript beneath it. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const agi = access?.agi;
  const limits = agi?.limits;
  const loop = session?.loop ?? null;
  const phase = loop?.active_phase || loop?.phase || (running ? "starting" : "—");
  const turn = typeof loop?.turn === "number" ? loop.turn : null;
  const blockers = loop?.blockers?.length ?? 0;

  // Budget state is the one metric that can stop a run mid-flight, so it is
  // stated rather than implied by a bar the eye has to measure.
  const budgetBlocked = usage ? usage.allowed === false : false;

  const statusLabel = running ? "running" : session ? session.status || "stopped" : "idle";
  const summary = `${statusLabel} · ${findingCount} finding${findingCount === 1 ? "" : "s"} · ${pendingCount} approval${pendingCount === 1 ? "" : "s"}`;

  return (
    <div className={cx("space-y-2.5", className)}>
      {collapsible && (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-1.5 text-left"
        >
          <Gauge size={10} className="shrink-0 text-slate-500" />
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">Session status</span>
          {collapsed && <span className="ml-auto min-w-0 truncate text-[10.5px] text-slate-400">{summary}</span>}
          <ChevronDown size={12} className={cx("ml-1 shrink-0 text-slate-500 transition-transform", !collapsed && "rotate-180")} />
        </button>
      )}
      {(!collapsible || !collapsed) && (
        <>
      {/* Run */}
      <section>
        <p className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          <Gauge size={10} /> Run
        </p>
        <div className={cx("grid gap-3", compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6")}>
          <Metric
            label="Status"
            value={running ? "running" : session ? session.status || "stopped" : "idle"}
            tone={running ? "gold" : "default"}
          />
          <Metric label="Phase" value={phase} title={loop?.working_on || undefined} />
          <Metric label="Turn" value={turn != null ? turn : "—"} />
          <Metric label="Elapsed" value={sessionElapsed(session)} />
          <Metric
            label="Findings"
            value={findingCount}
            tone={findingCount > 0 ? "gold" : "default"}
          />
          <Metric
            label="Approvals"
            value={pendingCount}
            tone={pendingCount > 0 ? "warn" : "default"}
            title={pendingCount > 0 ? "State-changing steps waiting on you" : undefined}
          />
        </div>
        {loop?.working_on && (
          <p className="mt-1.5 truncate text-[10.5px] text-slate-500" title={loop.working_on}>
            <Clock size={9} className="mr-1 inline" />
            {loop.working_on}
          </p>
        )}
        {blockers > 0 && (
          <p className="mt-1 text-[10.5px] text-amber-300">
            <AlertTriangle size={9} className="mr-1 inline" />
            {blockers} blocker{blockers === 1 ? "" : "s"} reported by the loop
          </p>
        )}
      </section>

      {/* Usage & limits */}
      <section className="border-t border-phantix-800/70 pt-2.5">
        <p className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          <Target size={10} /> AI usage
          {usage?.year_month && (
            <span className="font-mono text-[9px] normal-case tracking-normal text-slate-600">
              {usage.year_month}
            </span>
          )}
        </p>
        {usage ? (
          <div className={cx("grid gap-3", compact ? "grid-cols-1" : "grid-cols-2")}>
            <Budget label="Tokens" used={usage.tokens_used} total={usage.token_budget} render={fmtInt} />
            <Budget label="Spend" used={usage.cost_usd} total={usage.spend_limit_usd} render={fmtUsd} />
          </div>
        ) : (
          <p className="text-[10.5px] text-slate-600">Budget snapshot unavailable.</p>
        )}
        {budgetBlocked && (
          <p className="mt-1.5 text-[10.5px] text-severity-critical">
            <AlertTriangle size={9} className="mr-1 inline" />
            Budget exhausted — new AI work is refused until it is raised or the window rolls over.
          </p>
        )}
        {usage?.mode && (
          <p className="mt-1 text-[10px] text-slate-600">
            mode <span className="font-mono text-slate-500">{usage.mode}</span>
          </p>
        )}
      </section>

      {/* Governance & scope */}
      <section className="border-t border-phantix-800/70 pt-2.5">
        <p className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          <ShieldCheck size={10} /> Scope &amp; governance
        </p>
        <div className={cx("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
          <Metric
            label="Agreement"
            value={agi?.agreement_accepted ? "accepted" : "required"}
            tone={agi?.agreement_accepted ? "default" : "warn"}
            title={agi?.active_policy_version ? `policy ${agi.active_policy_version}` : undefined}
          />
          <Metric
            label="Targets / session"
            value={limits?.max_allowlist_targets ?? "—"}
            title="Most targets one session may run against"
          />
          <Metric
            label="Session cap"
            value={limits?.max_session_minutes ? `${limits.max_session_minutes}m` : "uncapped"}
            title={
              limits?.max_session_minutes
                ? "Sessions are torn down at this ceiling"
                : "A session runs until the agent finishes, you stop it, or AI credits run out"
            }
          />
          <Metric
            label="Daily runs"
            value={limits?.daily_session_limit ?? "—"}
            title="Set by your org admin in AI settings"
          />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span
            className={cx(
              "chip !px-2 !py-0.5 text-[9.5px]",
              limits?.allow_state_changing
                ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                : "border-phantix-600/40 bg-phantix-800/50 text-slate-400",
            )}
          >
            {limits?.allow_state_changing ? "state-changing allowed" : "read-only"}
          </span>
          {limits?.require_dual_control_for_active && (
            <span className="chip !px-2 !py-0.5 border-phantix-600/40 bg-phantix-800/50 text-[9.5px] text-slate-400">
              <Lock size={8} className="mr-1 inline" /> dual-control
            </span>
          )}
          {limits?.require_asset_backed_targets && (
            <span className="chip !px-2 !py-0.5 border-phantix-600/40 bg-phantix-800/50 text-[9.5px] text-slate-400">
              asset-backed targets only
            </span>
          )}
          {agi?.entitlement_code && (
            <span className="chip !px-2 !py-0.5 border-phantix-600/40 bg-phantix-800/50 font-mono text-[9.5px] text-slate-500">
              {agi.entitlement_code}
            </span>
          )}
        </div>
        {(agi?.blockers?.length ?? 0) > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {(agi?.blockers ?? []).slice(0, 3).map((b) => (
              <li key={b.code} className="flex items-start gap-1.5 text-[10.5px] text-slate-500">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                {b.message}
              </li>
            ))}
          </ul>
        )}
      </section>
        </>
      )}
    </div>
  );
}
