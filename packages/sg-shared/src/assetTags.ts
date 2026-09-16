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

/** A readable default palette so new tags are distinguishable at a glance. */
export const TAG_COLORS = [
  "#E8B54D", "#5A7BD6", "#34D399", "#F43F5E", "#FB923C", "#A78BFA", "#38BDF8", "#94A3B8",
];
