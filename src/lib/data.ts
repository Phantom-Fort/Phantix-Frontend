// Central resource loaders --- demo-data only when isDemoMode() is true.
import { api, ApiError, delay, isDemoMode, isSecurityDbBlocked, tokens, API_BASE } from "./api";
import * as demo from "./demo-data";
import type {
  AgentRun,
  AgentSkill,
  AgentSkillStatusUpdate,
  AgentStreamEvent,
  AiStatus,
  AlertEvent,
  AlertSettings,
  Asset,
  AssetIntelligence,
  AssetTag,
  AuditEvent,
  ComplianceAssessment,
  ComplianceControlResult,
  ComplianceFramework,
  DiscoveryJob,
  DualControlState,
  EvidenceItem,
  IntelligenceDashboard,
  OrgUser,
  Organization,
  PendingAction,
  PrioritizedAsset,
  RelationshipGraph,
  Report,
  Risk,
  ScanJob,
  ScanResult,
  SocAdapter,
  SocCase,
  SocCaseNote,
  SocDashboardScaffold,
  SocDetection,
  SocDetectionListResponse,
  SocEnrichmentResult,
  SocRule,
  SocStatus,
  SocTriagePacket,
  SupportTicket,
  TrackerFinding,
  VaptApproval,
  VaptCampaign,
  VaptFinding,
} from "./types";

export const emptyOrganization: Organization = {
  id: 0,
  name: "Organization",
  slug: "",
  creator_user_id: null,
  country: "",
  industry: "",
  setup_complete: false,
  company_verified: false,
  identity_verified: false,
  plan: "",
  created_at: new Date().toISOString(),
};

export const emptyDualControl: DualControlState = {
  configured: false,
  require_dual_control: false,
  initiator: null,
  authorizer: null,
};

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["items", "data", "results", "rows", "events", "jobs", "campaigns", "findings", "risks", "assets", "users", "tickets", "reports"]) {
      if (Array.isArray(o[key])) return o[key] as T[];
    }
  }
  return [];
}

export type LoadMeta = {
  /** Security storage not bootstrapped (API 409) --- product modules blocked. */
  securityDbBlocked?: boolean;
  error?: string | null;
};

async function softList<T>(path: string, meta?: LoadMeta): Promise<T[]> {
  try {
    return asList<T>(await api.get<unknown>(path));
  } catch (err) {
    if (meta && isSecurityDbBlocked(err)) {
      meta.securityDbBlocked = true;
      meta.error = err instanceof Error ? err.message : "Security database not ready";
    } else if (meta && err instanceof ApiError && err.status !== 404) {
      meta.error = err.message;
    }
    return [];
  }
}

async function softOne<T>(path: string, meta?: LoadMeta): Promise<T | null> {
  try {
    return await api.get<T>(path);
  } catch (err) {
    if (meta && isSecurityDbBlocked(err)) {
      meta.securityDbBlocked = true;
      meta.error = err instanceof Error ? err.message : "Security database not ready";
    }
    return null;
  }
}

function pickUser(u: Record<string, unknown> | null | undefined): DualControlState["initiator"] {
  if (!u) return null;
  return {
    id: Number(u.id ?? 0),
    full_name: String(u.full_name ?? u.name ?? ""),
    email: String(u.email ?? ""),
    title: String(u.title ?? ""),
  };
}

export function normalizeOrganization(raw: Record<string, unknown> | Organization | null | undefined): Organization {
  if (!raw) return emptyOrganization;
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id ?? 0),
    name: String(r.name ?? r.company_name ?? "Organization"),
    slug: String(r.slug ?? ""),
    creator_user_id: (r.creator_user_id as number | null) ?? null,
    country: String(r.country ?? ""),
    industry: String(r.industry ?? ""),
    setup_complete: Boolean(r.setup_complete ?? r.setup_completed ?? false),
    company_verified: Boolean(r.company_verified ?? false),
    identity_verified: Boolean(r.identity_verified ?? false),
    plan: String(r.plan ?? r.plan_name ?? ""),
    created_at: String(r.created_at ?? new Date().toISOString()),
  };
}

export function normalizeDualControl(raw: unknown, users: OrgUser[] = []): DualControlState {
  if (!raw || typeof raw !== "object") return emptyDualControl;
  const r = raw as Record<string, unknown>;
  const initiator =
    pickUser(r.initiator as Record<string, unknown>) ||
    users.find((u) => u.id === Number(r.initiator_user_id ?? r.initiator_id)) ||
    users.find((u) => u.is_initiator) ||
    null;
  const authorizer =
    pickUser(r.authorizer as Record<string, unknown>) ||
    users.find((u) => u.id === Number(r.authorizer_user_id ?? r.authorizer_id)) ||
    users.find((u) => u.is_authorizer) ||
    null;
  const configured = Boolean(
    r.configured ?? r.require_dual_control ?? (initiator && authorizer),
  );
  return {
    configured,
    require_dual_control: Boolean(r.require_dual_control ?? configured),
    initiator: initiator
      ? { id: initiator.id, full_name: initiator.full_name, email: initiator.email, title: initiator.title ?? "" }
      : null,
    authorizer: authorizer
      ? { id: authorizer.id, full_name: authorizer.full_name, email: authorizer.email, title: authorizer.title ?? "" }
      : null,
  };
}

export async function loadOrganization(): Promise<Organization> {
  if (isDemoMode()) {
    await delay(200);
    return demo.organization;
  }
  const me = await softOne<Record<string, unknown>>("/organizations/me");
  return normalizeOrganization(me);
}

export async function loadOrgUsers(): Promise<OrgUser[]> {
  if (isDemoMode()) {
    await delay(200);
    return demo.orgUsers;
  }
  return softList<OrgUser>("/org-users");
}

export async function loadDualControl(users?: OrgUser[]): Promise<DualControlState> {
  if (isDemoMode()) {
    await delay(200);
    return demo.dualControl;
  }
  const raw = await softOne<unknown>("/org-users/dual-control");
  const list = users ?? (await loadOrgUsers());
  return normalizeDualControl(raw, list);
}

export async function loadAssetsBundle() {
  if (isDemoMode()) {
    await delay();
    return {
      assets: demo.assets,
      assetTags: demo.assetTags,
      discoveryJobs: demo.discoveryJobs,
      securityDbBlocked: false as boolean,
      error: null as string | null,
    };
  }
  const meta: LoadMeta = {};
  const [assets, assetTags, discoveryJobs] = await Promise.all([
    softList<Asset>("/assets", meta),
    softList<AssetTag>("/asset-tags", meta),
    softList<DiscoveryJob>("/assets/discovery/jobs", meta),
  ]);
  return {
    assets,
    assetTags,
    discoveryJobs,
    securityDbBlocked: !!meta.securityDbBlocked,
    error: meta.error ?? null,
  };
}

export async function loadScansBundle() {
  if (isDemoMode()) {
    await delay();
    return {
      scanJobs: demo.scanJobs,
      scanResults: demo.scanResults,
      securityDbBlocked: false as boolean,
      error: null as string | null,
    };
  }
  const meta: LoadMeta = {};
  const [scanJobs, scanResults] = await Promise.all([
    softList<ScanJob>("/scans/jobs", meta),
    softList<ScanResult>("/scans/results", meta),
  ]);
  return {
    scanJobs,
    scanResults,
    securityDbBlocked: !!meta.securityDbBlocked,
    error: meta.error ?? null,
  };
}

export async function loadVaptBundle() {
  if (isDemoMode()) {
    await delay();
    return {
      campaigns: demo.vaptCampaigns,
      findings: demo.vaptFindings,
      approvals: demo.vaptApprovals,
      securityDbBlocked: false as boolean,
      error: null as string | null,
    };
  }
  const meta: LoadMeta = {};
  const campaigns = await softList<VaptCampaign>("/vapt/campaigns", meta);
  const findings: VaptFinding[] = [];
  const approvals: VaptApproval[] = [];
  await Promise.all(
    campaigns.slice(0, 25).map(async (c) => {
      const [f, a] = await Promise.all([
        softList<VaptFinding>(`/vapt/campaigns/${c.id}/findings`, meta),
        softList<VaptApproval>(`/vapt/campaigns/${c.id}/approvals`, meta),
      ]);
      for (const item of f) findings.push({ ...item, campaign_id: item.campaign_id ?? c.id });
      for (const item of a) {
        approvals.push({
          ...item,
          campaign_id: item.campaign_id ?? c.id,
          campaign_name: item.campaign_name ?? c.name,
        });
      }
    }),
  );
  return {
    campaigns,
    findings,
    approvals,
    securityDbBlocked: !!meta.securityDbBlocked,
    error: meta.error ?? null,
  };
}

export async function loadRisks(): Promise<Risk[]> {
  if (isDemoMode()) {
    await delay();
    return demo.risks;
  }
  const meta: LoadMeta = {};
  const prioritized = await softList<Risk>("/risks/prioritized", meta);
  if (prioritized.length) return prioritized;
  return softList<Risk>("/risks", meta);
}

export async function loadRisksBundle() {
  if (isDemoMode()) {
    await delay();
    return { risks: demo.risks, securityDbBlocked: false as boolean, error: null as string | null };
  }
  const meta: LoadMeta = {};
  const prioritized = await softList<Risk>("/risks/prioritized", meta);
  const risks = prioritized.length ? prioritized : await softList<Risk>("/risks", meta);
  return { risks, securityDbBlocked: !!meta.securityDbBlocked, error: meta.error ?? null };
}

export async function loadComplianceBundle() {
  if (isDemoMode()) {
    await delay();
    return {
      frameworks: demo.complianceFrameworks,
      assessments: demo.complianceAssessments,
      controlResults: demo.complianceControlResults,
      evidence: demo.evidenceItems,
    };
  }
  const [frameworks, assessments, evidence] = await Promise.all([
    softList<ComplianceFramework>("/compliance/frameworks"),
    softList<ComplianceAssessment>("/compliance/assessments"),
    softList<EvidenceItem>("/compliance/evidence"),
  ]);
  let controlResults: ComplianceControlResult[] = [];
  const latest = assessments[0];
  if (latest?.id != null) {
    controlResults = await softList<ComplianceControlResult>(`/compliance/assessments/${latest.id}/results`);
  }
  return { frameworks, assessments, controlResults, evidence };
}

export async function loadReportsBundle() {
  if (isDemoMode()) {
    await delay();
    return { reports: demo.reports, trackerFindings: demo.trackerFindings };
  }
  const [reports, trackerFindings] = await Promise.all([
    softList<Report>("/reports"),
    softList<TrackerFinding>("/reports/tracker"),
  ]);
  return { reports, trackerFindings };
}

export async function loadAlertsBundle() {
  if (isDemoMode()) {
    await delay();
    return { events: demo.alertEvents, settings: demo.alertSettings };
  }
  const [events, settingsRaw] = await Promise.all([
    softList<AlertEvent>("/alerts/events"),
    softOne<AlertSettings>("/alerts/settings"),
  ]);
  const raw = settingsRaw && typeof settingsRaw === "object" ? (settingsRaw as Record<string, any>) : {};
  const smtp = raw.smtp && typeof raw.smtp === "object" ? (raw.smtp as Record<string, any>) : {};
  const wa = raw.whatsapp && typeof raw.whatsapp === "object" ? (raw.whatsapp as Record<string, any>) : {};
  const tg = raw.telegram && typeof raw.telegram === "object" ? (raw.telegram as Record<string, any>) : {};
  const settings: AlertSettings = {
    alerts_enabled: raw.alerts_enabled !== false,
    smtp: {
      enabled: smtp.enabled !== false,
      host: String(smtp.host ?? ""),
      port: Number(smtp.port ?? 587),
      from_email: String(smtp.from_email ?? smtp.fromEmail ?? ""),
      from_name: String(smtp.from_name ?? smtp.fromName ?? "Phantix Alerts"),
      use_tls: smtp.use_tls !== false,
    },
    email_recipients: Array.isArray(raw.email_recipients) ? raw.email_recipients.map(String) : [],
    whatsapp: {
      enabled: wa.enabled === true,
      provider: String(wa.provider ?? "auto"),
      recipients: Array.isArray(wa.recipients) ? wa.recipients.map(String) : [],
    },
    telegram: {
      enabled: tg.enabled === true,
      provider: String(tg.provider ?? "auto"),
      recipients: Array.isArray(tg.recipients) ? tg.recipients.map(String) : [],
    },
    notify: (raw.notify && typeof raw.notify === "object" ? raw.notify : {}) as Record<string, boolean>,
  };
  return { events, settings };
}

export async function loadAuditBundle() {
  if (isDemoMode()) {
    await delay();
    return { events: demo.auditEvents };
  }
  const events = await softList<AuditEvent>("/audit/events");
  return { events };
}

export async function loadPeopleBundle() {
  if (isDemoMode()) {
    await delay();
    return { users: demo.orgUsers, dualControl: demo.dualControl };
  }
  const users = await softList<OrgUser>("/org-users");
  const dualControl = await loadDualControl(users);
  return { users, dualControl };
}

export async function loadSupportTickets(): Promise<SupportTicket[]> {
  if (isDemoMode()) {
    await delay();
    return demo.supportTickets;
  }
  const list = await softList<Record<string, unknown>>("/support/tickets");
  return list.map((t) => ({
    id: Number(t.id ?? 0),
    subject: String(t.subject ?? ""),
    status: String(t.status ?? "open") as SupportTicket["status"],
    priority: String(t.priority ?? "normal"),
    category: String(t.category ?? ""),
    created_at: String(t.created_at ?? new Date().toISOString()),
    updated_at: String(t.last_activity_at ?? t.updated_at ?? t.created_at ?? new Date().toISOString()),
    messages: Array.isArray(t.messages)
      ? (t.messages as Record<string, unknown>[]).map((m) => ({
          id: Number(m.id ?? 0),
          from: String(m.submitter_name ?? m.from ?? "You"),
          body: String(m.body ?? m.message ?? ""),
          at: String(m.created_at ?? m.at ?? new Date().toISOString()),
        }))
      : [],
  }));
}

export type PosturePoint = { day: string; score: number; findings: number };
export type SeveritySlice = { name: string; value: number; color: string };

const SEV_COLORS: Record<string, string> = {
  Critical: "#F43F5E",
  High: "#FB923C",
  Medium: "#FACC15",
  Low: "#38BDF8",
  Info: "#94A3B8",
};

function severityDistributionFrom(items: { severity?: string; level?: string }[]): SeveritySlice[] {
  const counts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
  for (const item of items) {
    const s = String(item.severity ?? item.level ?? "info").toLowerCase();
    if (s === "critical") counts.Critical++;
    else if (s === "high") counts.High++;
    else if (s === "medium") counts.Medium++;
    else if (s === "low") counts.Low++;
    else counts.Info++;
  }
  return (Object.keys(counts) as (keyof typeof counts)[]).map((name) => ({
    name,
    value: counts[name],
    color: SEV_COLORS[name],
  }));
}

function postureFromRisks(risks: Risk[]): { trend: PosturePoint[]; score: number } {
  const open = risks.filter((r) => !["closed", "accepted"].includes(r.status));
  const crit = open.filter((r) => r.level === "critical").length;
  const high = open.filter((r) => r.level === "high").length;
  const score = Math.max(0, Math.min(100, 100 - crit * 12 - high * 6 - open.length * 2));
  const now = new Date();
  const trend: PosturePoint[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (13 - i));
    return {
      day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      score,
      findings: open.length,
    };
  });
  return { trend, score };
}

// ── Asset Intelligence loaders ────────────────────────────────────────────────
export async function loadIntelligenceDashboard(): Promise<IntelligenceDashboard | null> {
  if (isDemoMode()) {
    await delay();
    // Deterministic trend — reuse the demo dashboard trend so the graph never
    // re-randomizes on each poll (the old code used Math.random() per call,
    // which made the posture chart "glitch" between refreshes).
    const trend = (demo.postureTrend as PosturePoint[]).map((p) => ({ day: p.day, score: p.score }));
    const lastScore = trend[trend.length - 1]?.score ?? 71;
    return {
      posture_score: lastScore,
      posture_trend: trend,
      total_assets: demo.assets.length,
      verified_count: demo.assets.filter((a) => a.is_verified).length,
      unscanned_count: 3,
      critical_assets_at_risk: demo.assets.slice(0, 3).map((a, i) => ({
        id: a.id,
        name: a.name,
        value: a.value,
        risk_score: 80 + i * 5,
        open_findings: 3 + i,
      })),
      newly_discovered: demo.assets.slice(-2).map((a) => ({
        id: a.id,
        name: a.name,
        value: a.value,
        asset_type: a.asset_type,
      })),
      severity_distribution: [
        { severity: "critical", count: 2 },
        { severity: "high", count: 5 },
        { severity: "medium", count: 8 },
        { severity: "low", count: 12 },
      ],
      top_exposures: [
        { exposure: "public_web", count: 15 },
        { exposure: "internal_api", count: 8 },
        { exposure: "cloud_storage", count: 5 },
      ],
    };
  }
  return await softOne<IntelligenceDashboard>("/assets/intelligence/dashboard");
}

export async function loadPrioritizedAssets(): Promise<PrioritizedAsset[]> {
  if (isDemoMode()) {
    await delay();
    return demo.assets.map((a, i) => ({
      id: a.id,
      asset_type: a.asset_type,
      value: a.value,
      name: a.name,
      criticality: a.criticality,
      risk_score: 30 + Math.floor(Math.random() * 60),
      risk_level: ["low", "medium", "high", "critical"][i % 4],
      open_findings: i,
      exposure: ["public_web", "internal_api", "cloud_storage"][i % 3],
      is_verified: a.is_verified,
      last_seen_at: a.last_seen_at,
    }));
  }
  const raw = await api.get<unknown>("/assets/intelligence/prioritized");
  return (asList(raw) as PrioritizedAsset[]).map((a) => ({
    ...a,
    id: Number(a.id),
    risk_score: Number(a.risk_score ?? 0),
    open_findings: Number(a.open_findings ?? 0),
  }));
}

export async function loadAssetIntelligence(assetId: number): Promise<AssetIntelligence | null> {
  if (isDemoMode()) {
    await delay();
    const a = demo.assets.find((x) => x.id === assetId) ?? demo.assets[0];
    return {
      asset: { id: a.id, name: a.name, value: a.value, asset_type: a.asset_type },
      risk_score: 62,
      risk_level: "medium",
      previous_risk_score: 78,
      risk_score_delta: -16,
      open_findings_count: 4,
      exposure_level: "external_facing",
      posture_summary: "Moderate risk due to exposed public API endpoints. The asset has been scanned 3 times in the past 30 days with 4 open findings, 2 of which are high severity.",
      recommended_actions: [
        { action_key: "scan_now", label: "Run a new scan", description: "Check for newly introduced vulnerabilities", priority: "high" },
        { action_key: "review_findings", label: "Review open findings", description: "4 findings need verification or remediation", priority: "high" },
        { action_key: "update_firewall", label: "Review firewall rules", description: "Public-facing asset --- ensure WAF rules are current", priority: "medium" },
      ],
      related_assets: demo.assets.filter((x) => x.id !== a.id).slice(0, 3).map((r) => ({
        id: r.id, name: r.name, value: r.value, asset_type: r.asset_type, risk_score: 30 + Math.floor(Math.random() * 40),
      })),
      active_threats: ["CVE-2026-12345", "OWASP A03-Injection"],
    };
  }
  return await softOne<AssetIntelligence>(`/assets/${assetId}/intelligence`);
}

export async function loadDashboardBundle() {
  if (isDemoMode()) {
    await delay();
    return {
      assets: demo.assets,
      risks: demo.risks,
      scanJobs: demo.scanJobs,
      vaptCampaigns: demo.vaptCampaigns,
      alertEvents: demo.alertEvents,
      auditEvents: demo.auditEvents,
      complianceAssessments: demo.complianceAssessments,
      reports: demo.reports,
      postureTrend: demo.postureTrend as PosturePoint[],
      severityDistribution: demo.severityDistribution as SeveritySlice[],
      securityDbBlocked: false as boolean,
      error: null as string | null,
    };
  }
  const meta: LoadMeta = {};
  const [assets, risks, scanJobs, vaptCampaigns, alertEvents, auditEvents, complianceAssessments, reports, scanResults] =
    await Promise.all([
      softList<Asset>("/assets", meta),
      loadRisks(),
      softList<ScanJob>("/scans/jobs", meta),
      softList<VaptCampaign>("/vapt/campaigns", meta),
      softList<AlertEvent>("/alerts/events"),
      softList<AuditEvent>("/audit/events"),
      softList<ComplianceAssessment>("/compliance/assessments"),
      softList<Report>("/reports"),
      softList<ScanResult>("/scans/results", meta),
    ]);
  const { trend: postureTrend } = postureFromRisks(risks);
  const severitySource = scanResults.length
    ? scanResults
    : risks.map((r) => ({ severity: r.level }));
  const severityDistribution = severityDistributionFrom(severitySource);
  return {
    assets,
    risks,
    scanJobs,
    vaptCampaigns,
    alertEvents,
    auditEvents,
    complianceAssessments,
    reports,
    postureTrend,
    severityDistribution,
    securityDbBlocked: !!meta.securityDbBlocked,
    error: meta.error ?? null,
  };
}

export async function loadRelationshipGraph(params?: { max_nodes?: number; relationship_type?: string }): Promise<RelationshipGraph | null> {
  if (isDemoMode()) { await delay(400); return demo.relationshipGraph; }
  return softOne<RelationshipGraph>("/assets/intelligence/graph");
}

export async function loadAssetGraph(id: number, depth = 2): Promise<RelationshipGraph | null> {
  if (isDemoMode()) { await delay(300); return demo.relationshipGraph; }
  return softOne<RelationshipGraph>(`/assets/${id}/graph`);
}

export async function requestAiSummary(id: number): Promise<{ postureSummary: string; whyPrioritized: string; summarySource: string }> {
  if (isDemoMode()) {
    await delay(1500);
    return { postureSummary: "This asset appears to be a production API endpoint...", whyPrioritized: "External exposure...", summarySource: "ai" };
  }
  return api.post(`/assets/${id}/intelligence/ai-summary`);
}

export async function loadAiStatus(): Promise<AiStatus> {
  if (isDemoMode()) { await delay(300); return demo.aiStatus; }
  const raw = await softOne<any>("/ai/settings");
  const agentRaw = await softOne<any>("/ai/agent/status");
  if (!raw && !agentRaw) return demo.aiStatus;
  const stream = agentRaw?.stream && typeof agentRaw.stream === "object" ? agentRaw.stream : null;
  return {
    enabled: Boolean(raw?.ai_enabled ?? raw?.enabled ?? agentRaw?.enabled ?? false),
    agent_enabled: Boolean(agentRaw?.enabled ?? agentRaw?.agent_enabled ?? raw?.agent_enabled ?? false),
    default_provider: String(agentRaw?.provider ?? raw?.default_provider ?? raw?.mode ?? ""),
    ai_pentest_ready: Boolean(agentRaw?.deepseek_ready ?? raw?.ai_pentest_ready ?? false),
    mode: (raw?.mode ?? "balanced") as AiStatus["mode"],
    providers: (raw?.providers ?? []).map((p: any) => ({ id: String(p.id ?? p.name ?? "provider"), configured: Boolean(p.configured) })),
    monthly_tokens: Number(raw?.monthly_tokens ?? 0),
    monthly_cost_usd: Number(raw?.monthly_cost_usd ?? 0),
    agent: {
      enabled: Boolean(agentRaw?.enabled ?? agentRaw?.agent_enabled ?? false),
      provider: String(agentRaw?.provider ?? "deepseek"),
      model: String(agentRaw?.model ?? "deepseek-v4-flash"),
      deepseek_ready: Boolean(agentRaw?.deepseek_ready ?? false),
      stream: {
        enabled: Boolean(stream?.enabled ?? true),
        protocol: String(stream?.protocol ?? "Server-Sent Events (text/event-stream)"),
        chat: String(stream?.chat ?? "/api/v1/ai/agent/chat/stream"),
        runs: String(stream?.runs ?? "/api/v1/ai/agent/runs/stream"),
        events: Array.isArray(stream?.events) ? stream.events.map(String) : ["connected", "meta", "reasoning", "delta", "usage", "done", "error"],
      },
    },
  };
}

/** Build the auth headers used for agent SSE POST requests (fetch + stream, not EventSource). */
function agentStreamHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  const bearer = tokens.appSession || tokens.orgUser || tokens.platform;
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  if (tokens.device) headers["X-Device-Token"] = tokens.device;
  // Agent chat/run streams are mutating org POSTs — the operate middleware
  // requires the dual-control session header once dual-control is configured.
  if (tokens.dualControl) headers["X-Dual-Control-Session"] = tokens.dualControl;
  return headers;
}

/**
 * PHANTIX_AGENT_SSE_FE.md §3: browser EventSource cannot send Authorization headers or a
 * JSON body, so agent chat/runs use fetch + ReadableStream. Parses SSE frames and calls
 * onEvent for every parsed event (connected / meta / reasoning / delta / usage / done / error).
 */
export async function streamAgentChat(
  body: {
    messages: { role: string; content: string }[];
    system?: string | null;
    domain?: string;
    temperature?: number;
    max_tokens?: number;
    thinking?: boolean;
    reasoning_effort?: "low" | "high" | "max";
  },
  onEvent: (event: string, data: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (isDemoMode()) {
    await streamDemoResponse(body.messages[body.messages.length - 1]?.content ?? "", onEvent, 900);
    return;
  }
  await streamAgentPost("/ai/agent/chat/stream", body, onEvent, signal);
}

/**
 * PHANTIX_AGENT_SSE_FE.md §5: starts an investigation (same body as POST /runs), gathers
 * engine tools, streams DeepSeek synthesis and persists the run. Emits run_started / tool /
 * synthesis_start / meta / reasoning / delta / usage / done / run_completed.
 */
export async function streamAgentRun(
  body: {
    domain: string;
    objective: string;
    campaign_id?: number;
    asset_ids?: number[];
    skill_ids?: number[];
    require_human_review?: boolean;
  },
  onEvent: (event: string, data: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (isDemoMode()) {
    await streamDemoRun(body.domain, body.objective, onEvent);
    return;
  }
  await streamAgentPost("/ai/agent/runs/stream", body, onEvent, signal);
}

async function streamAgentPost(path: string, body: unknown, onEvent: (event: string, data: any) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: agentStreamHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail: unknown = `SSE failed: ${res.status}`;
    try { detail = (await res.json()).detail ?? detail; } catch { /* non-JSON */ }
    const msg = typeof detail === "string" ? detail : JSON.stringify(detail);
    // Plan-gated: surface the paid-plan request clearly (402 from entitlement gate)
    // so the app-wide "Upgrade required" handler fires.
    if (res.status === 402) {
      const readable = (detail && typeof detail === "object" && typeof (detail as any).message === "string")
        ? (detail as any).message
        : "A paid plan is required to use the Phantix Agent.";
      window.dispatchEvent(new CustomEvent("phantix:billing-required", { detail: readable }));
      onEvent("error", { type: "error", error: readable, code: "ai_agent_plan_required", status: 402 });
    } else if (res.status === 403 && /dual|operate|authenticator|session/i.test(msg)) {
      onEvent("error", { type: "error", error: "Dual-control operate session required. Unlock operate mode and try again.", code: "dual_control_required" });
    } else {
      onEvent("error", { type: "error", error: msg });
    }
    throw new ApiError(res.status, detail);
  }
  if (!res.body) throw new ApiError(res.status, `SSE failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const block of parts) {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;
      try {
        onEvent(event, JSON.parse(dataLines.join("\n")));
      } catch { /* ignore partial */ }
    }
  }
}

/** Demo chat: emit connected → meta → reasoning → deltas → done in realistic cadence. */
async function streamDemoResponse(
  question: string,
  onEvent: (event: string, data: any) => void,
  stepMs = 900,
): Promise<void> {
  onEvent("connected", { type: "connected", protocol: "sse", demo: true });
  await delay(180);
  onEvent("meta", { type: "meta", provider: "deepseek", model: "deepseek-v4-flash", stream: true, thinking: true });
  await delay(stepMs);
  onEvent("reasoning", { type: "reasoning", content: "I'll summarize what the user asked and check the current posture signals available in the organization's security data." });
  await delay(stepMs);
  const answer = `Here's what I can tell you about "${question}":\n\n• I can review open findings, risk posture, asset exposure and recent scan results.\n• In production this answer is synthesized from your live security data (verified findings only — I never invent a vulnerability without a Phantix finding ID).\n• Skills used are shown on the result, and every interaction is governed + audited.\n\nAsk me about assets, VAPT campaigns, critical risks, or compliance gaps for a concrete summary.`;
  const words = answer.split(" ");
  for (const w of words) {
    onEvent("delta", { type: "delta", content: w + " " });
    await delay(12);
  }
  onEvent("usage", { type: "usage", tokens_used: 214, usage: { total_tokens: 214 } });
  onEvent("done", { type: "done", finish_reason: "stop", model: "deepseek-v4-flash" });
}

/** Demo investigation run stream: tool checklist → synthesis → run_completed. */
async function streamDemoRun(domain: string, objective: string, onEvent: (event: string, data: any) => void): Promise<void> {
  const analysisId = `demo-${Date.now()}`;
  onEvent("connected", { type: "connected", protocol: "sse", demo: true });
  await delay(150);
  onEvent("run_started", { type: "run_started", analysis_id: analysisId, domain });
  await delay(350);
  onEvent("tool", { type: "tool", tool: `${domain}_inventory`, ok: true });
  await delay(300);
  onEvent("tool", { type: "tool", tool: `${domain}_findings`, ok: true });
  await delay(300);
  onEvent("synthesis_start", { type: "synthesis_start", analysis_id: analysisId });
  await delay(250);
  onEvent("meta", { type: "meta", provider: "deepseek", model: "deepseek-v4-flash", stream: true });
  await delay(250);
  onEvent("reasoning", { type: "reasoning", content: `Correlating ${domain} signals across the organization.` });
  await delay(500);
  const summary = `${domain} analysis complete. I reviewed the ${domain} inventory, verified findings and posture signals. No finding was changed or created — every item referenced is a Phantix finding with an ID. Skills used: phantix-${domain}@1.0.0.`;
  const words = summary.split(" ");
  for (const w of words) {
    onEvent("delta", { type: "delta", content: w + " " });
    await delay(10);
  }
  onEvent("run_completed", { type: "run_completed", analysis_id: analysisId, status: "completed", summary });
}

/** Legacy single-turn helper. The checklist only exposes the SSE stream
 *  (`POST /ai/agent/chat/stream`), so route non-stream fallbacks through it. */
export async function sendAgentMessage(message: string): Promise<string> {
  if (isDemoMode()) {
    await delay(1600);
    return `I'm Phantix Agent. I understand you asked: "${message}". In production, I would analyze your assets, findings, and risk posture to answer this. Key surfaces you can explore: Assets, Scans, VAPT campaigns, Risks, Compliance, and Reports.`;
  }
  const out: string[] = [];
  await streamAgentChat(
    { messages: [{ role: "user", content: message }], domain: "cross" },
    (event, data) => {
      if (event === "delta" && typeof data?.content === "string") out.push(data.content);
      if (event === "done") { /* stream finished */ }
    },
  );
  return out.join("").trim() || "No response from agent.";
}

export async function startAgentRun(domain: string, objective: string, campaignId?: number): Promise<any> {
  if (isDemoMode()) {
    await delay(700);
    return { analysis_id: `demo-${Date.now()}`, status: "queued", domain, specialist: `${domain}_specialist`, skills: [`phantix-${domain}@1.0.0`], plan: { steps: [] }, async: true };
  }
  return api.post("/ai/agent/runs", { domain, objective, campaign_id: campaignId, run_inline: false });
}

export async function getAgentRun(analysisId: string): Promise<AgentRun | null> {
  if (isDemoMode()) {
    await delay(600);
    return { analysis_id: analysisId, status: "completed", domain: "vapt", summary: "Analysis complete. Verified findings summarized with impact." };
  }
  const res = await softOne<any>(`/ai/agent/runs/${analysisId}`);
  if (!res) return null;
  return {
    analysis_id: String(res.analysis_id ?? res.id ?? analysisId),
    domain: res.domain,
    objective: res.objective,
    status: (res.status ?? "completed") as AgentRun["status"],
    summary: res.summary ?? res.result ?? null,
    result: res.result ?? null,
    error: res.error ?? null,
    skills: Array.isArray(res.skills) ? res.skills.map(String) : undefined,
    created_at: res.created_at,
    completed_at: res.completed_at,
  };
}

// ── Agent skill library (PHANTIX_AGENT_FE.md A4/A5) ──────────────────────────
export async function loadAgentSkills(): Promise<AgentSkill[]> {
  if (isDemoMode()) { await delay(300); return demo.agentSkills; }
  const raw = await softOne<any>("/ai/agent/skills");
  const list = asList<any>(raw);
  return list.map((s: any) => ({
    id: Number(s.id ?? 0),
    name: String(s.name ?? s.skill_name ?? "skill"),
    description: String(s.description ?? ""),
    version: String(s.version ?? s.latest_version ?? "1.0.0"),
    domain: s.domain ? String(s.domain) : undefined,
    status: (s.status ?? "candidate") as AgentSkill["status"],
    score: Number(s.score ?? s.reliability_score ?? 0),
    uses: Number(s.uses ?? s.use_count ?? s.executions ?? 0),
    last_used_at: s.last_used_at ?? null,
    created_at: s.created_at,
    versions: Array.isArray(s.versions) ? s.versions.map((v: any) => ({ version: String(v.version ?? ""), status: String(v.status ?? "candidate"), score: v.score != null ? Number(v.score) : undefined, created_at: v.created_at })) : undefined,
  }));
}

export async function setAgentSkillStatus(
  id: number,
  version: string,
  status: AgentSkillStatusUpdate["status"],
  note?: string,
): Promise<AgentSkillStatusUpdate> {
  if (isDemoMode()) { await delay(500); return { status, note }; }
  // Checklist: POST /api/v1/ai/agent/skills/{skill_id}/versions/{version}/status
  return api.post(`/ai/agent/skills/${id}/versions/${encodeURIComponent(version)}/status`, { status, note });
}

export async function refreshIntelligence(limit = 500): Promise<{ updated: number; errors: number }> {
  if (isDemoMode()) { await delay(800); return { updated: 42, errors: 0 }; }
  return api.post("/assets/intelligence/refresh");
}

export async function loadSocDashboard(): Promise<SocDashboardScaffold | null> {
  if (isDemoMode()) { await delay(300); return demo.socDashboard; }
  return softOne<SocDashboardScaffold>("/soc/dashboard");
}

// ── SOC Engine loaders & mutations (SOC_PAGE_FE.md) ───────────────────────────
export async function loadSocStatus(): Promise<SocStatus | null> {
  if (isDemoMode()) { await delay(250); return demo.socStatus; }
  return softOne<SocStatus>("/soc/status");
}

export async function loadSocDetections(params: {
  status?: string;
  severity?: string;
  openOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<SocDetectionListResponse> {
  if (isDemoMode()) {
    await delay(300);
    let items = [...demo.socDetections];
    if (params.openOnly) items = items.filter((d) => !["closed"].includes(String(d.status)));
    if (params.status) items = items.filter((d) => d.status === params.status);
    if (params.severity) items = items.filter((d) => d.severity === params.severity);
    return { items, total: items.length, limit: params.limit ?? 50, offset: params.offset ?? 0 };
  }
  const q: Record<string, string | number | boolean> = { limit: params.limit ?? 50, offset: params.offset ?? 0 };
  if (params.status) q.status = params.status;
  if (params.severity) q.severity = params.severity;
  if (params.openOnly) q.open_only = true;
  const qs = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString();
  const raw = await softOne<SocDetectionListResponse>(`/soc/detections?${qs}`, {});
  if (raw?.items) return raw;
  const list = asList<SocDetection>(await api.get<unknown>(`/soc/detections?${qs}`));
  return { items: list, total: list.length, limit: params.limit ?? 50, offset: params.offset ?? 0 };
}

export async function loadSocTriagePacket(): Promise<SocTriagePacket | null> {
  if (isDemoMode()) {
    await delay(300);
    return {
      organization_id: 11,
      open_total: demo.socDetections.filter((d) => !["closed"].includes(String(d.status))).length,
      by_severity_open: { critical: 2, high: 3 },
      detections: demo.socDetections.filter((d) => !["closed"].includes(String(d.status))).slice(0, 5),
      playbook_suggestions_allowlist: ["review_risk", "request_rescan", "escalate_case", "notify_owner", "mark_false_positive"],
      honesty: "Only listed detections exist; do not invent additional alerts.",
    };
  }
  return softOne<SocTriagePacket>("/soc/detections/triage-packet");
}

export async function createSocDetection(body: {
  title: string;
  summary?: string;
  severity?: string;
  asset_id?: number | null;
  risk_id?: number | null;
  evidence?: Record<string, unknown>;
  assignee_ref?: string;
  metadata?: Record<string, unknown>;
}): Promise<SocDetection> {
  if (isDemoMode()) {
    await delay(500);
    const d: SocDetection = {
      id: demo.socDetections.length + 900,
      organization_id: 11,
      rule_id: null,
      correlator_id: null,
      case_id: null,
      title: body.title,
      summary: body.summary ?? null,
      severity: body.severity ?? "medium",
      status: "open",
      assignee_ref: body.assignee_ref ?? null,
      asset_id: body.asset_id ?? null,
      risk_id: body.risk_id ?? null,
      finding_ref: {},
      signal_fingerprint: null,
      evidence: body.evidence ?? {},
      metadata: body.metadata ?? {},
      source: "manual",
      occurrence_count: 1,
      priority_score: 50,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return d;
  }
  return api.post<SocDetection>("/soc/detections", body);
}

export async function patchSocDetection(id: number, body: {
  status?: string;
  assignee_ref?: string;
  clear_assignee?: boolean;
  severity?: string;
  summary?: string;
  case_id?: number | null;
}): Promise<SocDetection> {
  if (isDemoMode()) {
    await delay(400);
    return demo.socDetections.find((d) => d.id === id) ?? demo.socDetections[0];
  }
  return api.patch<SocDetection>(`/soc/detections/${id}`, body);
}

export async function escalateSocDetection(id: number, body: {
  title?: string;
  summary?: string;
  assignee_ref?: string;
} = {}): Promise<{ case: SocCase; detection: SocDetection; created: boolean }> {
  if (isDemoMode()) {
    await delay(500);
    const d = demo.socDetections.find((x) => x.id === id) ?? demo.socDetections[0];
    const c: SocCase = {
      id: demo.socCases.length + 500,
      organization_id: 11,
      title: body.title ?? `Incident: ${d.title}`,
      summary: body.summary ?? null,
      severity: d.severity,
      status: "open",
      assignee_ref: body.assignee_ref ?? null,
      metadata: { source_detection_id: d.id },
      opened_at: new Date().toISOString(),
      closed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { case: c, detection: { ...d, status: "escalated", case_id: c.id }, created: true };
  }
  return api.post<{ case: SocCase; detection: SocDetection; created: boolean }>(`/soc/detections/${id}/escalate`, body);
}

export async function loadSocCases(params: { status?: string; limit?: number; offset?: number } = {}): Promise<{ items: SocCase[]; total: number }> {
  if (isDemoMode()) {
    await delay(250);
    const items = params.status ? demo.socCases.filter((c) => c.status === params.status) : demo.socCases;
    return { items, total: items.length };
  }
  const q: Record<string, string | number> = { limit: params.limit ?? 50, offset: params.offset ?? 0 };
  if (params.status) q.status = params.status;
  const qs = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString();
  const raw = await softOne<{ items: SocCase[]; total: number }>(`/soc/cases?${qs}`, {});
  if (raw?.items) return raw;
  const list = asList<SocCase>(await api.get<unknown>(`/soc/cases?${qs}`));
  return { items: list, total: list.length };
}

export async function loadSocCase(id: number): Promise<SocCase | null> {
  if (isDemoMode()) {
    await delay(250);
    return demo.socCases.find((c) => c.id === id) ?? null;
  }
  return softOne<SocCase>(`/soc/cases/${id}`);
}

export async function createSocCase(body: {
  title: string;
  summary?: string;
  severity?: string;
  assignee_ref?: string;
  metadata?: Record<string, unknown>;
  detection_ids?: number[];
}): Promise<SocCase> {
  if (isDemoMode()) {
    await delay(500);
    const c: SocCase = {
      id: demo.socCases.length + 500,
      organization_id: 11,
      title: body.title,
      summary: body.summary ?? null,
      severity: body.severity ?? "medium",
      status: "open",
      assignee_ref: body.assignee_ref ?? null,
      metadata: body.metadata ?? {},
      opened_at: new Date().toISOString(),
      closed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return c;
  }
  return api.post<SocCase>("/soc/cases", body);
}

export async function patchSocCase(id: number, body: {
  title?: string;
  summary?: string;
  severity?: string;
  status?: string;
  assignee_ref?: string;
}): Promise<SocCase> {
  if (isDemoMode()) {
    await delay(400);
    return demo.socCases.find((c) => c.id === id) ?? demo.socCases[0];
  }
  return api.patch<SocCase>(`/soc/cases/${id}`, body);
}

export async function addSocCaseNote(id: number, body: { body: string; author_ref?: string }): Promise<SocCaseNote> {
  if (isDemoMode()) {
    await delay(350);
    return { id: 500, organization_id: 11, case_id: id, author_ref: body.author_ref ?? "user:1", body: body.body, created_at: new Date().toISOString() };
  }
  return api.post<SocCaseNote>(`/soc/cases/${id}/notes`, body);
}

export async function loadSocRules(enabledOnly = false): Promise<SocRule[]> {
  if (isDemoMode()) {
    await delay(250);
    return demo.socRules;
  }
  const q = enabledOnly ? "?enabled_only=true" : "";
  const raw = await softOne<{ items: SocRule[]; total: number }>(`/soc/rules${q}`, {});
  if (raw?.items) return raw.items;
  return asList<SocRule>(await api.get<unknown>(`/soc/rules${q}`));
}export async function createSocRule(body: {
  name: string;
  description?: string;
  enabled?: boolean;
  severity_default?: string;
  match_spec: Record<string, unknown>;
  dedup_window_seconds?: number;
  actions?: Record<string, unknown>;
}): Promise<SocRule> {
  if (isDemoMode()) {
    await delay(450);
    const r: SocRule = {
      id: demo.socRules.length + 400,
      organization_id: 11,
      name: body.name,
      description: body.description ?? null,
      enabled: body.enabled ?? true,
      source: "org",
      severity_default: body.severity_default ?? "medium",
      match_spec: body.match_spec,
      dedup_window_seconds: body.dedup_window_seconds ?? 3600,
      actions: body.actions ?? { create_detection: true, notify: false },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return r;
  }
  return api.post<SocRule>("/soc/rules", body);
}

export async function patchSocRule(id: number, body: Record<string, unknown>): Promise<SocRule> {
  if (isDemoMode()) {
    await delay(350);
    return demo.socRules.find((r) => r.id === id) ?? demo.socRules[0];
  }
  return api.patch<SocRule>(`/soc/rules/${id}`, body);
}

export async function deleteSocRule(id: number): Promise<void> {
  if (isDemoMode()) { await delay(300); return; }
  await api.delete(`/soc/rules/${id}`);
}

export async function seedSocRules(): Promise<SocRule[]> {
  if (isDemoMode()) {
    await delay(400);
    return demo.socRules;
  }
  const raw = await softOne<{ items: SocRule[]; total: number }>("/soc/rules/seed", {});
  if (raw?.items) return raw.items;
  return asList<SocRule>(await api.post<unknown>("/soc/rules/seed"));
}

export async function loadSocAdapters(): Promise<SocAdapter[]> {
  if (isDemoMode()) {
    await delay(200);
    return demo.socAdapters;
  }
  const raw = await softOne<{ adapters: SocAdapter[]; note?: string }>("/soc/adapters", {});
  if (raw?.adapters) return raw.adapters;
  return asList<SocAdapter>(await api.get<unknown>("/soc/adapters"));
}

export async function ingestSocWebhook(body: Record<string, unknown>): Promise<SocEnrichmentResult> {
  if (isDemoMode()) {
    await delay(400);
    return { organizationId: 11, adapterId: "generic_webhook", accepted: 1, detections: [] };
  }
  return api.post<SocEnrichmentResult>("/soc/adapters/webhook", body);
}
