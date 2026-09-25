// Passive-discovery candidates (asset_engine).
//
// Hostnames found by passive sources (Common Crawl, Wayback, certificate
// transparency, urlscan, passive DNS) are staged as *candidates* — they are not
// verified assets and never enter the inventory until promoted. This module
// mirrors app/engines/asset_engine/api/asset_candidates.py and the discovery
// job type added for passive enumeration.
import { api, delay, isDemoMode } from "./api";

export type ResolveState = "resolves" | "dangling" | "unresolved" | "unknown";
export type CandidateStatus = "candidate" | "promoted" | "rejected";
export type TakeoverRisk = "high" | "medium" | "none";

export interface AssetCandidate {
  id: number;
  asset_type: string;
  value: string;
  registrable_domain: string;
  sources: string[];
  evidence: Record<string, unknown>;
  resolve_state: ResolveState | string;
  resolved_ips: string[];
  cname: string | null;
  takeover_risk: TakeoverRisk | string;
  confidence: number;
  status: CandidateStatus | string;
  promoted_asset_id: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

export interface CandidateSummary {
  total: number;
  by_status: Record<string, number>;
  by_resolve_state: Record<string, number>;
  takeover_risk: number;
}

export interface CandidateListResponse {
  items: AssetCandidate[];
  total: number;
  limit: number;
  offset: number;
}

export interface CandidateFilters {
  status?: string;
  resolveState?: string;
  takeoverOnly?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

const EMPTY_SUMMARY: CandidateSummary = {
  total: 0,
  by_status: {},
  by_resolve_state: {},
  takeover_risk: 0,
};

/** GET /assets/candidates — staged hosts, worst takeover risk first. */
export async function listCandidates(filters: CandidateFilters = {}): Promise<CandidateListResponse> {
  if (isDemoMode()) {
    await delay(220);
    return { items: [], total: 0, limit: filters.limit ?? 100, offset: filters.offset ?? 0 };
  }
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.resolveState) qs.set("resolve_state", filters.resolveState);
  if (filters.takeoverOnly) qs.set("takeover_only", "true");
  if (filters.q?.trim()) qs.set("q", filters.q.trim());
  qs.set("limit", String(filters.limit ?? 100));
  qs.set("offset", String(filters.offset ?? 0));
  return api.get<CandidateListResponse>(`/assets/candidates?${qs.toString()}`);
}

/** GET /assets/candidates/summary — counts for the header strip. */
export async function candidateSummary(): Promise<CandidateSummary> {
  if (isDemoMode()) {
    await delay(160);
    return EMPTY_SUMMARY;
  }
  return api.get<CandidateSummary>("/assets/candidates/summary");
}

/**
 * POST /assets/candidates/{id}/promote — put a candidate into the verified
 * inventory. A host that does not resolve returns 422; pass ``confirm`` to
 * promote it anyway with an operator ownership attestation.
 */
export async function promoteCandidate(id: number, confirm = false): Promise<{ asset_id: number; candidate: AssetCandidate }> {
  if (isDemoMode()) {
    await delay(500);
    throw new Error("Promotion is available on a real organisation, not in the demo tenant.");
  }
  return api.post<{ asset_id: number; candidate: AssetCandidate }>(
    `/assets/candidates/${id}/promote?confirm=${confirm ? "true" : "false"}`,
    {},
  );
}

/** POST /assets/candidates/{id}/reject — keep the provenance, never promote. */
export async function rejectCandidate(id: number): Promise<AssetCandidate> {
  if (isDemoMode()) {
    await delay(300);
    throw new Error("Rejection is available on a real organisation, not in the demo tenant.");
  }
  return api.post<AssetCandidate>(`/assets/candidates/${id}/reject`, {});
}

export interface PassiveEnumOptions {
  sources?: string[];
  includeDns?: boolean;
  maxHosts?: number;
}

/**
 * POST /assets/discovery/jobs with job_type=passive_enum.
 * Returns immediately (the job is queued); poll GET /assets/discovery/jobs.
 */
export async function startPassiveEnum(domain: string, opts: PassiveEnumOptions = {}) {
  const clean = domain.trim().toLowerCase();
  if (!clean) throw new Error("Enter the domain to search.");
  if (isDemoMode()) {
    await delay(420);
    return { id: -1, job_type: "passive_enum", status: "queued", config: { domain: clean } };
  }
  return api.post<{ id: number; status?: string }>("/assets/discovery/jobs", {
    job_type: "passive_enum",
    config: {
      domain: clean,
      include_dns: opts.includeDns ?? true,
      ...(opts.sources?.length ? { sources: opts.sources } : {}),
      ...(opts.maxHosts ? { max_hosts: opts.maxHosts } : {}),
    },
    run_inline: false,
  });
}

/** The source keys the backend understands; labels are for the UI. */
export const PASSIVE_SOURCES: { key: string; label: string }[] = [
  { key: "commoncrawl", label: "Common Crawl" },
  { key: "wayback", label: "Wayback" },
  { key: "certspotter", label: "Cert Spotter" },
  { key: "crt", label: "crt.name" },
  { key: "urlscan", label: "urlscan.io" },
  { key: "otx", label: "OTX passive DNS" },
  { key: "mnemonic", label: "Mnemonic passive DNS" },
];

export const RESOLVE_TONE: Record<string, string> = {
  resolves: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  dangling: "border-severity-critical/30 bg-severity-critical/10 text-severity-critical",
  unresolved: "border-phantix-700 text-slate-400",
  unknown: "border-phantix-700 text-slate-500",
};

export const TAKEOVER_TONE: Record<string, string> = {
  high: "border-severity-critical/30 bg-severity-critical/10 text-severity-critical",
  medium: "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
  none: "border-phantix-700 text-slate-500",
};
