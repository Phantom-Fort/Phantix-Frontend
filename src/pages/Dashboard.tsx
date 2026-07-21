import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Boxes, ShieldAlert, Radar, Crosshair, ArrowRight, ArrowUpRight,
  BellRing, ScrollText, ShieldCheck, Zap,
} from "lucide-react";
import { Card, CardHeader, StatCard, AnimatedNumber, ProgressRing, SeverityBadge, StatusBadge, ProgressBar, Spinner } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import { loadDashboardBundle } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { priorityBandMeta, timeAgo, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";

const ttStyle = {
  background: "#0D1B3D",
  border: "1px solid rgba(30,51,115,0.8)",
  borderRadius: 12,
  fontSize: 12,
  color: "#e2e8f0",
};

const emptyDash = {
  assets: [],
  risks: [],
  scanJobs: [],
  vaptCampaigns: [],
  alertEvents: [],
  auditEvents: [],
  complianceAssessments: [],
  reports: [],
  postureTrend: [] as { day: string; score: number; findings: number }[],
  severityDistribution: [] as { name: string; value: number; color: string }[],
  securityDbBlocked: false,
  error: null as string | null,
};

export default function Dashboard() {
  const { org, operate, requireDualControl } = useStore();
  const { data, loading } = useResource(loadDashboardBundle, emptyDash);
  const {
    assets, risks, scanJobs, vaptCampaigns, alertEvents, auditEvents,
    postureTrend, severityDistribution, complianceAssessments, reports,
    securityDbBlocked, error: loadError,
  } = data;
  const activeScan = scanJobs.find((j) => j.status === "running" || j.status === "queued");
  const activeCampaign = vaptCampaigns.find((c) => c.status === "active");
  const openRisks = risks.filter((r) => !["closed", "accepted"].includes(r.status));
  const posture = postureTrend[postureTrend.length - 1]?.score ?? 0;
  const generating = reports.find((r) => r.status === "generating");

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading live posture…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {securityDbBlocked && <SecurityDbBanner message={loadError} />}
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">{org.name}</p>
          <h1 className="mt-1 font-display text-[26px] font-bold tracking-tight text-white">Security posture</h1>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex gap-2.5">
          <Link to="/vapt" className="btn-secondary"><Crosshair size={15} /> New campaign</Link>
          <Link to="/scans" className="btn-primary"><Radar size={15} /> Launch scan</Link>
        </motion.div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assets in inventory" value={<AnimatedNumber value={assets.length} />} icon={<Boxes size={17} />} accent="blue" delay={0}
          hint={<span>{assets.filter((a) => a.criticality === "critical").length} critical · all verified</span>} />
        <StatCard label="Open risks" value={<AnimatedNumber value={openRisks.length} />} icon={<ShieldAlert size={17} />} accent="red" delay={0.06}
          hint={<span>{openRisks.filter((r) => r.level === "critical").length} critical · {openRisks.filter((r) => r.priority_band === "P1").length} in P1</span>} />
        <StatCard label="Active scans" value={<AnimatedNumber value={activeScan ? 1 : 0} />} icon={<Radar size={17} />} accent="gold" delay={0.12}
          hint={activeScan ? <span>Job #{activeScan.id} · {activeScan.progress}% · one-job lock</span> : <span>Idle — slot free</span>} />
        <StatCard label="Campaigns" value={<AnimatedNumber value={vaptCampaigns.length} />} icon={<Crosshair size={17} />} accent="green" delay={0.18}
          hint={<span>{vaptCampaigns.filter((c) => c.status === "active").length} running · {vaptCampaigns.filter((c) => c.status === "completed").length} completed</span>} />
      </div>

      {/* Main grid */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Posture + trend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.5 }} className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader
              title="Posture trend"
              subtitle="Composite posture score over the last 14 days"
              action={<span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><ArrowUpRight size={12} /> +10 this week</span>}
            />
            <div className="flex items-center gap-6">
              <ProgressRing value={posture} size={132} color={posture >= 70 ? "#34D399" : "#E8B54D"}>
                <span className="font-display text-3xl font-bold text-white">{posture}</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">score</span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <ResponsiveContainer width="100%" height={132}>
                  <AreaChart data={postureTrend} margin={{ top: 6, right: 4, bottom: 0, left: -22 }}>
                    <defs>
                      <linearGradient id="postureFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E8B54D" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#E8B54D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(30,51,115,0.35)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} interval={3} />
                    <YAxis domain={[50, 80]} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={ttStyle} />
                    <Area type="monotone" dataKey="score" stroke="#E8B54D" strokeWidth={2.5} fill="url(#postureFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Severity donut */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.5 }}>
          <Card className="h-full">
            <CardHeader title="Findings by severity" subtitle="Verified findings this cycle" />
            <div className="flex items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={170} height={170}>
                  <PieChart>
                    <Pie data={severityDistribution} dataKey="value" innerRadius={56} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                      {severityDistribution.map((s) => (
                        <Cell key={s.name} fill={s.color} style={{ filter: `drop-shadow(0 0 6px ${s.color}66)` }} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={ttStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-2xl font-bold text-white">{severityDistribution.reduce((a, b) => a + b.value, 0)}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">verified</span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {severityDistribution.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                  <span className="ml-auto font-semibold text-slate-200">{s.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Active operations */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.5 }} className="xl:col-span-2">
          <Card>
            <CardHeader title="Live operations" subtitle="Scan lock and campaign execution state" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Active scan */}
              <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Radar size={15} className="text-gold-400" /> Scan #{activeScan?.id ?? "—"}
                  </span>
                  {activeScan && <StatusBadge status={activeScan.status} />}
                </div>
                {activeScan ? (
                  <>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {activeScan.tools.join(" + ")} · scope: {(activeScan.target_filter as { tags?: string[] }).tags?.join(", ") ?? "inventory"}
                    </p>
                    <div className="mt-3">
                      <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                        <span>Progress</span><span className="font-mono">{activeScan.progress}%</span>
                      </div>
                      <ProgressBar value={activeScan.progress} color="#38BDF8" />
                    </div>
                    <p className="mt-2.5 text-xs text-slate-500">{activeScan.findings_count} findings so far · started {timeAgo(activeScan.started_at)}</p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No scan running — the per-org slot is free.</p>
                )}
                <Link to="/scans" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:text-gold-300">
                  Open scans <ArrowRight size={12} />
                </Link>
              </div>

              {/* Active campaign */}
              <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Crosshair size={15} className="text-gold-400" /> {activeCampaign?.name ?? "No active campaign"}
                  </span>
                  {activeCampaign && <StatusBadge status={activeCampaign.status} />}
                </div>
                {activeCampaign && (
                  <>
                    <p className="mt-1.5 text-xs text-slate-500">Phase: {activeCampaign.phase}</p>
                    <div className="mt-3">
                      <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                        <span>Campaign progress</span><span className="font-mono">{activeCampaign.progress}%</span>
                      </div>
                      <ProgressBar value={activeCampaign.progress} />
                    </div>
                    <p className="mt-2.5 text-xs text-slate-500">{activeCampaign.findings_count} correlated findings · {activeCampaign.asset_count} assets in scope</p>
                  </>
                )}
                <Link to="/vapt" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:text-gold-300">
                  Open campaigns <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            {generating && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-severity-low/25 bg-severity-low/8 px-4 py-3">
                <span className="h-2 w-2 animate-pulse-soft rounded-full bg-severity-low" />
                <p className="text-xs text-slate-300">
                  Report <strong>#{generating.id} — {generating.title}</strong> is generating ({generating.formats.join(", ")})…
                </p>
                <Link to="/reports" className="ml-auto text-xs font-semibold text-gold-400">View</Link>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Verification gate */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
          <Card className="h-full border-gold-400/20">
            <CardHeader title="Verification gate" subtitle="REPORT_REQUIRE_VERIFIED_FINDINGS" action={<ShieldCheck size={17} className="text-gold-400" />} />
            <div className="space-y-3">
              {[
                { v: reports[0]?.stats.after_dedupe ?? 14, l: "After dedupe", c: "text-phantix-300", bar: 100, bg: "#5A7BD6" },
                { v: reports[0]?.stats.after_verification ?? 11, l: "After verification", c: "text-emerald-400", bar: 76, bg: "#34D399" },
                { v: reports[0]?.stats.excluded_from_report ?? 3, l: "Excluded noise", c: "text-severity-critical", bar: 24, bg: "#F43F5E" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5">
                  <div className="flex items-baseline justify-between">
                    <span className={`font-display text-2xl font-bold ${s.c}`}>{s.v}</span>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{s.l}</span>
                  </div>
                  <div className="mt-2"><ProgressBar value={s.bar} color={s.bg} /></div>
                </div>
              ))}
              <p className="text-[11px] leading-4 text-slate-500">
                Only auto / human-verified findings enter executive severity rollups. Heuristic probes are appendix-only.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Priority queue */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46, duration: 0.5 }} className="xl:col-span-2">
          <Card>
            <CardHeader
              title="Priority queue"
              subtitle="phantix.risk_priority.v1 — what to fix first"
              action={<Link to="/risks" className="text-xs font-semibold text-gold-400 hover:text-gold-300">All risks →</Link>}
            />
            <div className="space-y-2">
              {[...risks].sort((a, b) => b.priority_score - a.priority_score).slice(0, 5).map((r, i) => {
                const band = priorityBandMeta[r.priority_band];
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                  >
                    <Link to="/risks" className="flex items-center gap-4 rounded-xl border border-phantix-700/40 bg-phantix-950/40 px-4 py-3 transition-colors hover:border-phantix-500/50 hover:bg-phantix-800/40">
                      <span className={cx("chip shrink-0", band.className)}>{r.priority_band}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-200">{r.title}</p>
                        <p className="text-xs text-slate-500">{r.asset_value} · {r.owner_department ?? "Unassigned"}</p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="font-mono text-sm font-semibold text-slate-200">{r.priority_score.toFixed(1)}</p>
                        <p className="text-[10px] uppercase tracking-wider text-slate-600">priority</p>
                      </div>
                      <SeverityBadge severity={r.level === "critical" ? "critical" : r.level === "high" ? "high" : r.level === "medium" ? "medium" : "low"} />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Right column: alerts + audit + compliance */}
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52, duration: 0.5 }}>
            <Card>
              <CardHeader title="Recent alerts" action={<BellRing size={15} className="text-slate-500" />} />
              <div className="space-y-2.5">
                {alertEvents.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-start gap-3 text-xs">
                    <span className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", a.severity === "critical" ? "bg-severity-critical shadow-[0_0_8px_rgba(244,63,94,0.8)]" : "bg-severity-low")} />
                    <div className="min-w-0">
                      <p className="leading-5 text-slate-300">{a.title}</p>
                      <p className="mt-0.5 text-slate-600">{timeAgo(a.created_at)} · {a.channels.join(" + ")}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/alerts" className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:text-gold-300">
                Alert centre <ArrowRight size={12} />
              </Link>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58, duration: 0.5 }}>
            <Card>
              <CardHeader title="Compliance posture" action={<Link to="/compliance" className="text-xs font-semibold text-gold-400">Details →</Link>} />
              <div className="space-y-3">
                {complianceAssessments.map((c) => (
                  <div key={c.id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-slate-300">{c.framework_name}</span>
                      <span className="font-mono text-slate-400">{c.score}%</span>
                    </div>
                    <ProgressBar value={c.score} color={c.score >= 75 ? "#34D399" : c.score >= 60 ? "#E8B54D" : "#FB923C"} />
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.64, duration: 0.5 }}>
            <Card>
              <CardHeader title="Latest audit events" action={<ScrollText size={15} className="text-slate-500" />} />
              <div className="space-y-2.5">
                {auditEvents.slice(0, 3).map((e) => (
                  <div key={e.id} className="text-xs">
                    <p className="leading-5 text-slate-300">{e.action}</p>
                    <p className="mt-0.5 text-slate-600">
                      {e.initiator_name}{e.authorizer_name ? ` → ${e.authorizer_name}` : ""} · {timeAgo(e.created_at)}
                    </p>
                  </div>
                ))}
              </div>
              <Link to="/audit" className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:text-gold-300">
                Full trail <ArrowRight size={12} />
              </Link>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Operate hint */}
      {!operate.unlocked && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-gold-400/20 bg-gold-400/5 px-5 py-3.5">
          <Zap size={16} className="shrink-0 text-gold-400" />
          <p className="min-w-0 flex-1 text-xs leading-5 text-slate-400">
            You're browsing read-only. Unlock operate mode to run scans, start campaigns, and approve treatments —
            mutations require a dual-control session.
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
