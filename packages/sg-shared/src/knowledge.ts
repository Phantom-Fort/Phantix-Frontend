/**
 * Knowledge base — the controls/technique entries the off-peak research agent
 * maintains. `GET /api/v1/knowledge/entries` returns provenance-cited, versioned
 * entries so compliance/defend/report views can explain *why* they say what they do.
 */
import { api, isDemoMode } from "./api";

export type KnowledgeReference = { url: string; title?: string };

export type KnowledgeEntry = {
  topic: string;
  title: string;
  summary: string;
  guidance: string;
  techniques: string[];
  references: KnowledgeReference[];
  framework?: string | null;
  control_id?: string | null;
  version: number;
  content_hash: string;
  generated_at?: string | null;
  provenance?: Record<string, unknown>;
};

export async function loadKnowledgeEntries(q = "", limit = 50): Promise<KnowledgeEntry[]> {
  if (isDemoMode()) return [];
  try {
    const res = await api.get<{ items: KnowledgeEntry[]; count: number }>(
      `/knowledge/entries?q=${encodeURIComponent(q)}&limit=${limit}`,
    );
    return res?.items ?? [];
  } catch {
    return [];
  }
}

export async function loadKnowledgeEntry(slug: string): Promise<KnowledgeEntry | null> {
  if (isDemoMode()) return null;
  try {
    return await api.get<KnowledgeEntry>(`/knowledge/entries/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}
