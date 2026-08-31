import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Network, Search, Tag, Boxes, Link2, ExternalLink,
} from "lucide-react";
import AssetForceGraph from "@/components/AssetForceGraph";
import { Card, CardHeader, PageHeader, RiskBadge, Spinner, EmptyState } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import { loadAssetsBundle, loadRelationshipGraph } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { cx, titleCase, timeAgo } from "@/lib/utils";
import { RISK_COLORS, buildAssetGraph } from "@/lib/assetGraphData";
import type { AssetGraphNode, GraphNodeKind } from "@/lib/assetGraphData";

const RISK_FILTERS = ["all", "critical", "high", "medium", "low"] as const;

function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#F43F5E" }} /> critical</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#FB923C" }} /> high</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#FACC15" }} /> medium</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#38BDF8" }} /> low</span>
      <span className="mx-1 h-3 w-px bg-phantix-700" />
      <span>big rings = tags · double-ring = asset types · drag, zoom &amp; rearrange freely</span>
    </div>
  );
}

export default function AssetGraph() {
  const bundle = useResource(loadAssetsBundle, {
    assets: [], assetTags: [], discoveryJobs: [],
    securityDbBlocked: false, error: null as string | null,
  }, "assets");
  const relations = useResource(loadRelationshipGraph, null);

  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<(typeof RISK_FILTERS)[number]>("all");
  const [showTags, setShowTags] = useState(true);
  const [showTypes, setShowTypes] = useState(true);
  const [selected, setSelected] = useState<AssetGraphNode | null>(null);

  const filteredAssets = useMemo(
    () =>
      (bundle.data.assets ?? []).filter((a) => {
        if (riskFilter === "all") return true;
        const lvl = String((a as any).risk_level ?? "").toLowerCase();
        const crit = String(a.criticality ?? "").toLowerCase();
        if (lvl) return lvl === riskFilter;
        if (crit && ["critical", "high", "medium", "low"].includes(crit)) return crit === riskFilter;
        return riskFilter === "medium" || riskFilter === "low";
      }),
    [bundle.data.assets, riskFilter],
  );

  const model = useMemo(
    () =>
      buildAssetGraph(filteredAssets, bundle.data.assetTags ?? [], {
        groupByType: showTypes,
        relations:
          relations.data?.nodes?.length
            ? relations.data
            : null,
      }),
    [filteredAssets, bundle.data.assetTags, showTypes, relations.data],
  );

  // Drop tag nodes entirely when the toggle is off (types handled in builder).
  const prunedModel = useMemo(() => {
    if (showTags) return model;
    const drop = new Set(model.nodes.filter((n) => n.kind === "tag").map((n) => n.id));
    return {
      ...model,
      nodes: model.nodes.filter((n) => !drop.has(n.id)),
      edges: model.edges.filter((e) => !drop.has(e.source) && !drop.has(e.target)),
    };
  }, [model, showTags]);

  const neighborInfo = useMemo(() => {
    if (!selected) return null;
    let edgesIn = 0;
    for (const e of prunedModel.edges) {
      if (e.source === selected.id || e.target === selected.id) edgesIn += 1;
    }
    return { edgesIn };
  }, [selected, prunedModel.edges]);

  const loading = bundle.loading && !(bundle.data.assets ?? []).length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Asset Relationship Graph"
        description="Force-directed map of your attack surface — grouped by tags and asset types, like a vault of linked notes"
        actions={
          <Link to="/assets/intelligence" className="btn-secondary text-sm px-3 py-1.5">
            <ArrowLeft size={14} /> Intelligence
          </Link>
        }
      />

      {bundle.data.securityDbBlocked && <SecurityDbBanner message={bundle.data.error} />}

      {/* Controls */}
      <Card className="!p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input !pl-9 py-2 text-sm w-60"
              placeholder="Highlight assets or tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-1">
            {RISK_FILTERS.map((r) => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={cx(
                  "rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  riskFilter === r ? "bg-phantix-700/70 text-white" : "text-slate-400 hover:text-slate-200",
                )}
              >
                {r !== "all" && (
                  <span
                    className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                    style={{ background: RISK_COLORS[r] }}
                  />
                )}
                {titleCase(r)}
              </button>
            ))}
          </div>
          <label className={cx("chip cursor-pointer select-none text-xs", showTags ? "border-gold-400/40 bg-gold-400/10 text-gold-300" : "text-slate-500")}>
            <input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} className="sr-only" />
            <Tag size={11} /> Tags
          </label>
          <label className={cx("chip cursor-pointer select-none text-xs", showTypes ? "border-gold-400/40 bg-gold-400/10 text-gold-300" : "text-slate-500")}>
            <input type="checkbox" checked={showTypes} onChange={(e) => setShowTypes(e.target.checked)} className="sr-only" />
            <Boxes size={11} /> Asset types
          </label>
          <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-slate-500">
            <span>{prunedModel.counts.assets} assets</span>
            <span>·</span>
            <span>{prunedModel.counts.tags} tags</span>
            <span>·</span>
            <span>{prunedModel.counts.types} types</span>
            <span>·</span>
            <span>{prunedModel.edges.length} links</span>
            {(relations.data?.edgeCount ?? 0) > 0 && (
              <>
                <span>·</span>
                <span className="text-emerald-400">{relations.data!.edgeCount} engine relations</span>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <Card className="lg:col-span-8 min-w-0">
          <CardHeader
            title={<><Network size={15} className="inline mr-1.5 text-gold-400" />Force graph</>}
            subtitle="Hover to isolate neighbourhoods · click for details · double-click canvas to refit"
          />
          {loading ? (
            <div className="relative flex h-[62vh] min-h-[420px] items-center justify-center overflow-hidden">
              {/* Graph-shaped optimistic skeleton: scattered node blobs + edge stubs */}
              <div className="absolute inset-0 opacity-40" aria-hidden>
                {[
                  [14, 22, 34], [30, 12, 22], [52, 8, 44], [72, 16, 24], [86, 32, 30],
                  [10, 58, 26], [28, 46, 38], [50, 40, 22], [68, 56, 34], [84, 68, 24],
                  [20, 82, 30], [45, 74, 26], [62, 86, 36], [80, 46, 20],
                ].map(([x, y, s], i) => (
                  <span
                    key={i}
                    className="skeleton absolute rounded-full"
                    style={{ left: `${x}%`, top: `${y}%`, width: s, height: s }}
                  />
                ))}
                {[
                  [24, 28, 45, 30], [42, 25, 57, 20], [64, 32, 76, 28], [8, 34, 20, 50],
                  [30, 60, 46, 54], [58, 52, 72, 64], [16, 68, 32, 76], [50, 84, 64, 88],
                ].map(([x1, y1, x2, y2], i) => (
                  <span
                    key={`e${i}`}
                    className="skeleton absolute"
                    style={{
                      left: `${x1}%`, top: `${y1}%`, width: `${Math.max(2, Math.abs(x2 - x1))}%`,
                      height: 3, transform: `rotate(${Math.atan2((y2 as number) - (y1 as number), (x2 as number) - (x1 as number))}rad)`,
                      transformOrigin: "left center",
                    }}
                  />
                ))}
              </div>
              <div className="relative z-10 rounded-xl border border-phantix-700/40 bg-phantix-950/70 px-4 py-3 text-center">
                <Spinner className="mx-auto h-5 w-5" />
                <p className="mt-2 text-xs text-slate-400">Mapping your attack surface…</p>
              </div>
            </div>
          ) : prunedModel.nodes.length === 0 ? (
            <EmptyState
              icon={<Network size={24} />}
              title="Nothing to map yet"
              body="Add assets in the inventory — discovered tags and asset types become groups here automatically."
              action={
                <Link to="/assets" className="btn-primary text-sm">
                  Open inventory
                </Link>
              }
            />
          ) : (
            <div className="h-[62vh] min-h-[420px] overflow-hidden rounded-xl border border-phantix-800/40 bg-phantix-950/50">
              <AssetForceGraph
                model={prunedModel}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
                query={query}
              />
            </div>
          )}
          <div className="mt-3">
            <GraphLegend />
          </div>
        </Card>

        {/* Selection inspector */}
        <Card className="lg:col-span-4 min-w-0 lg:sticky lg:top-4">
          <CardHeader
            title={selected ? "Node details" : "Inspector"}
            subtitle={selected ? undefined : "Select any node in the graph"}
          />
          {!selected ? (
            <p className="py-6 text-center text-xs text-slate-500">
              Drag nodes to reshape clusters. Scroll to zoom, drag empty space to pan.
            </p>
          ) : selected.kind === "asset" ? (
            (() => {
              const meta = (selected.meta ?? {}) as Record<string, unknown>;
              const assetId = Number(selected.assetId ?? 0);
              return (
                <div className="space-y-3">
                  <div>
                    <RiskBadge level={String(meta.riskLevel ?? "") || "unknown"} />
                    <p className="mt-2 break-all font-display text-lg font-semibold text-white">{selected.label}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Type", String(meta.assetType ?? "—")],
                      ["Open findings", String(meta.openFindings ?? 0)],
                      ["Environment", String(meta.environment ?? "—")],
                      ["Verified", meta.isVerified ? "yes" : "no"],
                      ["Risk score", meta.riskScore != null ? String(meta.riskScore) : "—"],
                      ["Last seen", timeAgo(String(meta.lastSeenAt ?? ""))],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-phantix-700/40 bg-phantix-950/50 px-2.5 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                        <p className="mt-0.5 truncate text-slate-200">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-phantix-900/50 px-3 py-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><Link2 size={12} /> {neighborInfo?.edgesIn ?? 0} connections</span>
                  </div>
                  <Link to={`/assets?id=${assetId}`} className="btn-secondary w-full text-sm">
                    <ExternalLink size={13} /> Open in inventory
                  </Link>
                </div>
              );
            })()
          ) : (
            (() => {
              const isTag = selected.kind === ("tag" as GraphNodeKind);
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ background: `${selected.color}22`, color: selected.color }}
                    >
                      {isTag ? <Tag size={14} /> : <Boxes size={14} />}
                    </span>
                    <div>
                      <p className="font-display text-lg font-semibold text-white">{selected.label}</p>
                      <p className="text-[11px] uppercase tracking-wider text-slate-500">{isTag ? "tag cluster" : "asset-type cluster"}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-phantix-700/40 bg-phantix-950/50 px-3 py-2.5 text-sm text-slate-300">
                    {neighborInfo?.edgesIn ?? 0} direct member connection{(neighborInfo?.edgesIn ?? 0) === 1 ? "" : "s"}
                  </div>
                  <p className="text-xs leading-5 text-slate-500">
                    Group hubs collect every asset that shares this {isTag ? "tag" : "type"} — clearing or retagging assets reshapes the graph instantly.
                  </p>
                  <button className="btn-ghost w-full text-sm" onClick={() => setSelected(null)}>
                    Clear selection
                  </button>
                </div>
              );
            })()
          )}
        </Card>
      </div>
    </div>
  );
}
