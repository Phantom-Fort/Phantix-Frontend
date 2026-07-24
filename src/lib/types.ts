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
  organizationId: number; status: "scaffold"; generatedAt: string;
  panels: Array<{ id: string; title: string; source: string; ready: boolean; endpoint: string | null; stream?: string; note?: string; }>;
  liveSubscribers: number; message: string;
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
}

export interface VaptFinding {
  id: number;
  campaign_id: number;
  title: string;
  severity: Severity;
  verification_status: VerificationStatus;
  confidence: number;
  asset_value: string;
  correlation_rule: string | null;
  attack_path: string[];
  cve: string | null;
  cvss: number | null;
  created_at: string;
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
  report_type: "vapt_campaign" | "executive" | "compliance" | "tracker";
  title: string;
  status: "queued" | "generating" | "complete" | "failed";
  formats: string[];
  campaign_id: number | null;
  version: number;
  stats: {
    after_dedupe: number;
    after_verification: number;
    excluded_from_report: number;
  };
  created_at: string;
  size_bytes: number;
}

export interface TrackerFinding {
  finding_key: string;
  title: string;
  severity: Severity;
  status:
    | "open"
    | "in_progress"
    | "resolved"
    | "accepted"
    | "false_positive"
    | "verified";
  owner: string | null;
  campaign_name: string;
  asset_value: string;
  updated_at: string;
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
  event_key: string;
  category: string;
  action: string;
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
  default_provider: string;
  ai_pentest_ready: boolean;
  mode: "economy" | "balanced" | "enterprise";
  providers: { id: string; configured: boolean }[];
  monthly_tokens: number;
  monthly_cost_usd: number;
}

export interface SupportTicket {
  id: number;
  subject: string;
  status: "open" | "pending" | "closed";
  priority: string;
  created_at: string;
  messages: { from: string; body: string; at: string }[];
}
