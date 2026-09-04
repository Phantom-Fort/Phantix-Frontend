import React, { useState } from "react";
import { motion } from "framer-motion";
import { Scale, Play, Database, FileUp, ClipboardList, CheckCircle2, XCircle, HelpCircle, Plug } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, ProgressRing, ProgressBar, Tabs, Modal, Spinner, PageSkeleton, ErrorState } from "@/components/ui";
import DocLink from "@/components/DocLink";
import { loadComplianceBundle, runComplianceAssessment, collectComplianceEvidence, addComplianceEvidence } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";

const statusIcon = { pass: CheckCircle2, gap: XCircle, unknown: HelpCircle };

export default function Compliance() {
  const { toast, requireDualControl } = useStore();
  const { data, loading, error, reload } = useResource(loadComplianceBundle, {
    frameworks: [],
    assessments: [],
    controlResults: [],
    evidence: [],
  });
  const complianceFrameworks = data.frameworks;
  const complianceAssessments = data.assessments;
  const complianceControlResults = data.controlResults;
  const evidenceItems = data.evidence;
  const [tab, setTab] = useState("overview");
  const [assessOpen, setAssessOpen] = useState(false);
  const [assessBusy, setAssessBusy] = useState(false);
  const [assessForm, setAssessForm] = useState({
    framework_id: "",
    include_questionnaire: true,
    include_posture: true,
  });
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [collectBusy, setCollectBusy] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({
    framework_id: "",
    control_id: "",
    title: "",
    description: "",
    evidence_type: "policy",
    status: "unknown",
  });

  const openAssess = () => {
    setAssessForm((f) => ({
      ...f,
      framework_id: f.framework_id || complianceFrameworks[0]?.id || "",
    }));
    setAssessOpen(true);
  };

  const submitAssessment = async () => {
    if (!assessForm.framework_id) { toast("error", "Pick a framework"); return; }
    if (!(await requireDualControl("Running a compliance assessment requires a dual-control operate session."))) return;
    setAssessBusy(true);
    try {
      const created = await runComplianceAssessment(assessForm);
      toast("success", "Assessment completed", created ? `${created.framework_name} scored ${created.score}%` : "Assessment queued");
      setAssessOpen(false);
      reload();
    } catch (e: any) {
      toast("error", "Assessment failed", e?.message || "Could not run assessment");
    } finally {
      setAssessBusy(false);
    }
  };

  const submitEvidence = async () => {
    if (!evidenceForm.framework_id || !evidenceForm.control_id) { toast("error", "Framework and control are required"); return; }
    if (!(await requireDualControl("Registering evidence requires a dual-control operate session."))) return;
    setEvidenceBusy(true);
    try {
      await addComplianceEvidence({
        framework: evidenceForm.framework_id,
        control_id: evidenceForm.control_id,
        status: evidenceForm.status,
        title: evidenceForm.title || undefined,
        description: evidenceForm.description || undefined,
        evidence_type: evidenceForm.evidence_type,
      });
      toast("success", "Evidence registered", `Mapped to ${evidenceForm.control_id}`);
      setEvidenceOpen(false);
      setEvidenceForm({ framework_id: "", control_id: "", title: "", description: "", evidence_type: "policy", status: "unknown" });
      reload();
    } catch (e: any) {
      toast("error", "Evidence failed", e?.message || "Could not register evidence");
    } finally {
      setEvidenceBusy(false);
    }
  };

  const collectEvidence = async () => {
    if (!(await requireDualControl("Evidence collection requires a dual-control operate session."))) return;
    setCollectBusy(true);
    try {
      const res = await collectComplianceEvidence();
      toast("success", "Collection started", res.message);
      reload();
    } catch (e: any) {
      toast("error", "Collection failed", e?.message || "Could not start evidence collection");
    } finally {
      setCollectBusy(false);
    }
  };

  if (loading) {
    return <PageSkeleton variant="cards" rows={6} actions />;
  }

  if (error && data.frameworks.length === 0) {
    return (
      <ErrorState
        onRetry={reload}
        body="We could not load compliance frameworks. Check your connection and retry — your session stays signed in."
      />
    );
  }

  const defaultControlId = complianceFrameworks.find((f) => f.id === evidenceForm.framework_id)?.controls?.[0]?.id ?? "";

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Compliance"
        description="Frameworks mapped from verified findings + a merged GRC questionnaire. Keyword mapping is triage, not a certified audit --- gaps show human review status."
        actions={
          <>
          <DocLink docId="howto-app-10" label="Compliance how-to" />
          <button
            className="btn-primary"
            onClick={() =>
              void (async () => {
                if (await requireDualControl("Running a compliance assessment requires a dual-control operate session.")) {
                  openAssess();
                }
              })()
            }
          >
            <Play size={15} /> Run assessment
          </button>
          </>
        }
      />

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "frameworks", label: "Frameworks", count: complianceFrameworks.length },
          { id: "controls", label: "Control results", count: complianceControlResults.length },
          { id: "evidence", label: "Evidence", count: evidenceItems.length },
          { id: "questionnaire", label: "Questionnaire" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {complianceAssessments.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <Card hover className="flex items-center gap-5">
                  <ProgressRing value={a.score} size={96} stroke={9} color={a.score >= 75 ? "#34D399" : a.score >= 60 ? "#E8B54D" : "#FB923C"}>
                    <span className="font-display text-xl font-bold text-white">{a.score}%</span>
                  </ProgressRing>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-slate-100">{a.framework_name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{timeAgo(a.created_at)}</p>
                    <div className="mt-2 flex gap-2 text-[11px]">
                      <span className="text-emerald-400">{a.controls_passed} pass</span>
                      <span className="text-severity-critical">{a.controls_gap} gap</span>
                      <span className="text-slate-500">{a.controls_unknown} unknown</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Evidence connectors" subtitle="Phase 4 --- live collection into your security DB" />
              <div className="space-y-2.5">
                {[
                  { name: "wazuh", state: "configured", note: "SIEM alerts + agent coverage" },
                  { name: "manual", state: "ready", note: "Policy uploads & attestations" },
                  { name: "azure", state: "scaffold", note: "Graph sample mode" },
                  { name: "aws", state: "scaffold", note: "IAM sample mode" },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                    <Plug size={15} className={c.state === "configured" ? "text-emerald-400" : "text-slate-500"} />
                    <div className="flex-1">
                      <p className="font-mono text-sm text-slate-200">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.note}</p>
                    </div>
                    <StatusBadge status={c.state === "configured" ? "ready" : c.state === "ready" ? "pending" : "draft"} />
                  </div>
                ))}
              </div>
              <button
                className="btn-secondary mt-4 w-full"
                onClick={() => void collectEvidence()}
                disabled={collectBusy}
              >
                <Database size={14} /> {collectBusy ? "Collecting..." : "Collect evidence now"}
              </button>
            </Card>

            <Card>
              <CardHeader title="Recommended frameworks" subtitle="From your business profile (jurisdiction + industry)" />
              <div className="space-y-2.5">
                {complianceFrameworks.filter((f) => f.recommended).map((f) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                    <Scale size={15} className="text-gold-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">{f.name} <span className="text-xs text-slate-500">v{f.version}</span></p>
                      <p className="text-xs text-slate-500">{f.category} · {f.control_count} controls</p>
                    </div>
                    <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">active</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {tab === "frameworks" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {complianceFrameworks.map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover className="h-full">
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-phantix-800/70 font-display text-sm font-bold text-gold-400">
                    {f.name.slice(0, 2)}
                  </span>
                  {f.recommended && <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">recommended</span>}
                </div>
                <h3 className="mt-3 font-display text-base font-semibold text-slate-100">{f.name}</h3>
                <p className="mt-1 text-[13px] leading-5 text-slate-400">{f.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>v{f.version}</span>
                  <span>{f.control_count} controls</span>
                  <span>{f.category}</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === "controls" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="!p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th">Control</th>
                  <th className="th">Title</th>
                  <th className="th">Category</th>
                  <th className="th">Source</th>
                  <th className="th">Evidence</th>
                  <th className="th">Status</th>
                  <th className="th">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {complianceControlResults.map((c) => {
                  const Icon = statusIcon[c.status] ?? HelpCircle;
                  return (
                    <tr key={c.control_id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                      <td className="td font-mono text-xs text-gold-300">{c.control_id}</td>
                      <td className="td font-medium text-slate-200">{c.title}</td>
                      <td className="td text-xs text-slate-400">{c.category}</td>
                      <td className="td text-xs text-slate-500">{c.source}</td>
                      <td className="td text-xs text-slate-400">{c.evidence_count}</td>
                      <td className="td">
                        <span className={cx("inline-flex items-center gap-1.5 text-xs font-semibold", c.status === "pass" ? "text-emerald-400" : c.status === "gap" ? "text-severity-critical" : "text-slate-500")}>
                          <Icon size={13} /> {c.status}
                        </span>
                      </td>
                      <td className="td max-w-[260px] text-xs leading-5 text-slate-400">{c.recommendation}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs text-slate-500">
            Merged evaluation: questionnaire self-attestation + technical posture. A "yes" contradicted by a
            technical gap resolves to <strong className="text-severity-critical">gap</strong>.
          </p>
        </motion.div>
      )}

      {tab === "evidence" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="mb-1 flex justify-end">
            <button
              className="btn-secondary !py-2"
              onClick={() =>
                void (async () => {
                  if (!(await requireDualControl("Uploading evidence requires a dual-control operate session."))) return;
                  setEvidenceOpen(true);
                })()
              }
            >
              <FileUp size={14} /> Add manual evidence
            </button>
          </div>
          {evidenceItems.map((e, i) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card hover className="!p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-phantix-800/70 font-mono text-[10px] font-bold text-gold-400">
                    {e.connector.slice(0, 3).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-200">{e.title}</p>
                    <p className="text-xs text-slate-500">{e.summary} · {timeAgo(e.collected_at)}</p>
                  </div>
                  <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-400">{e.evidence_type}</span>
                  <StatusBadge status={e.status} />
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === "questionnaire" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader title="Your progress" subtitle="Merged across applicable frameworks" />
              <div className="flex items-center justify-center py-2">
                <ProgressRing value={68} size={140} color="#E8B54D">
                  <span className="font-display text-3xl font-bold text-white">68%</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">answered</span>
                </ProgressRing>
              </div>
              <p className="mt-2 text-center text-xs leading-5 text-slate-500">
                Questions merge across ISO 27001, NDPR, SOC 2 and PCI DSS --- one answer can satisfy multiple controls.
              </p>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader title="Answering rules" subtitle="Multi-user GRC attribution" action={<ClipboardList size={15} className="text-slate-500" />} />
              <div className="space-y-3 text-sm leading-6 text-slate-300">
                {[
                  ["Declare your role first", "POST /compliance/questionnaire/session with stated_role (e.g. CISO) before answering --- required for audit."],
                  ["Per-user upserts", "Multiple org users can answer the same question; the worst answer wins in merged assessments."],
                  ["Full attribution", "Every answer stores user id, name, email, stated role and session id --- exportable via GET .../answers."],
                  ["Named users only", "Company-only JWTs may be rejected --- answer as an org user."],
                ].map(([t, d]) => (
                  <div key={t} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-4">
                    <p className="font-semibold text-slate-100">{t}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{d}</p>
                  </div>
                ))}
              </div>
              <button className="btn-primary mt-4" onClick={() => toast("info", "Questionnaire", "Continue answering --- 32 of 47 questions complete.")}>
                Continue questionnaire
              </button>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Run assessment modal */}
      <Modal open={assessOpen} onClose={() => setAssessOpen(false)} title="Run merged assessment">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitAssessment();
          }}
        >
          <div>
            <label className="label">Framework</label>
            <select
              className="input"
              value={assessForm.framework_id}
              onChange={(e) => setAssessForm((f) => ({ ...f, framework_id: e.target.value }))}
            >
              {complianceFrameworks.map((f) => (
                <option key={f.id} value={f.id}>{f.name} v{f.version} · {f.control_count} controls</option>
              ))}
            </select>
          </div>
          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-gold-400"
                checked={assessForm.include_questionnaire}
                onChange={(e) => setAssessForm((f) => ({ ...f, include_questionnaire: e.target.checked }))}
              /> Include questionnaire (self-attestation)
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-gold-400"
                checked={assessForm.include_posture}
                onChange={(e) => setAssessForm((f) => ({ ...f, include_posture: e.target.checked }))}
              /> Include posture (verified findings + asset signals)
            </label>
          </div>
          <p className="rounded-lg bg-phantix-800/40 p-2.5 text-[11px] leading-5 text-slate-500">
            POST /compliance/assessments — runs the merge engine per control and writes a scored assessment you can review under Control results.
          </p>
          <button className="btn-primary w-full" type="submit" disabled={assessBusy}>
            {assessBusy ? <Spinner className="h-4 w-4" /> : <Play size={14} />} Run assessment
          </button>
        </form>
      </Modal>

      {/* Manual evidence modal */}
      <Modal open={evidenceOpen} onClose={() => setEvidenceOpen(false)} title="Register manual evidence">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitEvidence();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Framework</label>
              <select
                className="input"
                value={evidenceForm.framework_id}
                onChange={(e) => setEvidenceForm((f) => ({ ...f, framework_id: e.target.value }))}
              >
                <option value="">Select framework</option>
                {complianceFrameworks.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Control</label>
              <input
                className="input"
                placeholder={defaultControlId || "e.g. A.5.1"}
                value={evidenceForm.control_id}
                onChange={(e) => setEvidenceForm((f) => ({ ...f, control_id: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              placeholder="e.g. Annual access review report"
              value={evidenceForm.title}
              onChange={(e) => setEvidenceForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[72px] w-full resize-y"
              placeholder="What was reviewed and when"
              value={evidenceForm.description}
              onChange={(e) => setEvidenceForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Evidence type</label>
              <select
                className="input"
                value={evidenceForm.evidence_type}
                onChange={(e) => setEvidenceForm((f) => ({ ...f, evidence_type: e.target.value }))}
              >
                {["policy", "attestation", "scan_report", "training_record", "contract", "other"].map((t) => (
                  <option key={t} value={t}>{t.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={evidenceForm.status}
                onChange={(e) => setEvidenceForm((f) => ({ ...f, status: e.target.value }))}
              >
                {["unknown", "pass", "gap"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn-primary w-full" type="submit" disabled={evidenceBusy}>
            {evidenceBusy ? <Spinner className="h-4 w-4" /> : <FileUp size={14} />} Register evidence
          </button>
        </form>
      </Modal>
    </div>
  );
}
