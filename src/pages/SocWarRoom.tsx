import React, { useState } from "react";
import { motion } from "framer-motion";
import { Swords, Plus, ArrowRight, Check, Clock, AlertTriangle, FileText, ShieldAlert } from "lucide-react";
import { PageHeader, Card, CardHeader, SeverityBadge, StatusBadge, Tabs, Spinner, PageSkeleton, ErrorState, EmptyState, Modal } from "@/components/ui";
import { loadSocWarRoom, loadWarRoomChecklist, updateChecklistStep, loadWarRoomEvidence, loadWarRoomKillChain, loadWarRoomSla, openSocWarRoomCase } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { timeAgo, cx } from "@/lib/utils";
import type { Severity, SocWarRoomCase, SocWarRoomResponse, SocPlaybook } from "@/lib/types";

export default function SocWarRoom() {
  const { toast } = useStore();
  const [tab, setTab] = useState("cases");
  const [selectedCase, setSelectedCase] = useState<number | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);

  const { data, loading, error, reload } = useResource<SocWarRoomResponse | null>(
    () => loadSocWarRoom(),
    null,
    "war-room"
  );

  if (loading) return <PageSkeleton variant="list" rows={6} actions />;
  if (error && !data) return <ErrorState onRetry={reload} body="Could not load war room." />;

  const cases = data?.cases ?? [];
  const playbookCatalog: SocPlaybook[] = data?.playbook_catalog ?? [];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="War Room"
        description="Incident case management with playbook-driven checklists, evidence timelines, and SLA tracking."
        actions={
          <button className="btn-primary" onClick={() => setShowOpenModal(true)}>
            <Plus size={15} /> Open case
          </button>
        }
      />

      {selectedCase ? (
        <CaseDetailView caseId={selectedCase} onBack={() => setSelectedCase(null)} />
      ) : (
        <>
          <Tabs
            tabs={[
              { id: "cases", label: "Open cases", count: cases.length },
              { id: "catalog", label: "Playbook catalog", count: playbookCatalog.length },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === "cases" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
              {cases.length === 0 ? (
                <EmptyState icon={<Swords size={32} />} title="No open cases" body="Open a new case to start tracking an incident." />
              ) : cases.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className="cursor-pointer" onClick={() => setSelectedCase(c.id)}>
                  <Card hover className="!p-4">
                    <div className="flex items-center gap-4">
                      <SeverityBadge severity={c.severity as Severity} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-200">{c.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Opened {c.opened_at ? timeAgo(c.opened_at) : ""}</p>
                      </div>
                      <StatusBadge status={c.status} />
                      {c.sla_deadline && new Date(c.sla_deadline) < new Date() && <AlertTriangle size={16} className="text-severity-critical" />}
                      <ArrowRight size={16} className="text-slate-500" />
                    </div>
                  </Card>
                  </div>
                  </motion.div>
              ))}
            </motion.div>
          )}

          {tab === "catalog" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {playbookCatalog.length === 0 ? (
                <EmptyState icon={<FileText size={32} />} title="No playbooks" body="Playbooks define the checklist steps for each case type." />
              ) : playbookCatalog.map((pb) => (
                <Card key={pb.id} className="!p-4">
                  <CardHeader title={pb.title} subtitle={pb.category} />
                  <p className="mt-2 text-xs text-slate-400">{pb.phases?.length || 0} phases</p>
                </Card>
              ))}
            </motion.div>
          )}
        </>
      )}

      {showOpenModal && (
        <OpenCaseModal
          playbooks={playbookCatalog}
          onClose={() => setShowOpenModal(false)}
          onCreated={() => { setShowOpenModal(false); reload(); }}
        />
      )}
    </div>
  );
}

function CaseDetailView({ caseId, onBack }: { caseId: number; onBack: () => void }) {
  const [detailTab, setDetailTab] = useState("checklist");
  const { data: checklist, loading: cl } = useResource(() => loadWarRoomChecklist(caseId), null, "checklist");
  const { data: evidence, loading: ev } = useResource(() => loadWarRoomEvidence(caseId), null, "evidence");
  const { data: killChain, loading: kc } = useResource(() => loadWarRoomKillChain(caseId), null, "kill-chain");
  const { data: sla, loading: slaLoading } = useResource(() => loadWarRoomSla(caseId), null, "sla");

  if (cl) return <PageSkeleton variant="list" rows={4} />;

  return (
    <div className="mt-4">
      <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowRight size={14} className="rotate-180" /> Back to cases
      </button>

      <Tabs
        tabs={[
          { id: "checklist", label: "Checklist" },
          { id: "evidence", label: "Evidence" },
          { id: "kill-chain", label: "Kill chain" },
          { id: "sla", label: "SLA" },
        ]}
        active={detailTab}
        onChange={setDetailTab}
      />

      {detailTab === "checklist" && (
        <div className="mt-4 space-y-2">
          {checklist?.steps.map((step) => (
            <Card key={step.step_id} className="!p-3">
              <div className="flex items-center gap-3">
                <div
                  className={cx(
                    "flex h-8 w-8 items-center justify-center rounded-md border",
                    step.status === "completed" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" :
                    step.status === "skipped" ? "border-slate-600 bg-slate-800 text-slate-500" :
                    "border-phantix-700 bg-phantix-900 text-slate-400"
                  )}
                >
                  {step.status === "completed" ? <Check size={14} /> : <Clock size={14} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">{step.title}</p>
                  <p className="text-xs text-slate-500">{step.phase}</p>
                </div>
                {step.status !== "completed" && step.status !== "skipped" && (
                  <button
                    className="btn-secondary !px-3 !py-1 !text-xs"
                    onClick={() => { void updateChecklistStep(caseId, step.step_id, { status: "completed" }); }}
                  >
                    Complete
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {detailTab === "evidence" && (
        <div className="mt-4 space-y-2">
          {ev ? <Spinner /> : (evidence?.timeline ?? []).map((evt, i) => (
            <Card key={`${evt.id}-${i}`} className="!p-3">
              <p className="text-sm text-slate-200">{evt.title}</p>
              <p className="text-xs text-slate-500">{evt.event_type} &middot; {timeAgo(evt.created_at)}</p>
            </Card>
          ))}
        </div>
      )}

      {detailTab === "kill-chain" && (
        <div className="mt-4 space-y-2">
          {kc ? <Spinner /> : (killChain?.techniques ?? []).map((t) => (
            <div key={t.technique_id} className="flex items-center gap-3 rounded-md border border-phantix-700 bg-phantix-900 px-4 py-2.5">
              <ShieldAlert size={14} className="text-gold-400" />
              <span className="text-sm text-slate-200">{t.name}</span>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </div>
      )}

      {detailTab === "sla" && (
        <div className="mt-4 space-y-2">
          {slaLoading ? <Spinner /> : (sla?.targets ?? []).map((m) => (
            <div key={m.metric} className="flex items-center justify-between rounded-md border border-phantix-700 bg-phantix-900 px-4 py-2.5">
              <span className="text-sm text-slate-200">{m.metric}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-400">Target: {m.target}</span>
                <span className="text-slate-300">Actual: {m.actual}</span>
                {m.breached && <AlertTriangle size={14} className="text-severity-critical" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OpenCaseModal({ playbooks, onClose, onCreated }: { playbooks: SocPlaybook[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [playbookId, setPlaybookId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    await openSocWarRoomCase({ title: title.trim(), severity, playbookId });
    onCreated();
  };

  return (
    <Modal open={true} onClose={onClose} title="Open new case">
      <div className="space-y-4">
        <input className="input" placeholder="Case title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!title.trim() || loading} onClick={handleSubmit}>
            {loading ? "Opening..." : "Open case"}
          </button>
        </div>
      </div>
    </Modal>
  );
}