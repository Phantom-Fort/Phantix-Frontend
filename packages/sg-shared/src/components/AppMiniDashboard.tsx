import React from "react";
import {
  AlertTriangle, Bug, CheckCircle2, Crosshair, Gauge, GitBranch, GitPullRequest, Radar, ShieldAlert, Siren,
} from "lucide-react";
import { SeverityBadge, StatCardSkeleton, ChartCardSkeleton } from "../ui";
import { useResource } from "../useResource";
import {
  loadAlertsBundle, loadPostureTrend, loadRisksBundle, loadScansBundle, loadSocDetectionTrend,
  loadTrackerSummary, loadVaptBundle,
} from "../data";
import { loadPostureSnapshot } from "../vaptOps";
import { loadCodeFindings, loadGithubRepositories } from "../codeOps";
import { SEVERITY_ORDER, severityColor } from "../charts/palette";
import { titleCase } from "../utils";
import type { ApplicationKey } from "../shell/types";
import {
  AreaTrend, ColumnTrend, Delta, Donut, KpiTile, MiniTable, Panel, PanelEmpty, RankedBars, ViewAll,
  type Column, type Slice,
} from "./DashboardWidgets";

// A compact dashboard at the top of the Attack / Defend / Code overview: the
// four numbers and two charts that say how the application's own work is going.

type Row = Record<string, any>;

const soft = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

function severitySlices(counts: Record<string, number | undefined>): Slice[] {
  return SEVERITY_ORDER.map((s) => ({
    key: s,
    label: titleCase(s),
    value: Number(counts[s] ?? 0),
    color: severityColor(s),
  }));
}

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = key(it) || "unknown";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function Skeleton() {
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}

const KPI_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";
const PANEL_GRID = "mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3";

// ── Attack ────────────────────────────────────────────────────────────────────
async function loadAttack() {
  const [vapt, scans, tracker] = await Promise.all([
    soft(loadVaptBundle()),
    soft(loadScansBundle()),
    soft(loadTrackerSummary()),
  ]);
  return { vapt, scans, tracker };
}

function AttackDashboard() {
  const { data, loading } = useResource(loadAttack, null as Awaited<ReturnType<typeof loadAttack>> | null, "mini-attack");
  if (loading && !data) return <Skeleton />;
  const campaigns = (data?.vapt?.campaigns ?? []) as Row[];
  const findings = (data?.vapt?.findings ?? []) as Row[];
  const jobs = (data?.scans?.scanJobs ?? []) as Row[];
  const running = campaigns.filter((c) => ["running", "approved", "pending_approval"].includes(String(c.status))).length;
  const verified = findings.filter((f) => String(f.verification_status).endsWith("verified") && f.verification_status !== "unverified").length;
  const doneJobs = jobs.filter((j) => j.status === "completed").length;
  const testOpen = Number(data?.tracker?.bySurface?.test ?? 0);
  const byStatus = countBy(campaigns, (c) => String(c.status));
  const statusRows = Object.entries(byStatus)
    .map(([k, v]) => ({ key: k, label: titleCase(k.replace(/_/g, " ")), value: v }))
    .sort((a, b) => b.value - a.value);

  const cols: Column<Row>[] = [
    { key: "name", header: "Campaign", render: (c) => <span className="text-slate-200">{String(c.name ?? `#${c.id}`)}</span> },
    { key: "status", header: "Status", render: (c) => titleCase(String(c.status ?? "").replace(/_/g, " ")) },
    { key: "progress", header: "Progress", className: "text-right font-mono", render: (c) => `${Math.round(Number(c.progress ?? 0))}%` },
  ];

  return (
    <div className="mb-6">
      <div className={KPI_GRID}>
        <KpiTile icon={<Crosshair size={22} />} label="VAPT campaigns" value={campaigns.length} hint={`${running} in flight`} to="/vapt" />
        <KpiTile icon={<CheckCircle2 size={22} />} label="Verified findings" value={verified} hint={`of ${findings.length} campaign findings`} to="/vapt" delay={0.04} />
        <KpiTile icon={<Radar size={22} />} label="Scan jobs" value={jobs.length} hint={`${doneJobs} completed`} to="/scans" delay={0.08} />
        <KpiTile icon={<Bug size={22} />} label="Open test findings" value={testOpen} hint="Test surface, from the tracker" to="/remediation" delay={0.12} />
      </div>
      <div className={PANEL_GRID}>
        <Panel title="Campaign findings by severity" delay={0.1}>
          {findings.length ? <Donut slices={severitySlices(countBy(findings, (f) => String(f.severity).toLowerCase()))} centerLabel="findings" /> : <PanelEmpty>No campaign findings yet.</PanelEmpty>}
        </Panel>
        <Panel title="Campaigns by status" delay={0.14} action={<ViewAll to="/vapt" />}>
          {statusRows.length ? <RankedBars rows={statusRows} /> : <PanelEmpty>No campaigns yet — start one from Campaigns.</PanelEmpty>}
        </Panel>
        <Panel title="Recent campaigns" delay={0.18} action={<ViewAll to="/vapt" />} className="lg:col-span-2 2xl:col-span-1">
          <MiniTable rows={campaigns.slice(0, 6)} columns={cols} rowKey={(c, i) => Number(c.id) || i} rowHref={() => "/vapt"} empty="No campaigns yet." />
        </Panel>
      </div>
    </div>
  );
}

// ── Defend ────────────────────────────────────────────────────────────────────
async function loadDefend() {
  const [snapshot, trend, risks, alerts, detections] = await Promise.all([
    soft(loadPostureSnapshot()),
    soft(loadPostureTrend()),
    soft(loadRisksBundle()),
    soft(loadAlertsBundle()),
    soft(loadSocDetectionTrend(14)),
  ]);
  return { snapshot, trend: trend ?? [], risks: risks?.risks ?? [], alerts: alerts?.events ?? [], detections: detections ?? [] };
}

function DefendDashboard() {
  const { data, loading } = useResource(loadDefend, null as Awaited<ReturnType<typeof loadDefend>> | null, "mini-defend");
  if (loading && !data) return <Skeleton />;
  const trend = (data?.trend ?? []).map((p) => ({ label: p.day, value: Math.round(Number(p.score ?? 0)) }));
  const score = data?.snapshot?.overall_score ?? (trend.length ? trend[trend.length - 1].value : null);
  const delta = trend.length > 1 ? trend[trend.length - 1].value - trend[0].value : null;
  const risks = (data?.risks ?? []) as Row[];
  const openRisks = risks.filter((r) => !["closed", "accepted"].includes(String(r.status)));
  const critical = openRisks.filter((r) => r.level === "critical").length;
  const detections = (data?.detections ?? []).map((p) => ({ label: p.label, value: Number(p.value ?? 0) }));
  const detectionTotal = detections.reduce((s, p) => s + p.value, 0);
  const alerts = (data?.alerts ?? []) as Row[];

  const cols: Column<Row>[] = [
    { key: "title", header: "Risk", render: (r) => <span className="text-slate-200">{String(r.title ?? "")}</span> },
    { key: "level", header: "Level", render: (r) => <SeverityBadge severity={String(r.level ?? "info") as any} /> },
    { key: "band", header: "Priority", className: "text-right font-mono", render: (r) => String(r.priority_band ?? "—") },
  ];

  return (
    <div className="mb-6">
      <div className={KPI_GRID}>
        <KpiTile icon={<Gauge size={22} />} label="Posture score" value={score == null ? null : Math.round(score)} suffix="/100" delta={<Delta value={delta} unit=" pts" />} hint={delta != null ? "vs 14 days ago" : "Composite posture"} to="/posture" />
        <KpiTile icon={<ShieldAlert size={22} />} label="Open risks" value={openRisks.length} hint={`${critical} critical`} to="/risks" delay={0.04} />
        <KpiTile icon={<Siren size={22} />} label="SOC detections" value={detectionTotal} hint="Last 14 days" to="/soc" delay={0.08} />
        <KpiTile icon={<AlertTriangle size={22} />} label="Incidents" value={alerts.length} hint={`${alerts.filter((a) => a.status === "failed").length} failed deliveries`} to="/alerts" delay={0.12} />
      </div>
      <div className={PANEL_GRID}>
        <Panel title="Posture over time" subtitle="Daily composite score" delay={0.1} action={<ViewAll to="/posture" />}>
          {trend.length > 1 ? <AreaTrend points={trend} name="Posture score" /> : <PanelEmpty>Posture history builds up as scans run.</PanelEmpty>}
        </Panel>
        <Panel title="SOC detections per day" subtitle="Last 14 days" delay={0.14} action={<ViewAll to="/soc" />}>
          {detectionTotal > 0 ? <ColumnTrend points={detections} name="Detections" /> : <PanelEmpty>No detections in the last 14 days.</PanelEmpty>}
        </Panel>
        <Panel title="Top open risks" delay={0.18} action={<ViewAll to="/risks" />} className="lg:col-span-2 2xl:col-span-1">
          <MiniTable rows={openRisks.slice(0, 6)} columns={cols} rowKey={(r, i) => Number(r.id) || i} rowHref={(r) => `/risks?id=${Number(r.id)}`} empty="No open risks." />
        </Panel>
      </div>
    </div>
  );
}

// ── Code ──────────────────────────────────────────────────────────────────────
async function loadCode() {
  const [repos, findings] = await Promise.all([soft(loadGithubRepositories()), soft(loadCodeFindings({}))]);
  return { repos: repos?.items ?? [], findings: findings?.items ?? [], counts: findings?.counts ?? {}, total: findings?.total ?? 0 };
}

function CodeDashboard() {
  const { data, loading } = useResource(loadCode, null as Awaited<ReturnType<typeof loadCode>> | null, "mini-code");
  if (loading && !data) return <Skeleton />;
  const repos = (data?.repos ?? []) as Row[];
  const findings = (data?.findings ?? []) as Row[];
  const counts = (data?.counts ?? {}) as Record<string, number>;
  const total = Number(counts.total ?? data?.total ?? findings.length);
  const urgent = Number(counts.critical ?? 0) + Number(counts.high ?? 0);
  const analyzable = repos.filter((r) => r.can_analyze !== false).length;
  const byRepo = countBy(findings, (f) => String(f.repo ?? f.github_repository_id));
  const repoRows = Object.entries(byRepo)
    .map(([k, v]) => ({ key: k, label: k.split("/").pop() || k, value: v, icon: <GitBranch size={14} /> }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const cols: Column<Row>[] = [
    {
      key: "title",
      header: "Finding",
      render: (f) => (
        <>
          <span className="block truncate text-slate-200">{String(f.title ?? "")}</span>
          <span className="block truncate font-mono text-[12px] text-slate-500">
            {String(f.path ?? "")}
            {f.start_line ? `:${f.start_line}` : ""}
          </span>
        </>
      ),
    },
    { key: "sev", header: "Severity", className: "text-right", render: (f) => <SeverityBadge severity={String(f.severity ?? "info") as any} /> },
  ];

  return (
    <div className="mb-6">
      <div className={KPI_GRID}>
        <KpiTile icon={<GitBranch size={22} />} label="Repositories" value={repos.length} hint={`${analyzable} ready to review`} to="/code-review/repositories" />
        <KpiTile icon={<Bug size={22} />} label="Code findings" value={total} hint="Across reviewed repositories" to="/code-review" delay={0.04} />
        <KpiTile icon={<ShieldAlert size={22} />} label="Critical + high" value={urgent} hint={total ? `${Math.round((urgent / total) * 100)}% of findings` : "Nothing urgent"} to="/code-review" delay={0.08} />
        <KpiTile icon={<GitPullRequest size={22} />} label="Repositories with findings" value={Object.keys(byRepo).length} hint="Open the pull-request queue" to="/code-review/pull-requests" delay={0.12} />
      </div>
      <div className={PANEL_GRID}>
        <Panel title="Findings by severity" delay={0.1}>
          {total ? <Donut slices={severitySlices(counts)} centerLabel="findings" /> : <PanelEmpty>Review a repository to see findings.</PanelEmpty>}
        </Panel>
        <Panel title="Findings by repository" delay={0.14} action={<ViewAll to="/code-review/repositories" />}>
          {repoRows.length ? <RankedBars rows={repoRows} /> : <PanelEmpty>No reviewed repositories yet.</PanelEmpty>}
        </Panel>
        <Panel title="Latest findings" delay={0.18} action={<ViewAll to="/code-review" />} className="lg:col-span-2 2xl:col-span-1">
          <MiniTable rows={findings.slice(0, 6)} columns={cols} rowKey={(f, i) => Number(f.id) || i} rowHref={() => "/code-review"} empty="No code findings." />
        </Panel>
      </div>
    </div>
  );
}

export default function AppMiniDashboard({ application }: { application: ApplicationKey }) {
  if (application === "attack") return <AttackDashboard />;
  if (application === "defend") return <DefendDashboard />;
  if (application === "code") return <CodeDashboard />;
  return null;
}
