// Autonomous Pentest Agent (PHANTIX AGI) — customer surface.
// Mirrors app/engines/ai_engine/agi/customer_api.py. Demo-mode fallbacks so the
// UI is testable without a live runner.

import { api, ApiError, delay, isDemoMode } from "./api";
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

export async function loadAgiFindings(sessionId: number): Promise<Array<Record<string, unknown>>> {
  if (isDemoMode()) return [];
  try {
    const res = await api.get<unknown>(`/agi/sessions/${sessionId}/findings`);
    if (Array.isArray(res)) return res as Array<Record<string, unknown>>;
    if (res && typeof res === "object" && Array.isArray((res as { findings?: unknown }).findings)) {
      return (res as { findings: Array<Record<string, unknown>> }).findings;
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
