// ── Phantix API model types (mirror backend shapes from the FE docs) ─────────

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type VerificationStatus =
  | "auto_verified"
  | "manually_verified"
  | "unverified"
  | "rejected"
  | "false_positive";

export interface Organization {
  id: number;
  name: string;
  slug: string;
  creator_user_id: number | null;
  country: string;
  industry: string;
  setup_complete: boolean;
  company_verified: boolean;
  identity_verified: boolean;
  plan: string;
  created_at: string;
}

export interface OrgUser {
  id: number;
  full_name: string;
  email: string;
  title: string;
  role: string;
  otp_only: boolean;
  is_active: boolean;
  is_initiator?: boolean;
  is_authorizer?: boolean;
  last_login_at: string | null;
}

export interface DualControlState {
  configured: boolean;
  require_dual_control: boolean;
  initiator: Pick<OrgUser, "id" | "full_name" | "email" | "title"> | null;
  authorizer: Pick<OrgUser, "id" | "full_name" | "email" | "title"> | null;
}

export interface DbConnection {
  id: number;
  name: string;
  connection_purpose: "security_data_storage" | "config_inspection";
  db_type: string;
  host: string;
  port: number;
  database_name: string;
  target_schema: string;
  is_primary: boolean;
  bootstrap_status: "ready" | "pending" | "failed" | "not_bootstrapped";
  schema_version: string | null;
  last_test_at: string | null;
  last_test_ok: boolean;
  created_at: string;
}

export interface Asset {
  id: number;
  asset_type: string;
  value: string;
  name: string;
  source: string;
  is_verified: boolean;
  verification_method: string | null;
  criticality: "critical" | "high" | "medium" | "low";
  environment: string;
  tags: AssetTag[];
  first_discovered_at: string;
  last_seen_at: string;
  metadata?: Record<string, unknown>;
  // Intelligence fields (populated by GET /assets/intelligence/*)
  risk_score?: number;
  risk_level?: "critical" | "high" | "medium" | "low" | "info";
  open_findings?: number;
  exposure?: string;
}

export interface IntelligenceDashboard {
  organizationId?: number;
  postureScore?: number;
  posture_score?: number;
  posture_trend?: { day: string; score: number }[];
  totals?: {
    activeAssets?: number;
    verified?: number;
    unverified?: number;
    neverScanned?: number;
    highRiskAssets?: number;
    externalAssets?: number;
    openFindings?: number;
  };
  total_assets?: number;
  verified_count?: number;
  unscanned_count?: number;
  critical_assets_at_risk?: { id: number; name: string; value: string; risk_score: number; open_findings: number }[];
  criticalAssetsAtRisk?: { id: number; value: string; assetType: string; riskLevel: string; riskScore: number; openFindingsCount: number; priorityScore: number; exposureLevel: string; isVerified: boolean }[];
  newly_discovered?: { id: number; name: string; value: string; asset_type: string }[];
  newlyDiscoveredUnscanned?: { id: number; value: string; assetType: string; firstSeenAt?: string; isVerified: boolean; source: string }[];
  generatedAt?: string;
  severity_distribution?: { severity: string; count: number }[];
  top_exposures?: { exposure: string; count: number }[];
}

export interface PrioritizedAsset {
  id: number;
  asset_type: string;
  value: string;
  name: string;
  criticality: string;
  risk_score: number;
  risk_level: string;
  open_findings: number;
  exposure: string;
  is_verified: boolean;
  last_seen_at: string;
}

export interface AssetIntelligence {
  asset: {
    id: number;
    name: string;
    value: string;
    asset_type: string;
  };
  risk_score: number;
  risk_level: string;
  previous_risk_score: number | null;
  risk_score_delta: number | null;
  open_findings_count: number;
  exposure_level: string;
  posture_summary: string | null;
  recommended_actions: { action_key: string; label: string; description: string; priority: string }[];
  related_assets: { id: number; name: string; value: string; asset_type: string; risk_score: number }[];
  active_threats: string[];
}

export interface RelationshipGraph {
  nodes: Array<{
    id: number; value: string | null; name: string | null; assetType: string | null;
    riskLevel: string | null; riskScore: number | null; openFindingsCount: number;
    isVerified: boolean; exposureLevel: string; priorityScore: number;
  }>;
  edges: Array<{ id: number; source: number; target: number; relationshipType: string; confidence: number; }>;
  rootAssetId: number | null; depth: number; truncated: boolean; nodeCount: number; edgeCount: number;
}

export interface SocDashboardScaffold {
  organizationId: number; status: "scaffold" | "implemented"; generatedAt: string;
  panels: Array<{ id: string; title: string; source: string; ready: boolean; endpoint: string | null; stream?: string; note?: string; }>;
  liveSubscribers: number; message: string;
}

// ── SOC Engine (v0.1.0) ───────────────────────────────────────────────────────
export type DetectionStatus = "open" | "acknowledged" | "assigned" | "escalated" | "closed";
export type SocCaseStatus = "open" | "investigating" | "contained" | "closed";
export type DetectionSource = "correlator" | "rule" | "manual" | "enrichment";

export interface SocQueue {
  openTotal: number;
  open_total?: number;
  byStatus: Record<string, number>;
  bySeverityOpen: Record<string, number>;
  by_severity_open?: Record<string, number>;
  error?: string | null;
}

export interface SocStatus {
  engineId?: string;
  name?: string;
  status?: string;
  version?: string;
  organizationId?: number;
  message?: string;
  capabilities?: Record<string, boolean>;
  builtinCorrelators?: string[];
  queue?: SocQueue;
  adapters?: { id: string; configured: boolean; vendor?: string }[];
  realtimeHub?: string;
}

export interface SocDetection {
  id: number;
  organization_id: number;
  rule_id: number | null;
  correlator_id: string | null;
  case_id: number | null;
  title: string;
  summary: string | null;
  severity: Severity | string;
  status: DetectionStatus | string;
  assignee_ref: string | null;
  asset_id: number | null;
  risk_id: number | null;
  finding_ref: Record<string, unknown>;
  signal_fingerprint: string | null;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  source: string;
  occurrence_count: number;
  priority_score: number;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SocDetectionListResponse {
  items: SocDetection[];
  total: number;
  limit: number;
  offset: number;
}

export interface SocTriagePacket {
  organization_id?: number;
  open_total?: number;
  by_severity_open?: Record<string, number>;
  detections?: SocDetection[];
  playbook_suggestions_allowlist?: string[];
  honesty?: string;
}

export interface SocCase {
  id: number;
  organization_id?: number;
  title: string;
  summary: string | null;
  severity: Severity | string;
  status: SocCaseStatus | string;
  assignee_ref: string | null;
  metadata: Record<string, unknown>;
  opened_at?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  notes?: SocCaseNote[];
  detections?: Partial<SocDetection>[];
}

export interface SocCaseNote {
  id: number;
  organization_id?: number;
  case_id?: number;
  author_ref: string | null;
  body: string;
  created_at?: string;
}

export interface SocRule {
  id: number;
  organization_id?: number;
  name: string;
  description?: string | null;
  enabled: boolean;
  source?: string;
  severity_default: Severity | string;
  match_spec: Record<string, unknown>;
  dedup_window_seconds?: number;
  actions?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface SocAdapter {
  id?: string;
  displayName?: string;
  vendor?: string;
  configured: boolean;
  enabled?: boolean;
  detail?: string;
}

export interface SocEnrichmentResult {
  organizationId?: number;
  adapterId?: string;
  accepted: number;
  detections?: Partial<SocDetection>[];
}

/** Realtime SSE event from /assets/intelligence/stream (camelCase payload). */
export interface RealtimeEvent {
  type: string;
  organizationId: number;
  eventId: string;
  ts: string;
  payload: {
    assetId?: number;
    value?: string | null;
    assetType?: string | null;
    riskScore?: number | null;
    riskLevel?: string | null;
    previousRiskScore?: number | null;
    previousRiskLevel?: string | null;
    openFindingsCount?: number | null;
    priorityScore?: number | null;
    exposureLevel?: string | null;
    findingId?: number | string | null;
    title?: string | null;
    severity?: string | null;
    tool?: string | null;
    source?: string | null;
    isVerified?: boolean | null;
    [key: string]: unknown;
  };
}

export interface RecommendedAction {
  action_key: string;
  label: string;
  description: string;
  priority: string;
}

export interface AiPostureSummary {
  summary: string;
  generated_at: string;
  model: string;
}

export interface AssetTag {
  id: number;
  name: string;
  color: string;
  description?: string;
  asset_count?: number;
}

export interface DiscoveryJob {
  id: number;
  job_type: string;
  status: "pending" | "queued" | "running" | "completed" | "failed";
  config: Record<string, unknown>;
  result_summary?: Record<string, unknown>;
  created_at: string;
  finished_at: string | null;
}

export interface ScanJob {
  id: number;
  job_type: string;
  tools: string[];
  status: "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
  target_filter: Record<string, unknown>;
  progress: number;
  findings_count: number;
  initiated_by: string;
  idempotency_key: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ScanResult {
  id: number;
  scan_job_id: number;
  asset_id: number | null;
  asset_value?: string;
  tool: string;
  severity: Severity;
  title: string;
  description: string;
  verification_status: VerificationStatus;
  confidence: number;
  created_at: string;
  evidence?: {
    verification?: {
      confidence?: string;
      verification_status?: string;
      verification_reason?: string;
      reportable?: boolean;
      method?: string;
    };
    impact_analysis?: {
      impact_level?: string;
      impact_score?: number;
      summary?: string;
      categories?: string[];
      blast_radius?: string;
      cia?: { confidentiality?: string; integrity?: string; availability?: string };
    };
  };
  impact_level?: string;
  impact_score?: number;
  reportable?: boolean;
}

export interface VaptCampaign {
  id: number;
  name: string;
  campaign_type: string;
  procedure_key: string;
  status:
    | "draft"
    | "pending_approval"
    | "active"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";
  phase: string;
  progress: number;
  asset_count: number;
  findings_count: number;
  requires_approval: boolean;
  created_by: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  current_step_index?: number;
  current_phase?: string;
  asset_scope?: { asset_ids?: number[]; asset_types?: string[]; tags?: string[]; domains?: string[] };
  procedure_snapshot?: {
    steps?: VaptStep[];
    source?: string;
  };
}

export interface VaptStep {
  step_type: string;
  step_name: string;
  step_description?: string;
  status?: string;
  finding_count?: number;
  scan_job_ids?: number[];
  config?: {
    tools?: string[];
    max_duration_minutes?: number;
    dedupe_hosts?: boolean;
    caido_mode?: "inline" | "agent";
    caido_ai_enabled?: boolean;
    objectives?: string[];
    target_types?: string[];
  };
  output_summary?: {
    assets_resolved?: number;
    assets_considered?: number;
    unique_hosts?: number;
    targets_scanned?: string[];
    skipped_already_scanned?: string[];
    skipped_count?: number;
    time_budget_seconds?: number;
    elapsed_seconds?: number;
    budget_exhausted?: boolean;
    partial?: boolean;
    retest?: boolean;
    results_written?: number;
    errors?: string[];
    tools?: string[];
    completed_at?: string;
  };
  error_message?: string;
}

export interface VaptFinding {
  id: number;
  campaign_id: number;
  title: string;
  severity: Severity;
  verification_status: VerificationStatus;
  confidence: number | string;
  asset_value: string;
  correlation_rule: string | null;
  attack_path: string[];
  attack_path_object?: {
    rule_key?: string;
    steps?: { asset_id?: number | null; title?: string; severity?: string; types?: string[] }[];
    risk_summary?: string;
  };
  cve: string | null;
  cvss: number | null;
  created_at: string;
  reportable?: boolean;
  impact_level?: string;
  impact_score?: number;
  impact_summary?: string;
  business_impact?: string;
  technical_impact?: string;
  impact_analysis?: Record<string, unknown>;
  description?: string;
  correlation_type?: string;
  requires_human_review?: boolean;
  ai_analysis_requested?: boolean;
}

export interface VaptApproval {
  id: number;
  campaign_id: number;
  campaign_name: string;
  step: string;
  role_required: "initiator" | "authorizer";
  status: "pending" | "approved" | "rejected";
  requested_at: string;
}

export interface Risk {
  id: number;
  title: string;
  asset_value: string;
  vulnerability_key: string;
  status: string;
  level: "low" | "medium" | "high" | "critical";
  inherent_score: number;
  residual_score: number | null;
  likelihood: number;
  impact: number;
  owner_department: string | null;
  priority_band: "P1" | "P2" | "P3" | "P4" | "P5";
  priority_score: number;
  priority_factors: Record<string, number>;
  scoring_breakdown: { component: string; contribution: number; detail: string }[];
  treatment_status: string | null;
  age_days: number;
  created_at: string;
  updated_at: string;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  control_count: number;
  category: string;
  is_active: boolean;
  recommended: boolean;
  controls?: { id: string; title?: string; category?: string; risk?: string; description?: string }[];
}

export interface ComplianceAssessment {
  id: number;
  framework_id: string;
  framework_name: string;
  status: "completed" | "running";
  score: number;
  controls_passed: number;
  controls_gap: number;
  controls_unknown: number;
  include_questionnaire: boolean;
  include_posture: boolean;
  created_at: string;
}

export interface ComplianceControlResult {
  control_id: string;
  title: string;
  category: string;
  status: "pass" | "gap" | "unknown";
  source: "questionnaire" | "posture" | "merged";
  evidence_count: number;
  recommendation: string;
}

export interface EvidenceItem {
  id: number;
  connector: string;
  evidence_type: string;
  title: string;
  status: "collected" | "manual" | "failed";
  collected_at: string;
  summary: string;
}

export interface Report {
  id: number;
  report_type: "vapt_campaign" | "executive" | "compliance" | "tracker" | "agi_session" | string;
  title: string;
  status: "queued" | "generating" | "complete" | "failed" | string;
  formats_requested: string[];
  campaign_id: number | null;
  version: number;
  stats: {
    after_dedupe: number;
    after_verification: number;
    excluded_from_report: number;
    impact_analyzed?: number;
    attack_paths?: number;
    require_verified?: boolean;
    /** Unverified / candidate findings (appendix-only under verified-only policy). */
    candidates?: number;
  };
  created_at: string;
  size_bytes: number;
  /** storage paths and optional `<fmt>_error` strings */
  output_files?: Record<string, string>;
  ai_narratives?: {
    executive_summary?: string;
    current_development?: string;
    remediation_guidance?: string;
    attack_path_descriptions?: string;
    web_research?: {
      queries?: string[];
      source_count?: number;
      brief_md?: string;
      items?: Array<{ title?: string; url?: string; snippet?: string; source?: string }>;
    };
    source?: string;
  } | null;
  error_message?: string | null;
}

/** Living remediation board row — statuses from ORG_COMMAND_CENTER_PAGES_FE §7.2 */
export type TrackerStatus =
  | "open"
  | "in_progress"
  | "fixed"
  | "accepted"
  | "retest_failed"
  | "regressed";

export interface TrackerFinding {
  finding_key: string;
  title: string;
  severity: Severity;
  status: TrackerStatus | string;
  owner: string | null;
  campaign_name: string;
  asset_value: string;
  updated_at: string;
  surface?: string;
  priority?: string;
  asset_id?: number | null;
  assigned_owner?: string | null;
  assigned_owner_email?: string | null;
  target_fix_date?: string | null;
  detection_count?: number;
  retest_status?: string | null;
  description?: string | null;
}

export interface TrackerSummary {
  total?: number;
  open?: number;
  in_progress?: number;
  fixed?: number;
  retest_failed?: number;
  regressed?: number;
  accepted?: number;
  bySeverity?: Record<string, number>;
  bySurface?: Record<string, number>;
  unassigned?: number;
}

export interface OrgIdentity {
  id: number;
  name?: string | null;
  legalName?: string | null;
  slug?: string | null;
  industry?: string | null;
  subIndustry?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  logoUrl?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  authorizedLab?: boolean;
  isActive?: boolean;
  setupCompleted?: boolean;
  emailVerified?: boolean;
}

export interface LabCatalog {
  authorizedLab: true;
  domain?: string;
  webmail?: string;
  surfaces?: Array<{ key: string; name: string; host: string; kind: string; urls?: string[] }>;
  note?: string;
}

export interface CommandCenter {
  generatedAt?: string;
  org?: OrgIdentity;
  lab?: LabCatalog | null;
  links?: Record<string, string>;
  pages?: Record<string, string>;
  stream?: {
    commandCenter?: string;
    intelligence?: string;
    soc?: string;
    protocol?: string;
    auth?: string;
    eventTypes?: string[];
  };
  posture?: {
    organizationId?: number;
    postureScore?: number | null;
    totals?: Record<string, number>;
    criticalAssetsAtRisk?: Array<Record<string, unknown>>;
    newlyDiscoveredUnscanned?: Array<Record<string, unknown>>;
    available?: boolean;
  };
  assets?: {
    totals?: Record<string, number>;
    criticalAtRisk?: unknown[];
    neverScanned?: unknown[];
  };
  risks?: {
    total?: number;
    open?: number;
    byLevel?: Record<string, number>;
    byStatus?: Record<string, number>;
    top?: Array<Record<string, unknown>>;
    available?: boolean;
  };
  soc?: {
    available?: boolean;
    queue?: {
      openTotal?: number;
      byStatus?: Record<string, number>;
      bySeverityOpen?: Record<string, number>;
    };
    topDetections?: Array<Record<string, unknown>>;
  };
  tracker?: {
    available?: boolean;
    total?: number;
    summary?: TrackerSummary;
    criticalOpen?: Array<Record<string, unknown>>;
  };
  reports?: {
    available?: boolean;
    total?: number;
    recent?: Array<Record<string, unknown>>;
  };
}

export interface SocAgentDownload {
  os: "linux" | "macos" | "windows" | "python" | string;
  label: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  contentType?: string;
  downloadPath?: string;
  href?: string;
}

export interface SocAgentInstallCatalog {
  organizationId?: number;
  version?: string;
  supportedOs?: string[];
  authHeader?: string;
  authHint?: string;
  endpoint?: string;
  walkthrough?: string;
  downloads?: SocAgentDownload[];
  channels?: Array<{
    id: string;
    os: string;
    title: string;
    download: string | null;
    commands: string[];
  }>;
  afterInstall?: string[];
  docs?: string[];
}

export interface AlertEvent {
  id: number;
  event_type: string;
  severity: Severity;
  title: string;
  status: "pending" | "delivered" | "failed";
  channels: string[];
  created_at: string;
}

export interface AlertSettings {
  alerts_enabled: boolean;
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    from_email: string;
    from_name: string;
    use_tls: boolean;
  };
  email_recipients: string[];
  whatsapp: { enabled: boolean; provider: string; recipients: string[] };
  telegram: { enabled: boolean; provider: string; recipients: string[] };
  notify: Record<string, boolean>;
}

export interface AuditEvent {
  id: number;
  action_key: string;
  action_label: string;
  category: string;
  status: string;
  summary: string;
  details: {
    path: string;
    method: string;
    actor_user_id?: number;
    actor_email?: string;
    token_type?: string;
    passive?: boolean;
    [key: string]: unknown;
  } | null;
  source: string;
  ip_address: string | null;
  initiator_name: string | null;
  initiator_title: string | null;
  authorizer_name: string | null;
  authorizer_title: string | null;
  created_at: string;
}

export interface PendingAction {
  id: number;
  action_key: string;
  action_label: string;
  category: string;
  initiated_by: string;
  status: "pending" | "authorized" | "rejected";
  created_at: string;
}

export interface EngineInfo {
  id: string;
  name: string;
  status: string;
  description: string;
}

export interface ServiceKeyMeta {
  id: number;
  prefix: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface AiStatus {
  enabled: boolean;
  agent_enabled: boolean;
  default_provider: string;
  ai_pentest_ready: boolean;
  mode: "economy" | "balanced" | "enterprise";
  providers: { id: string; configured: boolean }[];
  monthly_tokens: number;
  monthly_cost_usd: number;
  /** Agent platform status (PHANTIX_AGENT_FE.md / PHANTIX_AGENT_SSE_FE.md). */
  agent?: {
    enabled: boolean;
    provider: string;
    model: string;
    deepseek_ready: boolean;
    stream: {
      enabled: boolean;
      protocol: string;
      chat: string;
      runs: string;
      events: string[];
    };
  };
}

/** Agent skill library item (PHANTIX_AGENT_FE.md A4/A5). */
export interface AgentSkill {
  id: number;
  name: string;
  description: string;
  version: string;
  domain?: string;
  status: "candidate" | "active" | "quarantined" | "retired";
  score: number;
  uses: number;
  last_used_at?: string | null;
  created_at?: string;
  versions?: { version: string; status: string; score?: number; created_at?: string }[];
}

/** Skill status change action (promote / quarantine / retire). */
export interface AgentSkillStatusUpdate {
  status: "active" | "quarantined" | "retired" | "candidate";
  note?: string;
}

/** Agent run item returned by GET /ai/agent/runs. */
export interface AgentRun {
  analysis_id: string;
  domain?: string;
  objective?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  summary?: string | null;
  result?: string | null;
  error?: string | null;
  skills?: string[];
  created_at?: string;
  completed_at?: string | null;
}

/** One SSE frame parsed from the agent chat / runs stream. */
export interface AgentStreamEvent {
  event: string;
  data: unknown;
  raw: string;
}

export interface SupportTicket {
  id: number;
  subject: string;
  status: "open" | "pending" | "closed";
  priority: string;
  created_at: string;
  messages: { from: string; body: string; at: string }[];
}

// ── Autonomous Pentest Agent (PHANTIX AGI) — customer surface ────────────────
// Mirror of app/engines/ai_engine/agi customer_api + schemas.

/** GET /agi/access — drives the Agent/AGI switcher, agreement modal + blockers. */
export interface AgiAccess {
  modes: {
    agent: { id: string; label: string; description: string; cost_tier: string; available: boolean };
    agi: { id: string; label: string; description: string; cost_tier: string; available: boolean };
  };
  agi: {
    platform_enabled: boolean;
    org_enabled: boolean;
    entitled: boolean;
    entitlement_code: string | null;
    agreement_required: boolean;
    agreement_accepted: boolean;
    active_policy_version: string | null;
    can_use: boolean;
    limits: {
      daily_session_limit: number;
      max_session_minutes: number;
      max_allowlist_targets: number;
      allow_state_changing: boolean;
      require_dual_control_for_active: boolean;
      require_asset_backed_targets: boolean;
    };
    blockers: { code: string; message: string }[];
  };
  agreement: {
    version: string | null;
    title: string | null;
    body_md: string | null;
    security_policy: Record<string, unknown> | null;
    must_accept_before_agi: boolean;
  };
}

/** Active AGI usage agreement (GET /agi/agreement). */
export interface AgiAgreement {
  version: string;
  title: string;
  body_md: string;
  security_policy?: Record<string, unknown> | null;
  accepted: boolean;
  must_accept: boolean;
  organization_id: number;
}

/** POST /agi/intent recommendation. */
export interface AgiIntentRecommendation {
  recommended_mode: "agent" | "agi";
  confidence: number;
  reason: string;
  can_switch: boolean;
  next_step?: string;
  access?: { agi_can_use: boolean; agreement_required: boolean };
}

/** Scoped work package (AgiEngagementRead). */
export interface AgiEngagement {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  scope_definition: {
    target_allowlist: string[];
    forbidden_actions: string[];
    rules_of_engagement?: string;
    window_start?: string | null;
    window_end?: string | null;
    max_session_minutes?: number | null;
  };
  status: string;
  config?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** Loop brief (phantix.agi.loop_brief.v1). */
export interface AgiLoopItem {
  title: string;
  detail: string;
  severity: string;
  target: string;
  tool: string;
  reason: string;
  action: string;
}

export interface AgiLoopBrief {
  schema?: string;
  event?: string;
  session_id?: number;
  turn?: number;
  working_on?: string;
  summary?: string;
  content?: string;
  found?: AgiLoopItem[];
  next?: AgiLoopItem[];
  blockers?: AgiLoopItem[];
  job_status?: string;
  active_phase?: string;
  phase?: string;
  loop_status?: string;
  findings_count?: number;
  pending_approvals?: number;
}

export interface AgiChatResponse {
  schema_version?: string;
  ok?: boolean;
  session_id?: number;
  accepted?: boolean;
  queued?: boolean;
  blocked?: boolean;
  mock?: boolean;
  code?: string;
  reply?: string;
  reply_kind?: string;
  findings_count?: number;
  job?: Record<string, unknown>;
  loop?: AgiLoopBrief;
  found?: AgiLoopItem[];
  next?: AgiLoopItem[];
  blockers?: AgiLoopItem[];
  transcript_seq?: number | null;
}

/** Live agent run (AgiSessionRead). */
export interface AgiSession {
  id: number;
  engagement_id: number;
  container_id?: string | null;
  runner_session_id?: string | null;
  status: string;
  started_at: string;
  ended_at?: string | null;
  teardown_reason?: string | null;
  meta?: Record<string, unknown> | null;
  job?: Record<string, unknown> | null;
  loop?: AgiLoopBrief | null;
}

/** One terminal history line (AgiTranscriptChunk). */
export interface AgiTranscriptChunk {
  seq: number;
  role: string;
  content: string;
  meta?: Record<string, unknown> | null;
  created_at: string;
}

/** State-changing step awaiting approval (AgiActionRead). */
export interface AgiAction {
  id: number;
  session_id: number;
  action_type: string;
  tool_name?: string | null;
  proposed_command: string;
  rationale?: string | null;
  status: string;
  approved_by_staff_id?: number | null;
  decision_notes?: string | null;
  result_summary?: string | null;
  created_at: string;
  decided_at?: string | null;
  executed_at?: string | null;
}

// ── SOC Availability / uptime (MTTR) ──────────────────────────────────────────
// Mirrors app/engines/soc_engine/schemas/availability.py + services/summary.

export type AvailabilityCheckType = "http" | "https" | "tcp" | "tls" | "dns";
export type AvailabilityStatus = "unknown" | "up" | "down" | "degraded";

export interface AvailabilityCheck {
  id: number;
  organization_id: number;
  asset_id: number | null;
  name: string;
  check_type: AvailabilityCheckType | string;
  target: string;
  enabled: boolean;
  interval_seconds: number;
  timeout_seconds: number;
  failures_to_down: number;
  successes_to_up: number;
  expected_status: number | null;
  expected_keyword: string | null;
  severity_on_down: string;
  notify_on_down: boolean;
  notify_on_recovery: boolean;
  last_status: AvailabilityStatus | string;
  consecutive_failures: number;
  consecutive_successes: number;
  last_checked_at: string | null;
  last_latency_ms: number | null;
  last_error: string | null;
  next_check_at: string | null;
  metadata: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AvailabilityIncident {
  id: number;
  organization_id: number;
  check_id: number | null;
  asset_id: number | null;
  soc_detection_id: number | null;
  title: string;
  status: string;
  severity: string;
  source: string;
  down_at: string;
  recovered_at: string | null;
  acknowledged_at: string | null;
  time_to_resolve_seconds: number | null;
  time_to_acknowledge_seconds: number | null;
  excluded_from_sla: boolean;
  failure_count: number;
  last_error: string | null;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  elapsed_seconds: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AvailabilitySummary {
  organizationId: number;
  checks: {
    total?: number;
    enabled?: number;
    up?: number;
    down?: number;
    degraded?: number;
    unknown?: number;
  };
  openIncidents: number;
  uptimePercentSnapshot: number | null;
  mttrLast7d: {
    recoveredCount: number;
    avgSeconds: number | null;
    medianSeconds: number | null;
    p95Seconds: number | null;
  };
}
