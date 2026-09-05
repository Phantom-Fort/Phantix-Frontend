import React, { useState } from "react";
import { motion } from "framer-motion";
import { ScrollText, Shield, Search, Filter } from "lucide-react";
import { PageHeader, Card, CardHeader, Tabs, Spinner, PageSkeleton, ErrorState, EmptyState } from "@/components/ui";
import { loadPlaybooks, loadMitreMatrix, loadMitreStats } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import type { SocPlaybook, MitreMatrix, MitreStats } from "@/lib/types";

export default function SocPlaybooks() {
  const [tab, setTab] = useState("playbooks");
  const { data: playbooks, loading: pl } = useResource<SocPlaybook[]>(() => loadPlaybooks(), [], "playbooks");
  const { data: matrix, loading: ml } = useResource<MitreMatrix | null>(() => loadMitreMatrix(), null, "mitre-matrix");
  const { data: stats, loading: sl } = useResource<MitreStats | null>(() => loadMitreStats(), null, "mitre-stats");

  if (pl) return <PageSkeleton variant="list" rows={4} />;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Playbooks & MITRE"
        description="Response playbooks, runbooks, and MITRE ATT&CK coverage mapping."
      />
      <Tabs
        tabs={[
          { id: "playbooks", label: "Playbooks", count: playbooks.length },
          { id: "mitre", label: "MITRE Coverage" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "playbooks" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playbooks.length === 0 ? (
            <EmptyState icon={<ScrollText size={32} />} title="No playbooks" body="Playbooks define response procedures for detections and incidents." />
          ) : playbooks.map((pb, i) => (
            <motion.div key={pb.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="!p-4">
                <CardHeader title={pb.title} subtitle={`${pb.category} &middot; v${pb.version}`} />
                <p className="mt-2 text-xs text-slate-400">{pb.phases?.length || 0} phases</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pb.mitre_id && <span className="chip border-phantix-700 bg-phantix-800 text-slate-300">{pb.mitre_id}</span>}
                  <span className="chip border-phantix-700 bg-phantix-800 text-slate-300">{pb.org_only ? "Custom" : "Global"}</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === "mitre" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
          {ml ? <Spinner /> : (
            <>
              {stats && (
                <div className="grid grid-cols-3 gap-3">
                  <Card className="!p-4">
                    <p className="text-2xl font-semibold text-white">{stats.total_techniques}</p>
                    <p className="text-xs text-slate-400">Total techniques</p>
                  </Card>
                  <Card className="!p-4">
                    <p className="text-2xl font-semibold text-emerald-400">{stats.covered}</p>
                    <p className="text-xs text-slate-400">Covered</p>
                  </Card>
                  <Card className="!p-4">
                    <p className="text-2xl font-semibold text-severity-critical">{stats.not_covered}</p>
                    <p className="text-xs text-slate-400">Not covered</p>
                  </Card>
                </div>
              )}
              {matrix && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {matrix.tactics.map((tactic) => (
                    <Card key={tactic.id} className="!p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-200">{tactic.name}</span>
                        <span className="text-xs text-slate-400">{tactic.coverage}%</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-phantix-800">
                        <div className="h-full rounded-full bg-gold-400" style={{ width: `${tactic.coverage}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{tactic.techniques} techniques</p>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}