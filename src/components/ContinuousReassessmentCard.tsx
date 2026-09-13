import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, GitBranch, Loader2, Play, RefreshCw, CalendarClock } from "lucide-react";
import { Card, CardHeader, EmptyState, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cx, timeAgo } from "@/lib/utils";
import {
  enableContinuousReassessment,
  listContinuousReassessment,
  proposeContinuousReassessment,
  type ContinuousReassessmentSchedule,
} from "@/lib/vaptOps";

// ── Continuous reassessment (W4) ─────────────────────────────────────────────
// Cadence + change-triggered re-assessment: the loop watches product context and
// re-runs the relevant VAPT scope when the design changes. Read + enable here;
// "Propose now" is dual-controlled on the backend.

const CADENCES = ["1d", "7d", "14d", "30d"];

export default function ContinuousReassessmentCard() {
  const { toast } = useStore();
  const [rows, setRows] = useState<ContinuousReassessmentSchedule[]>([]);
  const [projects, setProjects] = useState<{ id: number; name?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enableBusy, setEnableBusy] = useState(false);
  const [proposeBusyId, setProposeBusyId] = useState<number | string | null>(null);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [targetKey, setTargetKey] = useState("");
  const [cadence, setCadence] = useState("7d");
  const [debounceHours, setDebounceHours] = useState(24);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sched, proj] = await Promise.all([
        listContinuousReassessment(),
        api.get<any>("/context/projects").catch(() => null),
      ]);
      setRows(Array.isArray(sched?.schedules) ? sched.schedules : []);
      const items = Array.isArray(proj) ? proj : (proj?.items ?? []);
      setProjects(items);
      setProjectId((prev) => prev ?? items[0]?.id ?? null);
    } catch (e: any) {
      setRows([]);
      setError(e?.detail?.message || e?.message || "Continuous reassessment schedules unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enable = async () => {
    if (projectId == null || !targetKey.trim()) {
      toast("error", "Project and target key required");
      return;
    }
    setEnableBusy(true);
    try {
      await enableContinuousReassessment({
        project_id: projectId,
        target_key: targetKey.trim(),
        cadence,
        debounce_hours: debounceHours,
        schedule_name: `Continuous reassessment · project ${projectId}`,
      });
      toast("success", "Continuous reassessment enabled", `Cadence ${cadence}, debounce ${debounceHours}h`);
      setOpen(false);
      setTargetKey("");
      await load();
    } catch (e: any) {
      toast("error", "Could not enable", e?.message || "");
    } finally {
      setEnableBusy(false);
    }
  };

  const propose = async (s: ContinuousReassessmentSchedule) => {
    if (s.project_id == null || !s.target_key) return;
    setProposeBusyId(s.id);
    try {
      await proposeContinuousReassessment({
        project_id: s.project_id,
        target_key: s.target_key,
        reason: "manual",
      });
      toast("success", "Reassessment proposed", "Parked for an authorizer (dual control).");
    } catch (e: any) {
      toast("error", "Could not propose", e?.message || "");
    } finally {
      setProposeBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Continuous reassessment"
        subtitle="Re-run VAPT scope when product context changes or on a cadence"
        action={
          <div className="flex items-center gap-2">
            <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void load()} title="Refresh">
              <RefreshCw size={12} className={cx("inline", loading && "animate-spin")} />
            </button>
            <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setOpen((v) => !v)}>
              <CalendarClock size={12} className="mr-1 inline" /> Enable
            </button>
          </div>
        }
      />

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-phantix-700/40 bg-phantix-950/40 p-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="label">Product project</label>
                <select className="input" value={projectId ?? ""} onChange={(e) => setProjectId(Number(e.target.value) || null)}>
                  {projects.length === 0 && <option value="">No projects</option>}
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name || `Project #${p.id}`}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Target key</label>
                <input className="input font-mono !text-xs" placeholder="tk_…" value={targetKey} onChange={(e) => setTargetKey(e.target.value)} />
              </div>
              <div>
                <label className="label">Cadence</label>
                <select className="input" value={cadence} onChange={(e) => setCadence(e.target.value)}>
                  {CADENCES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Debounce (hours)</label>
                <input type="number" min={1} max={168} className="input" value={debounceHours} onChange={(e) => setDebounceHours(Number(e.target.value) || 24)} />
              </div>
              <div className="flex items-end sm:col-span-3">
                <button className="btn-primary text-xs" disabled={enableBusy} onClick={() => void enable()}>
                  {enableBusy ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : null} Enable continuous reassessment
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="Schedules unavailable"
          body={error}
          action={<button className="btn-secondary" onClick={() => void load()}>Retry</button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={<GitBranch size={20} />} title="No continuous schedules" body="Enable one to re-assess the scope when the product design changes." />
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-phantix-700/40 bg-phantix-900/40 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-200">{s.schedule_name || `Project #${s.project_id}`}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="chip border-phantix-700 font-mono text-phantix-300">{s.cadence || "7d"}</span>
                  <span className="chip border-phantix-700 text-slate-400">debounce {s.debounce_hours ?? 24}h</span>
                  {s.target_key && <span className="chip border-phantix-700 font-mono text-slate-400">{s.target_key}</span>}
                  {s.last_run_at && <span>last {timeAgo(String(s.last_run_at))}</span>}
                </p>
              </div>
              <button className="btn-ghost !px-2.5 !py-1 !text-xs" disabled={proposeBusyId === s.id} onClick={() => void propose(s)}>
                {proposeBusyId === s.id ? <Loader2 size={11} className="mr-1 inline animate-spin" /> : <Play size={11} className="mr-1 inline" />}
                Propose now
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
