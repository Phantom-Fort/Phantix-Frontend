// Autonomous Pentest Agent (SECUREGRAPH AGI) — customer surface.
// Mirrors app/engines/ai_engine/agi/customer_api.py. Demo-mode fallbacks so the
// UI is testable without a live runner.

import { api, ApiError, delay, isDemoMode, streamSse } from "./api";
import { AGI_ENABLED as AGI_FLAG } from "./config";
import type {
  AgiAccess,
  AgiAction,
  AgiAgreement,
  AgiChatResponse,
  AgiEngagement,
  AgiIntentRecommendation,
  AgiLoopBrief,
  AgiLoopItem,
  AgiSession,
  AgiTranscriptChunk,
} from "./types";

/** Master switch — mirrors backend PHANTIX_AGI_ENABLED (see config.ts). */
export const AGI_ENABLED = AGI_FLAG;
export const AGI_SESSION_START_TIMEOUT_MS = 180_000;

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function asStr(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}
function asLoopItem(raw: unknown): AgiLoopItem {
  const o = asObj(raw);
  return {
    title: asStr(o.title),
    detail: asStr(o.detail),
    severity: asStr(o.severity),
    target: asStr(o.target),
    tool: asStr(o.tool),
    reason: asStr(o.reason),
    action: asStr(o.action),
  };
}

export function normalizeAgiLoop(raw: unknown): AgiLoopBrief {
  const o = asObj(raw);
  return {
    schema: asStr(o.schema, "phantix.agi.loop_brief.v1"),
    event: asStr(o.event),
    session_id: o.session_id != null ? Number(o.session_id) : undefined,
    turn: o.turn != null ? Number(o.turn) : undefined,
    working_on: asStr(o.working_on),
    summary: asStr(o.summary),
    content: asStr(o.content),
    found: Array.isArray(o.found) ? o.found.map(asLoopItem) : [],
    next: Array.isArray(o.next) ? o.next.map(asLoopItem) : [],
    blockers: Array.isArray(o.blockers) ? o.blockers.map(asLoopItem) : [],
    job_status: asStr(o.job_status),
    active_phase: asStr(o.active_phase),
    phase: asStr(o.phase),
    loop_status: asStr(o.loop_status),
    findings_count: o.findings_count != null ? Number(o.findings_count) : 0,
    pending_approvals: o.pending_approvals != null ? Number(o.pending_approvals) : 0,
  };
}

export function normalizeAgiSession(raw: unknown): AgiSession {
  const o = asObj(raw);
  const meta = asObj(o.meta);
  return {
    id: Number(o.id ?? 0),
    engagement_id: Number(o.engagement_id ?? 0),
    container_id: o.container_id == null ? null : String(o.container_id),
    runner_session_id: o.runner_session_id == null ? null : String(o.runner_session_id),
    status: asStr(o.status, "unknown"),
    started_at: asStr(o.started_at, new Date().toISOString()),
    ended_at: o.ended_at == null ? null : String(o.ended_at),
    teardown_reason: o.teardown_reason == null ? null : String(o.teardown_reason),
    meta: Object.keys(meta).length ? meta : {},
    job: asObj(o.job),
    loop: normalizeAgiLoop(o.loop),
    loop_status: o.loop_status === "stopped" || o.loop_status === "running" ? o.loop_status : null,
    loop_stop_reason: o.loop_stop_reason == null ? null : String(o.loop_stop_reason),
    clarification: o.clarification != null && typeof o.clarification === "object" ? (o.clarification as Record<string, unknown>) : null,
  };
}

export function normalizeAgiChat(raw: unknown): AgiChatResponse {
  if (typeof raw === "string") {
    return { ok: true, accepted: true, queued: false, reply: raw, reply_kind: "assistant", job: {}, loop: normalizeAgiLoop({}), found: [], next: [], blockers: [] };
  }
  const o = asObj(raw);
  const reply = typeof o.reply === "string" ? o.reply : typeof o.message === "string" ? o.message : typeof o.content === "string" ? o.content : "";
  return {
    schema_version: asStr(o.schema_version, "phantix.agi.chat.v1"),
    ok: o.ok !== false,
    session_id: o.session_id != null ? Number(o.session_id) : undefined,
    accepted: o.accepted !== false,
    queued: Boolean(o.queued),
    blocked: Boolean(o.blocked),
    mock: Boolean(o.mock),
    code: asStr(o.code),
    reply,
    reply_kind: asStr(o.reply_kind, "assistant"),
    findings_count: o.findings_count != null ? Number(o.findings_count) : 0,
    job: asObj(o.job),
    loop: normalizeAgiLoop(o.loop),
    found: Array.isArray(o.found) ? o.found.map(asLoopItem) : [],
    next: Array.isArray(o.next) ? o.next.map(asLoopItem) : [],
    blockers: Array.isArray(o.blockers) ? o.blockers.map(asLoopItem) : [],
    transcript_seq: o.transcript_seq == null ? null : Number(o.transcript_seq),
  };
}

const ACTIVE_SESSION_KEY = "phantix_agi_active_session";

export function persistAgiSession(s: { id: number; engagement_id: number } | null): void {
  try {
    if (!s) localStorage.removeItem(ACTIVE_SESSION_KEY);
    else localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ id: s.id, engagement_id: s.engagement_id }));
  } catch { /* ignore */ }
}

export function readPersistedAgiSession(): { id: number; engagement_id: number } | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { id?: number; engagement_id?: number };
    if (typeof p.id === "number") return { id: p.id, engagement_id: Number(p.engagement_id ?? 0) };
  } catch { /* ignore */ }
  return null;
}

function isLiveStatus(status: string): boolean {
  return status === "running" || status === "provisioning" || status === "paused";
}

/**
 * Gateway-class failure during session start (408 client timeout, 502/503/504).
 * Session start is synchronous on the backend (Docker provision ~120s) while the
 * edge (Cloudflare) cuts origin responses around ~100s — so a 502/504 does NOT
 * mean the start failed; the backend may have created the session anyway.
 */
export function isAgiGatewayError(e: unknown): boolean {
  return e instanceof ApiError && [408, 502, 503, 504].includes(e.status);
}

/**
 * After a gateway failure on start, poll the live-sessions list briefly and
 * adopt the session if it actually started. Blindly retrying the POST would
 * provision a duplicate container.
 */
async function recoverSessionAfterGatewayFailure(engagementId: number): Promise<AgiSession | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await delay(10_000);
    try {
      const res = await api.get<AgiSession[] | { items?: AgiSession[] }>(
        "/agi/sessions?status=running,paused,provisioning",
      );
      const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      const live = list
        .map(normalizeAgiSession)
        .find((s) => s.engagement_id === engagementId && isLiveStatus(s.status)) ?? null;
      if (live) return live;
    } catch (e) {
      // 404: the live-sessions list route doesn't exist — recovery is impossible
      // on this backend; stop immediately instead of polling for a minute.
      if (e instanceof ApiError && e.status === 404) return null;
      /* other transient errors: keep polling until the window closes */
    }
  }
  return null;
}

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
        label: "SecureGraph Agent",
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
  { role: "system", content: "thinking…" },
  { role: "assistant", content: "Here's what I understood: **run a scoped security assessment of the allowlisted web application** — enumerate, discover endpoints, identify vulnerabilities, and verify with evidence. I'll stay read-only unless you approve an active step." },
  { role: "assistant", content: "Resolved skill: **agi.recon.http-surface** (HTTP surface mapping) — matching this objective." },
  { role: "tool", content: "nmap -sV -T3 --top-ports 100 lab.acme.example", meta: { tool: "nmap", action_class: "read" } },
  { role: "tool", content: "80/tcp open http nginx 1.24.0\n443/tcp open ssl/http nginx 1.24.0\n22/tcp filtered ssh", meta: { tool: "nmap", action_class: "read" } },
  { role: "assistant", content: "Recon looks clean: web on 80/443 only, SSH filtered. I'll fingerprint the HTTP origin and walk common paths next." },
  { role: "tool", content: "httpx -silent -status-code -title https://lab.acme.example", meta: { tool: "httpx", action_class: "read" } },
  { role: "tool", content: "https://lab.acme.example [200] \"Acme Lab Portal\"", meta: { tool: "httpx", action_class: "read" } },
  { role: "tool", content: "ffuf -u https://lab.acme.example/FUZZ -w common.txt -mc 200,302", meta: { tool: "ffuf", action_class: "read" } },
  { role: "tool", content: "/login 200\n/api/v1 200\n/admin 302 → /login\n/health 200", meta: { tool: "ffuf", action_class: "read" } },
  { role: "assistant", content: "Surface mapped. Notes so far:\n\n- **Info** — public app title and tech stack are visible\n- **Low** — server version banner is exposed\n\nAuth sits at `/login`; `/admin` redirects there. I'll run a safe signature scan next — still read-only." },
  { role: "tool", content: "nuclei -u https://lab.acme.example -severity info,low,medium,high", meta: { tool: "nuclei", action_class: "read" } },
  { role: "tool", content: "[info] outdated-jquery\n[low] server-version-disclose\n[medium] missing-security-headers", meta: { tool: "nuclei", action_class: "read" } },
  { role: "assistant", content: "Nothing critical yet. I'd like **one** active check: a single login probe with lab-only default credentials. No spray, no lockout loop. Queuing it for your approval.", gate: true },
  { role: "system", content: "Approved — running within scope.", clearGate: true },
  { role: "tool", content: "POST /login → 302 Location: /admin · session cookie issued", meta: { tool: "http_probe", action_class: "state_changing" } },
  { role: "assistant", content: "**Assessment complete**\n\n| Severity | Finding |\n|---|---|\n| High | Default credentials accepted on `/login` — session issued |\n| Medium | Missing security headers |\n| Low | Server version banner |\n| Info | Public app fingerprint |\n\n**Residual risk:** the authenticated admin surface is now proven. I will not pivot or leave the allowlist. Report tagged for your team." },
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
        : "Your request sounds like analysis of existing data — the SecureGraph Agent is faster and cheaper for that.",
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

export async function loadAgiSession(sessionId: number): Promise<AgiSession | null> {
  if (isDemoMode()) {
    if (demoSession && demoSession.id === sessionId) return normalizeAgiSession(demoSession);
    return null;
  }
  try {
    const raw = await api.get<AgiSession>(`/agi/sessions/${sessionId}`);
    return normalizeAgiSession(raw);
  } catch {
    return null;
  }
}

/** Set once the backend proves `GET /agi/sessions` (list) doesn't exist — avoids a 404 on every mount. */
let agiSessionsListUnavailable = false;

export async function loadActiveAgiSession(): Promise<AgiSession | null> {
  const persisted = readPersistedAgiSession();
  if (persisted) {
    const s = await loadAgiSession(persisted.id);
    if (s && isLiveStatus(s.status)) return s;
    persistAgiSession(null);
  }
  if (isDemoMode()) {
    return demoSession && isLiveStatus(demoSession.status) ? demoSession : null;
  }
  if (agiSessionsListUnavailable) return null;
  try {
    const res = await api.get<AgiSession[] | { items?: AgiSession[] }>("/agi/sessions?status=running,paused,provisioning");
    const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
    const live = list.find((s) => isLiveStatus(s.status)) ?? null;
    if (live) persistAgiSession(live);
    return live;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) agiSessionsListUnavailable = true;
    return null;
  }
}

export type AgiSessionStartOpts = {
  autonomy?: "low" | "medium" | "high";
  include_org_assets?: boolean;
  preapprove_lab_auth?: boolean;
  confirm_environment?: string;
  credentials?: { login_url: string; username: string; password: string; label?: string };
  credential_accounts?: Array<{ login_url: string; username: string; password: string; label?: string }>;
};

export async function startAgiSession(
  engagementId: number,
  instruction: string,
  opts: AgiSessionStartOpts = {},
): Promise<AgiSession> {
  if (isDemoMode()) {
    const s = demoStartSession(engagementId, instruction);
    persistAgiSession(s);
    return normalizeAgiSession(s);
  }
  const body: Record<string, unknown> = {
    instruction,
    autonomy: opts.autonomy ?? "medium",
    include_org_assets: opts.include_org_assets ?? false,
    confirm_environment: opts.confirm_environment ?? "staging",
  };
  if (opts.preapprove_lab_auth != null) body.preapprove_lab_auth = opts.preapprove_lab_auth;
  if (opts.credentials) body.credentials = opts.credentials;
  if (opts.credential_accounts?.length) body.credential_accounts = opts.credential_accounts;
  let s: AgiSession;
  try {
    s = await api.post<AgiSession>(
      `/agi/engagements/${engagementId}/sessions`,
      body,
      { dualControl: true, timeoutMs: AGI_SESSION_START_TIMEOUT_MS },
    );
  } catch (e) {
    if (isAgiGatewayError(e)) {
      const recovered = await recoverSessionAfterGatewayFailure(engagementId);
      if (recovered) {
        persistAgiSession(recovered);
        return recovered;
      }
      throw new ApiError(
        (e as ApiError).status,
        "Session start was cut off at the gateway while the workspace was provisioning. " +
        "The backend may still be starting it — wait a minute before retrying (an immediate retry can create a duplicate session).",
      );
    }
    throw e;
  }
  const normalized = normalizeAgiSession(s);
  persistAgiSession(normalized);
  return normalized;
}

export async function agiChat(sessionId: number, message: string): Promise<AgiChatResponse> {
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
    return normalizeAgiChat({ reply, queued: false, loop: { working_on: "Continuing within the approved scope.", content: reply } });
  }
  const raw = await api.post<unknown>(`/agi/sessions/${sessionId}/chat`, { message }, { dualControl: true });
  return normalizeAgiChat(raw);
}

/** Answer a mid-turn ASK_OPERATOR clarification and resume the loop. */
export async function answerAgiClarification(
  sessionId: number,
  body: { answer: string; clarification_id?: string },
): Promise<Record<string, unknown>> {
  if (isDemoMode()) {
    await delay(350);
    return { ok: true, session_id: sessionId, clarification_id: body.clarification_id ?? "", status: "answered", resumed: true };
  }
  return api.post<Record<string, unknown>>(`/agi/sessions/${sessionId}/clarify`, {
    answer: body.answer,
    clarification_id: body.clarification_id || undefined,
  }, { dualControl: true });
}

export async function loadAgiFindings(sessionId: number): Promise<Array<Record<string, unknown>>> {
  if (isDemoMode()) return [];
  try {
    const res = await api.get<unknown>(`/agi/sessions/${sessionId}/findings`);
    if (Array.isArray(res)) return res as Array<Record<string, unknown>>;
    if (res && typeof res === "object") {
      // Mirror the canonical list unwrapping used across the API (some builds
      // wrap list payloads in items/data/results instead of findings).
      const o = res as Record<string, unknown>;
      for (const key of ["findings", "items", "data", "results", "rows"]) {
        if (Array.isArray(o[key])) return o[key] as Array<Record<string, unknown>>;
      }
    }
    return [];
  } catch {
    return [];
  }
}

/** Human verification layer: confirm or dismiss a finding (operator-gated). */
export async function decideAgiFindingVerification(
  sessionId: number,
  findingId: string,
  verdict: "confirmed" | "rejected",
  note = "",
): Promise<boolean> {
  if (isDemoMode()) return true;
  try {
    await api.post<unknown>(
      `/agi/sessions/${sessionId}/findings/${encodeURIComponent(findingId)}/verdict`,
      { verdict, note },
      { dualControl: true },
    );
    return true;
  } catch {
    return false;
  }
}

/** Promote a session finding into the org risk register (dual-controlled). */
export async function promoteAgiFinding(
  sessionId: number,
  findingId: string | number,
  assetId?: number,
): Promise<Record<string, unknown>> {
  if (isDemoMode()) {
    await delay(320);
    return { ok: true, finding_id: findingId, promoted: true };
  }
  return api.post<Record<string, unknown>>(
    `/agi/sessions/${sessionId}/findings/${encodeURIComponent(String(findingId))}/promote`,
    assetId ? { asset_id: assetId } : {},
    { dualControl: true },
  );
}

/**
 * The job snapshot: whether the agent claims the job is done, and what is left.
 * ``confirm_required`` means a human must confirm before the session completes.
 */
export async function loadAgiJob(sessionId: number): Promise<Record<string, unknown>> {
  if (isDemoMode()) {
    await delay(200);
    return {};
  }
  const res = await api.get<Record<string, unknown> | null>(`/agi/sessions/${sessionId}/job`);
  return (res && typeof res === "object" ? res : {}) as Record<string, unknown>;
}

/** Confirm the agent's "job done" claim so the session can complete and tear down. */
export async function confirmAgiJob(
  sessionId: number,
  note = "",
): Promise<Record<string, unknown>> {
  if (isDemoMode()) {
    await delay(320);
    return { ok: true, confirmed: true };
  }
  return api.post<Record<string, unknown>>(
    `/agi/sessions/${sessionId}/job/confirm`,
    { note },
    { dualControl: true },
  );
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
      demoTx.push({ seq: demoTx.length, role: "system", content: approve ? "Approved — running within scope." : "Rejected — step skipped.", created_at: new Date().toISOString() });
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
      demoTx.push({ seq: demoTx.length, role: "system", content: "Session stopped · report submitted to your team.", created_at: new Date().toISOString() });
    }
    persistAgiSession(null);
    return demoSession ?? { id: sessionId, engagement_id: 0, status: "stopped", started_at: new Date().toISOString() };
  }
  const s = await api.post<AgiSession>(`/agi/sessions/${sessionId}/stop`, undefined, { dualControl: true });
  persistAgiSession(null);
  return s;
}

export function isAgiPolicyBlocked(err: unknown): { code: string; message: string } | null {
  if (!(err instanceof ApiError)) return null;
  const detail = err.detail as Record<string, unknown> | null;
  const code = typeof detail?.code === "string" ? detail.code : "";
  const message = typeof detail?.message === "string" ? detail.message : err.message;
  if (code.startsWith("forbidden_")) return { code, message };
  return null;
}

// ── Durable in-app notifications ──────────────────────────────────────────────
// The backend persists an inbox row for every signal the operator may have
// missed (session complete, new finding, approval gate) and pushes it on the
// org realtime stream. These helpers feed the notification bell and the global
// approval popup, even when the Pentest Agent console is closed.

export interface AgiNotification {
  id: number;
  organization_id: number;
  user_id: number | null;
  kind: string;
  severity: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  engagement_id: number | null;
  session_id: number | null;
  action_id: number | null;
  finding_id: string | null;
  link: string | null;
  requires_action: boolean;
  read: boolean;
  read_at: string | null;
  created_at: string;
  meta: Record<string, unknown>;
}

export interface AgiPendingApproval {
  action_id: number;
  session_id: number;
  engagement_id: number;
  engagement_name: string;
  action_type: string;
  tool_name: string | null;
  proposed_command: string;
  rationale: string | null;
  status: string;
  created_at: string;
  initiator_user_id: number | null;
  session_status: string;
}

function normalizeAgiNotification(raw: unknown): AgiNotification {
  const o = asObj(raw);
  const sev = asStr(o.severity, "info") || "info";
  return {
    id: Number(o.id ?? 0),
    organization_id: Number(o.organization_id ?? 0),
    user_id: o.user_id == null ? null : Number(o.user_id),
    kind: asStr(o.kind),
    severity: sev,
    title: asStr(o.title, "Notification"),
    body: asStr(o.body),
    entity_type: o.entity_type == null ? null : asStr(o.entity_type),
    entity_id: o.entity_id == null ? null : asStr(o.entity_id),
    engagement_id: o.engagement_id == null ? null : Number(o.engagement_id),
    session_id: o.session_id == null ? null : Number(o.session_id),
    action_id: o.action_id == null ? null : Number(o.action_id),
    finding_id: o.finding_id == null ? null : asStr(o.finding_id),
    link: o.link == null ? null : asStr(o.link),
    requires_action: Boolean(o.requires_action),
    read: Boolean(o.read),
    read_at: o.read_at == null ? null : asStr(o.read_at),
    created_at: asStr(o.created_at, new Date().toISOString()),
    meta: asObj(o.meta),
  };
}

function normalizeAgiPendingApproval(raw: unknown): AgiPendingApproval {
  const o = asObj(raw);
  return {
    action_id: Number(o.action_id ?? 0),
    session_id: Number(o.session_id ?? 0),
    engagement_id: Number(o.engagement_id ?? 0),
    engagement_name: asStr(o.engagement_name),
    action_type: asStr(o.action_type, "state_changing"),
    tool_name: o.tool_name == null ? null : asStr(o.tool_name),
    proposed_command: asStr(o.proposed_command),
    rationale: o.rationale == null ? null : asStr(o.rationale),
    status: asStr(o.status, "pending_approval"),
    created_at: asStr(o.created_at, new Date().toISOString()),
    initiator_user_id: o.initiator_user_id == null ? null : Number(o.initiator_user_id),
    session_status: asStr(o.session_status, "running"),
  };
}

/** The durable inbox (org-wide + rows targeted at the signed-in user). */
export async function loadAgiNotifications(
  opts: { unreadOnly?: boolean; limit?: number } = {},
): Promise<AgiNotification[]> {
  if (isDemoMode()) {
    await delay(120);
    return demoNotifications();
  }
  try {
    const qs = new URLSearchParams();
    if (opts.unreadOnly) qs.set("unread_only", "true");
    qs.set("limit", String(opts.limit ?? 30));
    const res = await api.get<{ items?: unknown[] }>(`/notifications?${qs.toString()}`);
    const items = Array.isArray(res) ? res : res?.items ?? [];
    return items.map(normalizeAgiNotification);
  } catch {
    return [];
  }
}

export async function markAgiNotificationRead(id: number): Promise<void> {
  if (isDemoMode()) return;
  try {
    await api.post(`/notifications/${id}/read`);
  } catch {
    /* best-effort */
  }
}

export async function markAllAgiNotificationsRead(): Promise<void> {
  if (isDemoMode()) return;
  try {
    await api.post("/notifications/read-all");
  } catch {
    /* best-effort */
  }
}

/** Cross-session pending approvals for the global popup (initiator-filtered). */
export async function loadAgiPendingApprovals(): Promise<AgiPendingApproval[]> {
  if (isDemoMode()) {
    await delay(120);
    return demoActions.map((a) => ({
      action_id: a.id,
      session_id: a.session_id,
      engagement_id: 0,
      engagement_name: "Lab external web",
      action_type: a.action_type,
      tool_name: a.tool_name ?? null,
      proposed_command: a.proposed_command,
      rationale: a.rationale ?? null,
      status: a.status,
      created_at: a.created_at,
      initiator_user_id: null,
      session_status: "running",
    }));
  }
  try {
    const res = await api.get<{ items?: unknown[] }>("/agi/pending-approvals");
    const items = Array.isArray(res) ? res : res?.items ?? [];
    return items.map(normalizeAgiPendingApproval);
  } catch {
    return [];
  }
}

/** Demo inbox: the pending gate plus a settled finding/completion pair. */
function demoNotifications(): AgiNotification[] {
  const now = Date.now();
  const base: AgiNotification[] = [];
  for (const a of demoActions) {
    base.push({
      id: 910000 + a.id,
      organization_id: 1,
      user_id: null,
      kind: "agi_approval_required",
      severity: "warning",
      title: "Pentest Agent needs your approval",
      body: a.proposed_command,
      entity_type: "agi_action",
      entity_id: String(a.id),
      engagement_id: 0,
      session_id: a.session_id,
      action_id: a.id,
      finding_id: null,
      link: "/pentest-agent",
      requires_action: true,
      read: false,
      read_at: null,
      created_at: a.created_at,
      meta: {},
    });
  }
  if (demoSession) {
    base.push({
      id: 910001,
      organization_id: 1,
      user_id: null,
      kind: "agi_finding",
      severity: "high",
      title: "New finding [high]: Default credentials accepted",
      body: "https://lab.acme.example · http_probe",
      entity_type: "agi_finding",
      entity_id: "demo-f1",
      engagement_id: 0,
      session_id: demoSession.id,
      action_id: null,
      finding_id: "demo-f1",
      link: "/pentest-agent",
      requires_action: false,
      read: false,
      read_at: null,
      created_at: new Date(now - 60_000).toISOString(),
      meta: {},
    });
  }
  return base;
}

/** Live SSE stream for a session (customer surface). No-op in demo mode. */
export async function streamAgiSession(
  sessionId: number,
  onEvent: (event: string, data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (isDemoMode()) return;
  return streamSse(`/agi/sessions/${sessionId}/stream`, onEvent, signal);
}

/** Pause the loop. Enforced runner-side: no tokens or shell work while paused. */
export async function pauseAgiSession(sessionId: number): Promise<AgiSession> {
  if (isDemoMode()) {
    await delay(150);
    return normalizeAgiSession({ id: sessionId, status: "paused", engagement_id: 0 } as AgiSession);
  }
  const raw = await api.post<AgiSession>(`/agi/sessions/${sessionId}/pause`, undefined, { dualControl: true });
  return normalizeAgiSession(raw);
}

/** Resume a paused loop. */
export async function resumeAgiSession(sessionId: number): Promise<AgiSession> {
  if (isDemoMode()) {
    await delay(150);
    return normalizeAgiSession({ id: sessionId, status: "running", engagement_id: 0 } as AgiSession);
  }
  const raw = await api.post<AgiSession>(`/agi/sessions/${sessionId}/resume`, undefined, { dualControl: true });
  return normalizeAgiSession(raw);
}

// ── Prior pentest/VAPT reports (org-wide knowledge) ──────────────────────────

/** Accepted upload formats; the backend converts each to markdown. */
export const AGI_REPORT_ACCEPT = ".docx,.pdf,.md,.markdown,.html,.htm,.txt";
export const AGI_REPORT_MAX_BYTES = 8 * 1024 * 1024;

export interface AgiPriorReport {
  id: number;
  organization_id: number | null;
  kind: string;
  title: string;
  body_md: string;
  tags: string[];
  categories: string[];
  status: string;
  meta: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  /** Conversion notes from the upload (e.g. "scanned PDF needs OCR"). */
  warnings?: string[];
}

export class AgiReportError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Client-side guard so the operator gets a clear reason before the upload. */
export function validateAgiReportFile(file: File): void {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!["docx", "pdf", "md", "markdown", "html", "htm", "txt"].includes(ext)) {
    throw new AgiReportError("unsupported_type", `Unsupported file type “.${ext}”. Use DOCX, PDF, MD, HTML, or TXT.`);
  }
  if (file.size === 0) throw new AgiReportError("empty_file", "That file is empty.");
  if (file.size > AGI_REPORT_MAX_BYTES) {
    throw new AgiReportError("too_large", `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 8 MB.`);
  }
}

export async function loadAgiPriorReports(query = ""): Promise<AgiPriorReport[]> {
  if (isDemoMode()) {
    return [
      {
        id: 1,
        organization_id: 1,
        kind: "prior_report",
        title: "Q2 2026 External VAPT",
        body_md: "# Q2 2026 External VAPT\n\n- Critical: default credentials on the admin console\n- High: IDOR on /api/v1/orders/{id}",
        tags: ["prior_report"],
        categories: ["default_credentials", "idor"],
        status: "active",
        meta: { source_file: "q2-2026-vapt.pdf", file_type: "pdf", byte_size: 482113, conversion_warnings: [] },
        created_at: new Date(Date.now() - 86_400_000).toISOString(),
        updated_at: new Date(Date.now() - 86_400_000).toISOString(),
      },
    ];
  }
  const qs = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : "";
  const res = await api.get<{ items?: AgiPriorReport[] } | AgiPriorReport[]>(
    `/agi/knowledge?kind=prior_report${qs}`,
  );
  const items = Array.isArray(res) ? res : res.items || [];
  return items.map((r) => ({ ...r, meta: asObj(r.meta) }));
}

export async function uploadAgiPriorReport(
  file: File,
  opts: { title?: string; tags?: string; categories?: string; reportDate?: string } = {},
): Promise<AgiPriorReport> {
  validateAgiReportFile(file);
  if (isDemoMode()) {
    await delay(600);
    return {
      id: Date.now(),
      organization_id: 1,
      kind: "prior_report",
      title: opts.title?.trim() || file.name,
      body_md: `# ${opts.title?.trim() || file.name}\n\n_(demo upload)_`,
      tags: ["prior_report"],
      categories: (opts.categories || "").split(",").map((s) => s.trim()).filter(Boolean),
      status: "active",
      meta: { source_file: file.name, file_type: (file.name.split(".").pop() || "").toLowerCase() },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      warnings: [],
    };
  }
  const fd = new FormData();
  fd.append("file", file);
  if (opts.title?.trim()) fd.append("title", opts.title.trim());
  if (opts.tags?.trim()) fd.append("tags", opts.tags.trim());
  if (opts.categories?.trim()) fd.append("categories", opts.categories.trim());
  if (opts.reportDate?.trim()) fd.append("report_date", opts.reportDate.trim());
  return api.upload<AgiPriorReport>("/agi/knowledge/upload", fd);
}
