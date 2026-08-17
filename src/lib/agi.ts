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
let demoStartedAt = 0;
const DEMO_SPAN_MS = 10000;

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

const DEMO_TX: { role: string; content: string; meta?: Record<string, unknown>; gate?: boolean; clearGate?: boolean }[] = [
  { role: "system", content: "[engine] Engagement container provisioned\n[engine] Scope guard loaded\n[engine] allowlist = lab.acme.example, api.acme-lab.example\n[engine] forbidden = dos, ransomware, data_exfil_bulk" },
  { role: "assistant", content: "Acknowledged. I will stay **read-only** until you approve anything that changes state.\n\n**Attack plan**\n1. Recon — enumerate services on the allowlisted host\n2. Endpoint discovery — map HTTP surface and interesting paths\n3. Vuln identification — banner, headers, signature scan\n4. Exploit chain — one gated credential probe, then stop and report" },
  { role: "tool", content: "nmap -sV -T3 --top-ports 100 lab.acme.example", meta: { tool: "nmap", action_class: "read" } },
  { role: "tool", content: "PORT    STATE    SERVICE  VERSION\n80/tcp  open     http     nginx 1.24.0\n443/tcp open     ssl/http nginx 1.24.0\n22/tcp  filtered ssh", meta: { tool: "nmap", action_class: "read" } },
  { role: "assistant", content: "Recon is clean.\n\n- Web only on 80/443 (nginx 1.24.0)\n- SSH is filtered — I will not touch it\n- No unexpected ports, no shadow admin listeners\n\nNext I fingerprint the HTTP origin and walk a small path dictionary." },
  { role: "tool", content: "httpx -silent -status-code -title -tech-detect https://lab.acme.example", meta: { tool: "httpx", action_class: "read" } },
  { role: "tool", content: "https://lab.acme.example  [200]  [Acme Lab Portal]  [nginx/1.24.0]  [jquery]", meta: { tool: "httpx", action_class: "read" } },
  { role: "tool", content: "ffuf -u https://lab.acme.example/FUZZ -w common.txt -mc 200,302 -t 20", meta: { tool: "ffuf", action_class: "read" } },
  { role: "tool", content: "/login   200\n/api/v1  200\n/admin   302 → /login\n/health  200\n/assets  200", meta: { tool: "ffuf", action_class: "read" } },
  { role: "assistant", content: "Surface mapped. Two notes before I go any further:\n\n- **Info** — application title and tech stack are public (`Acme Lab Portal`, nginx + jQuery)\n- **Low** — `Server: nginx/1.24.0` banner is leaking a precise version\n\nAuth lives at `/login`; `/admin` just redirects there. I will run a safe nuclei template pack next — still read-only." },
  { role: "tool", content: "nuclei -u https://lab.acme.example -severity info,low,medium,high -rate-limit 20", meta: { tool: "nuclei", action_class: "read" } },
  { role: "tool", content: "[info] outdated-jquery  CVE-2020-11022\n[low]  nginx-version-disclose\n[medium] missing-security-headers  (CSP, X-Frame-Options)", meta: { tool: "nuclei", action_class: "read" } },
  { role: "assistant", content: "Signature scan is in. Nothing critical yet.\n\nI want **one** state-changing check: a single POST to `/login` with lab-only default credentials (`admin` / `test`). No spray, no lockout loop, no host outside the allowlist.\n\nQueuing that step for your approval.", gate: true },
  { role: "system", content: "[engine] Operator approved state-changing step · within ROE · lab target only", clearGate: true },
  { role: "tool", content: "POST https://lab.acme.example/login\nusername=admin&password=test\n→ HTTP 302 Location: /admin  Set-Cookie: session=a1b2…; Path=/", meta: { tool: "http_probe", action_class: "state_changing" } },
  { role: "assistant", content: "**Engagement complete — verified results**\n\n| Sev | Finding |\n|---|---|\n| High | Default credentials accepted on `/login` → session cookie issued, `/admin` reachable |\n| Medium | Missing security headers (CSP, clickjacking) |\n| Low | nginx version banner |\n| Info | Public app fingerprint |\n\n**Residual risk:** authenticated admin surface is now proven, not theoretical. I will not pivot, dump data, or leave the allowlist.\n\nReport tagged `phantix_agi`. Container will destroy on stop." },
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
  ];
  demoTxEmit = 0;
  demoActions = [];
  demoPoll = 0;
  demoTick = 0;
  demoStartedAt = Date.now();
  return demoSession;
}

function demoAdvance(): void {
  const n = DEMO_TX.length;
  if (n === 0) return;
  const elapsed = Date.now() - demoStartedAt;
  const target = Math.min(n, Math.max(1, Math.ceil((elapsed / DEMO_SPAN_MS) * n)));
  while (demoTxEmit < target) {
    const scripted = DEMO_TX[demoTxEmit];
    demoTx.push({
      seq: demoTx.length,
      role: scripted.role,
      content: scripted.content,
      meta: scripted.meta ?? null,
      created_at: new Date().toISOString(),
    });
    demoTxEmit += 1;
    if (scripted.gate) {
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
    if (scripted.clearGate) demoActions = [];
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
  return api.post<AgiEngagement>("/agi/engagements", {
    ...payload,
    scope: {
      target_allowlist: payload.scope.target_allowlist,
      forbidden_actions: payload.scope.forbidden_actions,
      rules_of_engagement: payload.scope.rules_of_engagement ?? "",
      target_environment: "staging",
      production_ack: false,
    },
  }, { dualControl: true });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function startAgiSession(engagementId: number, instruction: string): Promise<AgiSession> {
  if (isDemoMode()) { await delay(180); return demoStartSession(engagementId, instruction); }
  return api.post<AgiSession>(`/agi/engagements/${engagementId}/sessions`, {
    instruction,
    autonomy: "medium",
    include_org_assets: true,
  }, { dualControl: true });
}

export async function agiChat(sessionId: number, message: string): Promise<Record<string, unknown>> {
  if (isDemoMode()) {
    await delay(500);
    demoTx.push({ seq: demoTx.length, role: "operator", content: message, created_at: new Date().toISOString() });
    const reply = /scope|allowlist/i.test(message)
      ? "Still inside the approved allowlist (`lab.acme.example`, `api.acme-lab.example`). I will not step outside it."
      : /stop|halt|enough/i.test(message)
        ? "Acknowledged. I will idle on read-only observations and wait for your next instruction."
        : /login|password|credential|exploit/i.test(message)
          ? "That would be state-changing. I've queued a single in-scope login probe — approve or reject it in the gate below."
          : "Understood — continuing within the approved scope. I'll stream new observations here as they come in.";
    demoTx.push({
      seq: demoTx.length,
      role: "assistant",
      content: reply,
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
  return api.post<Record<string, unknown>>(`/agi/sessions/${sessionId}/chat`, { message }, { dualControl: true });
}

export async function loadAgiTranscript(sessionId: number, afterSeq: number): Promise<AgiTranscriptChunk[]> {
  if (isDemoMode()) { await delay(40); return demoTxTail(afterSeq); }
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
  return api.post<AgiAction>(`/agi/actions/${actionId}/decide`, { approve, notes }, { dualControl: true });
}

export async function stopAgiSession(sessionId: number): Promise<AgiSession> {
  if (isDemoMode()) {
    await delay(400);
    if (demoSession) {
      demoSession.status = "stopped";
      demoSession.ended_at = new Date().toISOString();
      demoSession.meta = { ...(demoSession.meta ?? {}), report: { report_id: 4600 + (demoSession.id % 100), source: "phantix_agi" } };
      demoTx.push({ seq: demoTx.length, role: "system", content: "[engine] Session stopped · container destroyed · report tagged phantix_agi · submitted to report engine", created_at: new Date().toISOString() });
    }
    return demoSession ?? { id: sessionId, engagement_id: 0, status: "stopped", started_at: new Date().toISOString() };
  }
  return api.post<AgiSession>(`/agi/sessions/${sessionId}/stop`, undefined, { dualControl: true });
}

export function isAgiPolicyBlocked(err: unknown): { code: string; message: string } | null {
  if (!(err instanceof ApiError)) return null;
  const detail = err.detail as Record<string, unknown> | null;
  const code = typeof detail?.code === "string" ? detail.code : "";
  const message = typeof detail?.message === "string" ? detail.message : err.message;
  if (code.startsWith("forbidden_")) return { code, message };
  return null;
}
