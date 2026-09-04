import React, { useState } from "react";
import { motion } from "framer-motion";
import { Shield, TrendingUp, BarChart3, CheckCircle, XCircle, FileText, Plus, Download } from "lucide-react";
import { PageHeader, Card, CardHeader, Tabs, Spinner, PageSkeleton, ErrorState, EmptyState } from "@/components/ui";
import { loadAdvisorDashboard, loadAdvisorRecommendations, updateAdvisorRecommendation, loadAdvisorReports, generateAdvisorReport, publishAdvisorReport, deleteAdvisorReport } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { timeAgo, cx } from "@/lib/utils";
import type { SocAdvisorDashboard, SocAdvisorRecommendation, SocAdvisorReport } from "@/lib/types";

export default function SocAdvisor() {
  const [tab, setTab] = useState("dashboard");
  const { toast } = useStore();

  const { data: dashboard, loading: dl } = useResource<SocAdvisorDashboard | null>(() => loadAdvisorDashboard(), null, "advisor-dash");
  const { data: recommendations, loading: rl, reload: reloadRecs } = useResource<SocAdvisorRecommendation[]>(() => loadAdvisorRecommendations(), [], "advisor-recs");
  const { data: reports, loading: rptl, reload: reloadRpts } = useResource<SocAdvisorReport[]>(() => loadAdvisorReports(), [], "advisor-rpts");

  if (dl) return <PageSkeleton variant="list" rows={4} />;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="SOC Advisor"
        description="Posture score trends, benchmarks, readiness assessments, and automated recommendations."
      />

      <Tabs
        tabs={[
          { id: "dashboard", label: "Dashboard" },
          { id: "recommendations", label: "Recommendations", count: recommendations.length },
          { id: "reports", label: "Reports", count: reports.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "dashboard" && dashboard && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="!p-4">
              <p className="text-3xl font-semibold text-gold-400">{dashboard.score}</p>
              <p className="text-xs text-slate-400">Posture score</p>
            </Card>
            <Card className="!p-4">
              <p className="text-3xl font-semibold text-slate-200">{dashboard.open_recommendations}</p>
              <p className="text-xs text-slate-400">Open recommendations</p>
            </Card>
            <Card className="!p-4">
              <p className="text-3xl font-semibold text-slate-200">{Object.keys(dashboard.readiness || {}).length}</p>
              <p className="text-xs text-slate-400">Frameworks tracked</p>
            </Card>
          </div>

          {dashboard.trend && dashboard.trend.length > 0 && (
            <Card className="!p-4">
              <CardHeader title="Score trend" />
              <div className="mt-3 flex items-end gap-2 h-24">
                {dashboard.trend.map((pt, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-gold-400/60" style={{ height: `${Math.max(4, (pt.score / 100) * 80)}px` }} />
                    <span className="text-[9px] text-slate-500">{pt.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {dashboard.readiness && Object.keys(dashboard.readiness).length > 0 && (
            <Card className="!p-4">
              <CardHeader title="Framework readiness" />
              <div className="mt-3 space-y-2">
                {Object.entries(dashboard.readiness).map(([framework, data]) => (
                  <div key={framework} className="flex items-center gap-3">
                    <span className="w-32 text-xs font-medium text-slate-200">{framework}</span>
                    <div className="flex-1 h-2 rounded-full bg-phantix-800">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(data.passed / data.total_controls) * 100}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{data.passed}/{data.total_controls}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </motion.div>
      )}

      {tab === "recommendations" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2">
          {rl ? <Spinner /> : recommendations.length === 0 ? (
            <EmptyState icon={<CheckCircle size={32} />} title="All clear" body="No open recommendations." />
          ) : recommendations.map((rec, i) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="!p-4">
                <div className="flex items-start gap-3">
                  <div className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", rec.priority === "critical" ? "bg-severity-critical" : rec.priority === "high" ? "bg-severity-high" : "bg-slate-500")} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">{rec.title}</p>
                    {rec.description && <p className="mt-1 text-xs text-slate-400">{rec.description}</p>}
                    {rec.assignee && <p className="mt-1 text-[11px] text-slate-500">Assigned to: {rec.assignee}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    {["resolved", "accepted", "rejected"].includes(rec.status) ? null : (
                      <>
                        <button className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => { void updateAdvisorRecommendation(rec.id, { status: "resolved" }); reloadRecs(); toast("success", "Resolved", "Recommendation marked resolved."); }}>Resolve</button>
                        <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => { void updateAdvisorRecommendation(rec.id, { status: "accepted" }); reloadRecs(); }}>Accept</button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === "reports" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2">
          <div className="flex gap-2 mb-4">
            <button className="btn-primary" onClick={async () => {
              await generateAdvisorReport({ report_type: "posture", include_threat_model: true, format: "markdown" });
              toast("success", "Report queued", "Advisor report generation started.");
              reloadRpts();
            }}>
              <FileText size={14} /> Generate report
            </button>
          </div>
          {rptl ? <Spinner /> : reports.length === 0 ? (
            <EmptyState icon={<FileText size={32} />} title="No reports" body="Generate a posture report to see recommendations and scores." />
          ) : reports.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="!p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{r.title}</p>
                    <p className="text-xs text-slate-500">{r.report_type} &middot; {timeAgo(r.created_at || "")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "draft" && (
                      <button className="btn-secondary !px-3 !py-1 !text-xs" onClick={() => { void publishAdvisorReport(r.id); reloadRpts(); toast("success", "Published", "Report published."); }}>
                        Publish
                      </button>
                    )}
                    <button className="btn-ghost !px-2 !py-1 !text-xs text-severity-critical" onClick={() => { void deleteAdvisorReport(r.id); reloadRpts(); }}>
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}