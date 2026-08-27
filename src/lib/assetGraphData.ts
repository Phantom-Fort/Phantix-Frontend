// Obsidian-style relational graph model for assets.
// Nodes = assets + their tags + their asset types; edges connect assets to the
// groups they belong to (and to real backend relationships when available).

export type GraphNodeKind = "asset" | "tag" | "type";
export type GraphEdgeKind = "tagged" | "typed" | "related";

export interface AssetLike {
  id: number;
  value?: string | null;
  name?: string | null;
  asset_type?: string | null;
  assetType?: string | null;
  is_verified?: boolean | null;
  criticality?: string | null;
  risk_level?: string | null;
  riskLevel?: string | null;
  risk_score?: number | null;
  open_findings?: number | null;
  exposure?: string | null;
  first_discovered_at?: string | null;
  last_seen_at?: string | null;
  environment?: string | null;
  tags?: Array<{ id?: number; name?: string; color?: string } | number> | null;
}

export interface TagLike {
  id: number;
  name: string;
  color?: string | null;
  description?: string | null;
}

export interface AssetGraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  /** Node tint (hex). Assets use risk colour, tags use their own colour. */
  color: string;
  /** Relative importance 0..1 — drives radius. */
  weight: number;
  assetId?: number;
  meta?: Record<string, unknown>;
}

export interface AssetGraphEdge {
  source: string;
  target: string;
  kind: GraphEdgeKind;
  label?: string;
}

export interface AssetGraphModel {
  nodes: AssetGraphNode[];
  edges: AssetGraphEdge[];
  counts: { assets: number; tags: number; types: number };
}

/** Backend relationship graph payload (RelationshipGraph in types.ts), kept loose. */
interface RawRelGraph {
  nodes?: Array<{ id: number; value?: string | null; name?: string | null }>;
  edges?: Array<{ id?: number; source: number; target: number; relationshipType?: string }>;
}

export const RISK_COLORS: Record<string, string> = {
  critical: "#F43F5E",
  high: "#FB923C",
  medium: "#FACC15",
  low: "#38BDF8",
  info: "#94A3B8",
};

const TYPE_COLORS: Record<string, string> = {
  domain: "#E8B54D",
  subdomain: "#D4A73F",
  web_app: "#60A5FA",
  api: "#34D399",
  ip_address: "#A78BFA",
  port_service: "#8B5CF6",
  github_repo: "#94A3B8",
  mobile_apk: "#F472B6",
  database_connection: "#22D3EE",
};

const FALLBACK_PALETTE = ["#7C8CF8", "#5EEAD4", "#FB7185", "#F0ABFC", "#FDBA74", "#86EFAC"];

function hashColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

export function colorForType(t: string): string {
  const k = String(t ?? "").toLowerCase();
  if (TYPE_COLORS[k]) return TYPE_COLORS[k];
  if (/domain/.test(k)) return TYPE_COLORS.domain;
  if (/ip|host/.test(k)) return TYPE_COLORS.ip_address;
  if (/db|database/.test(k)) return TYPE_COLORS.database_connection;
  if (/repo|code|git/.test(k)) return TYPE_COLORS.github_repo;
  return hashColor(k || "unknown");
}

function riskColor(a: AssetLike): string {
  const lvl = String(a.riskLevel ?? a.risk_level ?? "").toLowerCase();
  if (lvl && RISK_COLORS[lvl]) return RISK_COLORS[lvl];
  const crit = String(a.criticality ?? "").toLowerCase();
  if (crit === "critical") return RISK_COLORS.critical;
  if (crit === "high") return RISK_COLORS.high;
  if (crit === "medium") return RISK_COLORS.medium;
  return RISK_COLORS.low;
}

function normalizeTags(a: AssetLike): Array<{ key: string; name: string; color: string }> {
  const out: Array<{ key: string; name: string; color: string }> = [];
  for (const raw of Array.isArray((a as any).tags) ? ((a as any).tags as any[]) : []) {
    if (typeof raw === "number") {
      out.push({ key: String(raw), name: `tag ${raw}`, color: "" });
    } else if (raw && typeof raw === "object") {
      const name = String(raw.name ?? "").trim();
      if (!name) continue;
      // Prefer numeric ids, fall back to slug keys so API + demo data both work.
      out.push({
        key: raw.id != null ? String(raw.id) : name,
        name,
        color: typeof raw.color === "string" ? raw.color : "",
      });
    }
  }
  return out;
}

export interface BuildGraphOptions {
  /** Also emit per-asset type group nodes / typed edges. */
  groupByType?: boolean;
  /** Emit edges for shared relationships returned by GET /assets/intelligence/graph. */
  relations?: RawRelGraph | null;
}

export function buildAssetGraph(
  assetsInput: AssetLike[],
  tags: TagLike[],
  opts: BuildGraphOptions = {},
): AssetGraphModel {
  const groupByType = opts.groupByType !== false;
  const tagById = new Map<string, TagLike>();
  for (const t of tags ?? []) tagById.set(String(t.id), t);

  const nodes = new Map<string, AssetGraphNode>();
  const edges: AssetGraphEdge[] = [];
  const seenEdges = new Set<string>();
  let typeCount = 0;

  const addNode = (n: AssetGraphNode) => {
    const cur = nodes.get(n.id);
    if (!cur) nodes.set(n.id, n);
  };

  const pushEdge = (e: AssetGraphEdge) => {
    const k = `${e.kind}:${e.source}->${e.target}`;
    if (!seenEdges.has(k)) {
      seenEdges.add(k);
      edges.push(e);
    }
  };

  const assets = (assetsInput ?? []).filter((a) => a && a.id != null);

  for (const a of assets) {
    const assetKey = `asset:${a.id}`;
    const openFindings = Number(a.open_findings ?? 0);
    const crit = String(a.criticality ?? "").toLowerCase();
    const findingsWeight = Math.min(1, openFindings / 12);
    addNode({
      id: assetKey,
      kind: "asset",
      label: String(a.value ?? a.name ?? `#${a.id}`),
      color: riskColor(a),
      weight: 0.45 + 0.3 * findingsWeight + (crit === "critical" ? 0.25 : crit === "high" ? 0.1 : 0),
      assetId: a.id,
      meta: {
        assetType: a.asset_type ?? a.assetType ?? "",
        riskLevel: a.riskLevel ?? a.risk_level ?? null,
        riskScore: a.risk_score ?? null,
        openFindings,
        isVerified: Boolean(a.is_verified),
        environment: a.environment ?? null,
        lastSeenAt: a.last_seen_at ?? null,
      },
    });

    for (const tg of normalizeTags(a)) {
      const key = `tag:${tg.key}`;
      const known = tagById.get(tg.key);
      const label = known?.name ?? tg.name;
      const color = known?.color || tg.color || "#64748B";
      addNode({ id: key, kind: "tag", label, color, weight: 0.35 });
      pushEdge({ source: assetKey, target: key, kind: "tagged" });
    }

    if (groupByType) {
      const t = String(a.asset_type ?? a.assetType ?? "other").toLowerCase() || "other";
      const key = `type:${t}`;
      if (!nodes.has(key)) typeCount += 1;
      addNode({
        id: key,
        kind: "type",
        label: t.replace(/_/g, " "),
        color: colorForType(t),
        weight: 0.55,
        meta: { assetType: t },
      });
      pushEdge({ source: assetKey, target: key, kind: "typed" });
    }
  }

  // Merge real relationship endpoints when both sides are present in inventory.
  for (const e of opts.relations?.edges ?? []) {
    const s = `asset:${Number(e.source)}`;
    const t = `asset:${Number(e.target)}`;
    if (nodes.has(s) && nodes.has(t)) {
      pushEdge({ source: s, target: t, kind: "related", label: e.relationshipType ?? undefined });
    }
  }

  return {
    nodes: [...nodes.values()],
    edges,
    counts: {
      assets: assets.length,
      tags: [...nodes.values()].filter((n) => n.kind === "tag").length,
      types: typeCount,
    },
  };
}
