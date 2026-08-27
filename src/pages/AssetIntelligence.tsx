import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Shield, AlertTriangle, Search, Activity, RefreshCw, ArrowRight, Globe, Server, Sparkles,
  Wifi, WifiOff, Radio, Network, ChevronDown, Crosshair, ShieldAlert, Tags as TagsIcon,
  Clock, CheckCircle2, CircleDot, GitBranch, ListChecks,
} from "lucide-react";
import { PageHeader, Card, CardHeader, StatCard, AnimatedNumber, SeverityBadge, RiskBadge, ProgressRing, TableSkeleton, EmptyState } from "@/components/ui";
import AssetForceGraph from "@/components/AssetForceGraph";
import { useResource } from "@/lib/useResource";
import { loadAssetsBundle, loadIntelligenceDashboard, loadRelationshipGraph, refreshIntelligence } from "@/lib/data";
import { generateComprehensiveExplanation, type ComprehensiveExplanation } from "@/lib/aiExplain";
import { buildAssetGraph } from "@/lib/assetGraphData";
import { useStore } from "@/lib/store";
import { timeAgo, cx, titleCase } from "@/lib/utils";
import { useSseStream, type SseEvent } from "@/lib/useSse";
import type { IntelligenceDashboard, RealtimeEvent } from "@/lib/types";

const emptyIntel: IntelligenceDashboard = { posture_score: 0, total_assets: 0, verified_count: 0, unscanned_count: 0 };

function criticalityDot(crit: string | null | undefined): string {
  switch (String(crit ?? "").toLowerCase()) {
    case "critical": return "bg-severity-critical";
    case "high": return "bg-severity-high";
    case "medium": return "bg-severity-medium";
    case "low": return "bg-severity-low";
    default: return "bg-slate-600";
  }
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/40 p-3.5">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

export default function AssetIntelligenceDashboard() {
  const { toast, requireDualControl } = useStore();

  // -- Explain-with-AI state ----------------------------------------------------
  const [explainTargetId, setExplainTargetId] = useState<number | null>(null);
  const [explainQuery, setExplainQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [explainStage, setExplainStage] = useState<"gather" | "ai" | null>(null);
  const [explanation, setExplanation] = useState<ComprehensiveExplanation | null>(null);
  const deepDiveRef = useRef<HTMLDivElement>(null);

  // Bring the freshly generated deep-dive into view instead of letting reflow land mid-card
  useEffect(() => {
    if (explanation) deepDiveRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [explanation]);

  const { data: intelData, loading, reload, setData } = useResource(
    () => loadIntelligenceDashboard().then((d) => d ?? emptyIntel),
    emptyIntel,
  );

  const { data: assetsBundle } = useResource(loadAssetsBundle, {
    assets: [], assetTags: [], discoveryJobs: [], securityDbBlocked: false, error: null as string | null,
  }, "assets");
  const { data: relations } = useResource(loadRelationshipGraph, null);

  const inlineGraph = useMemo(
    () =>
      buildAssetGraph(assetsBundle.assets ?? [], assetsBundle.assetTags ?? [], {
        groupByType: true,
        relations: relations?.nodes?.length ? relations : null,
      }),
    [assetsBundle.assets, assetsBundle.assetTags, relations],
  );

  const { connected: liveConnected, events: liveEvents } = useSseStream("/assets/intelligence/stream", {
    onEvent: useCallback((evt: SseEvent) => {
      const payload = (evt.data && typeof evt.data === "object" ? evt.data : {}) as Partial<RealtimeEvent["payload"]>;
      const assetId = payload.assetId;
      const assetType = payload.assetType;
      if (assetId && (assetType || payload.value)) {
        setData((prev) => {
          const p = { ...prev };
          const critical = [...((p.criticalAssetsAtRisk ?? p.critical_assets_at_risk ?? []) as any[])];
          const idx = critical.findIndex((a) => a.id === assetId);
          if (idx >= 0 && typeof payload.riskLevel === "string") {
            critical[idx] = { ...critical[idx], riskLevel: payload.riskLevel, riskScore: payload.riskScore ?? critical[idx].riskScore };
          }
          if (evt.event === "assetDiscovered") {
            const fresh = [...((p.newlyDiscoveredUnscanned ?? p.newly_discovered ?? []) as any[])];
            if (!fresh.some((a) => a.id === assetId)) {
              fresh.unshift({ id: assetId, value: payload.value ?? null, assetType: assetType ?? null, firstSeenAt: payload.ts ?? null, isVerified: payload.isVerified ?? null, source: payload.source ?? null });
              p.newlyDiscoveredUnscanned = fresh;
              p.newly_discovered = fresh;
            }
          }
          if (critical.length) {
            p.criticalAssetsAtRisk = critical;
            p.critical_assets_at_risk = critical;
          }
          return p;
        });
      }
    }, [setData]),
  });

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

  const allAssets = useMemo(() => [...(assetsBundle.assets ?? [])].sort((a, b) => String(a.value).localeCompare(String(b.value))), [assetsBundle.assets]);
  const explainTarget = allAssets.find((a) => a.id === explainTargetId) ?? null;
  const pickerMatches = useMemo(() => {
    const q = explainQuery.trim().toLowerCase();
    const base = q
      ? allAssets.filter((a) => `${a.value} ${a.name} ${a.asset_type}`.toLowerCase().includes(q))
      : allAssets;
    return base.slice(0, 60);
  }, [allAssets, explainQuery]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPickerOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-asset-picker]")) setPickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [pickerOpen]);

  const handleAiExplain = async () => {
    if (!explainTarget || explainStage) return;
    if (!(await requireDualControl("Generating an AI deep-dive requires a dual-control operate session."))) return;
    setExplanation(null);
    try {
      setExplainStage("gather");
      const res = await generateComprehensiveExplanation(explainTarget, assetsBundle.assetTags);
      setExplainStage("ai");
      await new Promise((r) => setTimeout(r, 450)); // brief beat so both stages are legible
      setExplanation(res);
      toast(
        "success",
        res.source === "ai" ? "AI deep-dive ready" : "Deep-dive composed",
        `${res.brief.recordCount} engine records analyzed for ${res.brief.assetLabel}`,
      );
    } catch (e) {
      toast("error", "AI explanation failed", e instanceof Error ? e.message : "");
    } finally {
      setExplainStage(null);
    }
  };

  if (loading && !intelData.total_assets) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-phantix-500 border-t-gold-400" />
        Loading intelligence data...
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
            title="Newly Discovered --- Not Scanned"
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

      {/* Live event feed */}
      <Card className="mb-6">
        <CardHeader
          title={<><Radio size={16} className="inline text-gold-400 mr-1" /> Live Event Feed</>}
          subtitle={liveConnected ? "Streaming from your security database via SSE" : "Reconnecting to event stream..."}
          action={
            liveEvents.length > 0 ? (
              <span className="text-xs text-slate-500">{liveEvents.length} recent events</span>
            ) : undefined
          }
        />
        {liveEvents.length > 0 ? (
          <div className="space-y-1.5 max-h-64 overflow-y-auto px-5 pb-5">
            {liveEvents.slice(-12).reverse().map((evt, i) => {
              const payload = (evt.data && typeof evt.data === "object" ? evt.data : {}) as Partial<RealtimeEvent["payload"]>;
              const label =
                evt.event === "riskScoreChanged"
                  ? `Risk changed on ${String(payload.value ?? `#${payload.assetId}`)}`
                  : evt.event === "assetDiscovered"
                    ? `New asset ${String(payload.value ?? `#${payload.assetId}`)}`
                    : evt.event === "newFindingOnAsset"
                      ? `New finding on ${String(payload.value ?? `#${payload.assetId}`)}`
                      : evt.event === "assetUpdated" || evt.event === "intelligenceUpdated"
                        ? `Intel updated for ${String(payload.value ?? `#${payload.assetId}`)}`
                        : evt.event === "heartbeat"
                          ? "Heartbeat"
                          : `${evt.event} event`;
              const isRisk = evt.event === "riskScoreChanged";
              return (
                <div key={`${evt.ts}-${i}`} className="flex items-center gap-2 text-xs">
                  <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", isRisk ? "bg-severity-high animate-pulse-soft" : evt.event === "heartbeat" ? "bg-slate-700" : "bg-emerald-400")} />
                  <span className="text-slate-400 font-mono w-14 shrink-0">{timeAgo(evt.ts)}</span>
                  <span className="text-slate-300 truncate">{label}</span>
                  {isRisk && (payload.previousRiskLevel || payload.riskLevel) && (
                    <span className="ml-auto text-[10px] text-slate-500">
                      {String(payload.previousRiskLevel ?? "?")} <span className="mx-0.5">→</span> {String(payload.riskLevel ?? "?")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 pb-5 text-xs text-slate-500">
            {liveConnected ? "Connected --- waiting for events..." : "Offline --- live updates will resume on reconnect."}
          </div>
        )}
      </Card>

      {/* Relational graph view */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <Card>
          <CardHeader
            title={<><Network size={16} className="inline text-gold-400 mr-1" /> Relationship Graph</>}
            subtitle="Obsidian-style force map — assets clustered by tags and asset types, connected to real engine relationships"
            action={
              <Link to="/assets/intelligence/graph" className="text-xs font-semibold text-gold-400 hover:text-gold-300 flex items-center gap-1">
                Open full view <ArrowRight size={12} />
              </Link>
            }
          />
          {inlineGraph.nodes.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">Add assets and tags in the inventory to populate the graph.</p>
          ) : (
            <div className="h-[420px] overflow-hidden rounded-xl border border-phantix-800/40 bg-phantix-950/60">
              <AssetForceGraph model={inlineGraph} />
            </div>
          )}
          <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-600">
            {inlineGraph.counts.assets} assets · {inlineGraph.counts.tags} tags · {inlineGraph.counts.types} type clusters · scroll to zoom, drag nodes to rearrange
          </p>
        </Card>
      </motion.div>

      {/* AI Explain CTA — pick any asset from inventory */}
      <Card>
        <CardHeader
          title={<><Sparkles size={16} className="inline text-gold-400 mr-1" /> Explain with AI</>}
          subtitle="Pick any asset — Phantix gathers its intelligence, findings, risks, SOC signals and relationships into one comprehensive deep-dive. Never invents CVEs or scores."
        />
        <div className="space-y-3">
          <div className="relative" data-asset-picker>
            <button
              type="button"
              onClick={() => { setPickerOpen((o) => !o); setExplainQuery(""); }}
              disabled={explainStage != null || allAssets.length === 0}
              className="input flex w-full items-center justify-between gap-2 text-left disabled:opacity-60"
            >
              {explainTarget ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cx("h-2 w-2 shrink-0 rounded-full", criticalityDot(explainTarget.criticality))} />
                  <span className="truncate font-mono text-sm text-slate-100">{explainTarget.value}</span>
                  <span className="shrink-0 text-xs text-slate-500">{explainTarget.asset_type.replace(/_/g, " ")}{explainTarget.is_verified ? " · verified" : ""}</span>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-sm text-slate-500">
                  <Search size={13} /> Select an asset to explain…
                </span>
              )}
              <ChevronDown size={14} className={cx("shrink-0 text-slate-500 transition-transform", pickerOpen && "rotate-180")} />
            </button>

            {pickerOpen && (
              <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-phantix-700/50 bg-phantix-900/95 shadow-card backdrop-blur-xl">
                <div className="border-b border-phantix-800/60 p-2">
                  <input
                    autoFocus
                    className="input !py-1.5 text-sm"
                    placeholder="Filter by value, name or type…"
                    value={explainQuery}
                    onChange={(e) => setExplainQuery(e.target.value)}
                  />
                </div>
                <div className="max-h-72 overflow-y-auto p-1.5">
                  {pickerMatches.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-slate-500">No assets match “{explainQuery}”</p>
                  ) : pickerMatches.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setExplainTargetId(a.id); setPickerOpen(false); }}
                      className={cx(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                        a.id === explainTargetId ? "bg-phantix-800 text-gold-200" : "hover:bg-phantix-800/70",
                      )}
                    >
                      <span className={cx("h-2 w-2 shrink-0 rounded-full", criticalityDot(a.criticality))} title={`criticality: ${a.criticality ?? "unknown"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm text-slate-200">{a.value}</span>
                        <span className="block truncate text-[11px] text-slate-500">{a.name || a.asset_type.replace(/_/g, " ")} · {(a.tags ?? []).length} tag(s)</span>
                      </span>
                      {!a.is_verified && <span className="chip shrink-0 text-[9px] text-severity-medium bg-severity-medium/10 border-severity-medium/30">unverified</span>}
                    </button>
                  ))}
                </div>
                <p className="border-t border-phantix-800/60 px-3 py-1.5 text-[10px] text-slate-600">
                  {allAssets.length} asset(s) in inventory · sorted by value · Esc closes
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleAiExplain}
            disabled={!explainTarget || explainStage != null}
            className="btn-secondary w-full text-sm disabled:opacity-50"
          >
            {explainStage === "gather" ? (
              <><RefreshCw size={14} className="animate-spin" /> Gathering intelligence, findings, risks, SOC & graph data…</>
            ) : explainStage === "ai" ? (
              <><Sparkles size={14} className="animate-pulse-soft" /> Composing comprehensive explanation…</>
            ) : (
              <><Sparkles size={14} /> Generate deep-dive explanation</>
            )}
          </button>
          {explanation && (
            <p className="text-[11px] leading-4 text-slate-500">
              Built from the engines' own records for <span className="font-mono text-slate-400">{explanation.brief.assetLabel}</span> — regenerate after scans or intel refresh to see it evolve.
            </p>
          )}
          {allAssets.length === 0 && (
            <p className="text-xs text-slate-500">Inventory is empty — add assets on the <Link to="/assets" className="text-gold-400 hover:text-gold-300">Asset Inventory</Link> page first.</p>
          )}
        </div>
      </Card>


      {explanation && (
        <motion.div
          ref={deepDiveRef}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          layout="position"
          className="relative isolate mb-6"
        >
          <Card>
            <CardHeader
              title={<><Sparkles size={16} className="inline text-gold-400 mr-1" /> AI Deep-Dive — {explanation.brief.assetLabel}</>}
              subtitle={
                explanation.source === "ai"
                  ? "Model narrative woven with engine-gathered context — never invents CVEs or scores"
                  : "Composed deterministically from every engine record — never invents CVEs or scores"
              }
              action={
                <span className={cx("chip text-[10px]", explanation.source === "ai" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "text-slate-400")}>
                  {explanation.source === "ai" ? "model + data" : "engine data"} · {explanation.brief.recordCount} records
                </span>
              }
            />
            <div className="space-y-4">
              <div className="rounded-lg bg-phantix-950/60 border border-phantix-700/40 p-4 space-y-2.5">
                {explanation.postureSummary.split(/\n\n+/).map((para, i) => (
                  <p key={i} className={cx("leading-relaxed", i === 0 ? "text-sm text-slate-200" : "text-sm text-slate-400")}>{para}</p>
                ))}
              </div>
              {explanation.whyPrioritized && (
                <div className="rounded-lg bg-gold-400/5 border border-gold-400/20 p-3">
                  <p className="text-xs font-semibold text-gold-400 mb-1">Why Prioritized</p>
                  <p className="text-sm text-slate-300">{explanation.whyPrioritized}</p>
                </div>
              )}

              {/* Findings */}
              {explanation.brief.findings.length > 0 && (
                <Section title={`Findings (${explanation.brief.findings.length})`} icon={<Crosshair size={13} />}>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {explanation.brief.findings.slice(0, 8).map((f) => (
                      <div key={f.id} className="flex items-center gap-2 rounded-lg bg-phantix-900/40 border border-phantix-700/30 px-3 py-2">
                        <SeverityBadge severity={(f.severity as any) ?? "info"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-200">{f.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {f.tool}{f.createdAt ? ` · ${timeAgo(f.createdAt)}` : ""}
                            {f.confidence != null ? ` · ${Math.round(Number(f.confidence))}% confidence` : ""}
                          </p>
                        </div>
                        {["manually_verified", "auto_verified"].includes(f.verificationStatus)
                          ? <span className="chip shrink-0 text-[10px] text-emerald-400 bg-emerald-400/10 border-emerald-400/30"><CheckCircle2 size={10} /> verified</span>
                          : <span className="chip shrink-0 text-[10px] text-severity-medium bg-severity-medium/10 border-severity-medium/30">unverified</span>}
                      </div>
                    ))}
                    {explanation.brief.findings.length > 8 && (
                      <p className="pl-1 text-[11px] text-slate-500">+{explanation.brief.findings.length - 8} more in Scans</p>
                    )}
                  </div>
                </Section>
              )}

              {/* Risk register + SOC signals */}
              {(explanation.brief.risks.length > 0 || explanation.brief.detections.length > 0) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {explanation.brief.risks.length > 0 && (
                    <Section title={`Risk register (${explanation.brief.risks.length})`} icon={<ShieldAlert size={13} />}>
                      <div className="space-y-1.5">
                        {explanation.brief.risks.slice(0, 5).map((r) => (
                          <Link key={r.id} to={`/risks?id=${r.id}`} className="flex items-center gap-2 rounded-lg bg-phantix-900/40 border border-phantix-700/30 px-3 py-2 hover:border-phantix-500/50 transition-colors">
                            <RiskBadge level={r.level} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-slate-200">{r.title}</p>
                              <p className="text-[11px] text-slate-500">
                                {titleCase(r.status)}{r.priorityBand ? ` · ${r.priorityBand}` : ""}{r.treatmentStatus ? ` · ${titleCase(r.treatmentStatus)}` : ""}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </Section>
                  )}
                  {explanation.brief.detections.length > 0 && (
                    <Section title={`SOC signals (${explanation.brief.detections.length})`} icon={<Radio size={13} />}>
                      <div className="space-y-1.5">
                        {explanation.brief.detections.slice(0, 5).map((d) => (
                          <div key={d.id} className="rounded-lg bg-phantix-900/40 border border-phantix-700/30 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <SeverityBadge severity={(d.severity as any) ?? "info"} />
                              <p className="min-w-0 flex-1 truncate text-sm text-slate-200">{d.title}</p>
                              <span className="shrink-0 font-mono text-[11px] text-slate-500">×{d.occurrences}</span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {titleCase(d.status)}{d.priorityScore != null ? ` · priority ${d.priorityScore}` : ""}
                              {d.assignee ? ` · ${d.assignee}` : ""}
                              {d.lastSeenAt ? ` · seen ${timeAgo(d.lastSeenAt)}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </div>
              )}

              {/* Relationships + tags + threats + actions */}
              <div className="grid gap-3 md:grid-cols-2">
                <Section title={`Relationships (${explanation.brief.related.length})`} icon={<GitBranch size={13} />}>
                  {explanation.brief.related.length === 0 ? (
                    <p className="text-xs text-slate-500">No mapped neighbours — a scan or discovery job will build links.</p>
                  ) : (
                    <div className="space-y-1">
                      {explanation.brief.related.slice(0, 6).map((rel) => (
                        <div key={`${rel.id}-${rel.via}`} className="flex items-center gap-2 text-xs">
                          <CircleDot size={9} className={cx("shrink-0", rel.via === "intelligence" ? "text-phantix-400" : "text-gold-400")} />
                          <span className="truncate text-slate-300">{rel.value}</span>
                          <span className="ml-auto shrink-0 chip text-[9px]">{rel.via === "intelligence" ? titleCase(rel.assetType || "asset") : rel.via.replace(/_/g, " ")}</span>
                        </div>
                      ))}
                      {explanation.brief.related.length > 6 && <p className="pl-4 text-[11px] text-slate-500">+{explanation.brief.related.length - 6} more</p>}
                    </div>
                  )}
                </Section>

                <Section title="Grouping & threats" icon={<TagsIcon size={13} />}>
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {explanation.brief.tags.length === 0
                        ? <span className="text-xs text-slate-500">No tags assigned</span>
                        : explanation.brief.tags.map((t) => (
                            <span key={t.name} className="chip text-[10px]" style={{ color: t.color || undefined, borderColor: `${t.color}55`, background: `${t.color}14` }}>
                              {t.name}
                            </span>
                          ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {explanation.brief.activeThreats.length === 0
                        ? <span className="text-xs text-slate-500">No active threat mapping</span>
                        : explanation.brief.activeThreats.map((t) => <span key={t} className="chip text-[10px] text-severity-high bg-severity-high/10 border-severity-high/30">{t}</span>)}
                    </div>
                    {explanation.brief.criticality && (
                      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Clock size={11} /> criticality <span className="capitalize text-slate-300">{explanation.brief.criticality}</span> · env <span className="capitalize text-slate-300">{explanation.brief.environment ?? "—"}</span>
                      </p>
                    )}
                  </div>
                </Section>
              </div>

              {explanation.brief.recommendedActions.length > 0 && (
                <Section title="Recommended actions" icon={<ListChecks size={13} />}>
                  <div className="space-y-1.5">
                    {explanation.brief.recommendedActions.map((a) => (
                      <div key={a.label} className="flex items-start gap-2.5 rounded-lg bg-phantix-900/40 border border-phantix-700/30 px-3 py-2">
                        <span className={cx("chip shrink-0 mt-0.5 text-[9px] uppercase", a.priority === "high" ? "text-severity-high bg-severity-high/10 border-severity-high/30" : a.priority === "medium" ? "text-severity-medium bg-severity-medium/10 border-severity-medium/30" : "text-slate-400")}>{a.priority}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200">{a.label}</p>
                          <p className="text-[11px] text-slate-500">{a.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </Card>
        </motion.div>
      )}

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
