import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import { PageHeader, Card, EmptyState, PageSkeleton, StatCard } from "@/components/ui";
import DocLink from "@/components/DocLink";
import TrendChart from "@/components/TrendChart";
import ChartFrame from "@/components/charts/ChartFrame";
import ComparativeBars from "@/components/charts/ComparativeBars";
import FindingsBreakdown from "@/components/charts/FindingsBreakdown";
import PostureDonut from "@/components/charts/PostureDonut";
import SurfaceScoreRow from "@/components/charts/SurfaceScoreRow";
import {
  LIFECYCLE_COLORS, SEVERITY_COLORS, SEVERITY_ORDER, SURFACES, SURFACE_LABELS,
  surfaceColor, type ChartTheme,
} from "@/components/charts/palette";
import MovementTimeline from "@/components/charts/MovementTimeline";
import {
  loadAiUsage, loadComplianceBundle, loadPostureTrend, loadTrackerAnalytics, loadTrackerTimeline,
} from "@/lib/data";
import type { TrackerTimeline } from "@/lib/data";
import { loadPostureSnapshot } from "@/lib/vaptOps";
import type { PostureSnapshot } from "@/lib/vaptOps";
import type { AiUsage, ComplianceAssessment, TrackerFinding, TrackerSummary } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { cx } from "@/lib/utils";

/*
 * Analytics — the org's security picture, live.
 *
 * Distinct from Report solutions on purpose: a report is an artifact you
 * generate, version and hand to someone. This page answers the same questions
 * from the same engine data with nothing to generate and nothing to wait for, so
 * "how are we doing" never costs a report run.
 *
 * Every panel reads an endpoint that already exists. A panel whose source has no
 * data says so rather than rendering an empty axis, because an empty chart reads
 * as "zero" when it usually means "not measured yet".
 */

export default function Analytics() {
  const { theme } = useTheme();
  const mode = (theme === "light" ? "light" : "dark") as ChartTheme;

  const [posture, setPosture] = useState<PostureSnapshot | null>(null);
  const [tracker, setTracker] = useState<TrackerSummary | null>(null);
  const [trend, setTrend] = useState<Array<{ day: string; score: number; findings: number }>>([]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [rows, setRows] = useState<TrackerFinding[]>([]);
  const [timeline, setTimeline] = useState<TrackerTimeline | null>(null);
  const [assessments, setAssessments] = useState<ComplianceAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [surface, setSurface] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Each source is independent: one unavailable engine must not blank the page.
    const [p, ta, tr, u, tl, comp] = await Promise.all([
      loadPostureSnapshot().catch(() => null),
      loadTrackerAnalytics().catch(() => ({ rows: [], summary: null })),
      loadPostureTrend().catch(() => []),
      loadAiUsage().catch(() => null),
      loadTrackerTimeline(90).catch(() => null),
      loadComplianceBundle().catch(() => null),
    ]);
    setPosture(p as PostureSnapshot | null);
    setTracker(ta.summary);
    setRows(ta.rows);
    setTrend(Array.isArray(tr) ? tr : []);
    setUsage(u);
    setTimeline(tl);
    setAssessments(((comp as any)?.assessments ?? []) as ComplianceAssessment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const surfaceRows = useMemo(() => {
    const surfaces = posture?.surfaces ?? {};
    return SURFACES.map((name) => {
      const s = (surfaces as Record<string, any>)[name] ?? {};
      return {
        surface: name,
        score: Number(s.score ?? 100),
        total: Number(s.total ?? 0),
        reportable: Number(s.reportable ?? 0),
        critical: Number(s.critical ?? 0),
        high: Number(s.high ?? 0),
      };
    });
  }, [posture]);

  /* Comparative: how each surface's exposure is composed. Stacked because the
     segments are parts of that surface's own total. */
  const severityBySurface = useMemo(() => {
    return surfaceRows
      .filter((s) => s.total > 0)
      .map((s) => ({
        name: SURFACE_LABELS[s.surface] ?? s.surface,
        critical: s.critical,
        high: s.high,
        // What the posture snapshot does not break out stays honest as "other"
        // rather than being invented as medium/low.
        other: Math.max(0, s.total - s.critical - s.high),
      }));
  }, [surfaceRows]);

  /* Comparative: work standing vs work closed, per surface — the throughput read
     the posture score alone cannot give. */
  const workBySurface = useMemo(() => {
    const bySurface = tracker?.bySurface ?? {};
    return Object.entries(bySurface)
      .filter(([, v]) => Number(v) > 0)
      .map(([key, value]) => ({
        name: SURFACE_LABELS[key] ?? key,
        tracked: Number(value) || 0,
      }));
  }, [tracker]);

  /* Aging: how long open work has been sitting. Buckets rather than a raw day
     axis — "37 days" is noise; "older than a month" is a decision. */
  const aging = useMemo(() => {
    const buckets = [
      { name: "0–7d", min: 0, max: 7, count: 0 },
      { name: "8–30d", min: 8, max: 30, count: 0 },
      { name: "31–90d", min: 31, max: 90, count: 0 },
      { name: "90d+", min: 91, max: Infinity, count: 0 },
    ];
    const now = Date.now();
    let undated = 0;
    for (const row of rows) {
      const status = String(row.status ?? "").toLowerCase();
      // Closed work has stopped aging; including it would flatter the picture.
      if (status === "fixed" || status === "accepted") continue;
      const seen = row.first_detected_at ?? row.updated_at;
      const ts = seen ? new Date(seen).getTime() : NaN;
      if (!Number.isFinite(ts)) {
        undated += 1;
        continue;
      }
      const days = Math.max(0, Math.floor((now - ts) / 86400000));
      const bucket = buckets.find((b) => days >= b.min && days <= b.max);
      if (bucket) bucket.count += 1;
    }
    return { buckets, undated };
  }, [rows]);

  /* SLA: open work already past the date someone committed to. */
  const slaBreaches = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    const bySeverity: Record<string, number> = {};
    for (const row of rows) {
      const status = String(row.status ?? "").toLowerCase();
      if (status === "fixed" || status === "accepted") continue;
      if (!row.target_fix_date) continue;
      const due = new Date(row.target_fix_date).setHours(0, 0, 0, 0);
      if (!Number.isFinite(due) || due >= today) continue;
      const sev = String(row.severity ?? "unknown").toLowerCase();
      bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
    }
    return SEVERITY_ORDER.filter((s) => bySeverity[s] > 0).map((s) => ({
      name: s[0].toUpperCase() + s.slice(1),
      breached: bySeverity[s],
    }));
  }, [rows]);

  /* Compliance: score per framework, plus how the controls actually landed. */
  const complianceRows = useMemo(
    () =>
      assessments
        .filter((a) => a.framework_name)
        .slice(0, 8)
        .map((a) => ({
          name: a.framework_name,
          passed: Number(a.controls_passed ?? 0),
          gap: Number(a.controls_gap ?? 0),
          unknown: Number(a.controls_unknown ?? 0),
        })),
    [assessments],
  );

  const totals = useMemo(() => {
    const open = Number(tracker?.open ?? 0) + Number(tracker?.in_progress ?? 0);
    const fixed = Number(tracker?.fixed ?? 0);
    const total = Number(tracker?.total ?? 0);
    return {
      open,
      fixed,
      regressed: Number(tracker?.regressed ?? 0),
      fixRate: total ? Math.round((fixed / total) * 100) : null,
      tracked: total,
    };
  }, [tracker]);

  if (loading) return <PageSkeleton />;

  const hasAnything =
    Boolean(posture?.surfaces && Object.keys(posture.surfaces).length) ||
    Boolean(tracker?.total) ||
    trend.length > 0;

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Analytics"
        description="Live analysis of your organization's security data across every surface and engine — no report generation required."
        actions={
          <span className="flex items-center gap-2">
            <DocLink docId="howto-app-28" label="Analytics how-to" />
            <button onClick={() => void load()} className="btn-ghost text-xs !py-2" title="Refresh">
              <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
            </button>
          </span>
        }
      />

      {!hasAnything ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={22} />}
            title="No analytics yet"
            body="Analytics build from posture, findings and engine activity. Run a scan or a campaign, and this page fills in without any further setup."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Headline numbers — a KPI row, not a chart. Four values do not earn
              an axis between them. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Overall posture" value={posture?.overall_score ?? "—"} hint="0–100 across all surfaces" />
            <StatCard label="Open findings" value={totals.open} hint="open + in progress" />
            <StatCard
              label="Fix rate"
              value={totals.fixRate == null ? "—" : `${totals.fixRate}%`}
              hint={`${totals.fixed} fixed of ${totals.tracked} tracked`}
            />
            <StatCard
              label="Regressions"
              value={totals.regressed}
              hint="fixes that did not hold"
            />
          </div>

          {/* Posture: where we stand, and where the exposure sits. */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Posture
            </h2>
            <SurfaceScoreRow surfaces={surfaceRows} onSelect={(s) => setSurface(s === surface ? null : s)} selected={surface} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PostureDonut surfaces={surfaceRows} overallScore={posture?.overall_score ?? null} />
              <ChartFrame
                title="Posture trend"
                subtitle={trend.length ? `${trend.length} days` : "No history yet"}
                tableHead={["Day", "Score"]}
                tableRows={trend.map((p) => [p.day, p.score])}
              >
                {trend.length ? (
                  <TrendChart points={trend.map((p) => ({ label: p.day, value: p.score }))} height={208} />
                ) : (
                  <div className="flex items-center justify-center text-[11px] text-slate-600" style={{ height: 208 }}>
                    Posture history appears once there are two or more snapshots.
                  </div>
                )}
              </ChartFrame>
            </div>
          </section>

          {/* Findings: magnitude and share, reframeable. */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Findings
            </h2>
            <FindingsBreakdown
              counts={{
                byStatus: {
                  open: Number(tracker?.open ?? 0),
                  in_progress: Number(tracker?.in_progress ?? 0),
                  fixed: Number(tracker?.fixed ?? 0),
                  retest_failed: Number(tracker?.retest_failed ?? 0),
                  regressed: Number(tracker?.regressed ?? 0),
                  accepted: Number(tracker?.accepted ?? 0),
                },
                bySeverity: tracker?.bySeverity ?? {},
                bySurface: tracker?.bySurface ?? {},
              }}
            />
          </section>

          {/* Direction over time — the question standing counts cannot answer. */}
          {timeline && timeline.series.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Direction
              </h2>
              <MovementTimeline timeline={timeline} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ComparativeBars
                  title="How long open work has been sitting"
                  subtitle={
                    aging.undated
                      ? `${aging.undated} without a detection date are excluded`
                      : "Open and in-progress findings only — closed work stops aging"
                  }
                  rows={aging.buckets.filter((b) => b.count > 0).map((b) => ({ name: b.name, count: b.count }))}
                  series={[{ key: "count", label: "Findings", color: LIFECYCLE_COLORS.open }]}
                  stacked={false}
                />
                <ComparativeBars
                  title="Past their fix date"
                  subtitle={
                    slaBreaches.length
                      ? "Open findings already past a committed date"
                      : "Nothing is overdue"
                  }
                  rows={slaBreaches}
                  series={[{ key: "breached", label: "Overdue", color: SEVERITY_COLORS.critical }]}
                  stacked={false}
                  valueLabel="overdue"
                />
              </div>
            </section>
          )}

          {/* Compliance standing, framework by framework. */}
          {complianceRows.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Compliance
              </h2>
              <ComparativeBars
                title="Control outcomes by framework"
                subtitle="Where each framework actually stands, control by control"
                rows={complianceRows}
                series={[
                  { key: "passed", label: "Passed", color: SEVERITY_COLORS.low },
                  { key: "gap", label: "Gap", color: SEVERITY_COLORS.critical },
                  { key: "unknown", label: "Unknown", color: "#52525B" },
                ]}
                stacked
                valueLabel="controls"
              />
            </section>
          )}

          {/* Comparative analysis — surfaces measured against each other. */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Comparative analysis
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ComparativeBars
                title="Exposure composition by surface"
                subtitle="What each surface's open findings are made of"
                rows={severityBySurface}
                series={[
                  { key: "critical", label: "Critical", color: SEVERITY_COLORS.critical },
                  { key: "high", label: "High", color: SEVERITY_COLORS.high },
                  { key: "other", label: "Other severities", color: "#52525B" },
                ]}
                stacked
              />
              <ComparativeBars
                title="Tracked findings by surface"
                subtitle="Where the remediation work actually sits"
                rows={workBySurface}
                series={[{ key: "tracked", label: "Tracked findings", color: surfaceColor("code", mode) }]}
                stacked={false}
              />
            </div>
            <ComparativeBars
              title="Severity mix across the organization"
              subtitle="Every tracked finding, by severity"
              rows={SEVERITY_ORDER.filter((s) => Number((tracker?.bySeverity ?? {})[s]) > 0).map((s) => ({
                name: s[0].toUpperCase() + s.slice(1),
                count: Number((tracker?.bySeverity ?? {})[s]) || 0,
              }))}
              series={[{ key: "count", label: "Findings", color: SEVERITY_COLORS.high }]}
              stacked={false}
            />
          </section>

          {/* Automation cost — analytics about the platform's own work. */}
          {usage && (
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Automation
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                  label="Tokens used"
                  value={Number(usage.tokens_used ?? 0).toLocaleString()}
                  hint={usage.token_budget ? `of ${Number(usage.token_budget).toLocaleString()}` : "no ceiling set"}
                />
                <StatCard
                  label="AI spend"
                  value={`₦${Math.round(Number(usage.cost_ngn ?? 0)).toLocaleString()}`}
                  hint={
                    usage.spend_limit_ngn
                      ? `of ₦${Math.round(Number(usage.spend_limit_ngn)).toLocaleString()}`
                      : "no ceiling set"
                  }
                />
                <StatCard
                  label="Budget window"
                  value={usage.year_month ?? "—"}
                  hint={usage.allowed === false ? "exhausted — AI work refused" : `mode ${usage.mode ?? "—"}`}
                />
              </div>
            </section>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 text-[11px] text-slate-600"
          >
            <Activity size={11} />
            Read live from posture, the finding tracker and the AI budget. To hand any of this to
            someone, generate the matching report from{" "}
            <a href="/reports" className="text-gold-300 underline-offset-2 hover:underline">
              Report solutions
            </a>
            .
          </motion.p>
        </div>
      )}
    </div>
  );
}
