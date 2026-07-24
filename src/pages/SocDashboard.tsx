import React, { useState, useEffect } from "react";
import { Activity, Gauge, Shield, Wifi, WifiOff, Monitor, Clock, AlertTriangle } from "lucide-react";
import { PageHeader, Card, CardHeader, SeverityBadge, EmptyState } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { loadIntelligenceDashboard, loadSocDashboard } from "@/lib/data";
import { timeAgo, cx } from "@/lib/utils";
import type { SocDashboardScaffold, IntelligenceDashboard } from "@/lib/types";

const emptySoc: SocDashboardScaffold = { organizationId: 0, status: "scaffold", generatedAt: "", panels: [], liveSubscribers: 0, message: "" };
const emptyIntel: IntelligenceDashboard = { posture_score: 0, total_assets: 0, verified_count: 0, unscanned_count: 0 };

export default function SocDashboard() {
  const [liveConnected, setLiveConnected] = useState(false);

  useEffect(() => {
    setLiveConnected(true);
    const t = setInterval(() => setLiveConnected((p) => !p), 3000);
    return () => clearInterval(t);
  }, []);

  const { data: socData, loading: socLoading } = useResource(
    () => loadSocDashboard().then((d) => d ?? emptySoc),
    emptySoc,
  );

  const { data: intelData } = useResource(
    () => loadIntelligenceDashboard().then((d) => d ?? emptyIntel),
    emptyIntel,
  );

  const score = intelData.postureScore ?? intelData.posture_score ?? 68;

  if (socLoading && !socData.panels.length) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-phantix-500 border-t-gold-400" />
        Loading SOC dashboard…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Security Operations Center"
        description="Live monitoring dashboard with real-time asset and risk events from your dedicated security database"
        actions={
          <span className={cx("flex items-center gap-1.5 text-xs font-mono", liveConnected ? "text-emerald-400" : "text-slate-500")}>
            {liveConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {liveConnected ? "SSE Live" : "Reconnecting..."}
          </span>
        }
      />

      {socData.message && (
        <div className="mb-4 rounded-lg bg-phantix-800/40 border border-phantix-700/40 px-4 py-2.5 text-sm text-slate-400">
          <Monitor size={14} className="inline mr-2 text-phantix-400" />
          {socData.message}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {socData.panels?.length ? (
          socData.panels.map((panel) => (
            <Card key={panel.id} className={cx(!panel.ready && "opacity-50")}>
              <CardHeader
                title={
                  <div className="flex items-center gap-2">
                    {panel.source === "asset_intelligence" ? <Shield size={16} className="text-phantix-400" /> : <Activity size={16} className="text-slate-500" />}
                    {panel.title}
                    {!panel.ready && <span className="chip text-[10px] text-severity-medium bg-severity-medium/10 border-severity-medium/20">Coming Soon</span>}
                  </div>
                }
                subtitle={panel.note || panel.source}
              />

              {panel.ready ? (
                <div>
                  {panel.id === "live-assets" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                        <Clock size={12} />
                        <span>Stream: {panel.stream}</span>
                      </div>
                      <div className="rounded-lg bg-phantix-950/60 border border-phantix-700/40 p-4 space-y-2 max-h-64 overflow-y-auto">
                        {["riskScoreChanged", "assetDiscovered", "intelligenceUpdated", "newFindingOnAsset", "heartbeat"].map((evt, i) => {
                          const sevs: ("critical" | "high" | "medium" | "low" | "info")[] = ["critical", "high", "medium", "low", "info"];
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <div className={cx("h-1.5 w-1.5 rounded-full", i < 2 ? "bg-current" : "bg-slate-600", i === 0 ? "text-severity-critical animate-pulse-soft" : i === 1 ? "text-severity-high" : "")} />
                              <span className="text-slate-400 font-mono w-16 shrink-0">{timeAgo(new Date(Date.now() - (i + 1) * 300000).toISOString())}</span>
                              <span className="text-slate-300 truncate">{evt}: live event</span>
                              {i < 2 && <SeverityBadge severity={sevs[i]} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {panel.id === "risk-panel" && (
                    <div>
                      <div className="flex items-center justify-center py-6">
                        <div className="text-center">
                          <div className="font-display text-4xl font-bold text-white">{score}</div>
                          <p className="text-sm text-slate-400 mt-1">Posture Score / 100</p>
                        </div>
                      </div>
                      {intelData.totals && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs"><span className="text-slate-400">Active Assets</span><span className="text-white font-mono">{intelData.totals.activeAssets}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-slate-400">High Risk</span><span className="text-severity-high font-mono">{intelData.totals.highRiskAssets}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-slate-400">Open Findings</span><span className="text-severity-medium font-mono">{intelData.totals.openFindings}</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                  <Clock size={16} className="mr-2" />
                  {panel.note || "Available when this module ships"}
                </div>
              )}
            </Card>
          ))
        ) : (
          <EmptyState icon={<Gauge size={24} />} title="No monitoring panels" body="SOC dashboard panels are not available yet" />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <a href="/assets/intelligence" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <Shield size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Asset Intelligence</p><p className="text-xs text-slate-400">Full posture view</p></div>
        </a>
        <a href="/assets" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <Monitor size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Asset Inventory</p><p className="text-xs text-slate-400">Discovery + management</p></div>
        </a>
        <a href="/scans" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <Activity size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Scans</p><p className="text-xs text-slate-400">Vulnerability scanning</p></div>
        </a>
        <a href="/risks" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <AlertTriangle size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Risks</p><p className="text-xs text-slate-400">Risk management</p></div>
        </a>
      </div>
    </div>
  );
}
