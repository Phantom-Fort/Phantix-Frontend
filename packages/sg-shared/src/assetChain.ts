// ── Asset chain ─────────────────────────────────────────────────────────────
// The inventory as a tree: example.com → sub.example.com → /api → /api/v1.
// The backend owns the chain (assets.parent_asset_id); this module reads it
// one level at a time with subtree roll-ups, and in demo mode derives the same
// shape from the demo inventory.

import { api, delay, isDemoMode } from "./api";
import * as demo from "./demo-data";
import type { Asset } from "./types";

export interface AssetTreeNode {
  asset: Asset;
  child_count: number;
  descendant_count: number;
  open_findings: number;
  critical_findings: number;
  high_findings: number;
}

export interface AssetTreePage {
  parent_id: number | null;
  items: AssetTreeNode[];
  total: number;
}

export interface PathDiscoveryResult {
  robots_found: boolean;
  sitemap_urls: number;
  paths_added: number;
  skipped: number;
  errors: string[];
}

/** Types the chain knows how to place; everything else is a root of its own. */
export const CHAIN_TYPES = new Set(["domain", "subdomain", "ip_address", "web_app", "api", "web_path"]);

/** (host, path) of a chainable asset value. */
export function locateAsset(assetType: string, value: string): { host: string; path: string } {
  const raw = (value || "").trim();
  const t = (assetType || "").toLowerCase();
  if (t === "domain" || t === "subdomain" || t === "ip_address") {
    const host = raw.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
    return { host, path: "/" };
  }
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw.replace(/^\/+/, "")}`);
    const segs: string[] = [];
    for (const s of u.pathname.split("/")) {
      if (!s || s === ".") continue;
      if (s === "..") segs.pop();
      else segs.push(s);
    }
    return { host: u.hostname.toLowerCase(), path: "/" + segs.join("/") };
  } catch {
    return { host: "", path: "/" };
  }
}

/** What a row shows: a path relative to its host, otherwise the full value. */
export function chainLabel(asset: Pick<Asset, "asset_type" | "value">): string {
  if (asset.asset_type === "web_path") {
    const { path } = locateAsset(asset.asset_type, asset.value);
    return path || asset.value;
  }
  return asset.value;
}

// ── Demo: the backend's parent rules, simplified for the demo inventory ─────

function registrable(host: string): string {
  if (/^[\d.]+$/.test(host)) return host;
  const labels = host.split(".");
  return labels.slice(-2).join(".");
}

function hostAncestors(host: string): string[] {
  const root = registrable(host);
  if (host === root || !host.endsWith("." + root)) return [];
  const labels = host.split(".");
  const out: string[] = [];
  for (let i = 1; i < labels.length; i++) {
    const c = labels.slice(i).join(".");
    out.push(c);
    if (c === root) break;
  }
  return out;
}

export function deriveParents(assets: Asset[]): Map<number, number | null> {
  const hosts = new Map<string, Asset>();
  const urls = new Map<string, Asset>();
  const sorted = [...assets].sort((a, b) => (a.asset_type === "domain" ? 0 : 1) - (b.asset_type === "domain" ? 0 : 1) || a.id - b.id);
  for (const a of sorted) {
    if (!CHAIN_TYPES.has(a.asset_type)) continue;
    const { host, path } = locateAsset(a.asset_type, a.value);
    if (!host) continue;
    if (a.asset_type === "domain" || a.asset_type === "subdomain" || a.asset_type === "ip_address") {
      if (!hosts.has(host)) hosts.set(host, a);
    } else if (!urls.has(`${host}${path}`)) {
      urls.set(`${host}${path}`, a);
    }
  }
  const out = new Map<number, number | null>();
  for (const a of assets) {
    if (!CHAIN_TYPES.has(a.asset_type)) {
      out.set(a.id, null);
      continue;
    }
    const { host, path } = locateAsset(a.asset_type, a.value);
    let parent: Asset | undefined;
    if (a.asset_type === "domain" || a.asset_type === "subdomain" || a.asset_type === "ip_address") {
      const same = hosts.get(host);
      if (same && same.id !== a.id) parent = same;
      else parent = hostAncestors(host).map((h) => hosts.get(h)).find(Boolean);
    } else {
      const same = urls.get(`${host}${path}`);
      if (same && same.id !== a.id) parent = same;
      const parts = path.split("/").filter(Boolean);
      for (let i = parts.length - 1; !parent && i > 0; i--) {
        const hit = urls.get(`${host}/${parts.slice(0, i).join("/")}`);
        if (hit && hit.id !== a.id) parent = hit;
      }
      parent ??= hosts.get(host) ?? hostAncestors(host).map((h) => hosts.get(h)).find(Boolean);
    }
    out.set(a.id, parent && parent.id !== a.id ? parent.id : null);
  }
  return out;
}

function demoTree(parentId: number | null): AssetTreePage {
  const assets = demo.assets as Asset[];
  const parents = deriveParents(assets);
  const children = (id: number | null) => assets.filter((a) => (parents.get(a.id) ?? null) === id);
  const subtree = (id: number): Asset[] => children(id).flatMap((c) => [c, ...subtree(c.id)]);
  const rank: Record<string, number> = { domain: 0, subdomain: 1, ip_address: 2, web_path: 4 };
  const items = children(parentId)
    .sort((a, b) => (rank[a.asset_type] ?? 3) - (rank[b.asset_type] ?? 3) || a.value.localeCompare(b.value))
    .map((a) => {
      const all = [a, ...subtree(a.id)];
      return {
        asset: { ...a, parent_asset_id: parents.get(a.id) ?? null },
        child_count: children(a.id).length,
        descendant_count: all.length - 1,
        open_findings: all.reduce((n, x) => n + Number(x.open_findings ?? 0), 0),
        critical_findings: all.filter((x) => x.risk_level === "critical").length,
        high_findings: all.filter((x) => x.risk_level === "high").length,
      };
    });
  return { parent_id: parentId, items, total: items.length };
}

// ── API ──────────────────────────────────────────────────────────────────────

/** One level of the chain (roots when ``parentId`` is null). */
export async function loadAssetTree(parentId: number | null, opts: { limit?: number; offset?: number } = {}): Promise<AssetTreePage> {
  if (isDemoMode()) {
    await delay(120);
    return demoTree(parentId);
  }
  const qs = new URLSearchParams();
  if (parentId != null) qs.set("parent_id", String(parentId));
  qs.set("limit", String(opts.limit ?? 200));
  if (opts.offset) qs.set("offset", String(opts.offset));
  return api.get<AssetTreePage>(`/assets/tree?${qs.toString()}`);
}

/** Root → … → asset, inclusive. */
export async function loadAssetChain(assetId: number): Promise<Asset[]> {
  if (isDemoMode()) {
    const assets = demo.assets as Asset[];
    const parents = deriveParents(assets);
    const byId = new Map(assets.map((a) => [a.id, a]));
    const chain: Asset[] = [];
    let cur = byId.get(assetId);
    while (cur && chain.length < 32) {
      chain.unshift(cur);
      const p = parents.get(cur.id);
      cur = p != null ? byId.get(p) : undefined;
    }
    return chain;
  }
  const res = await api.get<{ chain: Asset[] }>(`/assets/${assetId}/chain`);
  return res.chain ?? [];
}

export async function setChainScopeExcluded(assetId: number, excluded: boolean): Promise<Asset> {
  if (isDemoMode()) {
    await delay(150);
    const a = (demo.assets as Asset[]).find((x) => x.id === assetId);
    if (a) a.chain_scope_excluded = excluded;
    return a as Asset;
  }
  return api.patch<Asset>(`/assets/${assetId}/chain-scope`, { excluded });
}

export async function discoverAssetPaths(assetId: number): Promise<PathDiscoveryResult> {
  if (isDemoMode()) {
    await delay(600);
    return { robots_found: true, sitemap_urls: 0, paths_added: 0, skipped: 0, errors: [] };
  }
  return api.post<PathDiscoveryResult>(`/assets/${assetId}/paths/discover`);
}
