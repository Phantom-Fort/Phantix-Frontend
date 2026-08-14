import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Shield, Crosshair, AlertTriangle } from "lucide-react";
import { PageHeader, Card, TableSkeleton, EmptyState } from "@/components/ui";
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

  const { data: inbox, loading, reload } = useResource(
    () => api.get<InboxResponse>("/authorizer/inbox", { dualControl: true }),
    emptyInbox,
  );

  const items = inbox?.items || [];
  const filtered = filter === "all" ? items : items.filter((i) => {
    if (filter === "dual_control") return i.channel === "dual_control";
    if (filter === "vapt") return i.channel === "vapt";
    if (filter === "risk") return i.channel === "risk";
    return true;
  });

  const handleDecide = async (item: InboxItem, approve: boolean) => {
    setActing(item.pendingId || item.requestId || item.treatmentId || null);
    const dp = (item as any).decidePaths ?? (item as any).decide_paths ?? {};
    const path = approve ? (dp.approve || dp.decide) : (dp.reject || dp.decide);
    if (!path) { toast("error", "No decision path"); return; }

    let body: Record<string, unknown>;
    if (item.channel === "vapt") {
      body = approve
        ? { approve: true, notes: "Approved" }
        : { approve: false, rejection_reason: "Rejected" };
    } else if (approve) {
      body = { notes: "Approved" };
    } else {
      body = { reason: "Rejected" };
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
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-phantix-500 border-t-gold-400" />
        Loading authorizations...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        title="Authorizations"
        description={inbox?.authorizer?.email ? `Approving as ${inbox.authorizer.fullName || inbox.authorizer.email}` : "Review and decide on pending approvals"}
        actions={
          inbox?.total ? (
            <span className="chip text-sm font-mono text-gold-400 bg-gold-400/10 border-gold-400/30">
              {inbox.total} pending
            </span>
          ) : null
        }
      />

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
            const channelIcon = item.channel === "dual_control" ? <Shield size={16} className="text-blue-400" />
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
    </div>
  );
}
