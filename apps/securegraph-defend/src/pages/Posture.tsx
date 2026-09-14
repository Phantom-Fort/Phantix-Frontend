import React, { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw, RotateCcw, BookOpen, AlertTriangle, TrendingDown, Layers } from "lucide-react";
import { PageHeader, Card, CardHeader, EmptyState, Spinner, StatCard, RiskBadge, PageBodySkeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { loadPostureSnapshot, loadPostureReviewsDue, loadPostureDrift } from "@/lib/vaptOps";
import { listProjects } from "@/lib/productContext";
import { useStore } from "@/lib/store";
import { cx, timeAgo } from "@/lib/utils";
import DocLink from "@/components/DocLink";

// ── Posture — continuous loop (W7 LOOP-01/02/03) ─────────────────────────────
// Per-surface posture snapshot, product-context drift, and accepted risks due
// for re-review. This is the page the continuous reassessment loop reports into.

interface SurfaceScore {
  score?: number;
  total?: number;
  reportable?: number;
  critical?: number;
  high?: number;
}

interface PostureSnapshot {
  organization_id?: number;
  surfaces?: Record<string, SurfaceScore>;
  overall_score?: number | null;
  surfaces_covered?: number;
  generated_at?: string;
}

interface DueRisk {
  id: number;
  title?: string;
  risk_level?: string;
  residual_risk_score?: number | null;
  residual_risk_level?: string | null;
  accepted_at?: string | null;
  next_review_at?: string | null;
  review_interval_days?: number | null;
  asset_id?: number | null;
  vulnerability_key?: string | null;
  treatment_plan?: string | null;
}

interface Project {
  id: number;
  name?: string;
}

function scoreTone(score?: number): string {
  if (score == null) return "text-slate-400";
  if (score >= 80) return "text-emerald-300";
  if (score >= 55) return "text-gold-300";
  return "text-severity-high";
}

export default function Posture() {
  const { toast } = useStore();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<PostureSnapshot | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [drift, setDrift] = useState<any | null>(null);
  const [driftLoading, setDriftLoading] = useState(false);
  const [due, setDue] = useState<DueRisk[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [snap, proj, dueRes] = await Promise.all([
      loadPostureSnapshot().catch(() => null),
      listProjects().catch(() => null),
      loadPostureReviewsDue().catch(() => null),
    ]);
    setSnapshot(snap);
    const items: Project[] = Array.isArray(proj) ? proj : (proj?.items ?? []);
    setProjects(items);
    setProjectId((prev) => prev ?? items[0]?.id ?? null);
    setDue(Array.isArray(dueRes?.risks) ? dueRes.risks : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDrift = useCallback(
    async (id: number) => {
      setDriftLoading(true);
      try {
        setDrift(await loadPostureDrift(id));
      } catch {
        setDrift(null);
      } finally {
        setDriftLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (projectId != null) void loadDrift(projectId);
  }, [projectId, loadDrift]);

  const resurface = async () => {
    setBusy(true);
    try {
      const res = await api.post<any>(`/posture/reviews-due/resurface?limit=${Math.max(1, due.length)}`);
      toast("success", "Resurfaced", `${res?.resurfaced ?? 0} accepted risk(s) returned to triage.`);
      await load();
    } catch (e: any) {
      toast("error", "Could not resurface", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const learn = async () => {
    setBusy(true);
    try {
      const res = await api.post<any>("/posture/learning/feed");
      toast("success", "Learning feed published", `${res?.published ?? res?.count ?? 0} resolved risk(s) fed to the loop.`);
    } catch (e: any) {
      toast("error", "Could not publish learning feed", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const surfaces = Object.entries(snapshot?.surfaces ?? {});

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Posture"
        description="Per-surface posture, product-context drift and accepted risks due for re-review (continuous loop)."
        actions={<>
            <DocLink docId="howto-app-22" label="Posture how-to" />
          <button onClick={() => void load()} className="btn-ghost text-xs !py-2" title="Refresh">
            <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
          </button>
        </>}
      />

      {loading && !snapshot ? (
        <PageBodySkeleton stats={4} variant="section" rows={5} />
      ) : (
        <div className="space-y-5">
          {/* Overall + surfaces */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Overall posture" value={snapshot?.overall_score != null ? `${snapshot.overall_score}` : "—"} />
            <StatCard label="Surfaces covered" value={snapshot?.surfaces_covered ?? 0} />
            <StatCard label="Accepted risks due" value={due.length} />
            <StatCard label="Drift items" value={drift?.drift_count ?? 0} />
          </div>

          <Card>
            <CardHeader title="Surfaces" subtitle="Reportable, critical and high findings per surface" action={<Layers size={16} className="text-gold-300" />} />
            {surfaces.length === 0 ? (
              <EmptyState icon={<Activity size={22} />} title="No posture yet" body="Posture builds as scans, reviews and assessments land." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Surface</th>
                      <th className="th">Score</th>
                      <th className="th">Reportable</th>
                      <th className="th">Critical</th>
                      <th className="th">High</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surfaces.map(([name, s]) => (
                      <tr key={name} className="border-b border-phantix-700/20 hover:bg-phantix-800/40">
                        <td className="td text-sm capitalize text-slate-200">{name}</td>
                        <td className={cx("td text-sm font-semibold", scoreTone(s.score))}>{s.score ?? "—"}</td>
                        <td className="td text-sm text-slate-300">{s.reportable ?? 0}</td>
                        <td className="td text-sm text-severity-critical">{s.critical ?? 0}</td>
                        <td className="td text-sm text-severity-high">{s.high ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Context drift */}
          <Card>
            <CardHeader
              title="Context drift"
              subtitle="Projects whose design changed since the last model or assessment"
              action={<TrendingDown size={16} className="text-gold-300" />}
            />
            <div className="mb-3">
              <label className="label">Product project</label>
              <select
                className="input w-auto"
                value={projectId ?? ""}
                onChange={(e) => setProjectId(Number(e.target.value) || null)}
              >
                {projects.length === 0 && <option value="">No projects</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || `Project #${p.id}`}</option>
                ))}
              </select>
            </div>
            {driftLoading ? (
              <Spinner />
            ) : !drift ? (
              <p className="text-xs text-slate-500">Select a project to compute drift.</p>
            ) : (drift.drift?.length ?? 0) === 0 ? (
              <p className="text-xs text-slate-500">
                No drift — the current model matches the product context{drift?.projects != null ? ` (${drift.projects} project(s) checked)` : ""}.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {drift.drift.slice(0, 20).map((d: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      <strong className="text-amber-200">{d.project_name || `Project #${d.project_id}`}</strong>
                      {" — "}
                      {d.reason || d.detail || "context changed since the last model"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Reviews due */}
          <Card>
            <CardHeader
              title="Accepted risks due for re-review"
              subtitle="Accepted risks past their review interval (LOOP-03)"
              action={
                <div className="flex items-center gap-2">
                  <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => void learn()}>
                    <BookOpen size={13} className="mr-1 inline" /> Publish learning feed
                  </button>
                  <button className="btn-secondary !px-3 !py-1.5 text-xs" disabled={busy || due.length === 0} onClick={() => void resurface()}>
                    {busy ? <RefreshCw size={13} className="mr-1 inline animate-spin" /> : <RotateCcw size={13} className="mr-1 inline" />}
                    Resurface due
                  </button>
                </div>
              }
            />
            {due.length === 0 ? (
              <EmptyState icon={<Activity size={22} />} title="Nothing due" body="Accepted risks with a future review date stay here until they fall due." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Risk</th>
                      <th className="th">Level</th>
                      <th className="th">Residual</th>
                      <th className="th">Accepted</th>
                      <th className="th">Review due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {due.map((r) => (
                      <tr key={r.id} className="border-b border-phantix-700/20 hover:bg-phantix-800/40">
                        <td className="td text-sm text-slate-200">{r.title || `Risk #${r.id}`}</td>
                        <td className="td">{r.risk_level ? <RiskBadge level={r.risk_level} /> : <span className="text-xs text-slate-500">—</span>}</td>
                        <td className="td text-xs text-slate-300">{r.residual_risk_score ?? r.residual_risk_level ?? "—"}</td>
                        <td className="td text-xs text-slate-500">{r.accepted_at ? timeAgo(r.accepted_at) : "—"}</td>
                        <td className="td text-xs text-severity-high">{r.next_review_at ? timeAgo(r.next_review_at) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
