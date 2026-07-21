// Central resource loaders — demo-data only when isDemoMode() is true.
import { api, ApiError, delay, isDemoMode, isSecurityDbBlocked } from "./api";
import * as demo from "./demo-data";
import type {
  AlertEvent,
  AlertSettings,
  Asset,
  AssetTag,
  AuditEvent,
  ComplianceAssessment,
  ComplianceControlResult,
  ComplianceFramework,
  DiscoveryJob,
  DualControlState,
  EvidenceItem,
  OrgUser,
  Organization,
  PendingAction,
  Report,
  Risk,
  ScanJob,
  ScanResult,
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
  /** Security storage not bootstrapped (API 409) — product modules blocked. */
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
  const settings: AlertSettings = settingsRaw ?? {
    alerts_enabled: false,
    smtp: { enabled: false, host: "", port: 587, from_email: "", from_name: "", use_tls: true },
    email_recipients: [],
    whatsapp: { enabled: false, provider: "", recipients: [] },
    telegram: { enabled: false, provider: "", recipients: [] },
    notify: {},
  };
  return { events, settings };
}

export async function loadAuditBundle() {
  if (isDemoMode()) {
    await delay();
    return { events: demo.auditEvents, pending: demo.pendingActions };
  }
  const [events, pending] = await Promise.all([
    softList<AuditEvent>("/audit/events"),
    softList<PendingAction>("/audit/pending"),
  ]);
  return { events, pending };
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
  return softList<SupportTicket>("/support/tickets");
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
