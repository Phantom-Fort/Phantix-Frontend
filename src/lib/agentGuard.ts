// Agent guard — approvals, fresh single-use authorizations, and the "acts as you"
// model. Mirrors app/engines/ai_engine/api/agent.py:
//   GET  /ai/agent/approvals                  → org approvals + live authz state
//   POST /ai/agent/approvals                  → request one for (action, run)
//   POST /ai/agent/approvals/{id}/decide      → approve/reject (issues exactly one)
//   GET  /ai/agent/authorizations/status      → peek without spending
import { api, delay, isDemoMode } from "./api";

export type ApprovalStatus = "pending" | "approved" | "rejected" | string;

export interface AgentApprovalRow {
  approval_id: string;
  action: string;
  status: ApprovalStatus;
  reason?: string | null;
  analysis_id?: string | null;
  requested_by?: string | null;
  decided_by?: string | null;
  created_at?: string | null;
  decided_at?: string | null;
  /** True only while an unconsumed, unexpired authorization exists for this run. */
  authorized?: boolean;
  single_use?: boolean;
}

export interface AgentAuthorizationState {
  action: string;
  analysis_id: string;
  authorized: boolean;
  granted_by?: string | null;
  expires_in?: number;
  single_use: boolean;
}

const demoApprovals: AgentApprovalRow[] = [
  {
    approval_id: "demo-approval-1",
    action: "threat_model.generate",
    status: "pending",
    reason: "Generate the payments model",
    analysis_id: "demo-run-1",
    requested_by: "ai_agent",
    created_at: new Date().toISOString(),
    authorized: false,
    single_use: true,
  },
];

export async function loadAgentApprovals(status?: ApprovalStatus) {
  if (isDemoMode()) {
    await delay(280);
    const items = status ? demoApprovals.filter((a) => a.status === status) : demoApprovals;
    return { items, total: items.length };
  }
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return api.get<{ items: AgentApprovalRow[]; total: number }>(`/ai/agent/approvals${q}`);
}

/** Ask a human to authorize one action on one run. */
export async function requestAgentApproval(action: string, reason: string, analysisId?: string) {
  if (isDemoMode()) {
    await delay(320);
    return { approval_id: `demo-${Date.now()}`, status: "pending", action };
  }
  const params = new URLSearchParams({ action, reason });
  if (analysisId) params.set("analysis_id", analysisId);
  return api.post<{ approval_id: string; status: string; action: string }>(
    `/ai/agent/approvals?${params.toString()}`,
  );
}

/** Approve or reject. Approving issues exactly one single-use authorization. */
export async function decideAgentApproval(approvalId: string, approve: boolean, notes = "") {
  if (isDemoMode()) {
    await delay(320);
    return { approval_id: approvalId, status: approve ? "approved" : "rejected", authorization: approve ? { single_use: true } : null };
  }
  return api.post<Record<string, unknown>>(
    `/ai/agent/approvals/${encodeURIComponent(approvalId)}/decide`,
    { approve, notes },
    { dualControl: true },
  );
}

/** Whether a fresh authorization exists right now — peeking does not spend it. */
export async function agentAuthorizationStatus(action: string, analysisId: string) {
  if (isDemoMode()) {
    await delay(200);
    return { action, analysis_id: analysisId, authorized: false, single_use: true } as AgentAuthorizationState;
  }
  const params = new URLSearchParams({ action, analysis_id: analysisId });
  return api.get<AgentAuthorizationState>(`/ai/agent/authorizations/status?${params.toString()}`);
}

/** The tool reasons that mean "a human must authorize this", not "it broke". */
export function isAuthorizationBlock(reason?: string | null): boolean {
  const r = (reason || "").toLowerCase();
  return (
    r.includes("no fresh authorization") ||
    r.includes("requires approval") ||
    r.includes("does not include") ||
    r.includes("not permitted for domain") ||
    r.includes("authorization store is unavailable")
  );
}
