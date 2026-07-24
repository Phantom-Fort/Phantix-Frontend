import type {
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
  DbConnection,
  DiscoveryJob,
  DualControlState,
  EngineInfo,
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
  ServiceKeyMeta,
  SupportTicket,
  TrackerFinding,
  VaptApproval,
  VaptCampaign,
  VaptFinding,
} from "./types";

// Demo tenant ONLY — consumed via src/lib/data.ts when isDemoMode() is true
// (/demo, ?demo=1, or VITE_API_BASE unset). Live mode must never import this
// from pages; shapes still mirror the endpoint catalog.

export const organization: Organization = {
  id: 11,
  name: "Acme Financial Group",
  slug: "acme-financial",
  creator_user_id: 1,
  country: "NG",
  industry: "Financial Services",
  setup_complete: true,
  company_verified: true,
  identity_verified: true,
  plan: "Scale",
  created_at: "2026-05-04T09:12:00Z",
};

export const orgUsers: OrgUser[] = [
  {
    id: 1,
    full_name: "Ada Okonkwo",
    email: "ada@acme.ng",
    title: "IT Admin",
    role: "org_admin",
    otp_only: true,
    is_active: true,
    is_initiator: true,
    last_login_at: "2026-07-21T07:44:00Z",
  },
  {
    id: 2,
    full_name: "Chidi Eze",
    email: "chidi@acme.ng",
    title: "CISO",
    role: "security_admin",
    otp_only: true,
    is_active: true,
    is_authorizer: true,
    last_login_at: "2026-07-20T16:02:00Z",
  },
  {
    id: 3,
    full_name: "Tunde Bakare",
    email: "tunde@acme.ng",
    title: "SOC Analyst",
    role: "operator",
    otp_only: true,
    is_active: true,
    last_login_at: "2026-07-21T06:18:00Z",
  },
  {
    id: 4,
    full_name: "Ngozi Umeh",
    email: "ngozi@acme.ng",
    title: "Compliance Lead",
    role: "viewer",
    otp_only: true,
    is_active: true,
    last_login_at: "2026-07-19T11:40:00Z",
  },
];

export const dualControl: DualControlState = {
  configured: true,
  require_dual_control: true,
  initiator: { id: 1, full_name: "Ada Okonkwo", email: "ada@acme.ng", title: "IT Admin" },
  authorizer: { id: 2, full_name: "Chidi Eze", email: "chidi@acme.ng", title: "CISO" },
};

export const dbConnections: DbConnection[] = [
  {
    id: 4,
    name: "Phantix Security Store",
    connection_purpose: "security_data_storage",
    db_type: "postgresql",
    host: "10.20.0.14",
    port: 5432,
    database_name: "phantix_security",
    target_schema: "phantix",
    is_primary: true,
    bootstrap_status: "ready",
    schema_version: "1.4.2",
    last_test_at: "2026-07-21T06:30:00Z",
    last_test_ok: true,
    created_at: "2026-05-06T10:00:00Z",
  },
  {
    id: 7,
    name: "Core Banking Config Inspection",
    connection_purpose: "config_inspection",
    db_type: "postgresql",
    host: "10.20.0.22",
    port: 5432,
    database_name: "core_banking",
    target_schema: "public",
    is_primary: false,
    bootstrap_status: "not_bootstrapped",
    schema_version: null,
    last_test_at: "2026-07-18T13:11:00Z",
    last_test_ok: true,
    created_at: "2026-06-02T15:24:00Z",
  },
];

export const assetTags: AssetTag[] = [
  { id: 1, name: "crown-jewel", color: "#E8B54D", asset_count: 6, description: "Business critical" },
  { id: 2, name: "pci-scope", color: "#F43F5E", asset_count: 4, description: "Cardholder data env" },
  { id: 3, name: "external", color: "#38BDF8", asset_count: 18 },
  { id: 4, name: "production", color: "#34D399", asset_count: 21 },
  { id: 5, name: "customer-data", color: "#A78BFA", asset_count: 9 },
];

export const assets: Asset[] = [
  { id: 101, asset_type: "domain", value: "acme.ng", name: "Corporate domain", source: "manual", is_verified: true, verification_method: "domain_token", criticality: "high", environment: "production", tags: [assetTags[2], assetTags[3]], first_discovered_at: "2026-05-06T10:20:00Z", last_seen_at: "2026-07-21T05:00:00Z" },
  { id: 102, asset_type: "subdomain", value: "api.acme.ng", name: "Public API", source: "domain_enum", is_verified: true, verification_method: "http_probe", criticality: "critical", environment: "production", tags: [assetTags[0], assetTags[1], assetTags[2]], first_discovered_at: "2026-05-06T10:41:00Z", last_seen_at: "2026-07-21T05:00:00Z" },
  { id: 103, asset_type: "subdomain", value: "portal.acme.ng", name: "Customer portal", source: "domain_enum", is_verified: true, verification_method: "http_probe", criticality: "critical", environment: "production", tags: [assetTags[0], assetTags[2], assetTags[4]], first_discovered_at: "2026-05-06T10:41:00Z", last_seen_at: "2026-07-21T04:58:00Z" },
  { id: 104, asset_type: "web_app", value: "https://portal.acme.ng/", name: "Portal web app", source: "domain_enum", is_verified: true, verification_method: "http_probe", criticality: "high", environment: "production", tags: [assetTags[2]], first_discovered_at: "2026-05-06T11:02:00Z", last_seen_at: "2026-07-21T04:58:00Z" },
  { id: 105, asset_type: "ip_address", value: "41.58.130.44", name: "Edge gateway", source: "nmap", is_verified: true, verification_method: "ownership_confirm", criticality: "high", environment: "production", tags: [assetTags[2]], first_discovered_at: "2026-05-07T08:15:00Z", last_seen_at: "2026-07-20T22:10:00Z" },
  { id: 106, asset_type: "port_service", value: "41.58.130.44:443/https", name: "HTTPS service", source: "nmap", is_verified: true, verification_method: null, criticality: "medium", environment: "production", tags: [], first_discovered_at: "2026-05-07T08:16:00Z", last_seen_at: "2026-07-20T22:10:00Z" },
  { id: 107, asset_type: "github_repo", value: "acme-financial/core-ledger", name: "Core ledger service", source: "github", is_verified: true, verification_method: "github_owner", criticality: "critical", environment: "production", tags: [assetTags[0], assetTags[4]], first_discovered_at: "2026-05-09T09:00:00Z", last_seen_at: "2026-07-20T18:33:00Z" },
  { id: 108, asset_type: "github_repo", value: "acme-financial/mobile-android", name: "Android app", source: "github", is_verified: true, verification_method: "github_owner", criticality: "high", environment: "production", tags: [], first_discovered_at: "2026-05-09T09:00:00Z", last_seen_at: "2026-07-20T18:33:00Z" },
  { id: 109, asset_type: "api", value: "OpenAPI · payments-v2", name: "Payments API spec", source: "openapi", is_verified: true, verification_method: "ownership_confirm", criticality: "critical", environment: "production", tags: [assetTags[0], assetTags[1]], first_discovered_at: "2026-05-12T14:00:00Z", last_seen_at: "2026-07-19T09:44:00Z" },
  { id: 110, asset_type: "mobile_apk", value: "ng.acme.mobile", name: "Acme Mobile 4.2.1", source: "apk_upload", is_verified: true, verification_method: "ownership_confirm", criticality: "high", environment: "production", tags: [assetTags[4]], first_discovered_at: "2026-05-15T12:00:00Z", last_seen_at: "2026-07-18T10:20:00Z" },
  { id: 111, asset_type: "subdomain", value: "staging.acme.ng", name: "Staging environment", source: "domain_enum", is_verified: true, verification_method: "http_probe", criticality: "medium", environment: "staging", tags: [], first_discovered_at: "2026-05-06T10:41:00Z", last_seen_at: "2026-07-21T03:30:00Z" },
  { id: 112, asset_type: "database_connection", value: "core_banking@10.20.0.22", name: "Core banking DB", source: "manual", is_verified: true, verification_method: "config_inspection", criticality: "critical", environment: "production", tags: [assetTags[0], assetTags[4]], first_discovered_at: "2026-06-02T15:30:00Z", last_seen_at: "2026-07-18T13:11:00Z" },
];

export const discoveryJobs: DiscoveryJob[] = [
  { id: 31, job_type: "domain_enum", status: "completed", config: { domain: "acme.ng", include_subdomains: true, include_directories: true }, result_summary: { subdomains: 14, endpoints: 63, web_apps: 5 }, created_at: "2026-07-20T21:00:00Z", finished_at: "2026-07-20T21:14:00Z" },
  { id: 32, job_type: "nmap", status: "completed", config: { target: "41.58.130.44", ports: "top-1000" }, result_summary: { open_ports: 7, services: 7 }, created_at: "2026-07-20T22:00:00Z", finished_at: "2026-07-20T22:06:00Z" },
  { id: 33, job_type: "dns_enrich", status: "running", config: { domain: "acme.ng" }, created_at: "2026-07-21T07:58:00Z", finished_at: null },
];

export const scanJobs: ScanJob[] = [
  { id: 88, job_type: "vulnerability_scan", tools: ["nmap", "nuclei"], status: "running", target_filter: { tags: ["external"] }, progress: 62, findings_count: 14, initiated_by: "Tunde Bakare", idempotency_key: "scan-2026-07-21-01", created_at: "2026-07-21T07:30:00Z", started_at: "2026-07-21T07:30:20Z", finished_at: null },
  { id: 87, job_type: "vulnerability_scan", tools: ["nuclei"], status: "completed", target_filter: { asset_types: ["web_app", "api"] }, progress: 100, findings_count: 23, initiated_by: "Ada Okonkwo", idempotency_key: "scan-2026-07-20-02", created_at: "2026-07-20T13:00:00Z", started_at: "2026-07-20T13:00:15Z", finished_at: "2026-07-20T13:26:40Z" },
  { id: 86, job_type: "apk_scan", tools: ["apk"], status: "completed", target_filter: { asset_types: ["mobile_apk"] }, progress: 100, findings_count: 8, initiated_by: "Tunde Bakare", idempotency_key: "scan-2026-07-19-01", created_at: "2026-07-19T09:10:00Z", started_at: "2026-07-19T09:10:10Z", finished_at: "2026-07-19T09:19:02Z" },
  { id: 85, job_type: "vulnerability_scan", tools: ["nmap"], status: "failed", target_filter: { asset_ids: [105] }, progress: 41, findings_count: 3, initiated_by: "Ada Okonkwo", idempotency_key: "scan-2026-07-18-01", created_at: "2026-07-18T16:40:00Z", started_at: "2026-07-18T16:40:12Z", finished_at: "2026-07-18T16:47:51Z" },
];

export const scanResults: ScanResult[] = [
  { id: 901, scan_job_id: 88, asset_id: 104, asset_value: "portal.acme.ng", tool: "nuclei", severity: "critical", title: "CVE-2025-24104 — Jetty remote code execution", description: " vulnerable Jetty 11.0.24 handler chain allows unauthenticated RCE via crafted URI.", verification_status: "auto_verified", confidence: 98, created_at: "2026-07-21T07:41:00Z" },
  { id: 902, scan_job_id: 88, asset_id: 102, asset_value: "api.acme.ng", tool: "nuclei", severity: "high", title: "JWT accepts alg=none on /v2/auth/refresh", description: "Token validation bypass confirmed with forged claims.", verification_status: "auto_verified", confidence: 96, created_at: "2026-07-21T07:44:00Z" },
  { id: 903, scan_job_id: 88, asset_id: 105, asset_value: "41.58.130.44", tool: "nmap", severity: "medium", title: "OpenSSH 8.9p1 — outdated", description: "Version banner indicates missing security backports.", verification_status: "manually_verified", confidence: 88, created_at: "2026-07-21T07:35:00Z" },
  { id: 904, scan_job_id: 88, asset_id: 106, asset_value: "41.58.130.44:443", tool: "nuclei", severity: "high", title: "TLS 1.0 enabled on edge gateway", description: "Legacy protocol negotiated successfully.", verification_status: "auto_verified", confidence: 94, created_at: "2026-07-21T07:38:00Z" },
  { id: 905, scan_job_id: 88, asset_id: 111, asset_value: "staging.acme.ng", tool: "nuclei", severity: "low", title: "Directory listing on /backups/", description: "Heuristic probe — pattern match only.", verification_status: "unverified", confidence: 55, created_at: "2026-07-21T07:52:00Z" },
  { id: 906, scan_job_id: 88, asset_id: 105, asset_value: "41.58.130.44", tool: "nmap", severity: "info", title: "ICMP echo reply", description: "Host reachability signal.", verification_status: "rejected", confidence: 20, created_at: "2026-07-21T07:33:00Z" },
  { id: 907, scan_job_id: 87, asset_id: 109, asset_value: "payments-v2", tool: "nuclei", severity: "high", title: "Mass assignment on /v2/transfers", description: "Amount field accepted from client body without server check.", verification_status: "manually_verified", confidence: 91, created_at: "2026-07-20T13:14:00Z" },
  { id: 908, scan_job_id: 87, asset_id: 104, asset_value: "portal.acme.ng", tool: "nuclei", severity: "medium", title: "Missing Content-Security-Policy", description: "No CSP header on authenticated pages.", verification_status: "auto_verified", confidence: 99, created_at: "2026-07-20T13:09:00Z" },
  { id: 909, scan_job_id: 87, asset_id: 104, asset_value: "portal.acme.ng", tool: "nuclei", severity: "medium", title: "Session cookie lacks SameSite", description: "Cookie flags: Secure, HttpOnly only.", verification_status: "auto_verified", confidence: 97, created_at: "2026-07-20T13:09:30Z" },
  { id: 910, scan_job_id: 86, asset_id: 110, asset_value: "ng.acme.mobile", tool: "apk", severity: "high", title: "Hardcoded API secret in strings.xml", description: "Static analysis recovered a base64 secret constant.", verification_status: "manually_verified", confidence: 89, created_at: "2026-07-19T09:15:00Z" },
  { id: 911, scan_job_id: 86, asset_id: 110, asset_value: "ng.acme.mobile", tool: "apk", severity: "medium", title: "Exported activity without permission check", description: "MainActivity exported=true.", verification_status: "auto_verified", confidence: 93, created_at: "2026-07-19T09:16:00Z" },
  { id: 912, scan_job_id: 88, asset_id: 103, asset_value: "portal.acme.ng", tool: "nuclei", severity: "critical", title: "IDOR on /accounts/{id}/statement", description: "Sequential account ids return other customers' statements.", verification_status: "auto_verified", confidence: 97, created_at: "2026-07-21T07:49:00Z" },
];

export const vaptCampaigns: VaptCampaign[] = [
  { id: 13, name: "Q3 External Assessment", campaign_type: "external", procedure_key: "full_vapt", status: "active", phase: "Web application testing", progress: 58, asset_count: 9, findings_count: 17, requires_approval: true, created_by: "Ada Okonkwo", created_at: "2026-07-14T10:00:00Z", started_at: "2026-07-14T10:30:00Z", finished_at: null },
  { id: 12, name: "Payments API Deep Dive", campaign_type: "web_scan", procedure_key: "web_app_scan_only", status: "completed", phase: "Complete", progress: 100, asset_count: 3, findings_count: 11, requires_approval: false, created_by: "Chidi Eze", created_at: "2026-06-28T09:00:00Z", started_at: "2026-06-28T09:15:00Z", finished_at: "2026-07-02T17:40:00Z" },
  { id: 11, name: "Monthly Infrastructure Sweep", campaign_type: "internal", procedure_key: "infra_scan", status: "completed", phase: "Complete", progress: 100, asset_count: 22, findings_count: 31, requires_approval: false, created_by: "Tunde Bakare", created_at: "2026-06-01T08:00:00Z", started_at: "2026-06-01T08:05:00Z", finished_at: "2026-06-03T11:22:00Z" },
  { id: 10, name: "Mobile Channel Review", campaign_type: "mobile", procedure_key: "mobile_assessment", status: "draft", phase: "Scoping", progress: 0, asset_count: 1, findings_count: 0, requires_approval: true, created_by: "Ada Okonkwo", created_at: "2026-07-18T15:00:00Z", started_at: null, finished_at: null },
];

export const vaptFindings: VaptFinding[] = [
  { id: 301, campaign_id: 13, title: "Edge → Portal → Core ledger attack path", severity: "critical", verification_status: "auto_verified", confidence: 96, asset_value: "portal.acme.ng", correlation_rule: "chain.auth_bypass_data_access", attack_path: ["41.58.130.44:443 TLS 1.0", "portal.acme.ng Jetty RCE", "core-ledger service account"], cve: "CVE-2025-24104", cvss: 9.8, created_at: "2026-07-19T12:00:00Z" },
  { id: 302, campaign_id: 13, title: "IDOR exposes customer statements", severity: "critical", verification_status: "auto_verified", confidence: 97, asset_value: "portal.acme.ng", correlation_rule: null, attack_path: [], cve: null, cvss: 8.6, created_at: "2026-07-20T09:30:00Z" },
  { id: 303, campaign_id: 13, title: "JWT alg=none auth bypass", severity: "high", verification_status: "auto_verified", confidence: 96, asset_value: "api.acme.ng", correlation_rule: "chain.token_forgery", attack_path: ["/v2/auth/refresh", "forged admin claims"], cve: null, cvss: 8.1, created_at: "2026-07-20T11:00:00Z" },
  { id: 304, campaign_id: 13, title: "TLS 1.0 on edge gateway", severity: "high", verification_status: "manually_verified", confidence: 94, asset_value: "41.58.130.44", correlation_rule: null, attack_path: [], cve: null, cvss: 7.4, created_at: "2026-07-19T14:20:00Z" },
  { id: 305, campaign_id: 13, title: "Mass assignment on transfers", severity: "high", verification_status: "manually_verified", confidence: 91, asset_value: "payments-v2", correlation_rule: null, attack_path: [], cve: null, cvss: 7.1, created_at: "2026-07-21T06:10:00Z" },
  { id: 306, campaign_id: 13, title: "Staging debug console exposed", severity: "medium", verification_status: "unverified", confidence: 60, asset_value: "staging.acme.ng", correlation_rule: null, attack_path: [], cve: null, cvss: 5.3, created_at: "2026-07-20T16:45:00Z" },
];

export const vaptApprovals: VaptApproval[] = [
  { id: 51, campaign_id: 13, campaign_name: "Q3 External Assessment", step: "Exploitation phase — full_vapt gate", role_required: "authorizer", status: "pending", requested_at: "2026-07-21T06:55:00Z" },
  { id: 50, campaign_id: 13, campaign_name: "Q3 External Assessment", step: "Campaign start", role_required: "initiator", status: "approved", requested_at: "2026-07-14T10:05:00Z" },
];

export const risks: Risk[] = [
  {
    id: 501, title: "Unauthenticated RCE on customer portal", asset_value: "portal.acme.ng", vulnerability_key: "cve-2025-24104", status: "treatment_proposed", level: "critical", inherent_score: 92, residual_score: null, likelihood: 4, impact: 4, owner_department: "Digital Channels", priority_band: "P1", priority_score: 91.4,
    priority_factors: { effective_severity: 92, treatment_urgency: 88, status_urgency: 74, asset_context: 95, age: 40 },
    scoring_breakdown: [
      { component: "Base (L×I)", contribution: 80, detail: "Likelihood 4 × Impact 4 normalized" },
      { component: "Tag rules", contribution: 8, detail: "crown-jewel, pci-scope, external" },
      { component: "Exposure", contribution: 4, detail: "Internet-facing confirmed" },
    ],
    treatment_status: "proposed", age_days: 3, created_at: "2026-07-19T12:05:00Z", updated_at: "2026-07-21T06:00:00Z",
  },
  {
    id: 502, title: "IDOR on account statements", asset_value: "portal.acme.ng", vulnerability_key: "idor-statements", status: "under_approval", level: "critical", inherent_score: 86, residual_score: null, likelihood: 4, impact: 4, owner_department: "Digital Channels", priority_band: "P1", priority_score: 87.2,
    priority_factors: { effective_severity: 86, treatment_urgency: 92, status_urgency: 80, asset_context: 95, age: 30 },
    scoring_breakdown: [
      { component: "Base (L×I)", contribution: 78, detail: "Likelihood 4 × Impact 4 normalized" },
      { component: "Data rules", contribution: 8, detail: "customer_data exposure" },
    ],
    treatment_status: "under_approval", age_days: 2, created_at: "2026-07-20T09:35:00Z", updated_at: "2026-07-21T05:30:00Z",
  },
  {
    id: 503, title: "JWT algorithm confusion on refresh endpoint", asset_value: "api.acme.ng", vulnerability_key: "jwt-alg-none", status: "assessed", level: "high", inherent_score: 71, residual_score: null, likelihood: 3, impact: 4, owner_department: "Platform Engineering", priority_band: "P2", priority_score: 68.9,
    priority_factors: { effective_severity: 71, treatment_urgency: 60, status_urgency: 62, asset_context: 80, age: 45 },
    scoring_breakdown: [
      { component: "Base (L×I)", contribution: 63, detail: "Likelihood 3 × Impact 4 normalized" },
      { component: "Tag rules", contribution: 8, detail: "crown-jewel, pci-scope" },
    ],
    treatment_status: null, age_days: 2, created_at: "2026-07-20T11:05:00Z", updated_at: "2026-07-20T11:05:00Z",
  },
  {
    id: 504, title: "Legacy TLS on edge gateway", asset_value: "41.58.130.44", vulnerability_key: "tls-1.0-edge", status: "in_progress", level: "high", inherent_score: 64, residual_score: 28, likelihood: 3, impact: 3, owner_department: "Infrastructure", priority_band: "P2", priority_score: 61.3,
    priority_factors: { effective_severity: 46, treatment_urgency: 40, status_urgency: 55, asset_context: 75, age: 55 },
    scoring_breakdown: [
      { component: "Base (L×I)", contribution: 56, detail: "Likelihood 3 × Impact 3 normalized" },
      { component: "Exposure", contribution: 8, detail: "Internet-facing confirmed" },
    ],
    treatment_status: "approved", age_days: 8, created_at: "2026-07-13T14:00:00Z", updated_at: "2026-07-20T08:00:00Z",
  },
  {
    id: 505, title: "Hardcoded secret in Android build", asset_value: "ng.acme.mobile", vulnerability_key: "apk-hardcoded-secret", status: "identified", level: "high", inherent_score: 58, residual_score: null, likelihood: 2, impact: 4, owner_department: "Mobile Team", priority_band: "P3", priority_score: 47.8,
    priority_factors: { effective_severity: 58, treatment_urgency: 55, status_urgency: 68, asset_context: 60, age: 25 },
    scoring_breakdown: [
      { component: "Base (L×I)", contribution: 50, detail: "Likelihood 2 × Impact 4 normalized" },
      { component: "Data rules", contribution: 8, detail: "customer_data on device" },
    ],
    treatment_status: "proposed", age_days: 2, created_at: "2026-07-19T09:20:00Z", updated_at: "2026-07-19T09:20:00Z",
  },
  {
    id: 506, title: "Missing CSP on authenticated pages", asset_value: "portal.acme.ng", vulnerability_key: "missing-csp", status: "identified", level: "medium", inherent_score: 34, residual_score: null, likelihood: 2, impact: 2, owner_department: null, priority_band: "P4", priority_score: 33.1,
    priority_factors: { effective_severity: 34, treatment_urgency: 40, status_urgency: 68, asset_context: 55, age: 10 },
    scoring_breakdown: [{ component: "Base (L×I)", contribution: 34, detail: "Likelihood 2 × Impact 2 normalized" }],
    treatment_status: null, age_days: 1, created_at: "2026-07-20T13:10:00Z", updated_at: "2026-07-20T13:10:00Z",
  },
  {
    id: 507, title: "OpenSSH backports missing", asset_value: "41.58.130.44", vulnerability_key: "openssh-8.9p1", status: "accepted", level: "medium", inherent_score: 41, residual_score: 41, likelihood: 2, impact: 3, owner_department: "Infrastructure", priority_band: "P5", priority_score: 18.6,
    priority_factors: { effective_severity: 41, treatment_urgency: 10, status_urgency: 8, asset_context: 75, age: 20 },
    scoring_breakdown: [{ component: "Base (L×I)", contribution: 41, detail: "Likelihood 2 × Impact 3 normalized" }],
    treatment_status: "completed", age_days: 9, created_at: "2026-07-12T10:00:00Z", updated_at: "2026-07-19T10:00:00Z",
  },
];

export const complianceFrameworks: ComplianceFramework[] = [
  { id: "ndpr", name: "NDPR", version: "2019", description: "Nigeria Data Protection Regulation", control_count: 34, category: "Data Protection", is_active: true, recommended: true },
  { id: "iso27001", name: "ISO/IEC 27001", version: "2022", description: "Information security management", control_count: 93, category: "ISMS", is_active: true, recommended: true },
  { id: "soc2", name: "SOC 2", version: "2017", description: "Trust services criteria", control_count: 64, category: "Assurance", is_active: true, recommended: true },
  { id: "pci_dss", name: "PCI DSS", version: "4.0", description: "Payment card industry standard", control_count: 78, category: "Payments", is_active: true, recommended: true },
  { id: "gdpr", name: "GDPR", version: "2018", description: "EU general data protection", control_count: 41, category: "Data Protection", is_active: true, recommended: false },
];

export const complianceAssessments: ComplianceAssessment[] = [
  { id: 21, framework_id: "iso27001", framework_name: "ISO/IEC 27001", status: "completed", score: 71, controls_passed: 66, controls_gap: 19, controls_unknown: 8, include_questionnaire: true, include_posture: true, created_at: "2026-07-20T15:00:00Z" },
  { id: 20, framework_id: "ndpr", framework_name: "NDPR", status: "completed", score: 82, controls_passed: 28, controls_gap: 4, controls_unknown: 2, include_questionnaire: true, include_posture: true, created_at: "2026-07-18T10:00:00Z" },
  { id: 19, framework_id: "pci_dss", framework_name: "PCI DSS", status: "completed", score: 58, controls_passed: 45, controls_gap: 26, controls_unknown: 7, include_questionnaire: false, include_posture: true, created_at: "2026-07-10T09:00:00Z" },
];

export const complianceControlResults: ComplianceControlResult[] = [
  { control_id: "A.5.1", title: "Policies for information security", category: "Organizational", status: "pass", source: "merged", evidence_count: 4, recommendation: "Maintain annual review cycle" },
  { control_id: "A.8.9", title: "Configuration management", category: "Technological", status: "gap", source: "posture", evidence_count: 2, recommendation: "Remediate TLS 1.0 on edge gateway; enforce baseline" },
  { control_id: "A.8.16", title: "Monitoring activities", category: "Technological", status: "gap", source: "merged", evidence_count: 1, recommendation: "Extend Wazuh coverage to portal tier" },
  { control_id: "A.5.24", title: "Incident management planning", category: "Organizational", status: "pass", source: "questionnaire", evidence_count: 3, recommendation: "—" },
  { control_id: "A.8.2", title: "Privileged access rights", category: "Technological", status: "unknown", source: "questionnaire", evidence_count: 0, recommendation: "Complete questionnaire section" },
  { control_id: "A.8.8", title: "Management of technical vulnerabilities", category: "Technological", status: "pass", source: "posture", evidence_count: 6, recommendation: "Continue verified-finding cadence" },
];

export const evidenceItems: EvidenceItem[] = [
  { id: 71, connector: "wazuh", evidence_type: "siem_alerts", title: "Wazuh — authentication anomaly pack", status: "collected", collected_at: "2026-07-20T16:00:00Z", summary: "412 alerts normalized · 3 mapped to A.8.16" },
  { id: 72, connector: "wazuh", evidence_type: "agent_coverage", title: "Wazuh — agent coverage report", status: "collected", collected_at: "2026-07-20T16:00:00Z", summary: "38/44 agents active" },
  { id: 73, connector: "manual", evidence_type: "policy_document", title: "ISMS Policy v3.2 (board approved)", status: "manual", collected_at: "2026-07-15T11:00:00Z", summary: "Uploaded by Ngozi Umeh" },
  { id: 74, connector: "manual", evidence_type: "attestation", title: "Incident response tabletop minutes", status: "manual", collected_at: "2026-07-02T09:00:00Z", summary: "Q2 exercise records" },
];

export const reports: Report[] = [
  { id: 44, report_type: "vapt_campaign", title: "Payments API Deep Dive — Client Package", status: "complete", formats: ["pdf", "docx", "markdown", "json", "xlsx"], campaign_id: 12, version: 2, stats: { after_dedupe: 14, after_verification: 11, excluded_from_report: 3 }, created_at: "2026-07-03T09:00:00Z", size_bytes: 4_812_000 },
  { id: 43, report_type: "executive", title: "June Board Security Summary", status: "complete", formats: ["pdf", "docx"], campaign_id: 11, version: 1, stats: { after_dedupe: 38, after_verification: 31, excluded_from_report: 7 }, created_at: "2026-06-05T10:00:00Z", size_bytes: 2_204_000 },
  { id: 42, report_type: "compliance", title: "NDPR Readiness Snapshot", status: "complete", formats: ["pdf", "json"], campaign_id: null, version: 1, stats: { after_dedupe: 34, after_verification: 34, excluded_from_report: 0 }, created_at: "2026-07-18T12:00:00Z", size_bytes: 1_480_000 },
  { id: 45, report_type: "vapt_campaign", title: "Q3 External Assessment — Interim", status: "generating", formats: ["pdf", "docx", "markdown", "json"], campaign_id: 13, version: 1, stats: { after_dedupe: 19, after_verification: 14, excluded_from_report: 5 }, created_at: "2026-07-21T07:55:00Z", size_bytes: 0 },
];

export const trackerFindings: TrackerFinding[] = [
  { finding_key: "VAPT-301", title: "Edge → Portal → Core ledger attack path", severity: "critical", status: "in_progress", owner: "appsec@acme.ng", campaign_name: "Q3 External Assessment", asset_value: "portal.acme.ng", updated_at: "2026-07-21T06:30:00Z" },
  { finding_key: "VAPT-302", title: "IDOR exposes customer statements", severity: "critical", status: "open", owner: null, campaign_name: "Q3 External Assessment", asset_value: "portal.acme.ng", updated_at: "2026-07-20T09:35:00Z" },
  { finding_key: "VAPT-303", title: "JWT alg=none auth bypass", severity: "high", status: "open", owner: "platform@acme.ng", campaign_name: "Q3 External Assessment", asset_value: "api.acme.ng", updated_at: "2026-07-20T11:00:00Z" },
  { finding_key: "VAPT-287", title: "Mass assignment on transfers", severity: "high", status: "verified", owner: "payments@acme.ng", campaign_name: "Payments API Deep Dive", asset_value: "payments-v2", updated_at: "2026-07-19T15:00:00Z" },
  { finding_key: "VAPT-279", title: "Hardcoded API secret in APK", severity: "high", status: "in_progress", owner: "mobile@acme.ng", campaign_name: "Payments API Deep Dive", asset_value: "ng.acme.mobile", updated_at: "2026-07-20T10:00:00Z" },
  { finding_key: "VAPT-264", title: "Outdated OpenSSH on edge", severity: "medium", status: "accepted", owner: "infra@acme.ng", campaign_name: "Monthly Infrastructure Sweep", asset_value: "41.58.130.44", updated_at: "2026-07-12T10:00:00Z" },
  { finding_key: "VAPT-251", title: "Reflected XSS on search", severity: "medium", status: "resolved", owner: "portal@acme.ng", campaign_name: "Monthly Infrastructure Sweep", asset_value: "portal.acme.ng", updated_at: "2026-06-20T14:00:00Z" },
  { finding_key: "VAPT-249", title: "Rate limit bypass (reachability)", severity: "low", status: "false_positive", owner: null, campaign_name: "Monthly Infrastructure Sweep", asset_value: "api.acme.ng", updated_at: "2026-06-18T09:00:00Z" },
];

export const alertEvents: AlertEvent[] = [
  { id: 201, event_type: "risk.critical", severity: "critical", title: "Critical risk: Unauthenticated RCE on customer portal", status: "delivered", channels: ["email", "whatsapp", "telegram"], created_at: "2026-07-21T06:01:00Z" },
  { id: 200, event_type: "scan.completed", severity: "medium", title: "Scan #87 completed — 23 findings", status: "delivered", channels: ["email"], created_at: "2026-07-20T13:27:00Z" },
  { id: 199, event_type: "risk.created", severity: "high", title: "New risk: JWT algorithm confusion", status: "delivered", channels: ["email"], created_at: "2026-07-20T11:06:00Z" },
  { id: 198, event_type: "custom.vapt_campaign_completed", severity: "medium", title: "Campaign finished: Payments API Deep Dive", status: "delivered", channels: ["email"], created_at: "2026-07-02T17:41:00Z" },
  { id: 197, event_type: "scan.failed", severity: "high", title: "Scan #85 failed — executor timeout", status: "delivered", channels: ["email"], created_at: "2026-07-18T16:48:00Z" },
];

export const alertSettings: AlertSettings = {
  alerts_enabled: true,
  smtp: { enabled: true, host: "smtp.acme.ng", port: 587, from_email: "alerts@acme.ng", from_name: "Acme Security Alerts", use_tls: true },
  email_recipients: ["security@acme.ng", "ciso@acme.ng"],
  whatsapp: { enabled: true, provider: "log", recipients: ["+2348012345678"] },
  telegram: { enabled: false, provider: "log", recipients: [] },
  notify: { scan_completed: true, scan_failed: true, risk_created: true, risk_critical: true, treatment_events: true },
};

export const auditEvents: AuditEvent[] = [
  { id: 601, event_key: "risk.treatment.approve", category: "risks", action: "Approved treatment: TLS baseline remediation", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "Chidi Eze", authorizer_title: "CISO", created_at: "2026-07-20T08:05:00Z" },
  { id: 600, event_key: "vapt.campaign.start", category: "vapt", action: "Started campaign: Q3 External Assessment", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "Chidi Eze", authorizer_title: "CISO", created_at: "2026-07-14T10:30:00Z" },
  { id: 599, event_key: "db_connection.create", category: "connections", action: "Created security storage connection", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: null, authorizer_title: null, created_at: "2026-07-11T09:00:00Z" },
  { id: 598, event_key: "asset.bulk_delete", category: "assets", action: "Deleted 6 stale assets", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "Chidi Eze", authorizer_title: "CISO", created_at: "2026-07-08T14:22:00Z" },
  { id: 597, event_key: "auth.org_user.login", category: "auth", action: "Org user login (dual_control)", initiator_name: "Chidi Eze", initiator_title: "CISO", authorizer_name: null, authorizer_title: null, created_at: "2026-07-21T07:02:00Z" },
];

export const pendingActions: PendingAction[] = [
  { id: 41, action_key: "risk.treatment.approve", action_label: "Approve IDOR fix compensation plan", category: "risks", initiated_by: "Ada Okonkwo", status: "pending", created_at: "2026-07-21T05:40:00Z" },
  { id: 40, action_key: "vapt.step.exploitation", action_label: "Exploitation phase gate — Q3 External", category: "vapt", initiated_by: "Ada Okonkwo", status: "pending", created_at: "2026-07-21T06:55:00Z" },
];

export const engines: EngineInfo[] = [
  { id: "control_plane", name: "Control Plane", status: "implemented", description: "Tenancy, auth realms, billing, support" },
  { id: "asset_engine", name: "Asset Engine", status: "implemented", description: "Attack-surface inventory & discovery" },
  { id: "scanner_engine", name: "Scanner Engine", status: "implemented", description: "Nmap / Nuclei orchestration" },
  { id: "vapt_engine", name: "VAPT Engine", status: "implemented", description: "Campaigns, correlation, web scanner" },
  { id: "risk_engine", name: "Risk Engine", status: "implemented", description: "Hybrid scoring & prioritization" },
  { id: "ai_engine", name: "AI Engine", status: "implemented", description: "Governed narratives — never scores" },
  { id: "compliance_engine", name: "Compliance Engine", status: "implemented", description: "Frameworks, assessments, evidence" },
  { id: "reporting_engine", name: "Reporting Engine", status: "implemented", description: "Verified-only multi-format reports" },
  { id: "alert_engine", name: "Alert Engine", status: "implemented", description: "Severity-routed client alerts" },
  { id: "audit_engine", name: "Audit Engine", status: "implemented", description: "Immutable dual-control trail" },
  { id: "operations_engine", name: "Operations Engine", status: "implemented", description: "Server ops, logs, search" },
];

export const serviceKey: ServiceKeyMeta = {
  id: 3,
  prefix: "pk_live_9f4c…",
  active: true,
  created_at: "2026-06-20T10:00:00Z",
  last_used_at: "2026-07-21T07:12:00Z",
};

export const aiStatus: AiStatus = {
  enabled: true,
  default_provider: "deepseek",
  ai_pentest_ready: true,
  mode: "balanced",
  providers: [
    { id: "deepseek", configured: true },
    { id: "kimi", configured: true },
    { id: "qwen", configured: false },
    { id: "mock", configured: true },
  ],
  monthly_tokens: 1_284_500,
  monthly_cost_usd: 6.42,
};

export const supportTickets: SupportTicket[] = [
  { id: 12, subject: "Nuclei template update cadence", status: "open", priority: "normal", created_at: "2026-07-19T10:00:00Z", messages: [{ from: "Ada Okonkwo", body: "How often are nuclei templates refreshed on staging?", at: "2026-07-19T10:00:00Z" }] },
  { id: 9, subject: "APK upload limit increase", status: "pending", priority: "low", created_at: "2026-07-10T09:00:00Z", messages: [{ from: "Tunde Bakare", body: "Our release APK is 260MB — can the limit be raised?", at: "2026-07-10T09:00:00Z" }] },
];

// Dashboard trend (last 14 days of posture)
export const postureTrend = [
  { day: "Jul 8", score: 61, findings: 34 },
  { day: "Jul 9", score: 62, findings: 33 },
  { day: "Jul 10", score: 60, findings: 35 },
  { day: "Jul 11", score: 63, findings: 32 },
  { day: "Jul 12", score: 64, findings: 31 },
  { day: "Jul 13", score: 64, findings: 30 },
  { day: "Jul 14", score: 63, findings: 31 },
  { day: "Jul 15", score: 65, findings: 29 },
  { day: "Jul 16", score: 66, findings: 28 },
  { day: "Jul 17", score: 66, findings: 27 },
  { day: "Jul 18", score: 68, findings: 25 },
  { day: "Jul 19", score: 67, findings: 26 },
  { day: "Jul 20", score: 69, findings: 24 },
  { day: "Jul 21", score: 71, findings: 22 },
];

export const severityDistribution = [
  { name: "Critical", value: 2, color: "#F43F5E" },
  { name: "High", value: 6, color: "#FB923C" },
  { name: "Medium", value: 9, color: "#FACC15" },
  { name: "Low", value: 4, color: "#38BDF8" },
  { name: "Info", value: 1, color: "#94A3B8" },
];

export const intelligenceDashboard: IntelligenceDashboard = { organizationId: 11, postureScore: 68, posture_score: 68, totals: { activeAssets: 1423, verified: 892, unverified: 531, neverScanned: 204, highRiskAssets: 47, externalAssets: 312, openFindings: 184 }, total_assets: 1423, verified_count: 892, unscanned_count: 204, criticalAssetsAtRisk: [{ id: 1, value: "api.acme-financial.com", assetType: "domain", riskLevel: "critical", riskScore: 92, openFindingsCount: 12, priorityScore: 94, exposureLevel: "external", isVerified: true }, { id: 2, value: "db-prod.internal", assetType: "host", riskLevel: "high", riskScore: 78, openFindingsCount: 7, priorityScore: 85, exposureLevel: "internal", isVerified: true }], newlyDiscoveredUnscanned: [{ id: 201, value: "new-sub.acme-financial.com", assetType: "subdomain", firstSeenAt: new Date(Date.now() - 86400000).toISOString(), isVerified: false, source: "subfinder" }], generatedAt: new Date().toISOString() };

export const relationshipGraph: RelationshipGraph = { nodes: [{ id: 1, value: "acme-financial.com", name: "acme-financial.com", assetType: "domain", riskLevel: "low", riskScore: 15, openFindingsCount: 2, isVerified: true, exposureLevel: "external", priorityScore: 25 }, { id: 2, value: "api.acme-financial.com", name: "API Gateway", assetType: "subdomain", riskLevel: "high", riskScore: 74, openFindingsCount: 8, isVerified: true, exposureLevel: "external", priorityScore: 85 }], edges: [{ id: 1, source: 1, target: 2, relationshipType: "domain_to_subdomain", confidence: 1 }], rootAssetId: null, depth: 2, truncated: false, nodeCount: 2, edgeCount: 1 };

export const socDashboard = { organizationId: 0, status: "scaffold" as const, generatedAt: new Date().toISOString(), panels: [{ id: "live-assets", title: "Live Asset Events", source: "asset_intelligence", ready: true, endpoint: "/assets/intelligence/stream", stream: "/assets/intelligence/stream" }, { id: "risk-panel", title: "Risk Overview", source: "asset_intelligence", ready: true, endpoint: "/assets/intelligence/dashboard" }, { id: "detections", title: "SOC Detections", source: "soc_engine", ready: false, endpoint: null, note: "Coming when SOC detections ship" }], liveSubscribers: 1, message: "SOC monitoring scaffold" };
