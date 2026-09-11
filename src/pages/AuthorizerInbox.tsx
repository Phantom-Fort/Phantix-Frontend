import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Shield, ShieldCheck, Crosshair, AlertTriangle } from "lucide-react";
import { PageHeader, Card, CardHeader, TableSkeleton, EmptyState, PageSkeleton, ErrorState } from "@/components/ui";
import DocLink from "@/components/DocLink";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { cx } from "@/lib/utils";

type InboxItem = {
  inboxId: string;
  channel: "dual_control" | "vapt" | "risk";
  kind: string;
  status: string;
  title?: string;
  summary?: string;
  actionKey?: string;
  pendingId?: number;
  campaignId?: number;
  campaignName?: string;
  requestId?: number;
  treatmentId?: number;
  riskId?: number;
  requiredRole?: string;
  decidePaths: { approve?: string; reject?: string; decide?: string };
};

type InboxResponse = {
  total: number;
  counts: { dualControl: number; vapt: number; riskTreatments: number };
  items: InboxItem[];
  authorizer: { userId: number; email: string; fullName: string };
};

const emptyInbox: InboxResponse = { total: 0, counts: { dualControl: 0, vapt: 0, riskTreatments: 0 }, items: [], authorizer: { userId: 0, email: "", fullName: "" } };

export default function AuthorizerInbox() {
  const { toast } = useStore();
  const [filter, setFilter] = useState<string>("all");
  const [acting, setActing] = useState<number | null>(null);

  const { data: inbox, loading, error, reload } = useResource(
    () => api.get<InboxResponse>("/authorizer/inbox", { dualControl: true }),
    emptyInbox,
  );

  // Current dual-control designation (GET /audit/control-roles) — read-only here;
  // assignment is managed in the platform portal.
  const { data: controlRoles } = useResource(
    () => api.get<any>("/audit/control-roles", { dualControl: true }),
    null,
  );

  const items = inbox?.items || [];
  const filtered = filter === "all" ? items : items.filter((i) => {
    if (filter === "dual_control") return i.channel === "dual_control";
    if (filter === "vapt") return i.channel === "vapt";
    if (filter === "risk") return i.channel === "risk";
    return true;
  });

  const handleDecide = async (item: InboxItem, approve: boolean) => {
    const dp = (item as any).decidePaths ?? (item as any).decide_paths ?? {};
    const path = approve ? (dp.approve || dp.decide) : (dp.reject || dp.decide);
    if (!path) { toast("error", "No decision path"); return; }

    // A rejection is a decision someone will have to answer for later, so it
    // carries the authorizer's own words rather than a hardcoded "Rejected".
    // The server requires at least 2 characters on the dual-control channel.
    let reason = "";
    if (!approve) {
      const entered = window.prompt(`Why are you rejecting "${item.title || item.kind}"?`, "");
      if (entered === null) return;
      reason = entered.trim();
      if (reason.length < 2) {
        toast("error", "A reason is required", "Say why this was rejected — it is recorded on the audit trail.");
        return;
      }
    }

    setActing(item.pendingId || item.requestId || item.treatmentId || null);

    let body: Record<string, unknown>;
    if (item.channel === "vapt") {
      body = approve
        ? { approve: true }
        : { approve: false, rejection_reason: reason };
    } else if (approve) {
      body = {};
    } else {
      body = { reason };
    }

    try {
      await api.post(path, body);
      toast("success", approve ? "Approved" : "Rejected");
      reload();
    } catch (e: any) {
      toast("error", approve ? "Approve failed" : "Reject failed", e.message || "");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return <PageSkeleton variant="table" rows={5} cols={4} actions />;
  }

  if (error && items.length === 0) {
    return (
      <ErrorState
        onRetry={reload}
        body="We could not load the authorizer inbox. Check your connection and retry — your session stays signed in."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        title="Authorizations"
        description={inbox?.authorizer?.email ? `Approving as ${inbox.authorizer.fullName || inbox.authorizer.email}` : "Review and decide on pending approvals"}
        actions={
          <span className="flex items-center gap-2">
            <DocLink docId="howto-app-14" label="Approvals how-to" />
            {inbox?.total ? (
              <span className="chip text-sm font-mono text-gold-400 bg-gold-400/10 border-gold-400/30">
                {inbox.total} pending
              </span>
            ) : null}
          </span>
        }
      />

      {controlRoles?.configured && (
        <Card className="mb-4">
          <CardHeader
            title="Control roles"
            subtitle="Who proposes and who approves under dual control"
            action={<ShieldCheck size={16} className="text-gold-400" />}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-phantix-700/40 bg-phantix-950/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Initiator</p>
              <p className="mt-1 text-sm text-slate-200">
                {controlRoles.initiator_name || controlRoles.initiator_title || "—"}
              </p>
            </div>
            <div className="rounded-md border border-phantix-700/40 bg-phantix-950/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Authorizer</p>
              <p className="mt-1 text-sm text-slate-200">
                {controlRoles.authorizer_name || controlRoles.authorizer_title || "—"}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {[
          { id: "all", label: "All", count: inbox?.total },
          { id: "dual_control", label: "Dual Control", count: inbox?.counts?.dualControl },
          { id: "vapt", label: "VAPT", count: inbox?.counts?.vapt },
          { id: "risk", label: "Risk", count: inbox?.counts?.riskTreatments },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cx(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.id ? "bg-gold-400/15 text-gold-300 border border-gold-400/30" : "text-slate-400 hover:bg-phantix-800/60 border border-transparent",
            )}
          >
            {f.label}
            {f.count != null && f.count > 0 && (
              <span className={cx("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold", filter === f.id ? "bg-gold-400/20" : "bg-phantix-700/60")}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<CheckCircle2 size={24} />} title="All clear" body="No pending approvals --- everything is authorized." />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const busy = acting === (item.pendingId || item.requestId || item.treatmentId || null);
            const channelIcon = item.channel === "dual_control" ? <Shield size={16} className="text-gold-400" />
              : item.channel === "vapt" ? <Crosshair size={16} className="text-severity-medium" />
              : <AlertTriangle size={16} className="text-severity-high" />;
            const channelLabel = item.channel === "dual_control" ? "Dual Control"
              : item.channel === "vapt" ? "VAPT Campaign"
              : "Risk Treatment";

            return (
              <motion.div key={item.inboxId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <div className="flex flex-wrap items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-phantix-800/70">
                      {channelIcon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="chip text-[10px] text-slate-400 bg-slate-400/10 border-slate-500/30">{channelLabel}</span>
                        {item.actionKey && <span className="text-[10px] font-mono text-slate-500">{item.actionKey}</span>}
                        {item.requiredRole && <span className="text-[10px] text-slate-500 capitalize">requires {item.requiredRole}</span>}
                      </div>
                      <p className="text-sm font-semibold text-slate-100">{item.title || item.kind?.replace(/_/g, " ") || `#${item.inboxId}`}</p>
                      {item.summary && <p className="text-xs text-slate-400 mt-0.5">{item.summary}</p>}
                      {item.campaignName && <p className="text-xs text-slate-400 mt-0.5">Campaign: {item.campaignName}</p>}
                      {item.riskId && <p className="text-xs text-slate-400 mt-0.5">Risk #{item.riskId}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleDecide(item, true)} disabled={busy} className="btn-primary text-xs px-3 py-1.5">
                        {busy ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-phantix-950 border-t-transparent" /> : <CheckCircle2 size={14} />}
                        Approve
                      </button>
                      <button onClick={() => handleDecide(item, false)} disabled={busy} className="btn-danger text-xs px-3 py-1.5">
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
        <a href="/vapt" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <Crosshair size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">VAPT Campaigns</p><p className="text-xs text-slate-400">View campaigns</p></div>
        </a>
        <a href="/risks" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <AlertTriangle size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Risk Register</p><p className="text-xs text-slate-400">View treatments</p></div>
        </a>
        <a href="/audit" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <Shield size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Audit Trail</p><p className="text-xs text-slate-400">Pending actions</p></div>
        </a>
      </div>

      <AuthorizerCatalog />
    </div>
  );
}

/**
 * Reference list of what actually needs an authorizer, from
 * GET /authorizer/catalog. Collapsed by default — it answers "why did this land
 * in my inbox?" without competing with the queue itself.
 */
function AuthorizerCatalog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || rows || failed) return;
    void (async () => {
      try {
        const res = await api.get<{ items?: unknown[]; note?: string }>("/authorizer/catalog", { dualControl: true });
        setRows(Array.isArray(res.items) ? (res.items as Record<string, unknown>[]) : []);
        setNote(res.note ?? null);
      } catch {
        setFailed(true);
      }
    })();
  }, [open, rows, failed]);

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-phantix-700 bg-phantix-900/60 px-4 py-3 text-left transition-colors hover:border-phantix-600"
      >
        <span className="flex items-center gap-2 text-sm text-slate-300">
          <Shield size={15} className="text-phantix-400" />
          What requires an authorizer?
        </span>
        <span className="text-xs text-slate-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-phantix-700 bg-phantix-900/40 p-4">
          {failed ? (
            <p className="text-xs text-slate-500">The catalog could not be loaded.</p>
          ) : !rows ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-9 rounded-md" style={{ opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          ) : !rows.length ? (
            <p className="text-xs text-slate-500">No action types are registered.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                {rows.map((r, i) => (
                  <div key={i} className="rounded-md border border-phantix-700/60 bg-phantix-950/40 p-2.5">
                    <p className="text-xs text-slate-200">
                      {String(r.label ?? r.title ?? r.action_key ?? r.key ?? `Action ${i + 1}`)}
                    </p>
                    {(r.action_key ?? r.key) != null && (
                      <p className="mt-0.5 font-mono text-[10px] text-slate-500">{String(r.action_key ?? r.key)}</p>
                    )}
                    {r.description != null && (
                      <p className="mt-1 text-[11px] leading-4 text-slate-400">{String(r.description)}</p>
                    )}
                  </div>
                ))}
              </div>
              {note && <p className="mt-3 text-[11px] leading-4 text-slate-500">{note}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
