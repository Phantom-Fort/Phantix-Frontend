import React, { useState } from "react";
import { motion } from "framer-motion";
import { ScrollText, Download, UserCheck, ArrowRight, Hourglass } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Tabs } from "@/components/ui";
import { auditEvents, pendingActions } from "@/lib/demo-data";
import { timeAgo, titleCase } from "@/lib/utils";
import { useStore } from "@/lib/store";

export default function Audit() {
  const { toast, dualControl } = useStore();
  const [tab, setTab] = useState("trail");

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Audit trail"
        description="Immutable dual-control trail on the platform DB — every completed action carries initiator and authorizer name + title snapshots for compliance export."
        actions={
          <button className="btn-secondary" onClick={() => toast("info", "Export", "GET /audit/export?format=csv — both names on every row.")}>
            <Download size={15} /> Export CSV
          </button>
        }
      />

      <Tabs
        tabs={[
          { id: "trail", label: "Event trail", count: auditEvents.length },
          { id: "pending", label: "Pending actions", count: pendingActions.filter((p) => p.status === "pending").length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "trail" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="!p-0 overflow-hidden">
            <div className="relative">
              <div className="absolute bottom-0 left-[29px] top-0 w-px bg-phantix-700/50" />
              {auditEvents.map((e, i) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative flex items-start gap-4 border-b border-phantix-800/40 px-5 py-4 last:border-0 hover:bg-phantix-800/25"
                >
                  <span className="relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-gold-400/60 bg-phantix-950">
                    <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-200">{e.action}</p>
                      <span className="rounded-md bg-phantix-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{e.event_key}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {e.initiator_name && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-phantix-700/60 text-[9px] font-bold text-phantix-200">
                            {e.initiator_name.slice(0, 1)}
                          </span>
                          {e.initiator_name} · {e.initiator_title}
                        </span>
                      )}
                      {e.authorizer_name && (
                        <>
                          <ArrowRight size={11} className="text-gold-500" />
                          <span className="inline-flex items-center gap-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gold-400/20 text-[9px] font-bold text-gold-300">
                              {e.authorizer_name.slice(0, 1)}
                            </span>
                            {e.authorizer_name} · {e.authorizer_title}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{timeAgo(e.created_at)}</span>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {tab === "pending" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-severity-medium/25 bg-severity-medium/5 px-4 py-3">
            <Hourglass size={16} className="mt-0.5 shrink-0 text-severity-medium" />
            <p className="text-xs leading-5 text-slate-400">
              Initiated by <strong className="text-slate-200">{dualControl.initiator?.full_name}</strong> — waiting
              on <strong className="text-slate-200">{dualControl.authorizer?.full_name}</strong> (authorizer) to
              decide. Authorization identity comes from the session, never the request body.
            </p>
          </div>
          {pendingActions.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover className="!p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-severity-medium/12 text-severity-medium">
                    <UserCheck size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-200">{p.action_label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="font-mono">{p.action_key}</span> · {titleCase(p.category)} · initiated by {p.initiated_by} · {timeAgo(p.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                  <div className="flex gap-2">
                    <button className="btn-primary !px-3.5 !py-1.5 !text-xs" onClick={() => toast("success", "Authorized", `POST /audit/pending/${p.id}/authorize with authorizer session — writes the immutable trail + AuditRecorded event.`)}>
                      Authorize
                    </button>
                    <button className="btn-danger !px-3.5 !py-1.5 !text-xs" onClick={() => toast("info", "Rejected", "POST …/reject with reason")}>
                      Reject
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
