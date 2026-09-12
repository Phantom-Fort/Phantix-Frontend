// Agent activity — every action the agent took for this organization.
// Mirrors GET /ai/agent/activity (agent.py). Rows are written by the executor for
// both allowed and denied actions, so this records what was *asked*, by whom,
// and what happened.
import { api, delay, isDemoMode } from "./api";

export interface AgentAction {
  id: number;
  organization_id: number;
  event_id?: string | null;
  run_id?: string | null;
  domain?: string | null;
  tool?: string | null;
  intent?: string | null;
  params?: string | null;
  authorized?: boolean | null;
  actor_user_id?: number | null;
  actor_role?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  context?: string[];
  status: string;
  error?: string | null;
  created_at?: string | null;
  evidence_hash?: string | null;
  response_hash?: string | null;
}

export interface AgentActivityResponse {
  items: AgentAction[];
  total: number;
  limit: number;
  offset: number;
  summary?: { returned?: number; denied_or_failed?: number };
}

export interface AgentActivityFilter {
  status?: string;
  domain?: string;
  tool?: string;
  run_id?: string;
  limit?: number;
  offset?: number;
}

export function buildAgentActivityQuery(filter: AgentActivityFilter): string {
  const q = new URLSearchParams();
  if (filter.status) q.set("status", filter.status);
  if (filter.domain) q.set("domain", filter.domain);
  if (filter.tool) q.set("tool", filter.tool);
  if (filter.run_id) q.set("run_id", filter.run_id);
  if (filter.limit != null) q.set("limit", String(filter.limit));
  if (filter.offset != null) q.set("offset", String(filter.offset));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function loadAgentActivity(filter: AgentActivityFilter = {}) {
  if (isDemoMode()) {
    await delay(240);
    return { items: [] as AgentAction[], total: 0, limit: filter.limit ?? 50, offset: filter.offset ?? 0 };
  }
  return api.get<AgentActivityResponse>(`/ai/agent/activity${buildAgentActivityQuery(filter)}`);
}

/** A denial reason is a control working, not a bug. */
export function isDenied(row: AgentAction): boolean {
  return String(row.status || "").toLowerCase() === "failed";
}
