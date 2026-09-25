import React, { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Boxes, ShieldAlert, ArrowRight, BellRing, CalendarRange, Gauge, Bug, CheckCircle2,
  Zap, Activity, KanbanSquare, FileText, FlaskConical, HeartPulse, ScanSearch,
  ShieldCheck, Radar, BarChart3, ScrollText, Plug, Code2, Cloud, Smartphone, PenTool, TestTube2,
} from "lucide-react";
import { SeverityBadge, StatusBadge, PageSkeleton, ErrorState } from "@sg/ui";
import SecurityDbBanner from "@sg/components/SecurityDbBanner";
import LatestAssessmentPanel from "@sg/components/LatestAssessment";
import CrossAppLink from "@sg/components/CrossAppLink";
import AppSwitcher from "@sg/components/AppSwitcher";
import { SEVERITY_ORDER, SURFACES, SURFACE_LABELS, severityColor } from "@sg/charts/palette";
import { loadTrackerSummary } from "@sg/data";
import {
  loadAvailabilityIncidents,
  loadAvailabilitySummary,
} from "@sg/data";
import { loadPostureSnapshot } from "@sg/vaptOps";
import type { PostureSnapshot } from "@sg/vaptOps";
import type { TrackerSummary } from "@sg/types";
import type { AvailabilityIncident, AvailabilitySummary } from "@sg/types";
import { loadCommandCenter, loadPostureTrend, type PosturePoint } from "@sg/data";
import { useResource } from "@sg/useResource";
import { useSmartPoll } from "@sg/usePolling";
import { useSseStream } from "@sg/useSse";
import { timeAgo, cx, titleCase } from "@sg/utils";
import { useStore } from "@sg/store";
import type { CommandCenter } from "@sg/types";
import {
  AreaTrend, ColumnTrend, Delta, Donut, KpiTile, MiniTable, Panel, PanelEmpty, RankedBars, ViewAll,
  type Column,
} from "@sg/components/DashboardWidgets";

const SURFACE_ICONS: Record<string, React.ReactNode> = {
  design: <PenTool size={14} />,
  code: <Code2 size={14} />,
  test: <TestTube2 size={14} />,
  cloud: <Cloud size={14} />,
  mobile: <Smartphone size={14} />,
};

type Row = Record<string, unknown>;

function pctChange(first: number | null, last: number | null): number | null {
  if (first == null || last == null || first === 0) return null;
  return Math.round(((last - first) / first) * 1000) / 10;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const emptyDash = {
  cc: null as CommandCenter | null,
  securityDbBlocked: false,
  error: null as string | null,
};

/** Server-heartbeat status → chip tone. */
function availabilityTone(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "up") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (s === "down")
    return "border-severity-critical/30 bg-severity-critical/10 text-severity-critical";
  if (s === "degraded")
    return "border-severity-medium/30 bg-severity-medium/10 text-severity-medium";
  return "border-slate-500/50 bg-slate-500/10 text-slate-400";
}

/** One row on the server-heartbeat rail (availability, not findings). */
type ServerEvent = { type: string; label: string; detail: string; tone: string; ts: string };

function incidentToServerEvent(i: AvailabilityIncident): ServerEvent {
  const open = (i.status || "open") === "open";
  return {
    type: open ? "Server down" : "Server recovered",
    label: i.title || i.last_error || `Check ${i.check_id ?? ""}`,
    detail: open
      ? `Down since ${timeAgo(i.down_at)}`
      : `MTTR ${i.time_to_resolve_seconds != null ? `${i.time_to_resolve_seconds}s` : "—"} · recovered ${timeAgo(i.recovered_at || i.down_at)}`,
    tone: open ? "text-severity-critical" : "text-emerald-300",
    ts: i.recovered_at || i.down_at,
  };
}

function num(v: unknown, fallback = 0): number {
  // `Number(null)` is 0, which would report a real "0" for a value we simply
  // do not have. Treat null/undefined/"" as absent and use the fallback.
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = "—"): string {
  if (v == null || v === "") return fallback;
  return String(v);
}

export default function Dashboard() {
  const { org: storeOrg, operate, requireDualControl, session } = useStore();
  const { data, loading, error, reload, setData } = useResource(loadCommandCenter, emptyDash, "command-center");

  /* Posture and findings for the chart row. Loaded alongside the command centre
     rather than folded into it: either can be unavailable without blanking the
     page, and the charts are additive to what was already here. */
  const [posture, setPosture] = React.useState<PostureSnapshot | null>(null);
  const [tracker, setTracker] = React.useState<TrackerSummary | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadPostureSnapshot().catch(() => null),
      loadTrackerSummary().catch(() => null),
    ]).then(([p, t]) => {
      if (cancelled) return;
      setPosture(p as PostureSnapshot | null);
      setTracker(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const trendRes = useResource<PosturePoint[]>(() => loadPostureTrend(), [] as PosturePoint[], "posture-trend");
  const [serverEvents, setServerEvents] = useState<ServerEvent[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySummary | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
  const skipFirstPoll = useRef(true);
  // Min gap between SSE-triggered full reloads — the stream can emit event
  // bursts and each reload refetches the whole command-center payload.
  const lastSseReloadRef = useRef(0);

  useSmartPoll(async () => {
    if (skipFirstPoll.current) {
      skipFirstPoll.current = false;
      return;
    }
    await reload();
  }, { intervalMs: 60000, hiddenIntervalMs: 300000 });

  const onSse = useCallback(
    (evt: { event: string; data: unknown; ts: string }) => {
      // The command-centre stream patches findings/reports/risk. Its transport
      // heartbeat is NOT the server heartbeat — that comes from the availability
      // stream below.
      if (evt.event === "heartbeat") return;
      if (evt.event === "connected") return;
      const payload =
        evt.data && typeof evt.data === "object" ? (evt.data as Record<string, unknown>) : {};
      const inner =
        payload.payload && typeof payload.payload === "object"
          ? (payload.payload as Record<string, unknown>)
          : payload;
      const type = String(payload.type ?? evt.event ?? "event");

      // Patch panels in place for tracker / report / risk signals; full refresh on reconnect only.
      if (type === "trackerUpdated" || type === "agiFindingRecorded") {
        setData((prev) => {
          if (!prev.cc) return prev;
          const key = String(inner.findingKey ?? inner.trackerKey ?? "");
          if (!key) return prev;
          const critical = [...(prev.cc.tracker?.criticalOpen ?? [])];
          const idx = critical.findIndex(
            (r) => String((r as any).findingKey ?? (r as any).finding_key) === key,
          );
          const row = {
            findingKey: key,
            title: str(inner.title, key),
            severity: str(inner.severity, "info"),
            status: str(inner.status, "open"),
            priority: str(inner.priority, "P2"),
            assetId: inner.assetId ?? null,
            assignedOwner: inner.assignedOwner ?? null,
          };
          if (idx >= 0) {
            critical[idx] = { ...critical[idx], ...row };
          } else if (String(row.severity).toLowerCase() === "critical") {
            // Only critical findings belong in the "critical open" panel — an
            // agent can record info/low findings too, and injecting those here
            // made the panel lie about severity.
            critical.unshift(row);
          } else {
            return prev;
          }
          return {
            ...prev,
            cc: {
              ...prev.cc,
              tracker: {
                ...prev.cc.tracker,
                criticalOpen: critical.slice(0, 8),
                total: num(prev.cc.tracker?.total) + (key ? 0 : 0),
              },
            },
          };
        });
      }
      if (type === "reportReady") {
        setData((prev) => {
          if (!prev.cc) return prev;
          const id = Number(inner.reportId ?? 0);
          const recent = [...(prev.cc.reports?.recent ?? [])];
          const row = {
            id,
            title: str(inner.title, `Report #${id}`),
            reportType: str(inner.reportType, "report"),
            status: str(inner.status, "complete"),
            formats: [],
          };
          const idx = recent.findIndex((r) => Number((r as any).id) === id);
          if (idx >= 0) recent[idx] = { ...recent[idx], ...row };
          else recent.unshift(row);
          return {
            ...prev,
            cc: {
              ...prev.cc,
              reports: { ...prev.cc.reports, recent: recent.slice(0, 8), available: true },
            },
          };
        });
      }
      if (type === "riskUpdated") {
        // Throttle: at most one full command-center reload per 20s regardless
        // of how many riskUpdated events arrive (panel data still updates via
        // the 60s useSmartPoll and event patching above).
        const now = Date.now();
        if (now - lastSseReloadRef.current >= 20_000) {
          lastSseReloadRef.current = now;
          void reload();
        }
      }
    },
    [reload, setData],
  );

  // Server heartbeat is a separate feed: the organization's own infrastructure
  // availability, never the pentest-agent finding stream.
  const loadServerHealth = useCallback(async () => {
    const [summary, incidents] = await Promise.all([
      loadAvailabilitySummary().catch(() => null),
      loadAvailabilityIncidents(undefined, 12).catch(() => [] as AvailabilityIncident[]),
    ]);
    setAvailability(summary);
    const sorted = [...incidents].sort(
      (a, b) =>
        new Date(b.recovered_at || b.down_at).getTime() -
        new Date(a.recovered_at || a.down_at).getTime(),
    );
    setServerEvents(sorted.slice(0, 12).map(incidentToServerEvent));
  }, []);

  React.useEffect(() => {
    void loadServerHealth();
    const t = window.setInterval(() => void loadServerHealth(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadServerHealth();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadServerHealth]);

  const onServerSse = useCallback(
    (evt: { event: string; data: unknown; ts: string }) => {
      if (!evt.event || evt.event === "connected") return;
      setLastHeartbeatAt(evt.ts);
      if (evt.event !== "availabilityUpdated" && evt.event !== "availabilityIncident") return;
      const payload =
        evt.data && typeof evt.data === "object" ? (evt.data as Record<string, unknown>) : {};
      const inner =
        payload.payload && typeof payload.payload === "object"
          ? (payload.payload as Record<string, unknown>)
          : payload;
      if (evt.event === "availabilityIncident") {
        const open = String(inner.state || "opened") !== "recovered";
        setServerEvents((prev) =>
          [
            {
              type: open ? "Server down" : "Server recovered",
              label: str(inner.title ?? inner.target, "Server incident"),
              detail: open
                ? `Down since ${timeAgo(String(inner.downAt || evt.ts))}`
                : `MTTR ${inner.timeToResolveSeconds ?? "—"}s`,
              tone: open ? "text-severity-critical" : "text-emerald-300",
              ts: evt.ts,
            },
            ...prev,
          ].slice(0, 12),
        );
      } else {
        const status = String(inner.status || "unknown");
        setServerEvents((prev) =>
          [
            {
              type:
                status === "down"
                  ? "Server down"
                  : status === "degraded"
                    ? "Server degraded"
                    : "Server up",
              label: str(inner.name ?? inner.target, "Availability check"),
              detail: `Status ${status}${inner.latencyMs != null ? ` · ${inner.latencyMs}ms` : ""}`,
              tone: availabilityTone(status),
              ts: evt.ts,
            },
            ...prev,
          ].slice(0, 12),
        );
      }
      void loadServerHealth();
    },
    [loadServerHealth],
  );

  const streamPath =
    data.cc?.stream?.commandCenter?.replace(/^\/api\/v1/, "") ||
    "/org/command-center/stream";
  // Command-centre stream patches the tracker/report panels (findings, risk).
  useSseStream(streamPath.startsWith("/") ? streamPath : `/${streamPath}`, {
    enabled: !loading && !data.securityDbBlocked,
    onEvent: onSse,
  });
  // Server-heartbeat stream drives the heartbeat rail + its connected state.
  const availabilityPath =
    data.cc?.stream?.availability?.replace(/^\/api\/v1/, "") || "/soc/availability/stream";
  const { connected: serverConnected } = useSseStream(
    availabilityPath.startsWith("/") ? availabilityPath : `/${availabilityPath}`,
    {
      enabled: !loading && !data.securityDbBlocked,
      onEvent: onServerSse,
    },
  );

  if (loading) {
    return <PageSkeleton variant="dashboard" />;
  }

  if (error && !data.cc) {
    return (
      <ErrorState
        onRetry={reload}
        body="We could not load the command centre overview. Check your connection and retry — your session stays signed in."
      />
    );
  }

  const cc = data.cc;
  const orgName = cc?.org?.name || storeOrg.name;
  const firstName = (session?.userName || "").trim().split(/\s+/)[0] || "";
  const lab = cc?.lab;
  const postureScore = num(cc?.posture?.postureScore, 0);
  // Distinguish "no posture yet" from a genuine 0 so a transient/blocked load
  // does not read as a confident zero (the dashboard-shows-0 bug).
  const postureKnown = cc?.posture?.postureScore != null;
  const openFindings = num(cc?.posture?.totals?.openFindings ?? cc?.tracker?.summary?.open, 0);
  const openRisks = num(cc?.risks?.open, 0);
  const socOpen = num(cc?.soc?.queue?.openTotal, 0);
  const activeAssets = num(cc?.posture?.totals?.activeAssets ?? cc?.assets?.totals?.active, 0);
  const criticalAssets = (cc?.posture?.criticalAssetsAtRisk ?? cc?.assets?.criticalAtRisk ?? []) as Row[];
  const topRisks = (cc?.risks?.top ?? []) as Row[];
  const topDetections = (cc?.soc?.topDetections ?? []) as Row[];
  const trackerCritical = (cc?.tracker?.criticalOpen ?? []) as Row[];
  const recentReports = (cc?.reports?.recent ?? []) as Row[];
  const pages = cc?.pages ?? {};
  const href = (key: string, fallback: string) => str(pages[key], fallback);

  const trend = trendRes.data ?? [];
  const scorePoints = trend.map((p) => ({ label: p.day, value: Math.round(Number(p.score ?? 0)) }));
  const findingPoints = trend.map((p) => ({ label: p.day, value: Number(p.findings ?? 0) }));
  const hasTrend = trend.length > 1;
  const scoreDelta = hasTrend ? scorePoints[scorePoints.length - 1].value - scorePoints[0].value : null;
  const findingsDelta = hasTrend
    ? pctChange(findingPoints[0].value, findingPoints[findingPoints.length - 1].value)
    : null;
  const rangeLabel = hasTrend ? `${trend[0].day} – ${trend[trend.length - 1].day}` : "Last 14 days";

  const summary = cc?.tracker?.summary ?? tracker ?? {};
  const trackedTotal = num(summary.total ?? tracker?.total, 0);
  const fixed = num(summary.fixed ?? tracker?.fixed, 0);
  const fixRate = trackedTotal > 0 ? Math.round((fixed / trackedTotal) * 1000) / 10 : null;

  const bySeverity = (tracker?.bySeverity ?? summary.bySeverity ?? {}) as Record<string, number>;
  const severitySlices = SEVERITY_ORDER.map((s) => ({
    key: s,
    label: titleCase(s),
    value: Number(bySeverity[s] ?? 0),
    color: severityColor(s),
  }));

  const bySurface = (tracker?.bySurface ?? summary.bySurface ?? {}) as Record<string, number>;
  const surfaceRows = SURFACES.map((s) => ({
    key: s,
    label: SURFACE_LABELS[s] ?? titleCase(s),
    value: Number(bySurface[s] ?? (posture?.surfaces as Record<string, any> | undefined)?.[s]?.total ?? 0),
    icon: SURFACE_ICONS[s],
    to: `/analytics?surface=${s}`,
  })).sort((a, b) => b.value - a.value);

  const verified = num(cc?.posture?.totals?.verified, 0);
  const neverScanned = num(cc?.posture?.totals?.neverScanned, 0);
  const reportsTotal = num(cc?.reports?.total, recentReports.length);
  const checks = availability?.checks;

  const assetCols: Column<Row>[] = [
    { key: "asset", header: "Asset", render: (a) => <span className="font-mono text-slate-200">{str(a.value ?? a.name)}</span> },
    { key: "type", header: "Type", className: "table-cell xl:hidden 2xl:table-cell", render: (a) => titleCase(str(a.assetType ?? a.asset_type, "asset")) },
    {
      key: "open",
      header: "Open",
      className: "text-right font-mono",
      render: (a) => (a.openFindingsCount != null || a.open_findings != null ? num(a.openFindingsCount ?? a.open_findings) : "—"),
    },
    {
      key: "risk",
      header: "Risk",
      className: "text-right",
      render: (a) =>
        a.riskLevel != null || a.risk_level != null ? (
          <SeverityBadge severity={str(a.riskLevel ?? a.risk_level, "info") as any} />
        ) : (
          "—"
        ),
    },
  ];

  const trackerCols: Column<Row>[] = [
    {
      key: "finding",
      header: "Finding",
      render: (t) => (
        <>
          <span className="mr-2 font-mono text-[12px] text-slate-500">{str(t.findingKey ?? t.finding_key)}</span>
          {str(t.title)}
        </>
      ),
    },
    { key: "sev", header: "Severity", render: (t) => <SeverityBadge severity={str(t.severity, "critical") as any} /> },
    { key: "status", header: "Status", className: "table-cell xl:hidden 2xl:table-cell text-right", render: (t) => <StatusBadge status={str(t.status, "open")} /> },
  ];

  const riskCols: Column<Row>[] = [
    { key: "title", header: "Risk", render: (r) => str(r.title) },
    { key: "level", header: "Level", render: (r) => <SeverityBadge severity={str(r.riskLevel ?? r.level, "info") as any} /> },
    { key: "status", header: "Status", className: "table-cell xl:hidden 2xl:table-cell text-right", render: (r) => titleCase(str(r.status, "")) },
  ];

  const reportCols: Column<Row>[] = [
    {
      key: "title",
      header: "Report",
      render: (r) => (
        <>
          <span className="block truncate text-slate-200">{str(r.title)}</span>
          <span className="block truncate text-[12px] text-slate-500">
            {titleCase(str(r.reportType ?? r.report_type))}
            {r.generatedAt || r.created_at ? ` · ${timeAgo(String(r.generatedAt ?? r.created_at))}` : ""}
          </span>
        </>
      ),
    },
    { key: "status", header: "Status", className: "text-right", render: (r) => <StatusBadge status={str(r.status, "complete")} /> },
  ];

  const shortcuts = [
    { to: href("assets", "/assets"), label: "Asset inventory", hint: "Everything you own, by risk", icon: <Boxes size={15} /> },
    { to: href("reports", "/reports"), label: "Report solutions", hint: "Generate and download reports", icon: <FileText size={15} /> },
    { to: "/analytics", label: "Analytics", hint: "Movement, aging and SLA breaches", icon: <BarChart3 size={15} /> },
    { to: "/audit", label: "Audit trail", hint: "Who did what, and when", icon: <ScrollText size={15} /> },
    { to: "/integrations", label: "Integrations hub", hint: "Connect scanners and clouds", icon: <Plug size={15} /> },
  ];

  return (
    <div>
      {data.securityDbBlocked && <SecurityDbBanner message={data.error} />}

      {/* Greeting */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="min-w-0">
          <h1 className="font-display text-[26px] font-bold tracking-tight text-white">
            {firstName ? `${greeting()}, ${firstName}` : "Command center"}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            Here&apos;s what&apos;s happening across <span className="font-semibold text-gold-300">{orgName}</span> today.
            {lab?.authorizedLab && (
              <span className="chip border-amber-400/40 bg-amber-400/10 text-amber-200">
                <FlaskConical size={11} className="mr-1 inline" /> Lab
              </span>
            )}
          </p>
          {lab?.surfaces && lab.surfaces.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lab.surfaces.slice(0, 8).map((s) => (
                <Link
                  key={s.key || s.host}
                  to={`/assets?q=${encodeURIComponent(s.host)}`}
                  className="chip font-mono border-phantix-700 bg-phantix-900 text-[12px] text-slate-400 hover:border-gold-400/50 hover:text-gold-300"
                >
                  {s.name || s.host}
                </Link>
              ))}
            </div>
          )}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-md border border-phantix-700 bg-phantix-900 px-3 py-2 text-xs font-medium text-slate-300">
            <CalendarRange size={14} className="text-gold-400" /> {rangeLabel}
          </span>
          <AppSwitcher current="core" />
          <Link to={href("tracker", "/tracker")} className="btn-primary">
            <KanbanSquare size={15} /> Tracker
          </Link>
        </motion.div>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-5">
        <KpiTile
          icon={<Gauge size={22} />}
          label="Posture score"
          className="lg:col-span-2 2xl:col-span-1"
          value={postureKnown ? postureScore : null}
          suffix="/100"
          delta={<Delta value={scoreDelta} unit=" pts" goodWhen="up" />}
          hint={scoreDelta != null ? "vs 14 days ago" : `${activeAssets} active assets`}
          to="/analytics"
          delay={0}
        />
        <KpiTile
          icon={<Bug size={22} />}
          label="Open findings"
          className="lg:col-span-2 2xl:col-span-1"
          value={openFindings}
          delta={<Delta value={findingsDelta} goodWhen="down" />}
          hint={findingsDelta != null ? "vs 14 days ago" : "From intelligence and the tracker"}
          to={href("tracker", "/tracker")}
          delay={0.04}
        />
        <KpiTile
          icon={<ShieldAlert size={22} />}
          label="Open risks"
          className="lg:col-span-2 2xl:col-span-1"
          value={openRisks}
          hint={cc?.risks?.available === false ? "Risk engine unavailable" : "In the treatment queue"}
          delay={0.08}
        />
        <KpiTile
          icon={<Boxes size={22} />}
          label="Active assets"
          className="lg:col-span-3 2xl:col-span-1"
          value={activeAssets}
          hint={`${criticalAssets.length} critical at risk`}
          to={href("assets", "/assets")}
          delay={0.12}
        />
        <KpiTile
          icon={<CheckCircle2 size={22} />}
          label="Fix rate"
          className="lg:col-span-3 2xl:col-span-1"
          value={fixRate}
          suffix="%"
          hint={trackedTotal ? `${fixed} of ${trackedTotal} tracked findings fixed` : "No tracked findings yet"}
          delay={0.16}
        />
      </div>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Panel
          title="Posture overview"
          subtitle="Daily composite score"
          delay={0.1}
          action={<span className="chip border-phantix-700 bg-phantix-900 text-[12px] text-slate-400">14 days</span>}
        >
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-[26px] font-semibold text-white">{postureKnown ? postureScore : "—"}</span>
            <Delta value={scoreDelta} unit=" pts" goodWhen="up" />
          </div>
          {trendRes.loading && !hasTrend ? (
            <div className="skeleton h-[170px] rounded-md" />
          ) : hasTrend ? (
            <AreaTrend points={scorePoints} name="Posture score" />
          ) : (
            <PanelEmpty>Posture history builds up as scans and intelligence runs accumulate.</PanelEmpty>
          )}
        </Panel>

        <Panel title="Findings by surface" subtitle="Tracked findings per attack surface" delay={0.14} action={<ViewAll to="/analytics" />}>
          {surfaceRows.every((r) => r.value === 0) ? (
            <PanelEmpty>No findings tracked on any surface yet.</PanelEmpty>
          ) : (
            <RankedBars rows={surfaceRows} />
          )}
        </Panel>

        <Panel title="Findings by severity" subtitle="Share of tracked findings" delay={0.18}>
          <Donut slices={severitySlices} centerLabel="findings" />
        </Panel>

        <Panel
          title="Open findings per day"
          subtitle="Findings still open at each day's close"
          delay={0.22}
          action={<Delta value={findingsDelta} goodWhen="down" />}
        >
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-[26px] font-semibold text-white">{openFindings.toLocaleString()}</span>
            <span className="text-xs text-slate-500">open now</span>
          </div>
          {trendRes.loading && !hasTrend ? (
            <div className="skeleton h-[170px] rounded-md" />
          ) : hasTrend ? (
            <ColumnTrend points={findingPoints} name="Open findings" />
          ) : (
            <PanelEmpty>Daily finding counts appear once history is recorded.</PanelEmpty>
          )}
        </Panel>
      </div>

      {/* Work queues */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Critical assets at risk" delay={0.16} action={<ViewAll to={href("assets", "/assets")} />}>
          <MiniTable
            rows={criticalAssets.slice(0, 6)}
            columns={assetCols}
            rowKey={(a, i) => Number(a.id ?? 0) || i}
            rowHref={(a) => `/assets?id=${Number(a.id ?? 0)}`}
            empty="No critical assets flagged."
          />
        </Panel>
        <Panel title="Critical tracker items" delay={0.2} action={<ViewAll to={href("tracker", "/tracker")} />}>
          <MiniTable
            rows={trackerCritical.slice(0, 6)}
            columns={trackerCols}
            rowKey={(t, i) => str(t.findingKey ?? t.finding_key, `row-${i}`)}
            rowHref={(t) => `/tracker?key=${encodeURIComponent(str(t.findingKey ?? t.finding_key, ""))}`}
            empty="No critical open tracker items."
          />
        </Panel>
        <Panel
          title="Top risks"
          subtitle={cc?.risks?.available === false ? "Risk engine unavailable" : undefined}
          delay={0.24}
          action={
            <CrossAppLink app="defend" to="/risks" className="text-xs font-semibold text-gold-400 hover:text-gold-300">
              View all
            </CrossAppLink>
          }
        >
          <MiniTable rows={topRisks.slice(0, 6)} columns={riskCols} rowKey={(r, i) => Number(r.id ?? 0) || i} empty="No open risks." />
        </Panel>
      </div>

      {/* Activity */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Panel title="Recent reports" delay={0.2} action={<ViewAll to={href("reports", "/reports")} />}>
          <MiniTable
            rows={recentReports.slice(0, 6)}
            columns={reportCols}
            rowKey={(r, i) => Number(r.id ?? 0) || i}
            rowHref={(r) => `/reports?id=${Number(r.id ?? 0)}`}
            empty="No reports yet."
          />
        </Panel>

        <Panel
          title="SOC detections"
          subtitle={cc?.soc?.available === false ? "SOC unavailable" : `${socOpen} in the open queue`}
          delay={0.24}
          action={
            <CrossAppLink app="defend" to="/soc" className="text-xs font-semibold text-gold-400 hover:text-gold-300">
              View all
            </CrossAppLink>
          }
        >
          {topDetections.length === 0 ? (
            <PanelEmpty>Queue clear.</PanelEmpty>
          ) : (
            <ul className="space-y-3">
              {topDetections.slice(0, 5).map((d, i) => (
                <li key={Number(d.id ?? 0) || i} className="flex items-start gap-2.5">
                  <SeverityBadge severity={str(d.severity, "info") as any} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-slate-200">{str(d.title)}</p>
                    <p className="text-[12px] text-slate-500">
                      {titleCase(str(d.status, "open"))}
                      {d.occurrenceCount != null ? ` · ×${num(d.occurrenceCount)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Shortcuts" delay={0.28}>
          <ul className="space-y-2">
            {shortcuts.map((s) => (
              <li key={s.to}>
                <Link
                  to={s.to}
                  className="group flex items-center gap-3 rounded-md border border-phantix-700 bg-phantix-950 px-3 py-2 transition-colors hover:border-phantix-600 hover:bg-phantix-900"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gold-400/10 text-gold-300">{s.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-200">{s.label}</span>
                    <span className="block truncate text-[12px] text-slate-500">{s.hint}</span>
                  </span>
                  <ArrowRight size={14} className="text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Server heartbeat"
          subtitle="Organization uptime checks"
          delay={0.32}
          action={
            <span
              className={cx(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium",
                serverConnected
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
              )}
            >
              <span className={cx("h-2 w-2 rounded-full", serverConnected ? "bg-emerald-400" : "bg-severity-medium")} />
              {serverConnected ? "Live" : "Reconnecting"}
            </span>
          }
        >
          <div className="flex items-center gap-3 rounded-md border border-phantix-700 bg-phantix-950 px-3 py-2.5">
            <HeartPulse size={16} className="shrink-0 text-gold-400" />
            <p className="min-w-0 flex-1 truncate text-[12px] text-slate-400">
              {availability
                ? lastHeartbeatAt
                  ? `Last probe ${timeAgo(lastHeartbeatAt)}`
                  : "Uptime checks configured"
                : "Configure uptime checks in Defend → SOC availability."}
            </p>
            <svg width="72" height="24" viewBox="0 0 90 30" className="shrink-0" aria-hidden>
              <polyline
                points="0,15 10,15 15,15 18,7 21,23 24,13 27,15 44,15 49,15 54,9 57,21 60,13 63,15 90,15"
                fill="none"
                stroke={checks?.down ? "#ef4444" : "#E8B54D"}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                className={cx("ecg-line", !serverConnected && "stopped")}
              />
            </svg>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Checks", value: checks?.total ?? 0, tone: "text-slate-100" },
              { label: "Up", value: checks?.up ?? 0, tone: "text-emerald-300" },
              { label: "Degraded", value: checks?.degraded ?? 0, tone: "text-severity-medium" },
              { label: "Down", value: checks?.down ?? 0, tone: "text-severity-critical" },
            ].map((m) => (
              <div key={m.label} className="rounded-md border border-phantix-700 bg-phantix-950 py-2">
                <p className={cx("font-mono text-lg font-semibold", m.tone)}>{m.value}</p>
                <p className="text-[12px] text-slate-500">{m.label}</p>
              </div>
            ))}
          </div>
          {serverEvents.length > 0 && (
            <ul className="mt-3 max-h-32 space-y-2 overflow-y-auto">
              {serverEvents.slice(0, 5).map((e, i) => (
                <li key={`${e.ts}-${i}`} className="flex items-start gap-2 text-xs">
                  <span className={cx("mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current", e.tone)} />
                  <div className="min-w-0">
                    <p className="truncate text-slate-300">
                      <span className="font-mono text-[12px] uppercase text-slate-500">{e.type}</span> · {e.label}
                    </p>
                    <p className="text-slate-600">{timeAgo(e.ts)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <CrossAppLink app="defend" to="/soc" className="inline-flex items-center gap-1 font-semibold text-gold-400 hover:text-gold-300">
              Server monitoring <ArrowRight size={12} />
            </CrossAppLink>
            <CrossAppLink app="defend" to="/assets/intelligence" className="inline-flex items-center gap-1 font-semibold text-gold-400 hover:text-gold-300">
              Intelligence <ArrowRight size={12} />
            </CrossAppLink>
          </div>
        </Panel>
      </div>

      {/* Shared feed: what the last completed assessment left for Core. */}
      <LatestAssessmentPanel app="core" className="mt-4" />

      {/* Coverage summary */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiTile
          size="lg"
          icon={<ShieldCheck size={24} />}
          label="Verified assets"
          value={verified}
          hint={activeAssets ? `${Math.round((verified / Math.max(1, activeAssets)) * 100)}% of active assets` : "Ownership-verified assets"}
          to={href("assets", "/assets")}
          delay={0.2}
        />
        <KpiTile
          size="lg"
          icon={<ScanSearch size={24} />}
          label="Never scanned"
          value={neverScanned}
          hint="Discovered assets awaiting a first scan"
          to={href("assets", "/assets")}
          delay={0.24}
        />
        <KpiTile
          size="lg"
          icon={<Radar size={24} />}
          label="Reports generated"
          value={reportsTotal}
          hint="In the report library"
          to={href("reports", "/reports")}
          delay={0.28}
        />
      </div>

      {!operate.unlocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-gold-400/30 bg-phantix-950 px-5 py-3.5"
        >
          <Zap size={16} className="shrink-0 text-gold-400" />
          <p className="min-w-0 flex-1 text-xs leading-5 text-slate-400">
            You&apos;re browsing read-only. Unlock operate mode for changes (tracker updates, report generation, intel refresh) when dual-control is configured.
          </p>
          <button
            type="button"
            className="btn-primary !py-2 !text-xs"
            onClick={() => void requireDualControl("Unlock operate mode to perform protected mutations.")}
          >
            Unlock operate
          </button>
        </motion.div>
      )}
    </div>
  );
}
