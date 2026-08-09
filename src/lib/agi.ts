// Autonomous Pentest Agent (PHANTIX AGI) — customer surface.
// Mirrors app/engines/ai_engine/agi/customer_api.py. Demo-mode fallbacks so the
// UI is testable without a live runner.

import { api, ApiError, delay, isDemoMode } from "./api";
import type {
  AgiAccess,
  AgiAction,
  AgiAgreement,
  AgiEngagement,
  AgiIntentRecommendation,
  AgiSession,
  AgiTranscriptChunk,
} from "./types";

/** Build-time master switch — mirrors backend PHANTIX_AGI_ENABLED (default on). */
export const AGI_ENABLED = (import.meta.env.VITE_AGI_ENABLED ?? "true") !== "false";

// ── Demo fixtures ─────────────────────────────────────────────────────────────
let demoAgreed = false;
let demoEngagements: AgiEngagement[] = [];
let demoSession: AgiSession | null = null;
let demoTx: AgiTranscriptChunk[] = [];
let demoTxEmit = 0;
let demoActions: AgiAction[] = [];
let demoPoll = 0;
let demoTick = 0;

function demoAccess(): AgiAccess {
  const canUse = demoAgreed;
  return {
    modes: {
      agent: {
        id: "agent",
        label: "Phantix Agent",
        description: "Analysis, triage, narratives — grounded in existing engine data.",
        cost_tier: "standard",
        available: true,
      },
      agi: {
        id: "agi",
        label: "Autonomous Pentest Agent",
        description: "Human-gated live testing inside an approved scope. State-changing steps require approval.",
        cost_tier: "premium_session",
        available: canUse,
      },
    },
    agi: {
      platform_enabled: true,
      org_enabled: true,
      entitled: true,
      entitlement_code: null,
      agreement_required: !demoAgreed,
      agreement_accepted: demoAgreed,
      active_policy_version: demoAgreed ? "1.0.0" : null,
      can_use: canUse,
      limits: {
        daily_session_limit: 5,
        max_session_minutes: 60,
        max_allowlist_targets: 10,
        allow_state_changing: true,
        require_dual_control_for_active: false,
        require_asset_backed_targets: false,
      },
      blockers: demoAgreed ? [] : [{ code: "agi_agreement_required", message: "Accept AGI usage agreement to continue" }],
    },
    agreement: {
      version: "1.0.0",
      title: "Autonomous Pentest Agent Usage Agreement",
      body_md: demoAgreed
        ? null
        : "# Autonomous Pentest Agent — Usage Agreement\n\nThis agent runs **only** against targets in your approved engagement allowlist.\n\n- **Read-only** steps stream live.\n- **State-changing** steps pause for your approval.\n- Sessions destroy their containers when stopped.\n- No host / server information, no other organizations, no direct database access.\n\nBy accepting you confirm you are authorized to test the listed targets.",
      security_policy: demoAgreed
        ? null
        : { principles: ["scope-limited", "approval-gated", "container-isolated"] },
      must_accept_before_agi: !demoAgreed,
    },
  };
}

function demoAgreement(): AgiAgreement {
  return {
    version: "1.0.0",
    title: "Autonomous Pentest Agent Usage Agreement",
    body_md:
      "# Autonomous Pentest Agent — Usage Agreement\n\nThis agent runs **only** against targets in your approved engagement allowlist.\n\n- **Read-only** steps stream live.\n- **State-changing** steps pause for your approval.\n- Sessions destroy their containers when stopped.\n- No host / server information, no other organizations, no direct database access.\n\nBy accepting you confirm you are authorized to test the listed targets.",
    security_policy: { principles: ["scope-limited", "approval-gated", "container-isolated"] },
    accepted: demoAgreed,
    must_accept: !demoAgreed,
    organization_id: 1,
  };
}

function demoSeedEngagements(): void {
  demoEngagements = [
    {
      id: 11,
      organization_id: 1,
      name: "Lab external web",
      description: "External web assessment of the Acme lab environment.",
      scope_definition: {
        target_allowlist: ["https://lab.acme.example", "https://api.acme-lab.example"],
        forbidden_actions: ["dos", "ransomware", "data_exfil_bulk"],
        rules_of_engagement: "Business hours only. Stop on PII.",
        max_session_minutes: 60,
      },
      status: "ready",
      config: { prompts: {}, tools: ["httpx", "nmap_safe", "nuclei_safe"], skills: { auto_select: true, auto_select_limit: 6 } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 12,
      organization_id: 1,
      name: "Q3 internal network",
      description: "Internal posture verification against the staging CIDR.",
      scope_definition: {
        target_allowlist: ["10.20.0.0/24", "staging.acme-lab.example"],
        forbidden_actions: ["dos"],
        rules_of_engagement: "Lab network only. No production hosts.",
        max_session_minutes: 45,
      },
      status: "ready",
      config: { prompts: {}, tools: ["nmap_safe"], skills: { auto_select: true, auto_select_limit: 4 } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

const DEMO_TX: { role: string; content: string; meta?: Record<string, unknown> }[] = [
  { role: "system", content: "[engine] Engagement container provisioned · scope guard loaded" },
  { role: "assistant", content: "Plan: read-only recon of allowlisted hosts, then propose active verification steps for your approval." },
  { role: "tool", content: "httpx -silent -status-code -title https://lab.acme.example", meta: { tool: "httpx", action_class: "read" } },
  { role: "tool", content: "HTTP 200 · title \"Acme Lab Portal\" · server nginx", meta: { tool: "httpx", action_class: "read" } },
  { role: "assistant", content: "Recon complete. I'd like to verify the login endpoint with a controlled probe — waiting for your approval." },
];

function demoStartSession(engagementId: number, instruction: string): AgiSession {
  demoSeedEngagements();
  demoSession = {
    id: 101,
    engagement_id: engagementId,
    container_id: "demo-agi-container-101",
    runner_session_id: "demo-runner-101",
    status: "running",
    started_at: new Date().toISOString(),
    meta: {},
  };
  demoTx = [
    { seq: 0, role: "operator", content: instruction, created_at: new Date().toISOString() },
    { seq: 1, role: "system", content: "[engine] Engagement container provisioned · scope guard loaded", created_at: new Date().toISOString() },
  ];
  demoTxEmit = 1;
  demoActions = [];
  demoPoll = 0;
  demoTick = 0;
  return demoSession;
}

/** Emit 0-2 transcript lines + occasionally a pending action as the demo "streams". */
function demoAdvance(): void {
  demoPoll += 1;
  if (demoPoll >= 2) {
    const next = DEMO_TX[demoTxEmit - 1];
    if (next) {
      demoTx.push({ seq: demoTx.length, role: next.role, content: next.content, meta: next.meta ?? null, created_at: new Date().toISOString() });
      demoTxEmit += 1;
      if (demoTxEmit === 5) {
        demoActions = [
          {
            id: 501,
            session_id: demoSession?.id ?? 101,
            action_type: "state_changing",
            tool_name: "http_probe",
            proposed_command: "POST https://lab.acme.example/login -d 'username=admin&password=test'",
            rationale: "Verify whether the login endpoint accepts weak default credentials (in-scope, lab only).",
            status: "pending_approval",
            created_at: new Date().toISOString(),
          },
        ];
      }
    }
  }
  demoTick += 1;
  if (demoTick >= 10) {
    demoTx.push({ seq: demoTx.length, role: "system", content: "[engine] Demo session idle — awaiting further instruction.", created_at: new Date().toISOString() });
    demoTick = 0;
  }
}

function demoTxTail(afterSeq: number): AgiTranscriptChunk[] {
  demoAdvance();
  return demoTx.filter((t) => t.seq > afterSeq);
}

// ── Access / agreement / intent ───────────────────────────────────────────────

export async function loadAgiAccess(): Promise<AgiAccess> {
  if (isDemoMode()) { await delay(250); return demoAccess(); }
  const res = await api.get<AgiAccess>("/agi/access");
  return res ?? demoAccess();
}

export async function loadAgiAgreement(): Promise<AgiAgreement> {
  if (isDemoMode()) { await delay(200); return demoAgreement(); }
  const res = await api.get<AgiAgreement>("/agi/agreement");
  return res ?? demoAgreement();
}

export async function acceptAgiAgreement(surface: "app" | "platform" = "app"): Promise<{ ok: boolean; policy_version: string; message: string }> {
  if (isDemoMode()) { await delay(250); demoAgreed = true; return { ok: true, policy_version: "1.0.0", message: "AGI usage agreement accepted for this organization" }; }
  return api.post<{ ok: boolean; policy_version: string; message: string }>("/agi/agreement/accept", { accepted: true, surface });
}

export async function recommendAgiIntent(text: string, currentMode: "agent" | "agi"): Promise<AgiIntentRecommendation> {
  if (isDemoMode()) {
    await delay(200);
    const agi = /test|scan|probe|pentest|recon|exploit|verify|hack|bruteforce|fuzz/i.test(text);
    const agent = /summar|analy|explain|report|triage|investigate|posture|risk/i.test(text);
    const rec: AgiIntentRecommendation = {
      recommended_mode: agi && !agent ? "agi" : "agent",
      confidence: agi && !agent ? 0.85 : 0.6,
      reason: agi && !agent
        ? "Your request sounds like live testing. The Autonomous Pentest Agent is scoped, approval-gated and better for that."
        : "Your request sounds like analysis of existing data — the Phantix Agent is faster and cheaper for that.",
      can_switch: !!(agi && !agent) && demoAgreed,
      next_step: agi && !agent && !demoAgreed ? "agreement" : agi && !agent ? "switch" : "stay",
    };
    return rec;
  }
  return api.post<AgiIntentRecommendation>("/agi/intent", { text, current_mode: currentMode });
}

// ── Engagements ───────────────────────────────────────────────────────────────

export async function loadAgiEngagements(): Promise<AgiEngagement[]> {
  if (isDemoMode()) { await delay(250); demoSeedEngagements(); return demoEngagements; }
  const res = await api.get<AgiEngagement[]>("/agi/engagements");
  return Array.isArray(res) ? res : [];
}

export async function createAgiEngagement(payload: {
  name: string;
  description?: string;
  scope: { target_allowlist: string[]; forbidden_actions: string[]; rules_of_engagement?: string };
}): Promise<AgiEngagement> {
  if (isDemoMode()) {
    await delay(300);
    const eng: AgiEngagement = {
      id: Date.now(),
      organization_id: 1,
      name: payload.name,
      description: payload.description ?? "",
      scope_definition: {
        target_allowlist: payload.scope.target_allowlist,
        forbidden_actions: payload.scope.forbidden_actions,
        rules_of_engagement: payload.scope.rules_of_engagement ?? "",
        max_session_minutes: 60,
      },
      status: "ready",
      config: { prompts: {}, tools: ["httpx", "nmap_safe", "nuclei_safe"], skills: { auto_select: true, auto_select_limit: 6 } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    demoEngagements = [eng, ...demoEngagements];
    return eng;
  }
  return api.post<AgiEngagement>("/agi/engagements", payload);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function startAgiSession(engagementId: number, instruction: string): Promise<AgiSession> {
  if (isDemoMode()) { await delay(600); return demoStartSession(engagementId, instruction); }
  return api.post<AgiSession>(`/agi/engagements/${engagementId}/sessions`, {
    instruction,
    autonomy: "medium",
    include_org_assets: true,
  });
}

export async function agiChat(sessionId: number, message: string): Promise<Record<string, unknown>> {
  if (isDemoMode()) {
    await delay(500);
    demoTx.push({ seq: demoTx.length, role: "operator", content: message, created_at: new Date().toISOString() });
    demoTx.push({
      seq: demoTx.length,
      role: "assistant",
      content: "Understood — continuing within the approved scope. I'll stream new observations here as they come in.",
      created_at: new Date().toISOString(),
    });
    if (/exploit|attack|inject|credential|brute/i.test(message) && demoActions.length === 0) {
      demoActions = [{
        id: 502,
        session_id: sessionId,
        action_type: "state_changing",
        tool_name: "http_probe",
        proposed_command: "POST https://lab.acme.example/login -d 'username=admin&password=test'",
        rationale: "Proposed after your request — in-scope lab target only.",
        status: "pending_approval",
        created_at: new Date().toISOString(),
      }];
    }
    return { reply: "Understood — continuing within the approved scope." };
  }
  return api.post<Record<string, unknown>>(`/agi/sessions/${sessionId}/chat`, { message });
}

export async function loadAgiTranscript(sessionId: number, afterSeq: number): Promise<AgiTranscriptChunk[]> {
  if (isDemoMode()) { await delay(700); return demoTxTail(afterSeq); }
  const res = await api.get<AgiTranscriptChunk[]>(`/agi/sessions/${sessionId}/transcript?after_seq=${afterSeq}`);
  return Array.isArray(res) ? res : [];
}

export async function loadAgiPendingActions(sessionId: number): Promise<AgiAction[]> {
  if (isDemoMode()) { await delay(400); return demoActions; }
  const res = await api.get<AgiAction[]>(`/agi/sessions/${sessionId}/actions/pending`);
  return Array.isArray(res) ? res : [];
}

export async function decideAgiAction(actionId: number, approve: boolean, notes = ""): Promise<AgiAction> {
  if (isDemoMode()) {
    await delay(350);
    const a = demoActions.find((x) => x.id === actionId);
    if (a) {
      a.status = approve ? "approved" : "rejected";
      a.decision_notes = notes;
      a.decided_at = new Date().toISOString();
      a.executed_at = approve ? new Date().toISOString() : null;
      demoActions = demoActions.filter((x) => x.id !== actionId);
      demoTx.push({ seq: demoTx.length, role: "system", content: `[engine] Action ${approve ? "approved and executed" : "rejected"}: ${a.proposed_command}`, created_at: new Date().toISOString() });
    }
    return a ?? { id: actionId, session_id: 0, action_type: "state_changing", proposed_command: "", rationale: "", status: "rejected", created_at: new Date().toISOString() };
  }
  return api.post<AgiAction>(`/agi/actions/${actionId}/decide`, { approve, notes });
}

export async function stopAgiSession(sessionId: number): Promise<AgiSession> {
  if (isDemoMode()) {
    await delay(400);
    if (demoSession) {
      demoSession.status = "stopped";
      demoSession.ended_at = new Date().toISOString();
      demoTx.push({ seq: demoTx.length, role: "system", content: "[engine] Session stopped · container destroyed · report tagged phantix_agi", created_at: new Date().toISOString() });
    }
    return demoSession ?? { id: sessionId, engagement_id: 0, status: "stopped", started_at: new Date().toISOString() };
  }
  return api.post<AgiSession>(`/agi/sessions/${sessionId}/stop`);
}

export function isAgiPolicyBlocked(err: unknown): { code: string; message: string } | null {
  if (!(err instanceof ApiError)) return null;
  const detail = err.detail as Record<string, unknown> | null;
  const code = typeof detail?.code === "string" ? detail.code : "";
  const message = typeof detail?.message === "string" ? detail.message : err.message;
  if (code.startsWith("forbidden_")) return { code, message };
  return null;
}
