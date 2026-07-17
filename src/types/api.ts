// === Auth ===
export interface LoginResponse {
  access_token?: string
  mfa_required?: boolean
  mfa_token?: string
  dev_otp?: string
  message?: string
}

export interface MfaCompleteRequest {
  mfa_token: string
  code: string
}

export interface DualControlLoginRequest {
  email: string
  password: string
}

export interface DualControlLoginResponse {
  session_token: string
}

// === Organization ===
export interface Organization {
  id: number
  name: string
  slug: string
  email: string
  setup_status?: string
  created_at: string
}

export interface SetupStatus {
  privacy_notice_accepted: boolean
  email_verified: boolean
  dual_control_configured: boolean
  security_db_connected: boolean
  has_assets: boolean
  completed_steps: string[]
  next_step: string
}

export interface RegisterOrgRequest {
  name: string
  slug: string
  email: string
  password: string
  industry: string
  company_type: string
  employee_count_range: string
  security_maturity: string
  timezone: string
  compliance_frameworks: string[]
  primary_contact: { title: string; name: string; email: string; phone: string }
  [key: string]: unknown
}

// === Org Users ===
export interface OrgUser {
  id: number
  email: string
  full_name: string
  role: string
  title: string
  mfa_enabled: boolean
  is_initiator: boolean
  is_authorizer: boolean
  created_at: string
}

export interface CreateOrgUserRequest {
  email: string
  password: string
  full_name: string
  title: string
  role: string
  mfa_enabled?: boolean
}

export interface AssignDualControlRequest {
  initiator_user_id: number
  authorizer_user_id: number
}

// === DB Connections ===
export interface DbConnection {
  id: number
  name: string
  db_type: string
  host: string
  port: number
  database_name: string
  connection_purpose: string
  environment: string
  is_primary: boolean
  created_at: string
}

export interface CreateDbConnectionRequest {
  name: string
  description: string
  db_type: string
  host: string
  port: number
  database_name: string
  username: string
  password: string
  ssl_mode: string
  connection_purpose: string
  environment: string
  is_primary: boolean
}

// === Assets ===
export interface Asset {
  id: number
  asset_type: string
  value: string
  name: string
  criticality: string
  is_active: boolean
  metadata?: Record<string, unknown>
  created_at: string
}

// === Discovery Jobs ===
export interface DiscoveryJobResultSummary {
  ok?: boolean
  domain?: string
  subdomains?: string[]
  endpoints?: string[]
  priority_endpoints?: string[]
  tools_used?: string[]
  assets_upserted?: number
  errors?: string[]
  method?: string
}

export interface DiscoveryJob {
  id: number
  organization_id: number
  job_type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  config: Record<string, unknown>
  result_summary: DiscoveryJobResultSummary | null
  assets_discovered: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface CreateDiscoveryJobRequest {
  job_type: string
  config: { domain: string; include_subdomains?: boolean; include_directories?: boolean; dir_tool?: string; wordlist_key?: string }
  run_inline?: boolean
}

// === Scan Jobs & Results ===
export interface ScanJob {
  id: number
  job_type: string
  status: string
  tools: string[]
  created_at: string
}

export interface ScanResult {
  id: number
  scan_job_id: number
  asset_id: number | null
  tool: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  description: string
  evidence: Record<string, unknown>
  raw_output?: string
  created_at: string
}

// === VAPT ===
export type CampaignStatus = 'draft' | 'pending_approval' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface VaptCampaign {
  id: number
  status: CampaignStatus
  current_phase?: string
  current_step_index?: number
  steps?: CampaignStep[]
  created_at: string
}

export interface CampaignStep {
  id?: number
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  output_summary?: Record<string, unknown>
}

export interface CorrelatedFinding {
  id: number
  campaign_id: number
  title: string
  description: string
  severity: string
  correlation_type: string
  attack_path?: {
    rule_key: string
    steps: Array<{ asset_id?: number; finding_id?: number; title: string; severity: string; types: string[] }>
    risk_summary: string
  }
  asset_id: number | null
  false_positive: boolean
  requires_human_review: boolean
  ai_analysis_requested: boolean
  created_at: string
}

// === Reports ===
export interface Report {
  id: number
  report_type: string
  campaign_id?: number
  status: 'generating' | 'complete' | 'failed'
  title: string
  output_files?: Record<string, string>
  error_message?: string
  created_at: string
}

export interface GenerateReportRequest {
  report_type: string
  campaign_id?: number
  formats: string[]
  run_inline?: boolean
  title?: string
}

// === Tracker ===
export interface TrackerEntry {
  id?: number
  finding_key: string
  title: string
  severity: string
  status: string
  assigned_owner?: string
  target_fix_date?: string
  created_at: string
}

// === Compliance ===
export interface ComplianceFramework {
  id: number
  name: string
  version: string
  controls_count: number
}

export interface ComplianceStatus {
  overall_compliance: number
  framework_statuses: Array<{ framework: string; score: number; status: string }>
}

// === Alerts ===
export interface AlertSettings {
  alerts_enabled: boolean
  smtp?: { enabled: boolean; host: string; port: number; from_email: string; from_name: string; use_tls: boolean }
  email_recipients: string[]
}

export interface AlertEvent {
  id: number
  event_type: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  title: string
  body: string
  payload?: Record<string, unknown>
  status: string
  created_at: string
}

export interface AlertEventsResponse {
  items: AlertEvent[]
  total: number
}

// === Admin ===
export interface DashboardStats {
  total_organizations?: number
  total_assets?: number
  active_campaigns?: number
  total_findings?: number
  [key: string]: unknown
}

export interface ScannerTool {
  tool_key: string
  name: string
  purpose: string
  docker_image: string | null
  host_binary: string | null
  available: boolean
  docker_available: boolean
  version: string | null
}

export interface ScannerToolsResponse {
  tools: ScannerTool[]
  wordlists: Array<{ key: string; name: string; purpose: string; present: boolean; bytes: number }>
  wordlist_root: string
  notes: string[]
}
