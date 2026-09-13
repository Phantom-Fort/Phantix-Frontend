import React, { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Loader2, RefreshCw, ShieldCheck, UserRound, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { useStore } from "@/lib/store";
import {
  decideAgentApproval,
  loadAgentApprovals,
  type AgentApprovalRow,
} from "@/lib/agentGuard";
import { cx } from "@/lib/utils";

// ── Agent guard ──────────────────────────────────────────────────────────────
// The agent is not a system superuser: it acts as the signed-in user and can do
// only what that user can do. Every state-changing action needs a *fresh* human
// authorization, good for one action on one run and then spent. This panel is
// where that is made visible and where an authorizer grants it.

const STATUS_TONE: Record<string, string> = {
  pending: "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
  approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  rejected: "border-phantix-700 text-slate-500",
};

function statusTone(status: string): string {
  return STATUS_TONE[status] ?? "border-phantix-700 text-slate-400";
}

export default function AgentGuardPanel({
  runId,
  className,
}: {
  runId?: string;
  className?: string;
}) {
  const { session, toast } = useStore();
  const [rows, setRows] = useState<AgentApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadAgentApprovals();
      setRows(Array.isArray(res.items) ? res.items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, runId]);

  const decide = async (row: AgentApprovalRow, approve: boolean) => {
    setBusy(row.approval_id);
    try {
      const res = await decideAgentApproval(row.approval_id, approve);
      const authz = (res as { authorization?: unknown })?.authorization;
      toast(
        approve ? "success" : "info",
        approve ? "Authorized — once" : "Rejected",
        approve
          ? "The agent may take this action one time on this run; the authorization is then spent."
          : "The agent will not take this action."
      );
      void authz;
      await load();
    } catch (e) {
      toast("error", "Could not record the decision", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending").slice(0, 5);

  // Nothing needs a human right now — get out of the chat's way rather than
  // lingering with a stale "approved"/"rejected" row. The decide() toast
  // already told the operator what happened; a future request re-populates
  // `rows` (via the `runId` reload) and the panel reappears on its own.
  if (!loading && pending.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader
        title="Agent guard"
        subtitle="The agent uses your permissions — and nothing more"
        action={
          <button onClick={() => void load()} className="btn-ghost text-xs !py-1.5" title="Refresh">
            <RefreshCw size={12} className={cx("inline", loading && "animate-spin")} />
          </button>
        }
      />

      <div className="flex items-start gap-2.5 rounded-md border border-gold-400/25 bg-gold-400/[0.06] p-3">
        <UserRound size={14} className="mt-0.5 shrink-0 text-gold-300" />
        <p className="text-[11px] leading-5 text-gold-100/90">
          Acting as <span className="font-semibold">{session?.userName || session?.userEmail || "you"}</span>
          {session?.isAuthorizer ? " (authorizer)" : session?.isInitiator ? " (initiator)" : ""}. The agent can
          see and do only what your role allows, and every action that changes something needs a fresh
          authorization — good for one action on one run, then spent. Runs and actions are logged.
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {loading && !rows.length ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="skeleton h-9 w-full rounded-md" />)}
          </div>
        ) : (
          <>
            {pending.map((row) => (
              <div
                key={row.approval_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-phantix-700 bg-phantix-900/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-slate-200">{row.action}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {row.reason || "Requested by the agent"}
                    {row.analysis_id ? ` · run ${String(row.analysis_id).slice(0, 8)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => void decide(row, true)}
                    disabled={busy === row.approval_id}
                    className="btn-secondary !px-2.5 !py-1 !text-[11px] disabled:opacity-50"
                    title="Authorize once — the agent may take this action one time"
                  >
                    {busy === row.approval_id ? <Loader2 size={11} className="mr-1 inline animate-spin" /> : <Check size={11} className="mr-1 inline" />}
                    Authorize once
                  </button>
                  <button
                    onClick={() => void decide(row, false)}
                    disabled={busy === row.approval_id}
                    className="btn-ghost !px-2 !py-1 !text-[11px] disabled:opacity-50"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            ))}

            {decided.length > 0 && (
              <div className="space-y-1 pt-1">
                {decided.map((row) => (
                  <div key={row.approval_id} className="flex items-center justify-between gap-2 px-1 py-1">
                    <span className="truncate font-mono text-[10px] text-slate-500">{row.action}</span>
                    <span className="flex items-center gap-1.5">
                      {row.status === "approved" && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-500" title="An approved-but-unspent authorization still exists for this run">
                          <KeyRound size={10} className={row.authorized ? "text-emerald-400" : "text-slate-600"} />
                          {row.authorized ? "authorized now" : "spent"}
                        </span>
                      )}
                      <span className={cx("chip capitalize", statusTone(row.status))}>{row.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
