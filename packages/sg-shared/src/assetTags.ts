// Asset tag CRUD — /asset-tags (stored in the org's security DB, so every call
// can answer 409 when that storage is not activated).
//
// Contract mirrors app/engines/asset_engine/api/asset_tags.py. Note the shape of
// the sub-routes: they are nested under the tag router, so an asset's tags live
// at /asset-tags/assets/{asset_id}, not under /assets.
import { api, delay, isDemoMode } from "./api";
import * as demo from "./demo-data";
import { sanitizeSingleLine } from "./uploadValidation";
import type { AssetTag } from "./types";

export interface AssetTagCreate {
  name: string;
  /** Hex colour, max 7 chars including the leading `#`. */
  color?: string;
  description?: string;
}

export async function listAssetTags() {
  if (isDemoMode()) {
    await delay(240);
    return { items: demo.assetTags, total: demo.assetTags.length };
  }
  return api.get<{ items: AssetTag[]; total: number }>("/asset-tags");
}

/** 409 when a tag of the same name already exists for this organization. */
export async function createAssetTag(body: AssetTagCreate) {
  const name = sanitizeSingleLine(body.name).slice(0, 100);
  if (!name) throw new Error("Tag name is required.");
  const description = sanitizeSingleLine(body.description ?? "").slice(0, 500) || undefined;
  if (isDemoMode()) {
    await delay(300);
    return {
      id: Math.max(0, ...demo.assetTags.map((t) => t.id)) + 1,
      name,
      color: body.color ?? TAG_COLORS[demo.assetTags.length % TAG_COLORS.length],
      description,
      asset_count: 0,
    };
  }
  return api.post<AssetTag>("/asset-tags", {
    name,
    ...(body.color ? { color: body.color } : {}),
    ...(description ? { description } : {}),
  });
}

export function deleteAssetTag(tagId: number) {
  return api.delete<void>(`/asset-tags/${tagId}`);
}

export async function listTagsForAsset(assetId: number) {
  if (isDemoMode()) {
    await delay(200);
    return demo.assets.find((a) => a.id === assetId)?.tags ?? [];
  }
  return api.get<AssetTag[]>(`/asset-tags/assets/${assetId}`);
}

export function assignTagToAsset(assetId: number, tagId: number) {
  return api.post<void>(`/asset-tags/assets/${assetId}/assign`, { tag_id: tagId });
}

export function removeTagFromAsset(assetId: number, tagId: number) {
  return api.delete<void>(`/asset-tags/assets/${assetId}/${tagId}`);
}

// ── Inferred classification ──────────────────────────────────────────────────
// The backend derives what an asset *is* (surface, capabilities, process flow)
// from its type, value, metadata and imports, and persists namespaced tags
// (`surface:` / `cap:` / `flow:` / `tech:`). "Classify" refreshes them on demand
// — e.g. after a metadata change — and returns the reasoning for the UI.

export interface AssetClassification {
  asset_id: number;
  primary_surface: string;
  surfaces: string[];
  capabilities: string[];
  technologies: string[];
  recommended_flow: string;
  confidence: number;
  inferred_tags: string[];
  applied_tags: string[];
  evidence: string[];
}

/** Prefixes the classifier owns; anything else on an asset is a human tag. */
export const INFERRED_TAG_PREFIXES = ["surface:", "cap:", "flow:", "tech:"] as const;

export function isInferredTag(name: string): boolean {
  const n = (name ?? "").toLowerCase();
  return INFERRED_TAG_PREFIXES.some((p) => n.startsWith(p));
}

export async function classifyAsset(assetId: number): Promise<AssetClassification> {
  if (isDemoMode()) {
    await delay(300);
    const a = demo.assets.find((x) => x.id === assetId);
    const type = String(a?.asset_type ?? "domain").toLowerCase();
    const value = String(a?.value ?? "").toLowerCase();
    const surfaces: string[] = [];
    const capabilities: string[] = [];
    if (/graphql/.test(value)) {
      surfaces.push("graphql_api");
      capabilities.push("graphql");
    } else if (type === "api" || /\/api(\/|$)|openapi|swagger/.test(value)) {
      surfaces.push("rest_api");
      capabilities.push("rest", "json");
    } else if (type === "ip_address" || type === "port_service") {
      surfaces.push("network_host");
    } else if (type === "web_app") {
      surfaces.push("web_application");
    } else {
      surfaces.push("web_application");
    }
    const primary = surfaces[0];
    const flow =
      primary === "graphql_api"
        ? "graphql_focused"
        : primary === "rest_api"
          ? "rest_api_full"
          : primary === "network_host"
            ? "network_host"
            : "web_application_standard";
    return {
      asset_id: assetId,
      primary_surface: primary,
      surfaces,
      capabilities,
      technologies: [],
      recommended_flow: flow,
      confidence: 0.7,
      inferred_tags: [
        ...surfaces.map((s) => `surface:${s}`),
        ...capabilities.map((c) => `cap:${c}`),
        `flow:${flow}`,
      ],
      applied_tags: [],
      evidence: ["Demo classification — live mode reads type, value and metadata."],
    };
  }
  return api.post<AssetClassification>(`/asset-tags/assets/${assetId}/classify`, {});
}

/** A readable default palette so new tags are distinguishable at a glance. */
export const TAG_COLORS = [
  "#E8B54D", "#5A7BD6", "#34D399", "#F43F5E", "#FB923C", "#A78BFA", "#38BDF8", "#94A3B8",
];
