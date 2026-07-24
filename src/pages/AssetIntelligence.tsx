import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, AlertTriangle, Search, Activity, RefreshCw, ArrowRight, Globe, Server, Sparkles, Wifi, WifiOff } from "lucide-react";
import { PageHeader, Card, CardHeader, StatCard, AnimatedNumber, SeverityBadge, RiskBadge, ProgressRing, TableSkeleton, EmptyState } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { loadIntelligenceDashboard, refreshIntelligence, requestAiSummary } from "@/lib/data";
import { useStore } from "@/lib/store";
import { timeAgo, cx } from "@/lib/utils";
import type { IntelligenceDashboard } from "@/lib/types";

const emptyIntel: IntelligenceDashboard = { posture_score: 0, total_assets: 0, verified_count: 0, unscanned_count: 0 };

export default function AssetIntelligenceDashboard() {
  const { toast, requireDualControl } = useStore();
  const [liveConnected, setLiveConnected] = useState(false);
  const [aiLoading, setAiLoading] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState<{ postureSummary: string; whyPrioritized: string; summarySource: string } | null>(null);

  useEffect(() => {
    setLiveConnected(true);
    const t = setInterval(() => setLiveConnected((p) => !p), 3000);
    return () => clearInterval(t);
  }, []);

  const { data: intelData, loading, reload } = useResource(
    () => loadIntelligenceDashboard().then((d) => d ?? emptyIntel),
    emptyIntel,
  );

  const score = intelData.postureScore ?? intelData.posture_score ?? 68;

  const handleRefreshIntel = async () => {
    if (!(await requireDualControl("Refreshing asset intelligence requires a dual-control operate session."))) return;
    try {
      const res = await refreshIntelligence();
      toast("success", "Intelligence refresh started", `${res.updated} assets recomputed`);
      reload();
    } catch (e) {
      toast("error", "Refresh failed", e instanceof Error ? e.message : "");
    }
  };

  const handleAiExplain = async (assetId: number) => {
    if (!(await requireDualControl("Generating an AI summary requires a dual-control operate session."))) return;
    setAiLoading(assetId);
    setAiResult(null);
    try {
      const res = await requestAiSummary(assetId);
      setAiResult(res);
      toast("success", "AI summary ready");
    } catch (e) {
      toast("error", "AI summary failed", e instanceof Error ? e.message : "");
    } finally {
      setAiLoading(null);
    }
  };

  if (loading && !intelData.total_assets) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-phantix-500 border-t-gold-400" />
        Loading intelligence data…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Asset Intelligence"
        description="Security posture overview powered by automated enrichment, relationship mapping, and plain-language summaries"
        actions={
          <div className="flex items-center gap-2">
            <span className={cx("flex items-center gap-1.5 text-xs font-mono mr-1", liveConnected ? "text-emerald-400" : "text-slate-500")}>
              {liveConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {liveConnected ? "Live" : "Offline"}
            </span>
            <button onClick={handleRefreshIntel} className="btn-ghost text-sm px-3 py-1.5">
              <RefreshCw size={14} />
              Refresh Intel
            </button>
            <Link to="/assets" className="btn-secondary text-sm px-3 py-1.5">
              Asset Inventory <ArrowRight size={14} />
            </Link>
          </div>
        }
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Card className="lg:col-span-1 flex flex-col items-center justify-center py-6">
          <ProgressRing value={score} size={100} stroke={7} />
          <p className="text-xs text-slate-400 mt-3">Posture Score</p>
          <p className="text-[10px] text-slate-500 mt-0.5">higher = healthier</p>
        </Card>
        <StatCard label="Active Assets" value={<AnimatedNumber value={intelData.totals?.activeAssets ?? intelData.total_assets ?? 0} />} icon={<Globe size={18} />} />
        <StatCard label="High Risk" value={<AnimatedNumber value={intelData.totals?.highRiskAssets ?? 0} />} icon={<AlertTriangle size={18} />} accent="red" />
        <StatCard label="Never Scanned" value={<AnimatedNumber value={intelData.totals?.neverScanned ?? intelData.unscanned_count ?? 0} />} icon={<Search size={18} />} accent="blue" />
        <StatCard label="Open Findings" value={<AnimatedNumber value={intelData.totals?.openFindings ?? 0} />} icon={<Activity size={18} />} />
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Critical Assets */}
        <Card>
          <CardHeader
            title="Critical Assets at Risk"
            subtitle="Top priority assets requiring immediate attention"
            action={
              <Link to="/assets" className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1">
                View All <ArrowRight size={12} />
              </Link>
            }
          />
          {(() => {
            const criticalList = (intelData.criticalAssetsAtRisk as any[])
              ?? (intelData.critical_assets_at_risk as any[])?.map((a: any) => ({
                id: a.id,
                value: a.value ?? a.name ?? "",
                assetType: a.assetType ?? "asset",
                riskLevel: a.riskLevel,
                openFindings: a.openFindingsCount ?? a.open_findings ?? 0,
                priorityScore: a.priorityScore ?? 0,
                exposureLevel: a.exposureLevel ?? "",
                isVerified: a.isVerified ?? false,
              })) ?? [];
            return criticalList.length > 0 ? (
              <div className="space-y-2">
                {criticalList.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg bg-phantix-800/40 border border-phantix-700/30 px-3 py-3">
                    <RiskBadge level={a.riskLevel || "medium"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{a.value || `#${a.id}`}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span>{a.assetType}</span><span>•</span><span>{a.exposureLevel}</span>
                        {a.isVerified && <span className="text-emerald-400">• Verified</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono text-severity-high">{a.openFindings} findings</p>
                      <p className="text-xs text-slate-500">Priority {a.priorityScore}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Shield size={24} />} title="All clear" body="No critical assets at risk" />
            );
          })()}
        </Card>

        {/* Newly Discovered */}
        <Card>
          <CardHeader
            title="Newly Discovered — Not Scanned"
            subtitle="Assets found but not yet scanned"
            action={
              <Link to="/assets" className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1">
                Discovery <Search size={12} />
              </Link>
            }
          />
          {(() => {
            const newList = (intelData.newlyDiscoveredUnscanned as any[])
              ?? (intelData.newly_discovered as any[])?.map((a: any) => ({
                id: a.id,
                value: a.value ?? a.name ?? "",
                assetType: a.assetType ?? a.asset_type ?? "",
                firstSeenAt: a.firstSeenAt ?? null,
                isVerified: a.isVerified ?? false,
                source: a.source ?? null,
              })) ?? [];
            return newList.length > 0 ? (
              <div className="space-y-2">
                {newList.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg bg-phantix-800/40 border border-phantix-700/30 px-3 py-3">
                    <div className="h-2 w-2 rounded-full bg-severity-medium animate-pulse-soft" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{a.value || `#${a.id}`}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs">
                        <span className="text-slate-500">{a.assetType}</span>
                        {a.source && <span className="text-phantix-400">via {a.source}</span>}
                        {a.firstSeenAt && <span className="text-slate-500">• {timeAgo(a.firstSeenAt)}</span>}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {a.isVerified ? (
                        <span className="chip text-xs text-emerald-400 bg-emerald-400/10 border-emerald-400/30">Verified</span>
                      ) : (
                        <span className="chip text-xs text-severity-medium bg-severity-medium/10 border-severity-medium/30">Unverified</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Search size={24} />} title="Nothing new" body="All discovered assets have been scanned" />
            );
          })()}
        </Card>
      </div>

      {aiResult && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card>
            <CardHeader
              title={<><Sparkles size={16} className="inline text-gold-400 mr-1" /> AI Posture Summary</>}
              subtitle={aiResult.summarySource === "ai" ? "Generated from known data only — never invents CVEs or scores" : "Deterministic summary"}
            />
            <div className="space-y-3">
              <div className="rounded-lg bg-phantix-950/60 border border-phantix-700/40 p-4">
                <p className="text-sm text-slate-300 leading-relaxed">{aiResult.postureSummary}</p>
              </div>
              {aiResult.whyPrioritized && (
                <div className="rounded-lg bg-gold-400/5 border border-gold-400/20 p-3">
                  <p className="text-xs font-semibold text-gold-400 mb-1">Why Prioritized</p>
                  <p className="text-sm text-slate-300">{aiResult.whyPrioritized}</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* AI Explain CTA */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader
            title={<><Sparkles size={16} className="inline text-gold-400 mr-1" /> Explain with AI</>}
            subtitle="Let Phantix AI rephrase known facts about your top at-risk asset into plain language. Never invents CVEs or scores."
          />
          <div className="space-y-2">
            {(() => {
              const topAsset = (intelData.criticalAssetsAtRisk ?? [])[0];
              return topAsset ? (
                <div>
                  <p className="text-xs text-slate-400 mb-3">
                    Top asset: <span className="text-slate-200">{(topAsset as any).value ?? (topAsset as any).name ?? `#${topAsset.id}`}</span>
                  </p>
                  <button
                    onClick={() => handleAiExplain(topAsset.id)}
                    disabled={aiLoading === topAsset.id}
                    className="btn-secondary w-full text-sm"
                  >
                    {aiLoading === topAsset.id ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {aiLoading === topAsset.id ? "Generating..." : "Explain this asset"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No critical assets to analyze</p>
              );
            })()}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Relationship Graph"
            subtitle="Visualize domain, IP, port, and database connections across your attack surface"
          />
          <p className="text-xs text-slate-500 mb-3">Open the relationship graph to explore asset connections</p>
          <button onClick={() => window.location.href = "/assets/intelligence/graph"} className="btn-secondary w-full text-sm" disabled>
            <Activity size={14} /> Open Graph View (coming soon)
          </button>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/assets" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <Server size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Asset Inventory</p><p className="text-xs text-slate-400">Manage all assets</p></div>
        </Link>
        <Link to="/soc" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <Activity size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">SOC Monitor</p><p className="text-xs text-slate-400">Live monitoring</p></div>
        </Link>
        <Link to="/scans" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <Search size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Scans</p><p className="text-xs text-slate-400">Run scans</p></div>
        </Link>
        <Link to="/risks" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <AlertTriangle size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Risk Register</p><p className="text-xs text-slate-400">Risk management</p></div>
        </Link>
      </div>
    </div>
  );
}
