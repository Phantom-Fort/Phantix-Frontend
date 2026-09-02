import React, { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Boxes, ShieldAlert, Radar, Crosshair, ArrowRight, BellRing,
  ShieldCheck, Zap, Activity, KanbanSquare, FileText, FlaskConical, HeartPulse,
} from "lucide-react";
import { Card, CardHeader, StatCard, AnimatedNumber, ProgressRing, SeverityBadge, StatusBadge, PageSkeleton, ErrorState } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import TrendChart from "@/components/TrendChart";
import { loadCommandCenter, loadPostureTrend, type PosturePoint } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { useSmartPoll } from "@/lib/usePolling";
import { useSseStream } from "@/lib/useSse";
import { timeAgo, cx, titleCase } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { CommandCenter } from "@/lib/types";

const emptyDash = {
  cc: null as CommandCenter | null,
  securityDbBlocked: false,
  error: null as string | null,
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = "—"): string {
  if (v == null || v === "") return fallback;
  return String(v);
}

export default function Dashboard() {
  const { org: storeOrg, operate, requireDualControl } = useStore();
  const { data, loading, error, reload, setData } = useResource(loadCommandCenter, emptyDash, "command-center");
  const trendRes = useResource<PosturePoint[]>(() => loadPostureTrend(), [] as PosturePoint[], "posture-trend");
  const [liveEvents, setLiveEvents] = useState<Array<{ type: string; label: string; ts: string }>>([]);
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
      if (evt.event === "heartbeat") {
        setLastHeartbeatAt(evt.ts);
        return;
      }
      if (evt.event === "connected") return;
      const payload =
        evt.data && typeof evt.data === "object" ? (evt.data as Record<string, unknown>) : {};
      const inner =
        payload.payload && typeof payload.payload === "object"
          ? (payload.payload as Record<string, unknown>)
          : payload;
      const type = String(payload.type ?? evt.event ?? "event");
      const label =
        str(inner.title ?? inner.findingKey ?? inner.reportId ?? inner.assetId ?? type, type);
      setLiveEvents((prev) => [{ type, label, ts: evt.ts }, ...prev].slice(0, 24));

      // Patch panels in place for tracker / report / risk signals; full refresh on reconnect only.
      if (type === "trackerUpdated" || type === "agiFindingRecorded") {
        setData((prev) => {
          if (!prev.cc) return prev;
          const key = String(inner.findingKey ?? inner.trackerKey ?? "");
          const critical = [...(prev.cc.tracker?.criticalOpen ?? [])];
          if (key) {
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
            if (idx >= 0) critical[idx] = { ...critical[idx], ...row };
            else critical.unshift(row);
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

  const streamPath =
    data.cc?.stream?.commandCenter?.replace(/^\/api\/v1/, "") ||
    "/org/command-center/stream";
  const { connected } = useSseStream(streamPath.startsWith("/") ? streamPath : `/${streamPath}`, {
    enabled: !loading && !data.securityDbBlocked,
    onEvent: onSse,
  });

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
  const lab = cc?.lab;
  const postureScore = num(cc?.posture?.postureScore, 0);
  const openFindings = num(cc?.posture?.totals?.openFindings ?? cc?.tracker?.summary?.open, 0);
  const openRisks = num(cc?.risks?.open, 0);
  const socOpen = num(cc?.soc?.queue?.openTotal, 0);
  const trackerOpen = num(
    cc?.tracker?.summary?.open ?? cc?.tracker?.total,
    0,
  );
  const activeAssets = num(cc?.posture?.totals?.activeAssets ?? cc?.assets?.totals?.active, 0);
  const criticalAssets = (cc?.posture?.criticalAssetsAtRisk ?? cc?.assets?.criticalAtRisk ?? []) as Array<
    Record<string, unknown>
  >;
  const topRisks = (cc?.risks?.top ?? []) as Array<Record<string, unknown>>;
  const topDetections = (cc?.soc?.topDetections ?? []) as Array<Record<string, unknown>>;
  const trackerCritical = (cc?.tracker?.criticalOpen ?? []) as Array<Record<string, unknown>>;
  const recentReports = (cc?.reports?.recent ?? []) as Array<Record<string, unknown>>;
  const pages = cc?.pages ?? {};
  const href = (key: string, fallback: string) => str(pages[key], fallback);
  const trendPoints = (trendRes.data ?? []).map((p) => ({ label: p.day, value: Number(p.score ?? 0) }));
  const trendFirst = trendPoints[0]?.value ?? null;
  const trendLast = trendPoints[trendPoints.length - 1]?.value ?? null;
  const trendDelta = trendFirst != null && trendLast != null ? Math.round(trendLast - trendFirst) : null;

  return (
    <div className="mx-auto max-w-[1400px]">
      {data.securityDbBlocked && <SecurityDbBanner message={data.error} />}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">{orgName}</p>
            {lab?.authorizedLab && (
              <span className="chip border-amber-400/40 bg-amber-400/10 text-amber-200">
                <FlaskConical size={11} className="mr-1 inline" /> Lab
              </span>
            )}
            <span
              className={cx(
                "chip text-[10px]",
                connected
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : "border-slate-500/40 bg-slate-500/10 text-slate-400",
              )}
            >
              <span className={cx("mr-1 inline-block h-1.5 w-1.5 rounded-full", connected ? "bg-emerald-400 animate-pulse-soft" : "bg-slate-500")} />
              {connected ? "Live" : "Offline"}
            </span>
          </div>
          <h1 className="mt-1 font-display text-[26px] font-bold tracking-tight text-white">Command center</h1>
          {lab?.surfaces && lab.surfaces.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lab.surfaces.slice(0, 8).map((s) => (
                <Link
                  key={s.key || s.host}
                  to={`/assets?q=${encodeURIComponent(s.host)}`}
                  className="chip font-mono border-phantix-700 bg-phantix-900 text-[10px] text-slate-400 hover:border-gold-400/50 hover:text-gold-300"
                >
                  {s.name || s.host}
                </Link>
              ))}
            </div>
          )}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex gap-2.5">
          <Link to={href("risks", "/risks")} className="btn-secondary">
            <ShieldAlert size={15} /> Risks
          </Link>
          <Link to={href("soc", "/soc")} className="btn-secondary">
            <Activity size={15} /> SOC
          </Link>
          <Link to={href("tracker", "/reports?tab=tracker")} className="btn-primary">
            <KanbanSquare size={15} /> Tracker
          </Link>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Posture"
          value={<AnimatedNumber value={postureScore} />}
          icon={<ShieldCheck size={17} />}
          accent="gold"
          delay={0}
          hint={<span>{activeAssets} active assets</span>}
        />
        <StatCard
          label="Open findings"
          value={<AnimatedNumber value={openFindings} />}
          icon={<Crosshair size={17} />}
          accent="red"
          delay={0.04}
          hint={<span>From intelligence / tracker</span>}
        />
        <StatCard
          label="Open risks"
          value={<AnimatedNumber value={openRisks} />}
          icon={<ShieldAlert size={17} />}
          accent="red"
          delay={0.08}
          hint={
            <span>
              {cc?.risks?.available === false ? "Engine unavailable" : "Treatment queue"}
            </span>
          }
        />
        <StatCard
          label="SOC open"
          value={<AnimatedNumber value={socOpen} />}
          icon={<Radar size={17} />}
          accent="blue"
          delay={0.12}
          hint={<span>{cc?.soc?.available === false ? "SOC offline" : "Detection queue"}</span>}
        />
        <StatCard
          label="Tracker open"
          value={<AnimatedNumber value={trackerOpen} />}
          icon={<KanbanSquare size={17} />}
          accent="green"
          delay={0.16}
          hint={
            <span>
              {num(cc?.tracker?.summary?.regressed)} regressed · {num(cc?.tracker?.summary?.fixed)} fixed
            </span>
          }
        />
      </div>

      {/* Posture time series */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-4">
        <Card>
          <CardHeader
            title="Posture over time"
            subtitle="Daily composite score — last 14 days"
            action={
              trendDelta != null ? (
                <span
                  className={cx(
                    "chip text-xs",
                    trendDelta > 0
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : trendDelta < 0
                        ? "border-severity-critical/30 bg-severity-critical/10 text-severity-critical"
                        : "text-slate-400",
                  )}
                >
                  {trendDelta > 0 ? "▲" : trendDelta < 0 ? "▼" : "•"} {Math.abs(trendDelta)} pts / 14d
                </span>
              ) : undefined
            }
          />
          {trendPoints.length > 1 ? (
            <TrendChart points={trendPoints} color="#E8B54D" height={190} />
          ) : (
            <p className="py-10 text-center text-xs text-slate-500">
              Posture history isn&apos;t available yet — it builds up as scans and intelligence runs accumulate.
            </p>
          )}
        </Card>
      </motion.div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader
              title="Critical assets at risk"
              subtitle="Click through to asset inventory"
              action={
                <Link to={href("assets", "/assets")} className="text-xs font-semibold text-gold-400 hover:text-gold-300">
                  All assets →
                </Link>
              }
            />
            {criticalAssets.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No critical assets flagged.</p>
            ) : (
              <div className="space-y-2">
                {criticalAssets.slice(0, 8).map((a, i) => {
                  const id = Number(a.id ?? 0);
                  return (
                    <Link
                      key={id || i}
                      to={`/assets?id=${id}`}
                      className="flex items-center gap-3 rounded-md border border-phantix-700 bg-phantix-950 px-4 py-3 transition-colors hover:border-phantix-600 hover:bg-phantix-900"
                    >
                      <Boxes size={15} className="shrink-0 text-gold-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm font-medium text-slate-200">{str(a.value ?? a.name)}</p>
                        <p className="text-xs text-slate-500">
                          {str(a.assetType ?? a.asset_type, "asset")}
                          {a.openFindingsCount != null || a.open_findings != null
                            ? ` · ${num(a.openFindingsCount ?? a.open_findings)} open findings`
                            : ""}
                        </p>
                      </div>
                      {(a.riskLevel != null || a.risk_level != null) ? (
                        <SeverityBadge severity={str(a.riskLevel ?? a.risk_level, "info") as any} />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <Card className="h-full">
            <CardHeader title="Posture score" subtitle="Composite org posture" />
            <div className="flex flex-col items-center py-4">
              <ProgressRing value={postureScore} size={140} color={postureScore >= 70 ? "#34D399" : "#E8B54D"}>
                <span className="font-mono text-3xl font-semibold tracking-tight text-white">{postureScore}</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">score</span>
              </ProgressRing>
              <p className="mt-4 text-center text-xs text-slate-500">
                Verified {num(cc?.posture?.totals?.verified)} · Unscanned{" "}
                {num(cc?.posture?.totals?.neverScanned)}
              </p>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <Card className="h-full">
            <CardHeader
              title="Top risks"
              subtitle={cc?.risks?.available === false ? "Risk engine unavailable" : "Highest priority"}
              action={
                <Link to={href("risks", "/risks")} className="text-xs font-semibold text-gold-400">
                  All →
                </Link>
              }
            />
            {topRisks.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No open risks.</p>
            ) : (
              <div className="space-y-2">
                {topRisks.slice(0, 5).map((r, i) => {
                  const id = Number(r.id ?? 0);
                  return (
                    <Link
                      key={id || i}
                      to={`/risks?id=${id}`}
                      className="block rounded-md border border-phantix-700 bg-phantix-950 px-3.5 py-2.5 transition-colors hover:border-phantix-600 hover:bg-phantix-900"
                    >
                      <div className="flex items-start gap-2">
                        <SeverityBadge severity={str(r.riskLevel ?? r.level, "info") as any} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-200">{str(r.title)}</p>
                          <p className="text-[11px] text-slate-500">{titleCase(str(r.status, ""))}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <Card className="h-full">
            <CardHeader
              title="SOC detections"
              subtitle={cc?.soc?.available === false ? "SOC unavailable" : "Open queue"}
              action={
                <Link to={href("soc", "/soc")} className="text-xs font-semibold text-gold-400">
                  SOC →
                </Link>
              }
            />
            {topDetections.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Queue clear.</p>
            ) : (
              <div className="space-y-2">
                {topDetections.slice(0, 5).map((d, i) => {
                  const id = Number(d.id ?? 0);
                  return (
                    <Link
                      key={id || i}
                      to={`/soc?id=${id}`}
                      className="block rounded-md border border-phantix-700 bg-phantix-950 px-3.5 py-2.5 transition-colors hover:border-phantix-600 hover:bg-phantix-900"
                    >
                      <div className="flex items-start gap-2">
                        <SeverityBadge severity={str(d.severity, "info") as any} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-200">{str(d.title)}</p>
                          <p className="text-[11px] text-slate-500">
                            {titleCase(str(d.status, "open"))}
                            {d.occurrenceCount != null ? ` · ×${num(d.occurrenceCount)}` : ""}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
          <Card className="h-full">
            <CardHeader
              title="Tracker critical"
              subtitle="Living board — not a report file"
              action={
                <Link to={href("tracker", "/reports?tab=tracker")} className="text-xs font-semibold text-gold-400">
                  Board →
                </Link>
              }
            />
            {trackerCritical.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No critical open tracker items.</p>
            ) : (
              <div className="space-y-2">
                {trackerCritical.slice(0, 5).map((t, i) => {
                  const key = str(t.findingKey ?? t.finding_key, `row-${i}`);
                  return (
                    <Link
                      key={key}
                      to={`/reports?tab=tracker&key=${encodeURIComponent(key)}`}
                      className="block rounded-md border border-phantix-700 bg-phantix-950 px-3.5 py-2.5 transition-colors hover:border-phantix-600 hover:bg-phantix-900"
                    >
                      <div className="flex items-start gap-2">
                        <SeverityBadge severity={str(t.severity, "critical") as any} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-200">{str(t.title)}</p>
                          <p className="font-mono text-[11px] text-slate-500">
                            {key}
                            {String(t.status) === "regressed" && (
                              <span className="ml-1.5 text-severity-critical">regressed</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader
              title="Recent reports"
              subtitle="Generated library files"
              action={
                <Link to={href("reports", "/reports")} className="text-xs font-semibold text-gold-400">
                  Library →
                </Link>
              }
            />
            {recentReports.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No reports yet.</p>
            ) : (
              <div className="space-y-2">
                {recentReports.slice(0, 6).map((r, i) => {
                  const id = Number(r.id ?? 0);
                  return (
                    <Link
                      key={id || i}
                      to={`/reports?id=${id}`}
                      className="flex items-center gap-3 rounded-md border border-phantix-700 bg-phantix-950 px-4 py-3 transition-colors hover:border-phantix-600 hover:bg-phantix-900"
                    >
                      <FileText size={15} className="shrink-0 text-gold-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-200">{str(r.title)}</p>
                        <p className="text-xs text-slate-500">
                          {str(r.reportType ?? r.report_type)}
                          {r.generatedAt || r.created_at
                            ? ` · ${timeAgo(String(r.generatedAt ?? r.created_at))}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={str(r.status, "complete")} />
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}>
          <Card className="h-full overflow-hidden !p-0">
            <div className="px-5 pt-5">
              <CardHeader
                title="Live event rail"
                subtitle="SSE command-center stream"
                action={
                  <span className={cx(
                    "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-medium",
                    connected ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
                  )}>
                    <span className="relative flex h-2 w-2">
                      {connected && <span className="ecg-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400" />}
                      <span className={cx("relative inline-flex h-2 w-2 rounded-full", connected ? "bg-emerald-400" : "bg-severity-medium")} />
                    </span>
                    {connected ? "Live · heartbeat OK" : "Reconnecting…"}
                  </span>
                }
              />
            </div>
            {/* Heartbeat status strip */}
            <div className="flex items-center gap-3 border-y border-phantix-700 bg-phantix-950/60 px-5 py-3">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-400/25 bg-emerald-400/10 text-emerald-400">
                <HeartPulse size={16} />
                {connected && <span className="ecg-ping absolute inset-0 rounded-md border border-emerald-400/40" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100">{connected ? "Server responsive" : "Waiting for heartbeat"}</p>
                <p className="text-xs text-slate-500">
                  {lastHeartbeatAt
                    ? <>Last heartbeat ping <span className="font-mono text-emerald-300/90">{timeAgo(lastHeartbeatAt)}</span> · stream healthy</>
                    : connected ? "Connected — awaiting the first heartbeat ping…" : "Reconnecting to the command-centre stream…"}
                </p>
              </div>
              <svg width="90" height="30" viewBox="0 0 90 30" className="shrink-0 overflow-hidden" aria-hidden>
                <polyline
                  points="0,15 10,15 15,15 18,7 21,23 24,13 27,15 44,15 49,15 54,9 57,21 60,13 63,15 90,15"
                  fill="none"
                  stroke="#34D399"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className={cx("ecg-line", !connected && "stopped")}
                />
              </svg>
            </div>
            {liveEvents.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">
                {connected ? "Waiting for events…" : "Stream disconnected — reconnecting."}
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto px-5 py-4">
                {liveEvents.map((e, i) => (
                  <div key={`${e.ts}-${i}`} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-gold-400/80">{e.type}</p>
                      <p className="truncate text-slate-300">{e.label}</p>
                      <p className="text-slate-600">{timeAgo(e.ts)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 border-t border-phantix-700 px-5 py-3 text-xs">
              <Link to={href("intelligence", "/assets/intelligence")} className="inline-flex items-center gap-1 font-semibold text-gold-400 hover:text-gold-300">
                Intelligence <ArrowRight size={12} />
              </Link>
              <Link to={href("tracker", "/reports?tab=tracker")} className="inline-flex items-center gap-1 font-semibold text-gold-400 hover:text-gold-300">
                Tracker <ArrowRight size={12} />
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>

      {!operate.unlocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-gold-400/30 bg-phantix-950 px-5 py-3.5"
        >
          <Zap size={16} className="shrink-0 text-gold-400" />
          <p className="min-w-0 flex-1 text-xs leading-5 text-slate-400">
            You're browsing read-only. Unlock operate mode for mutations (tracker PATCH, report generate, intel refresh) when dual-control is configured.
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
