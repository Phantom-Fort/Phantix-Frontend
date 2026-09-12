import type {
  AgentSkill,
  AiStatus,
  AiUsage,
  ReportTypeEntry,
  TrackerSummary,
  AlertEvent,
  AlertSettings,
  Asset,
  AssetIntelligence,
  AssetTag,
  AuditEvent,
  CloudConnector,
  CloudEvent,
  CloudProvider,
  ComplianceAssessment,
  ComplianceControlResult,
  ComplianceFramework,
  DbConnection,
  DiscoveryJob,
  DualControlState,
  EngineInfo,
  EvidenceItem,
  IntegrationConnector,
  IntegrationInstallation,
  IntelDashboard,
  IntelEventsResponse,
  IntelLookup,
  IntelligenceDashboard,
  MitreMatrix,
  MitreStats,
  OrgUser,
  Organization,
  PendingAction,
  PentestEligibleResponse,
  PentestScopePattern,
  PentestScopeRead,
  PrioritizedAsset,
  RelationshipGraph,
  Report,
  Risk,
  ScanJob,
  ScanResult,
  ServiceKeyMeta,
  SocAdapter,
  SocAdvisorDashboard,
  SocAdvisorRecommendation,
  SocAdvisorReport,
  SocAgent,
  SocAgentFleet,
  SocCase,
  SocCasesSummary,
  SocCloudConnection,
  SocCloudProviderCatalog,
  SocDetection,
  SocLogPipelineStats,
  SocMitreMatrixPanel,
  SocPlaybook,
  SocRule,
  SocRunbook,
  SocSlaDashboard,
  SocStatus,
  SocWarRoomCase,
  SocWarRoomChecklist,
  SocWarRoomEvidence,
  SocWarRoomKillChain,
  SocWarRoomResponse,
  SocWarRoomSla,
  SocWarRoomStats,
  SupportTicket,
  TrackerFinding,
  VaptApproval,
  VaptCampaign,
  VaptFinding,
  Severity,
} from "./types";
// Type-only imports: erased at compile time, so the GRC/VAPT/context modules can
// import these fixtures back without creating a runtime import cycle.
import type {
  AnswererAudit,
  AnswererSession,
  BusinessProfile,
  ComplianceLevel,
  EvidenceConnector,
  GapAnalysis,
  QuestionnaireList,
  QuestionnaireProgress,
  QuestionnaireQuestion,
} from "./complianceGrc";
import type {
  CorrelationRule,
  PostureDrift,
  PostureDueRisk,
  PostureSnapshot,
  RuleCandidate,
  VaptProcedure,
  VaptSchedule,
  VaptSettings,
} from "./vaptOps";
import type {
  DocumentHit,
  ProductProject,
  ProjectGraph,
  RememberedModel,
  ThreatModelDetail,
} from "./productContext";
import type { VaptPlan } from "./vaptOps";
import type {
  AutofixStatus,
  BranchReviewWallet,
  CodeAiExplanation,
  CodeBlob,
  CodeFinding,
  CodeFindingFile,
  CodeSeverityCounts,
  GithubInstallation,
  Repo as GithubRepo,
  ReviewEvent,
  ReviewSetting,
} from "./codeOps";

// Demo tenant ONLY --- consumed via src/lib/data.ts when isDemoMode() is true
// (/demo or demo session flag). Live mode must never import this
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
    name: "SecureGraph Store",
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
  { id: 901, scan_job_id: 88, asset_id: 104, asset_value: "portal.acme.ng", tool: "nuclei", severity: "critical", title: "CVE-2025-24104 --- Jetty remote code execution", description: " vulnerable Jetty 11.0.24 handler chain allows unauthenticated RCE via crafted URI.", verification_status: "auto_verified", confidence: 98, created_at: "2026-07-21T07:41:00Z", reportable: true, impact_level: "Critical", impact_score: 4, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_cve" }, impact_analysis: { impact_level: "Critical", impact_score: 4, summary: "Critical impact — remote code execution (service)", categories: ["remote_code_execution"], blast_radius: "service" } } },
  { id: 902, scan_job_id: 88, asset_id: 102, asset_value: "api.acme.ng", tool: "nuclei", severity: "high", title: "JWT accepts alg=none on /v2/auth/refresh", description: "Token validation bypass confirmed with forged claims.", verification_status: "auto_verified", confidence: 96, created_at: "2026-07-21T07:44:00Z", reportable: true, impact_level: "High", impact_score: 3, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "High", impact_score: 3, summary: "High impact — authentication bypass (service)", categories: ["authentication_bypass"], blast_radius: "service" } } },
  { id: 903, scan_job_id: 88, asset_id: 105, asset_value: "41.58.130.44", tool: "nmap", severity: "medium", title: "OpenSSH 8.9p1 --- outdated", description: "Version banner indicates missing security backports.", verification_status: "manually_verified", confidence: 88, created_at: "2026-07-21T07:35:00Z", reportable: true, impact_level: "Medium", impact_score: 2, evidence: { verification: { confidence: "manually-verified", verification_status: "manually_verified", reportable: true, method: "explicit_status" }, impact_analysis: { impact_level: "Medium", impact_score: 2, summary: "Medium impact — service disruption (host)", categories: ["supply_chain"], blast_radius: "host" } } },
  { id: 904, scan_job_id: 88, asset_id: 106, asset_value: "41.58.130.44:443", tool: "nuclei", severity: "high", title: "TLS 1.0 enabled on edge gateway", description: "Legacy protocol negotiated successfully.", verification_status: "auto_verified", confidence: 94, created_at: "2026-07-21T07:38:00Z", reportable: true, impact_level: "High", impact_score: 3, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "High", impact_score: 3, summary: "High impact — cryptographic weakness (internet-facing)", categories: ["cryptographic_weakness"], blast_radius: "internet_facing" } } },
  { id: 905, scan_job_id: 88, asset_id: 111, asset_value: "staging.acme.ng", tool: "nuclei", severity: "low", title: "Directory listing on /backups/", description: "Heuristic probe --- pattern match only.", verification_status: "unverified", confidence: 55, created_at: "2026-07-21T07:52:00Z", reportable: false, evidence: { verification: { confidence: "heuristic", verification_status: "unverified", reportable: false, method: "auto_http_evidence" } } },
  { id: 906, scan_job_id: 88, asset_id: 105, asset_value: "41.58.130.44", tool: "nmap", severity: "info", title: "ICMP echo reply", description: "Host reachability signal.", verification_status: "rejected", confidence: 20, created_at: "2026-07-21T07:33:00Z", reportable: false, evidence: { verification: { confidence: "heuristic", verification_status: "rejected", reportable: false, method: "explicit_status" } } },
  { id: 907, scan_job_id: 87, asset_id: 109, asset_value: "payments-v2", tool: "nuclei", severity: "high", title: "Mass assignment on /v2/transfers", description: "Amount field accepted from client body without server check.", verification_status: "manually_verified", confidence: 91, created_at: "2026-07-20T13:14:00Z", reportable: true, impact_level: "High", impact_score: 3, evidence: { verification: { confidence: "manually-verified", verification_status: "manually_verified", reportable: true, method: "explicit_status" }, impact_analysis: { impact_level: "High", impact_score: 3, summary: "High impact — data exposure (service)", categories: ["data_exposure"], blast_radius: "service" } } },
  { id: 908, scan_job_id: 87, asset_id: 104, asset_value: "portal.acme.ng", tool: "nuclei", severity: "medium", title: "Missing Content-Security-Policy", description: "No CSP header on authenticated pages.", verification_status: "auto_verified", confidence: 99, created_at: "2026-07-20T13:09:00Z", reportable: true, impact_level: "Medium", impact_score: 2, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "Medium", impact_score: 2, summary: "Medium impact — misconfiguration (service)", categories: ["misconfiguration"], blast_radius: "service" } } },
  { id: 909, scan_job_id: 87, asset_id: 104, asset_value: "portal.acme.ng", tool: "nuclei", severity: "medium", title: "Session cookie lacks SameSite", description: "Cookie flags: Secure, HttpOnly only.", verification_status: "auto_verified", confidence: 97, created_at: "2026-07-20T13:09:30Z", reportable: true, impact_level: "Medium", impact_score: 2, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "Medium", impact_score: 2, summary: "Medium impact — misconfiguration (service)", categories: ["misconfiguration"], blast_radius: "service" } } },
  { id: 910, scan_job_id: 86, asset_id: 110, asset_value: "ng.acme.mobile", tool: "apk", severity: "high", title: "Hardcoded API secret in strings.xml", description: "Static analysis recovered a base64 secret constant.", verification_status: "manually_verified", confidence: 89, created_at: "2026-07-19T09:15:00Z", reportable: true, impact_level: "High", impact_score: 3, evidence: { verification: { confidence: "manually-verified", verification_status: "manually_verified", reportable: true, method: "explicit_status" }, impact_analysis: { impact_level: "High", impact_score: 3, summary: "High impact — data exposure (host)", categories: ["data_exposure"], blast_radius: "host" } } },
  { id: 911, scan_job_id: 86, asset_id: 110, asset_value: "ng.acme.mobile", tool: "apk", severity: "medium", title: "Exported activity without permission check", description: "MainActivity exported=true.", verification_status: "auto_verified", confidence: 93, created_at: "2026-07-19T09:16:00Z", reportable: true, impact_level: "Medium", impact_score: 2, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "Medium", impact_score: 2, summary: "Medium impact — information disclosure (host)", categories: ["information_disclosure"], blast_radius: "host" } } },
  { id: 912, scan_job_id: 88, asset_id: 103, asset_value: "portal.acme.ng", tool: "nuclei", severity: "critical", title: "IDOR on /accounts/{id}/statement", description: "Sequential account ids return other customers' statements.", verification_status: "auto_verified", confidence: 97, created_at: "2026-07-21T07:49:00Z", reportable: true, impact_level: "Critical", impact_score: 4, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "Critical", impact_score: 4, summary: "Critical impact — data exposure (service)", categories: ["data_exposure"], blast_radius: "service" } } },
];

export const vaptCampaigns: VaptCampaign[] = [
  { id: 13, name: "Q3 External Assessment", campaign_type: "external", procedure_key: "full_vapt", status: "active", phase: "Web application testing", progress: 58, asset_count: 9, findings_count: 17, requires_approval: true, created_by: "Ada Okonkwo", created_at: "2026-07-14T10:00:00Z", started_at: "2026-07-14T10:30:00Z", finished_at: null, current_step_index: 2, current_phase: "Vulnerability templates", asset_scope: { asset_types: ["domain", "subdomain", "ip_address"] }, procedure_snapshot: { source: "full_vapt", steps: [
    { step_type: "recon", step_name: "Asset & DNS recon", step_description: "Enumerate subdomains and hosts", status: "completed", config: { tools: ["subfinder", "dnsx"], max_duration_minutes: 15 }, output_summary: { assets_resolved: 22, unique_hosts: 14, targets_scanned: ["acme.ng", "www.acme.ng", "app.acme.ng", "portal.acme.ng", "api.acme.ng", "staging.acme.ng"], skipped_already_scanned: ["104.21.10.198 (IP skipped — domain/subdomain already in job; not re-scanned after hostname)", "172.67.131.182 (IP skipped — domain/subdomain already in job; not re-scanned after hostname)"], skipped_count: 2, time_budget_seconds: 900, elapsed_seconds: 540, results_written: 0, tools: ["subfinder", "dnsx"] } },
    { step_type: "scan", step_name: "Network surface (Nmap)", step_description: "Port and service discovery on live hosts", status: "completed", config: { tools: ["nmap"], max_duration_minutes: 20 }, output_summary: { assets_resolved: 9, unique_hosts: 9, targets_scanned: ["portal.acme.ng", "api.acme.ng", "staging.acme.ng"], skipped_already_scanned: [], skipped_count: 0, time_budget_seconds: 1200, elapsed_seconds: 1100, results_written: 41, tools: ["nmap"] } },
    { step_type: "scan", step_name: "Vulnerability templates", step_description: "6 vulnerability types, 28 checks; types=['domain', 'subdomain', 'web_app', 'api']", status: "running", config: { tools: ["vuln_scan"], max_duration_minutes: 35, dedupe_hosts: true, target_types: ["domain", "subdomain", "web_app", "api"], substeps: [
      { key: "transport_security", label: "Transport security", check_count: 4, enabled: true, regression: true, why: "A previously remediated weakness of this type has returned." },
      { key: "exposed_admin_surface", label: "Exposed admin & debug surfaces", check_count: 8, enabled: true, regression: false, why: "The attack tree ranks its class #4 on this surface." },
      { key: "known_cve", label: "Known CVE probes", check_count: 3, enabled: true, regression: false, why: "The attack tree ranks its class #9 on this surface." },
      { key: "secret_exposure", label: "Exposed secrets & source control", check_count: 2, enabled: true, regression: false, why: "Standard coverage for this surface." },
      { key: "security_headers", label: "Browser security headers", check_count: 4, enabled: true, regression: false, why: "A previous run disproved this class here." },
      { key: "tech_disclosure", label: "Technology & version disclosure", check_count: 7, enabled: false, regression: false, why: "Switched off by the reviewer before the campaign was created." },
    ] }, output_summary: { assets_resolved: 18, assets_considered: 12, unique_hosts: 12, targets_scanned: ["portal.acme.ng", "api.acme.ng", "app.acme.ng", "www.acme.ng", "staging.acme.ng"], skipped_already_scanned: ["41.58.130.44 (IP skipped — domain/subdomain already in job; not re-scanned after hostname)", "104.21.10.198 (IP skipped — domain/subdomain already in job; not re-scanned after hostname)"], skipped_count: 4, time_budget_seconds: 2100, elapsed_seconds: 1320, results_written: 17, tools: ["vuln_scan"], partial: true } },
    { step_type: "correlate", step_name: "Attack-path correlation", step_description: "Chain findings into attack paths", status: "pending", config: {}, output_summary: {} },
    { step_type: "analyze", step_name: "AI-assisted analysis", step_description: "Optional narrative enrichment", status: "pending", config: {}, output_summary: {} },
  ] } },
  { id: 12, name: "Payments API Deep Dive", campaign_type: "web_scan", procedure_key: "web_app_scan_only", status: "completed", phase: "Complete", progress: 100, asset_count: 3, findings_count: 11, requires_approval: false, created_by: "Chidi Eze", created_at: "2026-06-28T09:00:00Z", started_at: "2026-06-28T09:15:00Z", finished_at: "2026-07-02T17:40:00Z", current_step_index: 3, current_phase: "Complete", asset_scope: { asset_ids: [102, 109, 103] }, procedure_snapshot: { source: "web_app_scan_only", steps: [
    { step_type: "recon", step_name: "API surface enumeration", step_description: "Crawl and inventory endpoints", status: "completed", config: { tools: ["katana", "httpx"] }, output_summary: { assets_resolved: 3, unique_hosts: 3, results_written: 0, tools: ["katana", "httpx"] } },
    { step_type: "scan", step_name: "API security checks", step_description: "BOLA/JWT/rate-limit verification", status: "completed", config: { tools: ["nuclei", "sqlmap"] }, output_summary: { unique_hosts: 3, results_written: 11, tools: ["nuclei", "sqlmap"] } },
    { step_type: "correlate", step_name: "Attack-path correlation", step_description: "Chain findings", status: "completed", config: {}, output_summary: { results_written: 0 } },
    { step_type: "analyze", step_name: "AI-assisted analysis", step_description: "Narrative enrichment", status: "completed", config: {}, output_summary: {} },
  ] } },
  { id: 11, name: "Monthly Infrastructure Sweep", campaign_type: "internal", procedure_key: "infra_scan", status: "completed", phase: "Complete", progress: 100, asset_count: 22, findings_count: 31, requires_approval: false, created_by: "Tunde Bakare", created_at: "2026-06-01T08:00:00Z", started_at: "2026-06-01T08:05:00Z", finished_at: "2026-06-03T11:22:00Z", current_step_index: 2, current_phase: "Complete", asset_scope: { asset_types: ["ip_address"] }, procedure_snapshot: { source: "infra_scan", steps: [
    { step_type: "scan", step_name: "Network surface (Nmap)", step_description: "Port and service discovery", status: "completed", config: { tools: ["nmap"] }, output_summary: { assets_resolved: 22, unique_hosts: 22, results_written: 31, tools: ["nmap"] } },
    { step_type: "scan", step_name: "Vulnerability templates", step_description: "YAML checks on hosts", status: "completed", config: { tools: ["vuln_scan"] }, output_summary: { unique_hosts: 22, results_written: 0, tools: ["vuln_scan"] } },
    { step_type: "correlate", step_name: "Attack-path correlation", step_description: "Chain findings", status: "completed", config: {}, output_summary: {} },
  ] } },
  { id: 10, name: "Mobile Channel Review", campaign_type: "mobile", procedure_key: "mobile_assessment", status: "draft", phase: "Scoping", progress: 0, asset_count: 1, findings_count: 0, requires_approval: true, created_by: "Ada Okonkwo", created_at: "2026-07-18T15:00:00Z", started_at: null, finished_at: null, current_step_index: 0, current_phase: "Scoping", asset_scope: { asset_types: ["mobile_apk"] }, procedure_snapshot: { source: "mobile_assessment", steps: [
    { step_type: "scan", step_name: "APK static analysis", step_description: "Extract manifest and secrets", status: "pending", config: { tools: ["apk"] }, output_summary: {} },
  ] } },
];

export const vaptFindings: VaptFinding[] = [
  { id: 301, campaign_id: 13, title: "Edge → Portal → Core ledger attack path", severity: "critical", verification_status: "auto_verified", confidence: 96, asset_value: "portal.acme.ng", correlation_rule: "chain.auth_bypass_data_access", attack_path: ["41.58.130.44:443 TLS 1.0", "portal.acme.ng Jetty RCE", "core-ledger service account"], cve: "CVE-2025-24104", cvss: 9.8, created_at: "2026-07-19T12:00:00Z", reportable: true, impact_level: "Critical", impact_score: 4, impact_summary: "Critical impact — remote code execution (service)", business_impact: "High business impact from a verified critical-severity finding allowing unauthenticated control of the customer portal.", technical_impact: "Untrusted input reaches a trusted Jetty handler chain, enabling unauthenticated RCE on the portal tier.", impact_analysis: { impact_level: "Critical", impact_score: 4, cia: { confidentiality: "high", integrity: "high", availability: "high" }, categories: ["remote_code_execution"], blast_radius: "service", business_impact: "High business impact from a verified critical-severity finding allowing unauthenticated control of the customer portal.", technical_impact: "Untrusted input reaches a trusted Jetty handler chain, enabling unauthenticated RCE on the portal tier.", summary: "Critical impact — remote code execution (service)", analysis_method: "deterministic_v1", analyzed_at: "2026-07-21T10:00:00Z" } },
  { id: 302, campaign_id: 13, title: "IDOR exposes customer statements", severity: "critical", verification_status: "auto_verified", confidence: 97, asset_value: "portal.acme.ng", correlation_rule: null, attack_path: [], cve: null, cvss: 8.6, created_at: "2026-07-20T09:30:00Z", reportable: true, impact_level: "Critical", impact_score: 4, impact_summary: "Critical impact — data exposure (service)", business_impact: "Customers' financial statements can be read by any authenticated user by walking sequential ids.", technical_impact: "Object reference is not validated against the authenticated principal before returning the statement resource.", impact_analysis: { impact_level: "Critical", impact_score: 4, cia: { confidentiality: "high", integrity: "low", availability: "low" }, categories: ["data_exposure"], blast_radius: "service", business_impact: "Customers' financial statements can be read by any authenticated user by walking sequential ids.", technical_impact: "Object reference is not validated against the authenticated principal before returning the statement resource.", summary: "Critical impact — data exposure (service)", analysis_method: "deterministic_v1", analyzed_at: "2026-07-21T10:05:00Z" } },
  { id: 303, campaign_id: 13, title: "JWT alg=none auth bypass", severity: "high", verification_status: "auto_verified", confidence: 96, asset_value: "api.acme.ng", correlation_rule: "chain.token_forgery", attack_path: ["/v2/auth/refresh", "forged admin claims"], cve: null, cvss: 8.1, created_at: "2026-07-20T11:00:00Z", reportable: true, impact_level: "High", impact_score: 3, impact_summary: "High impact — authentication bypass (service)", business_impact: "Forged tokens grant administrative API access without credentials.", technical_impact: "Refresh endpoint accepts alg=none tokens, bypassing signature verification.", impact_analysis: { impact_level: "High", impact_score: 3, cia: { confidentiality: "high", integrity: "high", availability: "low" }, categories: ["authentication_bypass"], blast_radius: "service", business_impact: "Forged tokens grant administrative API access without credentials.", technical_impact: "Refresh endpoint accepts alg=none tokens, bypassing signature verification.", summary: "High impact — authentication bypass (service)", analysis_method: "deterministic_v1", analyzed_at: "2026-07-21T10:10:00Z" } },
  { id: 304, campaign_id: 13, title: "TLS 1.0 on edge gateway", severity: "high", verification_status: "manually_verified", confidence: 94, asset_value: "41.58.130.44", correlation_rule: null, attack_path: [], cve: null, cvss: 7.4, created_at: "2026-07-19T14:20:00Z", reportable: true, impact_level: "High", impact_score: 3, impact_summary: "High impact — cryptographic weakness (internet-facing)", business_impact: "Legacy TLS weakens transport security for internet-facing traffic.", technical_impact: "TLS 1.0 negotiation accepted, exposing the connection to protocol-level attacks.", impact_analysis: { impact_level: "High", impact_score: 3, cia: { confidentiality: "medium", integrity: "low", availability: "low" }, categories: ["cryptographic_weakness"], blast_radius: "internet_facing", business_impact: "Legacy TLS weakens transport security for internet-facing traffic.", technical_impact: "TLS 1.0 negotiation accepted, exposing the connection to protocol-level attacks.", summary: "High impact — cryptographic weakness (internet-facing)", analysis_method: "deterministic_v1", analyzed_at: "2026-07-21T10:15:00Z" } },
  { id: 305, campaign_id: 13, title: "Mass assignment on transfers", severity: "high", verification_status: "manually_verified", confidence: 91, asset_value: "payments-v2", correlation_rule: null, attack_path: [], cve: null, cvss: 7.1, created_at: "2026-07-21T06:10:00Z", reportable: true, impact_level: "High", impact_score: 3, impact_summary: "High impact — data exposure (service)", business_impact: "Client-controlled fields can alter transfer amounts and destinations.", technical_impact: "Request body fields are bound to the transfer model without an allowlist.", impact_analysis: { impact_level: "High", impact_score: 3, cia: { confidentiality: "low", integrity: "high", availability: "low" }, categories: ["data_exposure"], blast_radius: "service", business_impact: "Client-controlled fields can alter transfer amounts and destinations.", technical_impact: "Request body fields are bound to the transfer model without an allowlist.", summary: "High impact — data exposure (service)", analysis_method: "deterministic_v1", analyzed_at: "2026-07-21T10:20:00Z" } },
  { id: 306, campaign_id: 13, title: "Staging debug console exposed", severity: "medium", verification_status: "unverified", confidence: 60, asset_value: "staging.acme.ng", correlation_rule: null, attack_path: [], cve: null, cvss: 5.3, created_at: "2026-07-20T16:45:00Z", reportable: false },
];

export const vaptApprovals: VaptApproval[] = [
  { id: 51, campaign_id: 13, campaign_name: "Q3 External Assessment", step: "Exploitation phase --- full_vapt gate", role_required: "authorizer", status: "pending", requested_at: "2026-07-21T06:55:00Z" },
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
  { control_id: "A.5.24", title: "Incident management planning", category: "Organizational", status: "pass", source: "questionnaire", evidence_count: 3, recommendation: "---" },
  { control_id: "A.8.2", title: "Privileged access rights", category: "Technological", status: "unknown", source: "questionnaire", evidence_count: 0, recommendation: "Complete questionnaire section" },
  { control_id: "A.8.8", title: "Management of technical vulnerabilities", category: "Technological", status: "pass", source: "posture", evidence_count: 6, recommendation: "Continue verified-finding cadence" },
];

export const evidenceItems: EvidenceItem[] = [
  { id: 71, connector: "wazuh", evidence_type: "siem_alerts", title: "Wazuh --- authentication anomaly pack", status: "collected", collected_at: "2026-07-20T16:00:00Z", summary: "412 alerts normalized · 3 mapped to A.8.16" },
  { id: 72, connector: "wazuh", evidence_type: "agent_coverage", title: "Wazuh --- agent coverage report", status: "collected", collected_at: "2026-07-20T16:00:00Z", summary: "38/44 agents active" },
  { id: 73, connector: "manual", evidence_type: "policy_document", title: "ISMS Policy v3.2 (board approved)", status: "manual", collected_at: "2026-07-15T11:00:00Z", summary: "Uploaded by Ngozi Umeh" },
  { id: 74, connector: "manual", evidence_type: "attestation", title: "Incident response tabletop minutes", status: "manual", collected_at: "2026-07-02T09:00:00Z", summary: "Q2 exercise records" },
];

export const reports: Report[] = [
  { id: 44, report_type: "vapt_campaign", title: "Payments API Deep Dive --- Client Package", status: "complete", formats_requested: ["pdf", "docx", "markdown", "json", "xlsx"], campaign_id: 12, version: 2, stats: { after_dedupe: 14, after_verification: 11, excluded_from_report: 3, impact_analyzed: 11 }, created_at: "2026-07-03T09:00:00Z", size_bytes: 4_812_000 },
  { id: 43, report_type: "executive", title: "June Board Security Summary", status: "complete", formats_requested: ["pdf", "docx"], campaign_id: 11, version: 1, stats: { after_dedupe: 38, after_verification: 31, excluded_from_report: 7, impact_analyzed: 31 }, created_at: "2026-06-05T10:00:00Z", size_bytes: 2_204_000 },
  { id: 42, report_type: "compliance", title: "NDPR Readiness Snapshot", status: "complete", formats_requested: ["pdf", "json"], campaign_id: null, version: 1, stats: { after_dedupe: 34, after_verification: 34, excluded_from_report: 0, impact_analyzed: 34 }, created_at: "2026-07-18T12:00:00Z", size_bytes: 1_480_000 },
  { id: 45, report_type: "vapt_campaign", title: "Q3 External Assessment --- Interim", status: "generating", formats_requested: ["pdf", "docx", "markdown", "json"], campaign_id: 13, version: 1, stats: { after_dedupe: 19, after_verification: 14, excluded_from_report: 5 }, created_at: "2026-07-21T07:55:00Z", size_bytes: 0 },
];

export const trackerFindings: TrackerFinding[] = [
  { finding_key: "VAPT-301", title: "Edge → Portal → Core ledger attack path", severity: "critical", status: "in_progress", owner: "appsec@acme.ng", campaign_name: "Q3 External Assessment", asset_value: "portal.acme.ng", updated_at: "2026-07-21T06:30:00Z", priority: "P0", surface: "Web" },
  { finding_key: "VAPT-302", title: "IDOR exposes customer statements", severity: "critical", status: "open", owner: null, campaign_name: "Q3 External Assessment", asset_value: "portal.acme.ng", updated_at: "2026-07-20T09:35:00Z", priority: "P0", surface: "Web" },
  { finding_key: "VAPT-303", title: "JWT alg=none auth bypass", severity: "high", status: "open", owner: "platform@acme.ng", campaign_name: "Q3 External Assessment", asset_value: "api.acme.ng", updated_at: "2026-07-20T11:00:00Z", priority: "P1", surface: "API" },
  { finding_key: "VAPT-287", title: "Mass assignment on transfers", severity: "high", status: "fixed", owner: "payments@acme.ng", campaign_name: "Payments API Deep Dive", asset_value: "payments-v2", updated_at: "2026-07-19T15:00:00Z", priority: "P1", surface: "API" },
  { finding_key: "VAPT-279", title: "Hardcoded API secret in APK", severity: "high", status: "in_progress", owner: "mobile@acme.ng", campaign_name: "Payments API Deep Dive", asset_value: "ng.acme.mobile", updated_at: "2026-07-20T10:00:00Z", priority: "P1", surface: "Mobile" },
  { finding_key: "VAPT-264", title: "Outdated OpenSSH on edge", severity: "medium", status: "accepted", owner: "infra@acme.ng", campaign_name: "Monthly Infrastructure Sweep", asset_value: "41.58.130.44", updated_at: "2026-07-12T10:00:00Z", priority: "P3", surface: "Infrastructure" },
  { finding_key: "VAPT-251", title: "Reflected XSS on search", severity: "medium", status: "fixed", owner: "portal@acme.ng", campaign_name: "Monthly Infrastructure Sweep", asset_value: "portal.acme.ng", updated_at: "2026-06-20T14:00:00Z", priority: "P2", surface: "Web" },
  { finding_key: "VAPT-249", title: "Rate limit bypass (reachability)", severity: "low", status: "regressed", owner: null, campaign_name: "Monthly Infrastructure Sweep", asset_value: "api.acme.ng", updated_at: "2026-06-18T09:00:00Z", priority: "P3", surface: "API" },
];

export const alertEvents: AlertEvent[] = [
  { id: 201, event_type: "risk.critical", severity: "critical", title: "Critical risk: Unauthenticated RCE on customer portal", status: "delivered", channels: ["email", "whatsapp", "telegram"], created_at: "2026-07-21T06:01:00Z" },
  { id: 200, event_type: "scan.completed", severity: "medium", title: "Scan #87 completed --- 23 findings", status: "delivered", channels: ["email"], created_at: "2026-07-20T13:27:00Z" },
  { id: 199, event_type: "risk.created", severity: "high", title: "New risk: JWT algorithm confusion", status: "delivered", channels: ["email"], created_at: "2026-07-20T11:06:00Z" },
  { id: 198, event_type: "custom.vapt_campaign_completed", severity: "medium", title: "Campaign finished: Payments API Deep Dive", status: "delivered", channels: ["email"], created_at: "2026-07-02T17:41:00Z" },
  { id: 197, event_type: "scan.failed", severity: "high", title: "Scan #85 failed --- executor timeout", status: "delivered", channels: ["email"], created_at: "2026-07-18T16:48:00Z" },
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
  { id: 601, action_key: "risk.treatment.approve", action_label: "PATCH /api/v1/risks/treatments/3/approve", category: "risks", status: "completed", summary: "Approved treatment: TLS baseline remediation", details: { path: "/api/v1/risks/treatments/3/approve", method: "PATCH", actor_user_id: 2, actor_email: "ada@phantixlabs.com", token_type: "app_session", passive: false }, source: "api_middleware", ip_address: "102.89.34.12", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "Chidi Eze", authorizer_title: "CISO", created_at: "2026-07-20T08:05:00Z" },
  { id: 600, action_key: "vapt.campaign.start", action_label: "POST /api/v1/vapt/campaigns/13/start", category: "vapt", status: "completed", summary: "Started campaign: Q3 External Assessment", details: { path: "/api/v1/vapt/campaigns/13/start", method: "POST", actor_user_id: 2, actor_email: "ada@phantixlabs.com", token_type: "app_session", passive: false }, source: "api_middleware", ip_address: "102.89.34.12", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "Chidi Eze", authorizer_title: "CISO", created_at: "2026-07-14T10:30:00Z" },
  { id: 599, action_key: "data.access", action_label: "GET /api/v1/assets/intelligence/dashboard", category: "data_access", status: "completed", summary: "GET /api/v1/assets/intelligence/dashboard", details: { path: "/api/v1/assets/intelligence/dashboard", method: "GET", actor_user_id: 2, actor_email: "ada@phantixlabs.com", token_type: "app_session", passive: true }, source: "api_middleware", ip_address: "102.89.34.12", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "SecureGraph Test Org", authorizer_title: "org_admin", created_at: "2026-07-13T15:22:00Z" },
  { id: 598, action_key: "data.access", action_label: "GET /api/v1/scans/results", category: "data_access", status: "completed", summary: "GET /api/v1/scans/results", details: { path: "/api/v1/scans/results", method: "GET", actor_user_id: 2, actor_email: "ada@phantixlabs.com", token_type: "app_session", passive: true }, source: "api_middleware", ip_address: "102.89.34.12", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "SecureGraph Test Org", authorizer_title: "org_admin", created_at: "2026-07-13T15:20:00Z" },
  { id: 597, action_key: "compliance.assessment.run", action_label: "POST /api/v1/compliance/assessments/2/run", category: "compliance", status: "completed", summary: "Ran ISO 27001 assessment", details: { path: "/api/v1/compliance/assessments/2/run", method: "POST", actor_user_id: 2, actor_email: "ada@phantixlabs.com", token_type: "app_session", passive: false }, source: "api_middleware", ip_address: "102.89.34.12", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "Chidi Eze", authorizer_title: "CISO", created_at: "2026-07-12T11:00:00Z" },
  { id: 596, action_key: "data.access", action_label: "GET /api/v1/risks/prioritized", category: "data_access", status: "completed", summary: "GET /api/v1/risks/prioritized", details: { path: "/api/v1/risks/prioritized", method: "GET", actor_user_id: 3, actor_email: "chidi@phantixlabs.com", token_type: "app_session", passive: true }, source: "api_middleware", ip_address: "102.89.34.13", initiator_name: "Chidi Eze", initiator_title: "CISO", authorizer_name: "SecureGraph Test Org", authorizer_title: "org_admin", created_at: "2026-07-12T09:30:00Z" },
  { id: 595, action_key: "report.generate", action_label: "POST /api/v1/reports", category: "reports", status: "completed", summary: "Generated vapt_campaign report for campaign #12", details: { path: "/api/v1/reports", method: "POST", actor_user_id: 2, actor_email: "ada@phantixlabs.com", token_type: "app_session", passive: false }, source: "api_middleware", ip_address: "102.89.34.12", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "Chidi Eze", authorizer_title: "CISO", created_at: "2026-07-11T14:00:00Z" },
  { id: 594, action_key: "auth.org_user.login", action_label: "POST /api/v1/auth/login", category: "auth", status: "completed", summary: "Org user login (dual_control)", details: { path: "/api/v1/auth/login", method: "POST", actor_user_id: 3, actor_email: "chidi@phantixlabs.com", token_type: "app_session", passive: false }, source: "api_middleware", ip_address: "102.89.34.13", initiator_name: "Chidi Eze", initiator_title: "CISO", authorizer_name: null, authorizer_title: null, created_at: "2026-07-10T07:02:00Z" },
];

export const pendingActions: PendingAction[] = [
  { id: 41, action_key: "risk.treatment.approve", action_label: "Approve IDOR fix compensation plan", category: "risks", initiated_by: "Ada Okonkwo", status: "pending", created_at: "2026-07-21T05:40:00Z" },
  { id: 40, action_key: "vapt.step.exploitation", action_label: "Exploitation phase gate --- Q3 External", category: "vapt", initiated_by: "Ada Okonkwo", status: "pending", created_at: "2026-07-21T06:55:00Z" },
];

export const engines: EngineInfo[] = [
  { id: "control_plane", name: "Control Plane", status: "implemented", description: "Tenancy, auth realms, billing, support" },
  { id: "asset_engine", name: "Asset Engine", status: "implemented", description: "Attack-surface inventory & discovery" },
  { id: "scanner_engine", name: "Scanner Engine", status: "implemented", description: "Nmap / Nuclei orchestration" },
  { id: "vapt_engine", name: "VAPT Engine", status: "implemented", description: "Campaigns, correlation, web scanner" },
  { id: "risk_engine", name: "Risk Engine", status: "implemented", description: "Hybrid scoring & prioritization" },
  { id: "ai_engine", name: "AI Engine", status: "implemented", description: "Governed narratives --- never scores" },
  { id: "compliance_engine", name: "Compliance Engine", status: "implemented", description: "Frameworks, assessments, evidence" },
  { id: "reporting_engine", name: "Reporting Engine", status: "implemented", description: "Verified-only multi-format reports" },
  { id: "alert_engine", name: "Alert Engine", status: "implemented", description: "Severity-routed client alerts" },
  { id: "audit_engine", name: "Audit Engine", status: "implemented", description: "Immutable dual-control trail" },
  { id: "operations_engine", name: "Operations Engine", status: "implemented", description: "Server ops, logs, search" },
];

export const serviceKey: ServiceKeyMeta = {
  id: 3,
  prefix: "pk_live_9f4c...",
  active: true,
  created_at: "2026-06-20T10:00:00Z",
  last_used_at: "2026-07-21T07:12:00Z",
};

/** Mid-month budget state: comfortably inside both ceilings. */
export const aiUsage: AiUsage = {
  organization_id: 11,
  year_month: "2026-09",
  tokens_used: 412880,
  token_budget: 1000000,
  cost_usd: 18.4,
  spend_limit_usd: 50,
  cost_ngn: 27600,
  spend_limit_ngn: 75000,
  currency: "NGN",
  fx_ngn_per_usd: 1500,
  allowed: true,
  mode: "balanced",
};

export const aiStatus: AiStatus = {
  enabled: true,
  agent_enabled: true,
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
  agent: {
    enabled: true,
    provider: "deepseek",
    model: "deepseek-v4-flash",
    deepseek_ready: true,
    stream: {
      enabled: true,
      protocol: "Server-Sent Events (text/event-stream)",
      chat: "POST /api/v1/ai/agent/chat/stream",
      runs: "POST /api/v1/ai/agent/runs/stream",
      events: ["connected", "meta", "reasoning", "delta", "usage", "done", "error"],
    },
  },
};

export const agentSkills: AgentSkill[] = [
  { id: 1, name: "phantix-vapt-writeup", description: "Drafts verified VAPT finding write-ups from campaign data. Only references findings with a SecureGraph finding ID.", version: "1.0.0", domain: "vapt", status: "active", score: 0.94, uses: 187, last_used_at: "2026-07-21T09:00:00Z", created_at: "2026-06-02T10:00:00Z" },
  { id: 2, name: "phantix-asset-exposure-brief", description: "Summarizes an asset's external exposure from intelligence signals.", version: "1.1.0", domain: "asset", status: "active", score: 0.91, uses: 142, last_used_at: "2026-07-20T14:22:00Z", created_at: "2026-06-05T10:00:00Z" },
  { id: 3, name: "phantix-soc-triage-assist", description: "Assists SOC triage: correlates detections, suggests priority for human review.", version: "0.9.0", domain: "soc", status: "candidate", score: 0.78, uses: 21, last_used_at: "2026-07-18T11:40:00Z", created_at: "2026-07-01T10:00:00Z" },
  { id: 4, name: "phantix-grc-gap-brief", description: "Explains compliance framework gaps with control evidence references.", version: "1.0.0", domain: "grc", status: "candidate", score: 0.82, uses: 9, last_used_at: null, created_at: "2026-07-08T10:00:00Z" },
  { id: 5, name: "phantix-threat-correlate", description: "Correlates threat intelligence signals across assets. Disabled pending review.", version: "0.4.0", domain: "ti", status: "quarantined", score: 0.51, uses: 14, last_used_at: "2026-07-12T09:30:00Z", created_at: "2026-06-20T10:00:00Z" },
];

export const supportTickets: SupportTicket[] = [
  { id: 12, subject: "Nuclei template update cadence", status: "open", priority: "normal", created_at: "2026-07-19T10:00:00Z", messages: [{ from: "Ada Okonkwo", body: "How often are nuclei templates refreshed on staging?", at: "2026-07-19T10:00:00Z" }] },
  { id: 9, subject: "APK upload limit increase", status: "pending", priority: "low", created_at: "2026-07-10T09:00:00Z", messages: [{ from: "Tunde Bakare", body: "Our release APK is 260MB --- can the limit be raised?", at: "2026-07-10T09:00:00Z" }] },
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

export const socDashboard = { organizationId: 0, status: "implemented" as const, generatedAt: new Date().toISOString(), panels: [
  { id: "live-assets", title: "Live Security Events", source: "shared.realtime + soc_engine", ready: true, endpoint: "/api/v1/soc/dashboard/stream", stream: "/api/v1/soc/dashboard/stream", note: "SOC SSE + Asset Intelligence events on same hub" },
  { id: "asset_posture", title: "Asset posture", source: "asset_intelligence", ready: true, endpoint: "/api/v1/assets/intelligence/dashboard", note: "Posture score" },
  { id: "critical_assets", title: "Critical assets at risk", source: "asset_intelligence", ready: true, endpoint: "/api/v1/assets/intelligence/prioritized?risk_level=critical" },
  { id: "detections", title: "Active detections", source: "soc_engine", ready: true, endpoint: "/api/v1/soc/detections?open_only=true", openTotal: 8 },
  { id: "triage_queue", title: "Analyst triage queue", source: "soc_engine", ready: true, endpoint: "/api/v1/soc/detections?open_only=true" },
  { id: "cases", title: "Open cases", source: "soc_engine", ready: true, endpoint: "/api/v1/soc/cases?status=open" },
], liveSubscribers: 2, message: "SOC dashboard live. Detections and triage are engine-backed; asset posture still served by Asset Intelligence." };

export const socStatus: SocStatus = {
  engineId: "soc_engine",
  name: "SOC Engine",
  status: "implemented",
  version: "0.1.0",
  organizationId: 11,
  message: "SOC Engine is implemented: detections, rules, optional cases, dashboard SSE, Celery correlation, enrichment adapter interfaces.",
  capabilities: {
    detection_rules: true,
    builtin_correlators: true,
    manual_detections: true,
    alert_triage_queue: true,
    optional_cases: true,
    realtime_monitoring_dashboard: true,
    soc_sse_stream: true,
    dedup_fingerprints: true,
    celery_correlation: true,
    ai_triage_packet: true,
    audit_on_triage: true,
    alert_enqueue_on_critical: true,
    siem_connectors_live: false,
    enrichment_adapter_interfaces: true,
    enrichment_webhook: true,
  },
  builtinCorrelators: ["builtin.risk", "builtin.finding_high", "builtin.scan_high_findings", "builtin.alert_critical", "builtin.asset_watch"],
  queue: { openTotal: 8, byStatus: { open: 5, assigned: 2, escalated: 1, closed: 12 }, bySeverityOpen: { critical: 2, high: 3, medium: 3 } },
  adapters: [
    { id: "generic_webhook", configured: true, vendor: "phantix" },
    { id: "splunk", configured: false, vendor: "splunk" },
    { id: "microsoft_defender", configured: false, vendor: "microsoft" },
    { id: "soar_generic", configured: false, vendor: "soar" },
  ],
  realtimeHub: "app.shared.realtime — SOC publishes socDetectionMatched, socAlertRaised, socTriageAssigned; stream at /api/v1/soc/dashboard/stream",
};

const socDetection = (d: Partial<SocDetection> & { id: number; title: string; severity: Severity }): SocDetection => ({
  organization_id: 11,
  rule_id: null,
  correlator_id: null,
  case_id: null,
  summary: null,
  status: "open",
  assignee_ref: null,
  asset_id: null,
  risk_id: null,
  finding_ref: {},
  signal_fingerprint: null,
  evidence: {},
  metadata: {},
  source: "correlator",
  occurrence_count: 1,
  priority_score: 50,
  first_seen_at: new Date(Date.now() - 7200000).toISOString(),
  last_seen_at: new Date().toISOString(),
  created_at: new Date(Date.now() - 7200000).toISOString(),
  updated_at: new Date().toISOString(),
  ...d,
});

export const socDetections: SocDetection[] = [
  socDetection({ id: 101, title: "Critical risk: RCE on edge", severity: "critical", correlator_id: "builtin.risk", risk_id: 501, asset_id: 7, occurrence_count: 3, priority_score: 125.5, source: "correlator", status: "open", evidence: { event_type: "RiskCritical", blast_radius_hint: { related_asset_count: 3 } } }),
  socDetection({ id: 102, title: "High findings on prod tags", severity: "high", correlator_id: "builtin.finding_high", asset_id: 9, occurrence_count: 2, priority_score: 98, source: "correlator", status: "open", evidence: { event_type: "FindingCreated" } }),
  socDetection({ id: 103, title: "TLS 1.0 on edge gateway", severity: "high", correlator_id: "builtin.scan_high_findings", asset_id: 10, risk_id: 504, occurrence_count: 1, priority_score: 88, source: "correlator", status: "assigned", assignee_ref: "user:12", evidence: { event_type: "ScanCompleted" } }),
  socDetection({ id: 104, title: "Alert: critical vulnerability detected", severity: "critical", correlator_id: "builtin.alert_critical", asset_id: 11, occurrence_count: 1, priority_score: 115, source: "correlator", status: "escalated", case_id: 9, evidence: { event_type: "AlertCritical" } }),
  socDetection({ id: 105, title: "Suspicious login spike on VPN", severity: "medium", source: "manual", asset_id: 12, assignee_ref: "user:5", occurrence_count: 1, priority_score: 40, status: "open", metadata: { channel: "slack" } }),
  socDetection({ id: 106, title: "Staging debug console exposed", severity: "medium", correlator_id: "builtin.finding_high", asset_id: 13, occurrence_count: 4, priority_score: 35, source: "enrichment", status: "open", evidence: { event_type: "FindingCreated" } }),
  socDetection({ id: 107, title: "Mass assignment on transfers", severity: "high", correlator_id: "builtin.finding_high", asset_id: 14, risk_id: 505, occurrence_count: 1, priority_score: 91, source: "correlator", status: "assigned", assignee_ref: "user:8" }),
  socDetection({ id: 108, title: "Directory listing on /backups/", severity: "low", correlator_id: "builtin.finding_high", asset_id: 15, occurrence_count: 1, priority_score: 15, source: "correlator", status: "closed", closed_at: new Date().toISOString() }),
];

export const socCases: SocCase[] = [
  {
    id: 9,
    organization_id: 11,
    title: "Incident: edge RCE",
    summary: "Escalated for IR — unauthenticated RCE on the portal tier.",
    severity: "critical",
    status: "investigating",
    assignee_ref: "user:12",
    metadata: { source_detection_id: 101 },
    opened_at: new Date(Date.now() - 3600000).toISOString(),
    closed_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    notes: [
      { id: 1, organization_id: 11, case_id: 9, author_ref: "user:12", body: "Isolated the portal tier; collecting evidence.", created_at: new Date(Date.now() - 3000000).toISOString() },
      { id: 2, organization_id: 11, case_id: 9, author_ref: "user:12", body: "Containment complete; monitoring 24h.", created_at: new Date(Date.now() - 1800000).toISOString() },
    ],
    detections: [
      { id: 101, title: "Critical risk: RCE on edge", severity: "critical", status: "escalated", priority_score: 125.5, asset_id: 7, risk_id: 501 },
      { id: 104, title: "Alert: critical vulnerability detected", severity: "critical", status: "escalated", priority_score: 115, asset_id: 11 },
    ],
  },
  {
    id: 10,
    organization_id: 11,
    title: "Weekend IR war room",
    summary: "Multi-detection cluster for the TLS + transfer findings.",
    severity: "high",
    status: "open",
    assignee_ref: null,
    metadata: {},
    opened_at: new Date(Date.now() - 86400000).toISOString(),
    closed_at: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    notes: [],
    detections: [],
  },
];

export const socRules: SocRule[] = [
  { id: 3, organization_id: 11, name: "Critical risk created", description: "Open SOC detection when a critical risk is created", enabled: true, source: "seed", severity_default: "critical", match_spec: { event_types: ["RiskCritical", "RiskCreated"], risk_levels: ["critical"] }, dedup_window_seconds: 7200, actions: { notify: true, create_detection: true }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, organization_id: 11, name: "High findings on prod tags", description: "Detection when high+ findings land on production assets", enabled: true, source: "seed", severity_default: "high", match_spec: { event_types: ["FindingCreated"], min_severity: "high" }, dedup_window_seconds: 3600, actions: { create_detection: true, notify: false }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 5, organization_id: 11, name: "Scan completed with criticals", description: "Flag completed scans that produced critical findings", enabled: false, source: "org", severity_default: "high", match_spec: { event_types: ["ScanCompleted"], severities: ["critical"] }, dedup_window_seconds: 1800, actions: { create_detection: true, notify: true }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const socAdapters: SocAdapter[] = [
  { id: "generic_webhook", displayName: "Generic webhook", vendor: "phantix", configured: true, enabled: true, detail: "Accepts normalized enrichment payloads (no vendor credentials)" },
  { id: "splunk", displayName: "Splunk", vendor: "splunk", configured: false, enabled: true, detail: "Not configured — interface only; engine works without this adapter" },
  { id: "microsoft_defender", displayName: "Microsoft Defender", vendor: "microsoft", configured: false, enabled: true, detail: "Not configured — interface only" },
  { id: "soar_generic", displayName: "Generic SOAR", vendor: "soar", configured: false, enabled: false, detail: "Not configured" },
];

// ── Orchestration: Cloud Security connectors (cloud.md) ─────────────────────
export const cloudProviders: CloudProvider[] = [
  { id: "vercel", name: "Vercel", description: "Log drains + deployment telemetry", kind: "paas", webhook: { label: "Log drain / webhook", ingestUrlHint: "Vercel → Project → Integrations → Log Drains", signatureHeader: "x-vercel-signature" } },
  { id: "aws", name: "AWS", description: "CloudTrail / EventBridge events", kind: "cloud", webhook: { label: "EventBridge target", ingestUrlHint: "AWS console → EventBridge → Rule target", signatureHeader: "X-SecureGraph-Signature" } },
  { id: "azure", name: "Azure", description: "Azure Monitor / Sentinel log analytics", kind: "cloud", webhook: { label: "Log Analytics workspace", ingestUrlHint: "Azure → Log Analytics → Custom log", signatureHeader: "X-SecureGraph-Signature" } },
  { id: "gcp", name: "Google Cloud", description: "Cloud logging sinks", kind: "cloud", webhook: { label: "Pub/Sub push subscription", ingestUrlHint: "GCP → Logging → Sink → Pub/Sub", signatureHeader: "X-SecureGraph-Signature" } },
  { id: "hetzner", name: "Hetzner", description: "VPS / server events", kind: "vps", webhook: { label: "Webhook notification", ingestUrlHint: "Hetzner Cloud → Project → Webhooks", signatureHeader: "X-SecureGraph-Signature" } },
  { id: "digitalocean", name: "DigitalOcean", description: "Droplet / alert webhooks", kind: "vps", webhook: { label: "Alert webhook", ingestUrlHint: "DO → Monitoring → Alerts → Notification channel", signatureHeader: "X-SecureGraph-Signature" } },
  { id: "github", name: "GitHub", description: "Audit log + security alerts", kind: "code", webhook: { label: "Repository webhook", ingestUrlHint: "GitHub → Settings → Webhooks", signatureHeader: "X-Hub-Signature-256" } },
  { id: "uptimekuma", name: "Uptime Kuma", description: "Availability notification webhooks", kind: "monitoring", webhook: { label: "Notification webhook URL", ingestUrlHint: "Uptime Kuma → Settings → Notifications", signatureHeader: "X-SecureGraph-Signature" } },
];

export const cloudConnectors: CloudConnector[] = [
  {
    id: 1, organization_id: 11, provider: "vercel", label: "Acme Vercel production", is_active: true, created_at: new Date().toISOString(),
    webhook: { public_id: "vcl_9f4c...", secret_configured: true, ingest_url_hint: "https://api.phantix.site/api/v1/cloud-security/hooks/vcl_9f4c" },
  },
  {
    id: 2, organization_id: 11, provider: "github", label: "Acme GitHub org audit", is_active: true, created_at: new Date().toISOString(),
    webhook: { public_id: "gh_2b81...", secret_configured: true, ingest_url_hint: "https://api.phantix.site/api/v1/cloud-security/hooks/gh_2b81" },
  },
];

export const cloudEvents: CloudEvent[] = [
  { id: 90, connector_id: 2, provider: "vercel", eventKind: "telemetry", title: "Deploy failed", severity: "medium", summary: "Production deploy rolled back", assetHints: ["app.acme-financial.com"], iocs: [], mappedEngines: ["soc", "ti"], receivedAt: "2026-08-23T18:01:00Z" },
  { id: 89, connector_id: 2, provider: "vercel", eventKind: "security", title: "Build step touched secrets", severity: "high", summary: "Possible secret exposure in build logs", assetHints: ["app.acme-financial.com"], iocs: [], mappedEngines: ["soc", "compliance"], receivedAt: "2026-08-23T17:40:00Z" },
  { id: 88, connector_id: 3, provider: "github", eventKind: "audit_log", title: "New collaborator added", severity: "low", summary: "dev-ops added to acme/api with write scope", assetHints: ["github.com/acme/api"], iocs: [], mappedEngines: ["soc"], receivedAt: "2026-08-23T16:12:00Z" },
  { id: 87, connector_id: 3, provider: "github", eventKind: "secret_scan", title: "Dependabot alert: high vuln", severity: "high", summary: "axios CVE in package lock", assetHints: ["github.com/acme/api"], iocs: [], mappedEngines: ["soc", "vapt"], receivedAt: "2026-08-22T22:04:00Z" },
];

export const intelDashboard: IntelDashboard = {
  organizationId: 11,
  connectorCount: 2,
  eventCount24h: 18,
  openDetections: 3,
  matchedIocs: 4,
  unmatchedIocs: 9,
  byProvider: { vercel: 10, aws: 8 },
  bySeverity: { high: 2, medium: 16 },
  recentEvents: cloudEvents,
  signals: [
    { id: 5, ioc: "app.acme-financial.com", iocType: "domain", title: "TI signal — deploy error pattern", severity: "high", matchedAssetIds: [12], source: "vercel", evidence: { event_kind: "telemetry", provider: "vercel" }, firstSeenAt: "2026-08-20T00:00:00Z", lastSeenAt: "2026-08-23T18:01:00Z" },
    { id: 4, ioc: "185.199.108.153", iocType: "ip", title: "VirusTotal reputation hit", severity: "medium", matchedAssetIds: [], source: "yaml_ti", evidence: { tool: "threat_intel_scan" }, occurrenceCount: 2, firstSeenAt: "2026-08-21T09:12:00Z", lastSeenAt: "2026-08-23T14:00:00Z" },
    { id: 3, ioc: "admin.acme-financial.com", iocType: "domain", title: "Suspicious login spike", severity: "high", matchedAssetIds: [15], source: "vercel", evidence: { provider: "vercel" }, firstSeenAt: "2026-08-22T07:00:00Z", lastSeenAt: "2026-08-23T10:30:00Z" },
  ],
  note: "Threat intelligence here is org-scoped correlation of connector telemetry + scan reputation against inventory. It is not a global intel feed.",
};

export const intelLookup: IntelLookup = {
  organization_id: 11,
  signals: intelDashboard.signals!,
  new_signals: [],
  matched_count: 1,
  unmatched_count: 8,
  scan_reputation: [
    { id: 9001, title: "VirusTotal IP — 185.199.108.153", severity: "high", tool: "yaml_ti", asset_value: "185.199.108.153", ioc: "185.199.108.153", created_at: "2026-08-21T09:12:00Z" },
  ],
  note: "Org-scoped correlation of connector IOCs and scan reputation against inventory. Not a global threat-intel feed.",
};

export const intelEvents: IntelEventsResponse = {
  items: cloudEvents,
  total: 18,
  limit: 50,
  offset: 0,
};

// ── Orchestration: External pentest scope + ROE (EXTERNAL_PENTEST_SCOPE_AND_ROE_FE.md) ─
export const pentestPattern: PentestScopePattern = {
  pattern_version: "roe_pattern_v1",
  document_kind: "external_pentest",
  documents: [
    { id: "scope", title: "External pentest scope", filename_stem: "External_Pentest_Scope" },
    { id: "roe", title: "Rules of engagement", filename_stem: "Rules_of_Engagement" },
  ],
  formats: ["pdf", "docx", "markdown"],
  declared_sources: ["github", "import", "manual", "openapi", "postman"],
  in_scope_asset_types: ["api", "domain", "ip_address", "subdomain", "web_app"],
  related_code_asset_types: ["github_repo"],
  sections: [
    { id: "parties", title: "1. Parties", kind: "auto_parties" },
    { id: "authorization", title: "2. Authorization", kind: "ack", ack_id: "authorization_ack" },
    { id: "assets", title: "3. In-scope assets", kind: "assets" },
    { id: "related_code", title: "4. Related code (context)", kind: "related_code" },
    { id: "window", title: "5. Test window", kind: "window" },
    { id: "prohibitions", title: "6. Prohibited activities", kind: "toggles" },
    { id: "out_of_scope", title: "7. Out-of-scope", kind: "static" },
    { id: "data_handling", title: "8. Data handling", kind: "ack", ack_id: "data_handling_ack" },
    { id: "third_parties", title: "9. Third parties", kind: "ack", ack_id: "third_parties_ack" },
    { id: "contacts", title: "10. Contacts", kind: "auto_contacts" },
    { id: "emergency", title: "11. Emergency stop", kind: "emergency" },
    { id: "sign", title: "12. Signatures", kind: "sign" },
  ],
  required_acks: [
    { id: "authorization_ack", section: "authorization", label: "We authorize testing of the named in-scope assets only." },
    { id: "out_of_scope_ack", section: "out_of_scope", label: "We will not test out-of-scope assets, including anything discovered after this document." },
    { id: "data_handling_ack", section: "data_handling", label: "We will not download, modify, or exfiltrate customer or personal data." },
    { id: "third_parties_ack", section: "third_parties", label: "We will not engage third parties without prior written approval." },
  ],
  prohibited: [
    { id: "no_dos", label: "No denial-of-service, flood, or availability-impacting tests", default: true },
    { id: "no_social_engineering", label: "No social engineering of employees or customers", default: true },
    { id: "no_data_exfil", label: "No exfiltration or destruction of data", default: true },
    { id: "no_pivoting", label: "No pivoting to out-of-scope infrastructure", default: true },
  ],
  permitted: ["External reconnaissance of named in-scope hosts and URLs only"],
};

export const pentestEligible: PentestEligibleResponse = {
  pattern_version: "roe_pattern_v1",
  in_scope: [
    { id: 12, name: "app.acme-financial.com", value: "app.acme-financial.com", asset_type: "domain", source: "manual", environment: "prod", criticality: "high", is_verified: true },
    { id: 15, name: "admin.acme-financial.com", value: "admin.acme-financial.com", asset_type: "domain", source: "import", environment: "prod", criticality: "critical", is_verified: true },
    { id: 44, name: "185.199.108.153", value: "185.199.108.153", asset_type: "ip_address", source: "manual", environment: "prod", criticality: "medium", is_verified: true },
    { id: 71, name: "api.acme-financial.com", value: "https://api.acme-financial.com", asset_type: "api", source: "openapi", environment: "prod", criticality: "high", is_verified: true },
  ],
  related_code: [
    { id: 81, name: "acme/api", value: "https://github.com/acme/api", asset_type: "github_repo", source: "github", is_verified: true },
  ],
  excluded_count: 14,
  excluded_reasons: { enumerated: 10, private_ip: 2, internal_type: 2 },
};

export const pentestScopes: PentestScopeRead[] = [
  {
    id: 3,
    organization_id: 11,
    title: "Q3 external pentest — acme.example",
    status: "approved",
    pattern_version: "roe_pattern_v1",
    window: { starts_at: "2026-09-01T13:00:00Z", ends_at: "2026-09-12T21:00:00Z", timezone: "America/Toronto", business_hours_only: true },
    prohibited: {
      no_dos: { id: "no_dos", enabled: true, reason: null },
      no_social_engineering: { id: "no_social_engineering", enabled: false, reason: "Agreed phishing simulation, HR ticket 4412" },
    },
    acks: { authorization_ack: true, out_of_scope_ack: true, data_handling_ack: true, third_parties_ack: true },
    extras: { client_signatory: "Jane Doe, CISO", emergency_contact: "+14165550100" },
    in_scope_assets: [
      { id: 12, value: "app.acme-financial.com", asset_type: "domain", source: "manual", is_verified: true },
      { id: 44, value: "185.199.108.153", asset_type: "ip_address", source: "manual", is_verified: true },
    ],
    related_code_assets: [{ id: 81, value: "https://github.com/acme/api", asset_type: "github_repo", source: "github", is_verified: true }],
    out_of_scope_notes: [
      "This organization's inventory also contains assets that are not authorized: enumerated=10, private_ip=2.",
      "Subdomains, IPs, and applications discovered after this document is approved are out of scope until a new document names them.",
    ],
    created_by_name: "Jane Doe",
    approved_by_name: "Alex Authorizer",
    approved_at: "2026-08-23T20:30:00Z",
    content_hash: "a1b2c3...",
    is_draft_watermark: false,
    created_at: "2026-08-23T20:00:00Z",
    download: {
      scope_pdf: "/pentest-scope/3/download?document=scope&format=pdf",
      scope_docx: "/pentest-scope/3/download?document=scope&format=docx",
      roe_pdf: "/pentest-scope/3/download?document=roe&format=pdf",
      roe_docx: "/pentest-scope/3/download?document=roe&format=docx",
    },
  },
  {
    id: 2,
    organization_id: 11,
    title: "Aug 2026 external scope (draft)",
    status: "draft",
    pattern_version: "roe_pattern_v1",
    in_scope_assets: [{ id: 71, value: "api.acme-financial.com", asset_type: "api", source: "openapi", is_verified: true }],
    related_code_assets: [],
    created_by_name: "Jane Doe",
    approved_by_name: null,
    is_draft_watermark: true,
    created_at: "2026-08-22T10:00:00Z",
    download: {
      scope_pdf: "/pentest-scope/2/download?document=scope&format=pdf",
      scope_docx: "/pentest-scope/2/download?document=scope&format=docx",
      roe_pdf: "/pentest-scope/2/download?document=roe&format=pdf",
      roe_docx: "/pentest-scope/2/download?document=roe&format=docx",
    },
  },
];

// ── SOC War Room (enhanced incident case management) ─────────────────────────
export const warRoomPlaybooks: SocPlaybook[] = [
  {
    id: 1,
    title: "Ransomware containment",
    description: "Detect, isolate, and recover from a ransomware event.",
    category: "malware",
    mitre_id: "T1486",
    severity: "critical",
    enabled: true,
    org_only: false,
    version: 3,
    created_at: "2026-06-01T09:00:00Z",
    phases: [
      { id: 11, name: "Triage", order: 1, steps: [
        { id: 111, title: "Confirm the alert is genuine", order: 1 },
        { id: 112, title: "Identify affected assets", order: 2 },
        { id: 113, title: "Set severity and notify stakeholders", order: 3 },
      ] },
      { id: 12, name: "Containment", order: 2, steps: [
        { id: 121, title: "Isolate infected hosts from the network", order: 1 },
        { id: 122, title: "Preserve forensic evidence", order: 2 },
      ] },
      { id: 13, name: "Eradication", order: 3, steps: [
        { id: 131, title: "Remove the payload and persistence", order: 1 },
        { id: 132, title: "Rotate exposed credentials", order: 2 },
      ] },
      { id: 14, name: "Recovery", order: 4, steps: [
        { id: 141, title: "Restore from clean backups", order: 1 },
        { id: 142, title: "Run a verification scan", order: 2 },
      ] },
    ],
  },
  {
    id: 2,
    title: "Credential stuffing response",
    description: "Respond to a wave of failed + successful login attempts.",
    category: "credential_access",
    mitre_id: "T1110",
    severity: "high",
    enabled: true,
    org_only: false,
    version: 2,
    created_at: "2026-06-05T09:00:00Z",
    phases: [
      { id: 21, name: "Triage", order: 1, steps: [
        { id: 211, title: "Confirm brute-force volume", order: 1 },
        { id: 212, title: "Identify breached accounts", order: 2 },
      ] },
      { id: 22, name: "Containment", order: 2, steps: [
        { id: 221, title: "Force password reset on hit accounts", order: 1 },
        { id: 222, title: "Enforce MFA on all accounts", order: 2 },
      ] },
    ],
  },
  {
    id: 3,
    title: "Web app RCE incident",
    description: "Unauthenticated remote code execution on an internet-facing app.",
    category: "application",
    mitre_id: "T1190",
    severity: "critical",
    enabled: true,
    org_only: false,
    version: 4,
    created_at: "2026-06-10T09:00:00Z",
    phases: [
      { id: 31, name: "Triage", order: 1, steps: [
        { id: 311, title: "Confirm the exploit path", order: 1 },
        { id: 312, title: "Scope blast radius", order: 2 },
      ] },
      { id: 32, name: "Containment", order: 2, steps: [
        { id: 321, title: "Place WAF rule / rate limit", order: 1 },
        { id: 322, title: "Take the vulnerable version offline", order: 2 },
      ] },
      { id: 33, name: "Eradication", order: 3, steps: [
        { id: 331, title: "Patch or redeploy the application", order: 1 },
        { id: 332, title: "Audit for post-exploitation", order: 2 },
      ] },
    ],
  },
  {
    id: 4,
    title: "Data exfiltration investigation",
    description: "Suspected bulk data leaving the boundary.",
    category: "exfiltration",
    mitre_id: "T1048",
    severity: "high",
    enabled: true,
    org_only: false,
    version: 1,
    created_at: "2026-07-01T09:00:00Z",
    phases: [
      { id: 41, name: "Triage", order: 1, steps: [
        { id: 411, title: "Confirm outbound volume anomaly", order: 1 },
        { id: 412, title: "Identify the source host", order: 2 },
      ] },
      { id: 42, name: "Containment", order: 2, steps: [
        { id: 421, title: "Block the destination", order: 1 },
        { id: 422, title: "Suspend the source account", order: 2 },
      ] },
    ],
  },
];

export const warRoomCases: SocWarRoomCase[] = [
  {
    id: 9,
    organization_id: 11,
    title: "Incident: edge RCE",
    severity: "critical",
    status: "investigating",
    playbook_id: 3,
    detection_ids: [101, 104],
    opened_at: new Date(Date.now() - 3600000).toISOString(),
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 10,
    organization_id: 11,
    title: "Credential stuffing wave on portal",
    severity: "high",
    status: "open",
    playbook_id: 2,
    detection_ids: [105],
    opened_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 11,
    organization_id: 11,
    title: "Possible data exfil to staging",
    severity: "medium",
    status: "contained",
    playbook_id: 4,
    detection_ids: [],
    sla_deadline: new Date(Date.now() + 7200000).toISOString(),
    opened_at: new Date(Date.now() - 7200000).toISOString(),
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

export const socWarRoom: SocWarRoomResponse = {
  cases: warRoomCases,
  playbook_catalog: warRoomPlaybooks,
};

export const socPlaybooks = warRoomPlaybooks;

const warChecklistSteps: SocWarRoomChecklist = {
  case_id: 9,
  playbook_id: 3,
  current_phase: "Containment",
  progress: 57,
  steps: [
    { step_id: 311, phase: "Triage", title: "Confirm the exploit path", status: "completed", completed_by: "user:12", notes: "Jetty handler chain confirmed via CVE-2025-24104.", order: 1 },
    { step_id: 312, phase: "Triage", title: "Scope blast radius", status: "completed", completed_by: "user:12", notes: "Portal tier only; core ledger isolated.", order: 2 },
    { step_id: 321, phase: "Containment", title: "Place WAF rule / rate limit", status: "in_progress", completed_by: null, notes: null, order: 3 },
    { step_id: 322, phase: "Containment", title: "Take the vulnerable version offline", status: "pending", completed_by: null, notes: null, order: 4 },
    { step_id: 331, phase: "Eradication", title: "Patch or redeploy the application", status: "pending", completed_by: null, notes: null, order: 5 },
    { step_id: 332, phase: "Eradication", title: "Audit for post-exploitation", status: "pending", completed_by: null, notes: null, order: 6 },
  ],
};

export const socWarRoomChecklist: SocWarRoomChecklist = warChecklistSteps;

export const warRoomEvidence: SocWarRoomEvidence = {
  case_id: 9,
  timeline: [
    { id: 1, event_type: "detection", title: "Critical risk: RCE on edge", detail: "Correlator builtin.risk", source: "soc_engine", created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, event_type: "alert", title: "Alert: critical vulnerability detected", detail: "Email + Slack", source: "alert_engine", created_at: new Date(Date.now() - 3500000).toISOString() },
    { id: 3, event_type: "case", title: "Case opened from escalation", source: "soc_engine", created_at: new Date(Date.now() - 3400000).toISOString() },
    { id: 4, event_type: "step", title: "Checklist: Confirm the exploit path → completed", source: "war_room", created_at: new Date(Date.now() - 1800000).toISOString() },
  ],
};

export const warRoomKillChain: SocWarRoomKillChain = {
  case_id: 9,
  tactics: ["Initial Access", "Execution", "Impact"],
  techniques: [
    { technique_id: "T1190", name: "Exploit Public-Facing Application", tactic: "Initial Access", status: "confirmed" },
    { technique_id: "T1059", name: "Command and Scripting Interpreter", tactic: "Execution", status: "detected" },
    { technique_id: "T1490", name: "Inhibit System Recovery", tactic: "Impact", status: "mitigated" },
  ],
};

export const warRoomSla: SocWarRoomSla = {
  case_id: 9,
  targets: [
    { metric: "Triage response", target: 900, actual: 420, breached: false },
    { metric: "Containment", target: 3600, actual: 2700, breached: false },
    { metric: "Eradication", target: 28800, actual: 0, breached: false },
  ],
};

// ── SOC Playbooks & MITRE ─────────────────────────────────────────────────────
export const socRunbooks: SocRunbook[] = [
  {
    id: 1,
    title: "Compromised host runbook",
    description: "Step-by-step host isolation + evidence collection.",
    version: 2,
    created_at: "2026-06-01T09:00:00Z",
    steps: [
      { id: 1, title: "Snapshot memory", order: 1 },
      { id: 2, title: "Disconnect from network", order: 2 },
      { id: 3, title: "Capture disk image", order: 3 },
    ],
  },
  {
    id: 2,
    title: "Phishing mailbox runbook",
    description: "Contain a reported phishing email and check the sent folder.",
    version: 1,
    created_at: "2026-06-20T09:00:00Z",
    steps: [
      { id: 1, title: "Quarantine the email", order: 1 },
      { id: 2, title: "Check if the user clicked links", order: 2 },
      { id: 3, title: "Force password reset if credentials were entered", order: 3 },
    ],
  },
];

export const mitreMatrix: MitreMatrix = {
  tactics: [
    { id: "TA0001", name: "Initial Access", techniques: 9, coverage: 44 },
    { id: "TA0002", name: "Execution", techniques: 12, coverage: 33 },
    { id: "TA0003", name: "Persistence", techniques: 18, coverage: 22 },
    { id: "TA0004", name: "Privilege Escalation", techniques: 13, coverage: 38 },
    { id: "TA0005", name: "Defense Evasion", techniques: 37, coverage: 11 },
    { id: "TA0006", name: "Credential Access", techniques: 15, coverage: 40 },
    { id: "TA0007", name: "Discovery", techniques: 22, coverage: 27 },
    { id: "TA0008", name: "Lateral Movement", techniques: 9, coverage: 33 },
    { id: "TA0009", name: "Collection", techniques: 14, coverage: 21 },
    { id: "TA0010", name: "Exfiltration", techniques: 9, coverage: 44 },
    { id: "TA0040", name: "Impact", techniques: 13, coverage: 31 },
  ],
  total_techniques: 95,
  covered_techniques: 27,
  coverage_pct: 28,
};

export const mitreStats: MitreStats = {
  total_techniques: 95,
  covered: 27,
  not_covered: 68,
  by_tactic: {
    "Initial Access": { total: 9, covered: 4 },
    Execution: { total: 12, covered: 4 },
    "Credential Access": { total: 15, covered: 6 },
  },
};

// ── SOC Advisor ───────────────────────────────────────────────────────────────
export const advisorDashboard: SocAdvisorDashboard = {
  score: 68,
  trend: [
    { date: "2026-07-01", score: 61 },
    { date: "2026-07-08", score: 63 },
    { date: "2026-07-15", score: 64 },
    { date: "2026-07-22", score: 66 },
    { date: "2026-07-29", score: 67 },
    { date: "2026-08-05", score: 68 },
  ],
  benchmarks: [
    { name: "Acme Financial Group", score: 68, industry_avg: 71 },
    { name: "Financial services (NG)", score: 68, industry_avg: 66 },
  ],
  readiness: {
    "NIST CSF 2.0": { score: 68, total_controls: 108, passed: 74 },
    "ISO 27001:2022": { score: 62, total_controls: 93, passed: 58 },
    "NDPR": { score: 74, total_controls: 46, passed: 34 },
    "SOC 2": { score: 59, total_controls: 64, passed: 38 },
  },
  open_recommendations: 6,
};

export const advisorRecommendations: SocAdvisorRecommendation[] = [
  { id: 1, title: "Remediate the Jetty RCE (CVE-2025-24104) on the portal tier", description: "Critical unauthenticated RCE is the highest residual risk.", priority: "critical", status: "open", created_at: "2026-07-21T10:00:00Z" },
  { id: 2, title: "Enforce MFA across all org users", description: "Credential access coverage is below 40%.", priority: "high", status: "in_progress", assignee: "Ada Okonkwo", created_at: "2026-07-19T09:00:00Z" },
  { id: 3, title: "Disable TLS 1.0 / 1.1 on the edge gateway", description: "Internet-facing cryptographic weakness.", priority: "high", status: "open", created_at: "2026-07-18T14:00:00Z" },
  { id: 4, title: "Add CSP headers to authenticated pages", description: "Missing Content-Security-Policy on portal.", priority: "medium", status: "open", created_at: "2026-07-16T11:00:00Z" },
  { id: 5, title: "Inventory staging subdomains before next scan", description: "Reduces false-positive surface.", priority: "low", status: "accepted", created_at: "2026-07-12T09:00:00Z" },
];

export const advisorReports: SocAdvisorReport[] = [
  {
    id: 1,
    report_type: "posture",
    title: "August 2026 posture report",
    status: "published",
    score: 68,
    executive_summary: "Acme Financial Group improved from 61 to 68. Priority: remediate the portal RCE and roll out MFA.",
    created_at: "2026-08-06T08:00:00Z",
    published_at: "2026-08-06T09:30:00Z",
    recommendations: advisorRecommendations.slice(0, 3),
  },
  {
    id: 2,
    report_type: "posture",
    title: "July 2026 posture report",
    status: "draft",
    score: 66,
    created_at: "2026-07-20T08:00:00Z",
    recommendations: [],
  },
];

// ── SOC Log Pipeline ──────────────────────────────────────────────────────────
export const socLogEntries = Array.from({ length: 24 }, (_, i) => {
  const levels = ["info", "info", "warn", "error"];
  const hosts = ["web-01", "web-02", "db-01", "app-01"];
  const facilities = ["auth", "vpn", "nginx", "postgres", "ossec"];
  const messages = [
    "POST /v2/auth/refresh 401 from 41.58.130.44",
    "Failed SSH login attempt for root from 203.0.113.7",
    "nginx: 5xx burst on portal.acme.ng (12 in 60s)",
    "ossec: possible privilege escalation detected on db-01",
    "postgres: slow query 4123ms on core_ledger",
  ];
  const level = levels[i % 4];
  return {
    id: 5000 + i,
    host: hosts[i % 4],
    facility: facilities[i % 5],
    level,
    message: messages[i % messages.length],
    timestamp: new Date(Date.now() - i * 90000).toISOString(),
    hash: `sha256:${(i + 1) * 7}x`.padEnd(20, "0"),
  };
});

export const socLogPipelineStats: SocLogPipelineStats = {
  total_24h: 48230,
  error_pct: 4,
  by_level: { info: 38210, warn: 6200, error: 1830, debug: 990 },
  by_facility: { auth: 12200, vpn: 8100, nginx: 9410, postgres: 7100, ossec: 2200 },
  by_host: { "web-01": 14200, "web-02": 13100, "db-01": 11800, "app-01": 9130 },
};

// ── SOC Agent Fleet ───────────────────────────────────────────────────────────
export const socAgentFleet: SocAgentFleet = {
  active: 4,
  stale: 1,
  offline: 2,
  agents: [
    { agent_id: "agt_w01ab3c", hostname: "web-01", version: "1.4.0", status: "active", last_heartbeat: new Date(Date.now() - 60000).toISOString(), registered_at: "2026-07-01T09:00:00Z" },
    { agent_id: "agt_w02d4e5f", hostname: "web-02", version: "1.4.0", status: "active", last_heartbeat: new Date(Date.now() - 120000).toISOString(), registered_at: "2026-07-01T09:05:00Z" },
    { agent_id: "agt_db01g6h7i", hostname: "db-01", version: "1.3.1", status: "stale", last_heartbeat: new Date(Date.now() - 3900000).toISOString(), registered_at: "2026-06-20T10:00:00Z" },
    { agent_id: "agt_app1j8k9l", hostname: "app-01", version: "1.4.1", status: "active", last_heartbeat: new Date(Date.now() - 30000).toISOString(), registered_at: "2026-07-02T09:00:00Z" },
    { agent_id: "agt_edge0m1n2", hostname: "edge-gw", version: "1.2.0", status: "offline", last_heartbeat: new Date(Date.now() - 172800000).toISOString(), registered_at: "2026-05-10T09:00:00Z" },
  ],
};

// ── SOC Dashboard v2 panels ───────────────────────────────────────────────────
export const dashboardMitreMatrix: SocMitreMatrixPanel = {
  techniques: 95,
  covered: 27,
  coverage_pct: 28,
  detections_mapped: 18,
  cases: 6,
};

export const dashboardSla: SocSlaDashboard = {
  period_days: 30,
  compliance_pct: 91,
  metrics: [
    { name: "Triage response", target: 900, actual: 812, breaching: false },
    { name: "Containment", target: 3600, actual: 3400, breaching: false },
    { name: "Eradication", target: 28800, actual: 30120, breaching: true },
  ],
};

export const dashboardCasesSummary: SocCasesSummary = {
  total_open: 3,
  by_severity: { critical: 1, high: 1, medium: 1 },
  by_playbook: { "Web app RCE incident": 1, "Credential stuffing response": 1, "Data exfiltration investigation": 1 },
  oldest_case_hours: 26,
};

export const dashboardWarRoomStats: SocWarRoomStats = {
  open_cases: 3,
  cases_by_severity: { critical: 1, high: 1, medium: 1 },
  average_progress: 57,
  breached_sla_count: 0,
};

// ── Integrations Hub ──────────────────────────────────────────────────────────
export const hubCatalog: IntegrationConnector[] = [
  { connector_id: "slack", name: "Slack", description: "Send critical + high alerts and case updates to a channel.", auth_modes: ["oauth2"], category: "channel", wave: 1, status: "active", config_schema: {} },
  { connector_id: "teams", name: "Microsoft Teams", description: "Post alerts to a Teams channel via incoming webhook.", auth_modes: ["copy_webhook"], category: "channel", wave: 1, status: "active", config_schema: {} },
  { connector_id: "whatsapp", name: "WhatsApp", description: "Critical-only alerts to a WhatsApp Business number.", auth_modes: ["meta_cloud"], category: "channel", wave: 2, status: "beta", config_schema: {} },
  { connector_id: "telegram", name: "Telegram", description: "Critical-only alerts to a bot chat.", auth_modes: ["bot_token"], category: "channel", wave: 2, status: "beta", config_schema: {} },
  { connector_id: "entra_oidc", name: "Microsoft Entra SSO", description: "OIDC single sign-on for your organization.", auth_modes: ["oidc"], category: "sso", wave: 1, status: "active", config_schema: {} },
  { connector_id: "okta_oidc", name: "Okta SSO", description: "OIDC single sign-on via Okta.", auth_modes: ["oidc"], category: "sso", wave: 1, status: "active", config_schema: {} },
  { connector_id: "google_oidc", name: "Google Workspace SSO", description: "OIDC single sign-on via Google.", auth_modes: ["oidc"], category: "sso", wave: 2, status: "beta", config_schema: {} },
  { connector_id: "webhook_mapper", name: "Webhook mapper", description: "Inbound webhook that maps to SOC signals.", auth_modes: ["webhook_secret"], category: "automation", wave: 1, status: "active", config_schema: {} },
  { connector_id: "n8n", name: "n8n", description: "Receive outbound signed events for workflow automation.", auth_modes: ["webhook_secret"], category: "automation", wave: 2, status: "coming_soon", config_schema: {} },
];

export const hubInstallations: IntegrationInstallation[] = [
  { installation_id: 1, connector_id: "slack", label: "Prod security alerts", status: "active", auth_mode: "oauth2", config: { channel: "#security-alerts" }, has_secrets: false, created_at: "2026-07-11T10:00:00Z", last_test_at: "2026-08-23T08:00:00Z", last_test_ok: true },
  { installation_id: 2, connector_id: "webhook_mapper", label: "Vercel deploy hook", status: "active", auth_mode: "webhook_secret", config: { fan_out: ["soc"] }, has_secrets: true, created_at: "2026-07-15T12:00:00Z", last_test_at: "2026-08-23T07:30:00Z", last_test_ok: true },
  { installation_id: 3, connector_id: "entra_oidc", label: "Acme Entra SSO", status: "pending_auth", auth_mode: "oidc", config: {}, has_secrets: false, created_at: "2026-08-23T09:00:00Z" },
];

// ── SOC Cloud provider integrations ───────────────────────────────────────────
export const socCloudProviderCatalog: SocCloudProviderCatalog = {
  providers: [
    { id: "aws", name: "AWS", description: "CloudTrail, GuardDuty, and Security Hub events.", integration_types: ["log_ingestion", "guardduty"], setup_templates: {} },
    { id: "azure", name: "Microsoft Azure", description: "Microsoft Sentinel / Activity log events.", integration_types: ["log_ingestion", "sentinel"], setup_templates: {} },
    { id: "gcp", name: "Google Cloud", description: "Cloud Logging + Security Command Center.", integration_types: ["log_ingestion", "scc"], setup_templates: {} },
    { id: "aws_eventbridge", name: "AWS EventBridge (direct)", description: "Push provider-native events via EventBridge rule.", integration_types: ["webhook"], setup_templates: {} },
  ],
};

export const socCloudConnections: SocCloudConnection[] = [
  { id: 1, provider: "aws", integration_type: "log_ingestion", display_name: "Acme prod CloudTrail", status: "connected", last_sync_at: "2026-08-23T06:00:00Z", created_at: "2026-07-02T09:00:00Z" },
  { id: 2, provider: "aws_eventbridge", integration_type: "webhook", display_name: "EventBridge → SOC", status: "connected", last_sync_at: "2026-08-23T07:00:00Z", created_at: "2026-07-10T09:00:00Z" },
];

// ── Compliance GRC: questionnaire, gaps, profile, evidence connectors ─────────
// Shapes mirror app/engines/compliance_engine/api/compliance.py as encoded in
// src/lib/complianceGrc.ts. Every derived number below is computed from the rows
// it summarises the way the server computes it — see `questionnaireProgress`.

/** The demo explorer's own org-user id (orgUsers 1-4 are their colleagues). */
const DEMO_ANSWERER_ID = 5;

function myAnswer(value: string, notes: string | null, updatedAt: string): AnswererAudit {
  return {
    organization_user_id: DEMO_ANSWERER_ID,
    answered_by_name: "Demo Explorer",
    answered_by_email: "demo@acme.ng",
    stated_role: "Compliance Officer",
    stated_title: "Head of Governance, Risk & Compliance",
    answer_value: value,
    notes,
    updated_at: updatedAt,
  };
}

function colleagueAnswer(
  userId: number,
  name: string,
  email: string,
  role: string,
  title: string,
  value: string,
  notes: string | null,
  updatedAt: string,
): AnswererAudit {
  return {
    organization_user_id: userId,
    answered_by_name: name,
    answered_by_email: email,
    stated_role: role,
    stated_title: title,
    answer_value: value,
    notes,
    updated_at: updatedAt,
  };
}

export const questionnaireQuestions: QuestionnaireQuestion[] = [
  {
    id: 1001,
    question_key: "gov.security_policy",
    prompt: "Do you have a documented information security policy approved by leadership?",
    help_text: "An approved policy signed off at board or executive level, reviewed at least annually.",
    category: "Governance",
    risk: "high",
    answer_type: "yes_no_partial",
    framework_ids: ["iso27001", "soc2"],
    source_controls: [
      { framework_id: "iso27001", control_id: "A.5.1" },
      { framework_id: "soc2", control_id: "CC1.1" },
    ],
    sort_order: 10,
    my_answer: myAnswer("yes", "Approved by the board on 2026-03-14, next review March 2027.", "2026-08-28T09:12:00Z"),
    answers_from_others: [
      colleagueAnswer(2, "Chidi Eze", "chidi@acme.ng", "CISO", "Chief Information Security Officer", "yes", null, "2026-08-27T15:40:00Z"),
    ],
    answer_count: 2,
    is_seeded: true,
  },
  {
    id: 1002,
    question_key: "gov.security_owner",
    prompt: "Is a named individual accountable for information security?",
    help_text: "One person, named in the policy, with the authority to require remediation.",
    category: "Governance",
    risk: "high",
    answer_type: "yes_no_partial",
    framework_ids: ["iso27001", "ndpr"],
    source_controls: [{ framework_id: "iso27001", control_id: "A.5.2" }],
    sort_order: 20,
    my_answer: myAnswer("yes", "CISO (Chidi Eze) since 2025.", "2026-08-28T09:14:00Z"),
    answers_from_others: [],
    answer_count: 1,
    is_seeded: true,
  },
  {
    id: 1003,
    question_key: "gov.risk_register",
    prompt: "Do you maintain a risk register that is reviewed at least annually?",
    help_text: "A living register with owners and treatment decisions, not a one-off assessment.",
    category: "Governance",
    risk: "medium",
    answer_type: "yes_no_partial",
    framework_ids: ["iso27001"],
    source_controls: [{ framework_id: "iso27001", control_id: "A.5.7" }],
    sort_order: 30,
    my_answer: myAnswer("partial", "Register exists in SecureGraph but treatment owners are not assigned for every entry.", "2026-08-28T09:20:00Z"),
    answers_from_others: [],
    answer_count: 1,
    is_seeded: true,
  },
  {
    id: 1004,
    question_key: "ac.mfa_admin",
    prompt: "Is multi-factor authentication enforced on all administrative accounts?",
    help_text: "Enforced technically, not requested by policy. Includes cloud consoles and the VPN.",
    category: "Access Control",
    risk: "critical",
    answer_type: "yes_no_partial",
    framework_ids: ["iso27001", "soc2", "pci_dss"],
    source_controls: [
      { framework_id: "iso27001", control_id: "A.8.5" },
      { framework_id: "pci_dss", control_id: "8.4.2" },
    ],
    sort_order: 40,
    my_answer: myAnswer("yes", "Entra conditional access blocks admin sign-in without MFA.", "2026-08-28T09:26:00Z"),
    answers_from_others: [
      colleagueAnswer(1, "Ada Okonkwo", "ada@acme.ng", "IT Admin", "Head of IT Operations", "yes", "Enforced on AWS, Azure and the VPN.", "2026-08-26T11:05:00Z"),
    ],
    answer_count: 2,
    is_seeded: true,
  },
  {
    id: 1005,
    question_key: "ac.joiner_leaver",
    prompt: "Is there a documented joiner, mover and leaver process for access rights?",
    help_text: "Covers provisioning on hire, change on role move, and revocation within one business day of exit.",
    category: "Access Control",
    risk: "high",
    answer_type: "yes_no_partial",
    framework_ids: ["iso27001", "soc2"],
    source_controls: [{ framework_id: "iso27001", control_id: "A.5.11" }],
    sort_order: 50,
    my_answer: myAnswer("partial", "Joiner and leaver are documented; movers are handled ad hoc by the line manager.", "2026-08-28T09:31:00Z"),
    answers_from_others: [],
    answer_count: 1,
    is_seeded: true,
  },
  {
    id: 1006,
    question_key: "ac.privileged_review",
    prompt: "Are privileged access rights reviewed at least quarterly?",
    help_text: "A recorded review with evidence of who reviewed, when, and what was revoked.",
    category: "Access Control",
    risk: "high",
    answer_type: "yes_no_partial",
    framework_ids: ["iso27001", "pci_dss"],
    source_controls: [
      { framework_id: "iso27001", control_id: "A.8.2" },
      { framework_id: "pci_dss", control_id: "7.2.4" },
    ],
    sort_order: 60,
    my_answer: null,
    answers_from_others: [],
    answer_count: 0,
    is_seeded: true,
  },
  {
    id: 1007,
    question_key: "dp.data_inventory",
    prompt: "Do you maintain an inventory of the personal data you process?",
    help_text: "Categories of data subject, lawful basis, retention and where the data lives.",
    category: "Data Protection",
    risk: "critical",
    answer_type: "yes_no_partial",
    framework_ids: ["ndpr"],
    source_controls: [{ framework_id: "ndpr", control_id: "2.1" }],
    sort_order: 70,
    my_answer: myAnswer("yes", "Record of processing activities maintained by the GRC team.", "2026-08-28T09:38:00Z"),
    answers_from_others: [],
    answer_count: 1,
    is_seeded: true,
  },
  {
    id: 1008,
    question_key: "dp.dpo_appointed",
    prompt: "Have you appointed a Data Protection Officer?",
    help_text: "NDPR requires a DPO for organizations processing personal data of more than 2,000 data subjects.",
    category: "Data Protection",
    risk: "high",
    answer_type: "yes_no_partial",
    framework_ids: ["ndpr"],
    source_controls: [{ framework_id: "ndpr", control_id: "4.1" }],
    sort_order: 80,
    my_answer: myAnswer("no", "Being recruited — the role is open as of Q3.", "2026-08-28T09:41:00Z"),
    answers_from_others: [],
    answer_count: 1,
    is_seeded: true,
  },
  {
    id: 1009,
    question_key: "dp.encryption_at_rest",
    prompt: "Is personal and cardholder data encrypted at rest?",
    help_text: "Includes database storage, backups and any exports held outside the primary system.",
    category: "Data Protection",
    risk: "critical",
    answer_type: "yes_no_partial",
    framework_ids: ["ndpr", "pci_dss"],
    source_controls: [
      { framework_id: "pci_dss", control_id: "3.5.1" },
      { framework_id: "ndpr", control_id: "2.6" },
    ],
    sort_order: 90,
    my_answer: myAnswer("yes", "AES-256 via KMS on RDS and S3.", "2026-08-28T09:45:00Z"),
    answers_from_others: [
      colleagueAnswer(1, "Ada Okonkwo", "ada@acme.ng", "IT Admin", "Head of IT Operations", "yes", "Backups encrypted with the same CMK.", "2026-08-26T11:12:00Z"),
    ],
    answer_count: 2,
    is_seeded: true,
  },
  {
    id: 1010,
    question_key: "dp.retention_schedule",
    prompt: "Is there a documented data retention and disposal schedule?",
    help_text: "States how long each data category is kept and how it is destroyed.",
    category: "Data Protection",
    risk: "medium",
    answer_type: "yes_no_partial",
    framework_ids: ["ndpr"],
    source_controls: [{ framework_id: "ndpr", control_id: "2.9" }],
    sort_order: 100,
    my_answer: null,
    answers_from_others: [],
    answer_count: 0,
    is_seeded: true,
  },
  {
    id: 1011,
    question_key: "ir.plan_documented",
    prompt: "Do you have a documented incident response plan?",
    help_text: "Roles, severity thresholds, escalation path and external notification duties.",
    category: "Incident Response",
    risk: "high",
    answer_type: "yes_no_partial",
    framework_ids: ["iso27001", "soc2", "ndpr"],
    source_controls: [
      { framework_id: "iso27001", control_id: "A.5.24" },
      { framework_id: "soc2", control_id: "CC7.4" },
    ],
    sort_order: 110,
    my_answer: myAnswer("yes", "Plan v3 published February 2026; tabletop exercise run in June.", "2026-08-28T09:52:00Z"),
    answers_from_others: [
      colleagueAnswer(3, "Tunde Bakare", "tunde@acme.ng", "Security Engineer", "SOC Analyst", "yes", "SOC runbooks reference it directly.", "2026-08-25T08:20:00Z"),
    ],
    answer_count: 2,
    is_seeded: true,
  },
  {
    id: 1012,
    question_key: "ir.breach_notification_72h",
    prompt: "Can you notify the regulator of a personal data breach within 72 hours?",
    help_text: "The clock starts at awareness, not at confirmation. Evidence means a tested process.",
    category: "Incident Response",
    risk: "critical",
    answer_type: "yes_no_partial",
    framework_ids: ["ndpr"],
    source_controls: [{ framework_id: "ndpr", control_id: "4.2" }],
    sort_order: 120,
    my_answer: myAnswer("partial", "Process is written but has never been exercised end to end with legal counsel.", "2026-08-28T09:56:00Z"),
    answers_from_others: [],
    answer_count: 1,
    is_seeded: true,
  },
  {
    id: 1013,
    question_key: "ops.backup_restore_test",
    prompt: "Are backups tested by restore at least every six months?",
    help_text: "A restore that was actually performed and signed off, not a backup job that reported success.",
    category: "Operations",
    risk: "high",
    answer_type: "yes_no_partial",
    framework_ids: ["iso27001"],
    source_controls: [{ framework_id: "iso27001", control_id: "A.8.13" }],
    sort_order: 130,
    my_answer: myAnswer("no", "Last verified restore was August 2025 — overdue.", "2026-08-28T10:02:00Z"),
    answers_from_others: [],
    answer_count: 1,
    is_seeded: true,
  },
  {
    id: 1014,
    question_key: "tp.vendor_due_diligence",
    prompt: "Do you perform security due diligence on third-party vendors before onboarding?",
    help_text: "A recorded assessment proportionate to the data or access the vendor receives.",
    category: "Third Parties",
    risk: "medium",
    answer_type: "yes_no_partial",
    framework_ids: ["iso27001", "soc2"],
    source_controls: [{ framework_id: "iso27001", control_id: "A.5.19" }],
    sort_order: 140,
    my_answer: null,
    answers_from_others: [],
    answer_count: 0,
    is_seeded: true,
  },
  {
    id: 1015,
    question_key: "ops.external_vuln_scan",
    prompt: "Are vulnerability scans run at least quarterly on internet-facing systems?",
    help_text: "Authenticated where possible, with findings tracked to closure.",
    category: "Operations",
    risk: "high",
    answer_type: "yes_no_partial",
    framework_ids: ["pci_dss", "iso27001"],
    source_controls: [
      { framework_id: "pci_dss", control_id: "11.3.2" },
      { framework_id: "iso27001", control_id: "A.8.8" },
    ],
    sort_order: 150,
    my_answer: myAnswer("yes", "Continuous scanning through SecureGraph; findings feed the risk register.", "2026-08-28T10:08:00Z"),
    answers_from_others: [],
    answer_count: 1,
    is_seeded: true,
  },
  {
    id: 1016,
    question_key: "ops.call_recording_chd",
    prompt: "Do you record customer calls that capture cardholder data?",
    help_text: "Answer N/A if you operate no telephone channel that takes card numbers.",
    category: "Operations",
    risk: "medium",
    answer_type: "yes_no_partial",
    framework_ids: ["pci_dss"],
    source_controls: [{ framework_id: "pci_dss", control_id: "3.3.2" }],
    sort_order: 160,
    my_answer: myAnswer("na", "No telephone payment channel — card capture is web and app only.", "2026-08-28T10:11:00Z"),
    answers_from_others: [],
    answer_count: 1,
    is_seeded: true,
  },
];

/** The answer that counts for a question: yours, else the earliest colleague's. */
function resolvedAnswer(q: QuestionnaireQuestion): string | null {
  return q.my_answer?.answer_value ?? q.answers_from_others[0]?.answer_value ?? null;
}

/**
 * Progress is *derived*, not hand-written, so the totals can never drift from
 * the questions above — the same relationship the server guarantees. The
 * attestation score weights a partial at half a yes and excludes N/A from the
 * denominator, which is how the engine describes its own scoring.
 */
function questionnaireProgress(items: QuestionnaireQuestion[]): QuestionnaireProgress {
  const answered = items.filter((q) => q.answer_count > 0);
  const tally = { yes: 0, no: 0, partial: 0, na: 0 } as Record<string, number>;
  for (const q of answered) {
    const value = resolvedAnswer(q);
    if (value && value in tally) tally[value] += 1;
  }

  const scored = tally.yes + tally.no + tally.partial;
  const attestation = scored ? ((tally.yes + tally.partial * 0.5) / scored) * 100 : null;

  const byCategory: Record<string, { total: number; answered: number }> = {};
  for (const q of items) {
    const key = q.category ?? "Uncategorised";
    byCategory[key] ??= { total: 0, answered: 0 };
    byCategory[key].total += 1;
    if (q.answer_count > 0) byCategory[key].answered += 1;
  }

  const level: ComplianceLevel =
    attestation == null
      ? { id: "not_started", label: "Not started", score: null, band: null }
      : attestation >= 85
        ? { id: "strong", label: "Strong", score: Math.round(attestation * 10) / 10, band: "green" }
        : attestation >= 65
          ? { id: "substantial", label: "Substantial", score: Math.round(attestation * 10) / 10, band: "amber" }
          : attestation >= 40
            ? { id: "developing", label: "Developing", score: Math.round(attestation * 10) / 10, band: "orange" }
            : { id: "initial", label: "Initial", score: Math.round(attestation * 10) / 10, band: "red" };

  return {
    organization_id: organization.id,
    applicable_frameworks: APPLICABLE_FRAMEWORKS,
    total_questions: items.length,
    answered_unique_questions: answered.length,
    unanswered: items.length - answered.length,
    percent_complete: items.length ? Math.round((answered.length / items.length) * 1000) / 10 : 0,
    total_answer_events: items.reduce((n, q) => n + q.answer_count, 0),
    by_category: byCategory,
    attestation_score: attestation == null ? null : Math.round(attestation * 10) / 10,
    compliance_level: level,
    yes_count: tally.yes,
    no_count: tally.no,
    partial_count: tally.partial,
    not_applicable: tally.na,
    disclaimer: QUESTIONNAIRE_DISCLAIMER,
    disclaimer_short: "Self-attestation only — not a substitute for a GRC specialist audit.",
    replaces_certified_audit: false,
  };
}

/** Resolved from the business profile below (NG, financial services, cards). */
const APPLICABLE_FRAMEWORKS = ["ndpr", "iso27001", "soc2", "pci_dss"];

const QUESTIONNAIRE_DISCLAIMER =
  "These answers are your organization's own attestation. They are recorded against the person and the role they declared, and they inform your compliance posture — but they are not independently verified by SecureGraph and do not replace a certified audit by a qualified GRC assessor.";

export const questionnaireProgressSummary: QuestionnaireProgress = questionnaireProgress(questionnaireQuestions);

export const questionnaire: QuestionnaireList = {
  applicable_frameworks: APPLICABLE_FRAMEWORKS,
  total: questionnaireQuestions.length,
  items: questionnaireQuestions,
  progress: questionnaireProgressSummary,
  answer_choices: ["yes", "no", "partial", "na"],
  disclaimer: QUESTIONNAIRE_DISCLAIMER,
};

/** What POST /compliance/questionnaire/session returns once a role is declared. */
export const answererSession: AnswererSession = {
  id: 4101,
  organization_id: organization.id,
  organization_user_id: DEMO_ANSWERER_ID,
  stated_role: "Compliance Officer",
  stated_title: "Head of Governance, Risk & Compliance",
  user_email: "demo@acme.ng",
  user_full_name: "Demo Explorer",
  created_at: "2026-08-28T09:10:00Z",
  last_activity_at: "2026-08-28T10:11:00Z",
};

/** Flattened audit trail behind GET /compliance/questionnaire/answers. */
export const questionnaireAnswerAudit: AnswererAudit[] = questionnaireQuestions
  .flatMap((q) => [...(q.my_answer ? [q.my_answer] : []), ...q.answers_from_others])
  .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));

// ── Gap analysis ─────────────────────────────────────────────────────────────

const gapRows = [
  { framework_id: "iso27001", control_id: "A.8.13", title: "Information backup", category: "Technological", risk: "high" },
  { framework_id: "iso27001", control_id: "A.8.2", title: "Privileged access rights", category: "Technological", risk: "high" },
  { framework_id: "iso27001", control_id: "A.5.19", title: "Information security in supplier relationships", category: "Organizational", risk: "medium" },
  { framework_id: "iso27001", control_id: "A.8.9", title: "Configuration management", category: "Technological", risk: "high" },
  { framework_id: "iso27001", control_id: "A.8.16", title: "Monitoring activities", category: "Technological", risk: "medium" },
  { framework_id: "ndpr", control_id: "4.1", title: "Appointment of a Data Protection Officer", category: "Accountability", risk: "high" },
  { framework_id: "ndpr", control_id: "2.9", title: "Data retention and disposal", category: "Data Lifecycle", risk: "medium" },
  { framework_id: "ndpr", control_id: "4.2", title: "Breach notification within 72 hours", category: "Incident Response", risk: "critical" },
  { framework_id: "pci_dss", control_id: "7.2.4", title: "Review of user accounts and access privileges", category: "Access Control", risk: "high" },
  { framework_id: "pci_dss", control_id: "6.3.3", title: "Security patches installed within one month", category: "Vulnerability Management", risk: "critical" },
  { framework_id: "pci_dss", control_id: "10.4.1", title: "Daily review of audit logs", category: "Logging", risk: "medium" },
  { framework_id: "soc2", control_id: "CC6.7", title: "Restriction of data transmission and movement", category: "Logical Access", risk: "medium" },
  { framework_id: "soc2", control_id: "CC9.2", title: "Vendor and business partner risk management", category: "Risk Mitigation", risk: "medium" },
];

const controlsTouched = [
  { framework_id: "iso27001", control_id: "A.8.5", title: "Secure authentication", findings_count: 3 },
  { framework_id: "iso27001", control_id: "A.8.8", title: "Management of technical vulnerabilities", findings_count: 9 },
  { framework_id: "iso27001", control_id: "A.8.24", title: "Use of cryptography", findings_count: 4 },
  { framework_id: "ndpr", control_id: "2.6", title: "Security of processing", findings_count: 5 },
  { framework_id: "pci_dss", control_id: "4.2.1", title: "Strong cryptography in transit", findings_count: 4 },
  { framework_id: "pci_dss", control_id: "11.3.2", title: "External vulnerability scanning", findings_count: 9 },
  { framework_id: "soc2", control_id: "CC7.1", title: "Detection of configuration changes", findings_count: 2 },
];

const gapMappings = [
  { finding_id: 5101, severity: "critical", framework_id: "pci_dss", control_id: "4.2.1", relationship: "demonstrates_failure", title: "TLS 1.0 accepted on edge gateway" },
  { finding_id: 5101, severity: "critical", framework_id: "iso27001", control_id: "A.8.24", relationship: "demonstrates_failure", title: "TLS 1.0 accepted on edge gateway" },
  { finding_id: 5104, severity: "high", framework_id: "iso27001", control_id: "A.8.8", relationship: "demonstrates_failure", title: "Outdated OpenSSL on portal tier" },
  { finding_id: 5108, severity: "high", framework_id: "iso27001", control_id: "A.8.5", relationship: "demonstrates_failure", title: "Password authentication exposed on SSH" },
  { finding_id: 5112, severity: "medium", framework_id: "ndpr", control_id: "2.6", relationship: "demonstrates_control", title: "Database encryption verified" },
  { finding_id: 5115, severity: "medium", framework_id: "soc2", control_id: "CC7.1", relationship: "demonstrates_control", title: "Change detection active on production" },
];

const gapRecommendations = [
  {
    title: "Perform and sign off a backup restore test",
    detail: "ISO 27001 A.8.13 has no supporting evidence and your attestation records the last verified restore as August 2025. One documented restore closes the gap.",
    priority: "high",
    control_ids: ["A.8.13"],
  },
  {
    title: "Run a quarterly privileged access review",
    detail: "Both ISO 27001 A.8.2 and PCI DSS 7.2.4 need a recorded review with a reviewer, a date and the revocations made. The org user list already exports what you need.",
    priority: "high",
    control_ids: ["A.8.2", "7.2.4"],
  },
  {
    title: "Appoint a Data Protection Officer",
    detail: "NDPR 4.1 is mandatory at your data-subject volume and the questionnaire records the role as open. Naming an interim DPO removes the finding while recruitment continues.",
    priority: "high",
    control_ids: ["4.1"],
  },
  {
    title: "Close the patch window on internet-facing systems",
    detail: "PCI DSS 6.3.3 requires critical patches inside one month. Nine open verified findings on the portal tier are older than that today.",
    priority: "critical",
    control_ids: ["6.3.3"],
  },
  {
    title: "Publish a retention and disposal schedule",
    detail: "NDPR 2.9 is unanswered and no evidence maps to it. A schedule per data category is the smallest artefact that satisfies the control.",
    priority: "medium",
    control_ids: ["2.9"],
  },
];

function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export const gapAnalysis: GapAnalysis = {
  frameworks: APPLICABLE_FRAMEWORKS,
  findings_in: 24,
  summary: {
    total_gaps: gapRows.length,
    controls_evaluated: gapRows.length + controlsTouched.length,
    controls_covered: controlsTouched.length,
    by_framework: countBy(gapRows, (g) => g.framework_id),
    by_risk: countBy(gapRows, (g) => g.risk),
    generated_at: "2026-09-05T06:30:00Z",
  },
  gaps: gapRows,
  controls_touched: controlsTouched,
  mappings: gapMappings,
  recommendations: gapRecommendations,
};

// ── Business profile + framework recommendations ─────────────────────────────

export const businessProfile: BusinessProfile = {
  id: 61,
  organization_id: organization.id,
  country: "NG",
  customer_countries: ["NG", "GH", "KE", "GB"],
  industry: "Financial Services",
  company_size: "201-1000",
  handles_personal_data: true,
  handles_health_records: false,
  handles_payment_cards: true,
  handles_government_contracts: false,
  handles_financial_transactions: true,
  cloud_providers: ["aws", "azure"],
  has_public_apis: true,
  uses_ai: true,
  data_retention_period_days: 2555,
  created_at: "2026-06-02T11:20:00Z",
  updated_at: "2026-08-28T08:45:00Z",
};

/** Scores are the engine's applicability confidence, not a compliance score. */
export const frameworkRecommendations = [
  {
    framework_id: "ndpr",
    name: "NDPR",
    score: 98,
    reason: "You are registered in Nigeria and process personal data of Nigerian data subjects, so the NDPR applies by law rather than by choice.",
  },
  {
    framework_id: "pci_dss",
    name: "PCI DSS 4.0",
    score: 95,
    reason: "You handle payment card data. Your acquirer will require an attestation of compliance at the level set by your annual transaction volume.",
  },
  {
    framework_id: "iso27001",
    name: "ISO/IEC 27001:2022",
    score: 86,
    reason: "Financial services counterparties in GB and KE routinely require certification, and it subsumes most of your other control obligations.",
  },
  {
    framework_id: "soc2",
    name: "SOC 2 Type II",
    score: 74,
    reason: "You expose public APIs to business customers, which is the usual trigger for a SOC 2 report request during procurement.",
  },
  {
    framework_id: "gdpr",
    name: "GDPR",
    score: 61,
    reason: "You list GB among your customer countries, so UK GDPR obligations attach to those data subjects even though you are not established in the UK.",
  },
];

// ── Evidence connectors ──────────────────────────────────────────────────────

export const evidenceConnectors: EvidenceConnector[] = [
  {
    connector_id: "securegraph_posture",
    name: "SecureGraph posture",
    description: "Verified findings, asset inventory and scan history already held in your security database.",
    ready: true,
    configured: true,
    evidence_count: 46,
    last_collected_at: "2026-09-05T06:30:00Z",
  },
  {
    connector_id: "aws_config",
    name: "AWS Config",
    description: "Config rules, CloudTrail status and KMS key policies for the accounts you connect.",
    ready: true,
    configured: true,
    evidence_count: 31,
    last_collected_at: "2026-09-05T06:30:00Z",
  },
  {
    connector_id: "entra_id",
    name: "Microsoft Entra ID",
    description: "Conditional access policies, MFA registration state and privileged role assignments.",
    ready: true,
    configured: true,
    evidence_count: 18,
    last_collected_at: "2026-09-05T06:30:00Z",
  },
  {
    connector_id: "github",
    name: "GitHub",
    description: "Branch protection, required reviews and secret-scanning status across your repositories.",
    ready: false,
    configured: false,
    evidence_count: 0,
    last_collected_at: null,
  },
  {
    connector_id: "wazuh",
    name: "Wazuh",
    description: "Agent coverage, file integrity monitoring and log retention from your SIEM.",
    ready: false,
    configured: false,
    evidence_count: 0,
    last_collected_at: null,
  },
  {
    connector_id: "jira",
    name: "Jira",
    description: "Change tickets and approval records used to evidence change management controls.",
    ready: false,
    configured: false,
    evidence_count: 0,
    last_collected_at: null,
  },
];

/**
 * GET /compliance/evidence/summary. `total` and `controls` are the field names
 * the connectors page reads first; the richer breakdown is what the engine
 * returns alongside them.
 */
export const evidenceSummary: Record<string, unknown> = {
  organization_id: organization.id,
  total: 95,
  controls: 38,
  by_connector: {
    securegraph_posture: 46,
    aws_config: 31,
    entra_id: 18,
  },
  by_framework: { iso27001: 34, pci_dss: 26, ndpr: 21, soc2: 14 },
  last_collected_at: "2026-09-05T06:30:00Z",
  stale_after_days: 90,
};

// ── VAPT operations: schedules, settings, procedures, correlation ────────────
// Shapes mirror app/engines/vapt_engine/api/{schedules,procedures,approvals}.py
// as encoded in src/lib/vaptOps.ts.

/** Schedules only look alive if the next run is genuinely ahead of now. */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export const vaptProcedures: VaptProcedure[] = [
  {
    procedure_key: "external_web_app_assessment",
    display_name: "External web application assessment",
    category: "application",
    phase: "exploitation",
    required_role: "authorizer",
    is_active: true,
    description: "Authenticated and unauthenticated testing of an internet-facing web application against the OWASP Top 10.",
    steps: [
      { order: 1, name: "Scope confirmation", requires_approval: true },
      { order: 2, name: "Passive reconnaissance", requires_approval: false },
      { order: 3, name: "Authentication and session testing", requires_approval: false },
      { order: 4, name: "Injection and access-control testing", requires_approval: true },
      { order: 5, name: "Verification and evidence capture", requires_approval: false },
    ],
  },
  {
    procedure_key: "external_network_discovery",
    display_name: "External network discovery",
    category: "network",
    phase: "reconnaissance",
    required_role: "initiator",
    is_active: true,
    description: "Non-intrusive enumeration of the external perimeter: hosts, ports, services and TLS posture.",
    steps: [
      { order: 1, name: "Asset scope resolution", requires_approval: false },
      { order: 2, name: "Port and service enumeration", requires_approval: false },
      { order: 3, name: "TLS and certificate inspection", requires_approval: false },
    ],
  },
  {
    procedure_key: "api_security_assessment",
    display_name: "API security assessment",
    category: "application",
    phase: "exploitation",
    required_role: "authorizer",
    is_active: true,
    description: "Schema-driven testing of REST endpoints for broken object-level authorization, rate limiting and mass assignment.",
    steps: [
      { order: 1, name: "Specification ingest", requires_approval: false },
      { order: 2, name: "Authorization matrix testing", requires_approval: true },
      { order: 3, name: "Rate limit and abuse testing", requires_approval: true },
      { order: 4, name: "Evidence capture", requires_approval: false },
    ],
  },
  {
    procedure_key: "cloud_configuration_review",
    display_name: "Cloud configuration review",
    category: "cloud",
    phase: "assessment",
    required_role: "initiator",
    is_active: true,
    description: "Read-only review of IAM, storage exposure, logging and encryption settings across connected cloud accounts.",
    steps: [
      { order: 1, name: "Account inventory", requires_approval: false },
      { order: 2, name: "IAM and key policy review", requires_approval: false },
      { order: 3, name: "Public exposure check", requires_approval: false },
      { order: 4, name: "Logging and retention check", requires_approval: false },
    ],
  },
  {
    procedure_key: "internal_network_assessment",
    display_name: "Internal network assessment",
    category: "network",
    phase: "exploitation",
    required_role: "authorizer",
    is_active: true,
    description: "Segmentation, lateral movement and privilege escalation testing from an assumed foothold inside the network.",
    steps: [
      { order: 1, name: "Foothold confirmation", requires_approval: true },
      { order: 2, name: "Segmentation validation", requires_approval: false },
      { order: 3, name: "Privilege escalation attempts", requires_approval: true },
      { order: 4, name: "Cleanup and evidence capture", requires_approval: false },
    ],
  },
  {
    procedure_key: "credential_hygiene_audit",
    display_name: "Credential hygiene audit",
    category: "identity",
    phase: "assessment",
    required_role: "initiator",
    is_active: true,
    description: "Checks MFA coverage, dormant privileged accounts and credentials exposed in public breach corpora.",
    steps: [
      { order: 1, name: "Directory export", requires_approval: false },
      { order: 2, name: "MFA coverage analysis", requires_approval: false },
      { order: 3, name: "Breach corpus correlation", requires_approval: false },
    ],
  },
  {
    procedure_key: "mobile_app_assessment",
    display_name: "Mobile application assessment",
    category: "application",
    phase: "exploitation",
    required_role: "authorizer",
    is_active: false,
    description: "Static and dynamic analysis of Android and iOS builds. Disabled for this organization pending tooling rollout.",
    steps: [
      { order: 1, name: "Build intake", requires_approval: true },
      { order: 2, name: "Static analysis", requires_approval: false },
      { order: 3, name: "Runtime instrumentation", requires_approval: true },
    ],
  },
];

export const vaptSchedules: VaptSchedule[] = [
  {
    id: 301,
    organization_id: organization.id,
    schedule_name: "Weekly perimeter discovery",
    description: "Keeps the external asset picture current between full engagements.",
    procedure_key: "external_network_discovery",
    asset_scope_template: { asset_types: ["domain", "subdomain", "ip"], tags: ["external"], verified_only: true },
    campaign_config: { max_findings: 500, notify_on_completion: true },
    cron_expression: "7d",
    timezone: "Africa/Lagos",
    max_concurrent_per_org: 1,
    allowed_days_of_week: ["mon", "tue", "wed", "thu"],
    blackout_windows: [{ start: "08:00", end: "18:00", days: ["mon", "tue", "wed", "thu", "fri"] }],
    is_active: true,
    skip_next: false,
    pause_until: null,
    last_run_at: "2026-08-31T22:00:00Z",
    last_run_campaign_id: 4411,
    next_run_at: hoursFromNow(38),
    total_runs: 17,
    total_failures: 1,
    created_at: "2026-05-18T09:30:00Z",
    updated_at: "2026-08-31T22:06:00Z",
  },
  {
    id: 302,
    organization_id: organization.id,
    schedule_name: "Monthly API assessment",
    description: "Authorization matrix and rate-limit testing against the public API.",
    procedure_key: "api_security_assessment",
    asset_scope_template: { asset_ids: [102], tags: ["pci-scope"], verified_only: true },
    campaign_config: { require_dual_control: true, evidence_retention_days: 365 },
    cron_expression: "30d",
    timezone: "Africa/Lagos",
    max_concurrent_per_org: 1,
    allowed_days_of_week: ["sat", "sun"],
    blackout_windows: [
      { start: "06:00", end: "22:00", days: ["mon", "tue", "wed", "thu", "fri"] },
      { start: "00:00", end: "23:59", days: ["fri"] },
    ],
    is_active: true,
    skip_next: true,
    pause_until: null,
    last_run_at: "2026-08-16T02:00:00Z",
    last_run_campaign_id: 4388,
    next_run_at: hoursFromNow(242),
    total_runs: 4,
    total_failures: 0,
    created_at: "2026-05-20T14:10:00Z",
    updated_at: "2026-09-02T10:04:00Z",
  },
  {
    id: 303,
    organization_id: organization.id,
    schedule_name: "Quarterly cloud configuration review",
    description: "Read-only IAM, exposure and logging review across the AWS and Azure accounts.",
    procedure_key: "cloud_configuration_review",
    asset_scope_template: { cloud_accounts: ["aws:acme-prod", "azure:acme-core"] },
    campaign_config: { read_only: true },
    cron_expression: "0 3 1 */3 *",
    timezone: "UTC",
    max_concurrent_per_org: 2,
    allowed_days_of_week: null,
    blackout_windows: [],
    is_active: false,
    skip_next: false,
    pause_until: "2026-10-01T00:00:00Z",
    last_run_at: "2026-07-01T03:00:00Z",
    last_run_campaign_id: 4290,
    next_run_at: null,
    total_runs: 2,
    total_failures: 1,
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-08-20T16:22:00Z",
  },
];

export const vaptSettings: VaptSettings = {
  organization_id: organization.id,
  mining_consent_enabled: true,
  mining_consent_granted_at: "2026-06-14T13:05:00Z",
  mining_data_scope: "findings_and_correlations",
  ai_threshold: "high",
};

export const vaptCorrelationRules: CorrelationRule[] = [
  {
    id: 1,
    rule_key: "tls_weak_plus_public_admin",
    name: "Weak TLS on a host exposing an admin interface",
    description: "Raises severity when a host that negotiates TLS 1.0/1.1 also exposes an authenticated administrative path.",
    severity: "critical",
    source: "builtin",
  },
  {
    id: 2,
    rule_key: "cred_reuse_across_environments",
    name: "Credential reuse across environments",
    description: "Correlates identical credential material observed in both a production and a non-production asset.",
    severity: "high",
    source: "builtin",
  },
  {
    id: 3,
    rule_key: "unauth_api_plus_pii_response",
    name: "Unauthenticated API returning personal data",
    description: "Pairs a missing authorization finding with a response body classified as containing personal data.",
    severity: "critical",
    source: "builtin",
  },
  {
    id: 4,
    rule_key: "stale_patch_plus_known_exploit",
    name: "Missing patch with a known public exploit",
    description: "Escalates an outdated-package finding when the matching CVE has a public proof of concept.",
    severity: "high",
    source: "builtin",
  },
  {
    id: 5,
    rule_key: "acme_portal_session_fixation",
    name: "Portal session fixation pattern",
    description: "Organization rule: the customer portal reissues a session cookie without rotation after privilege change.",
    severity: "medium",
    source: "organization",
  },
];

export const vaptRuleCandidates: RuleCandidate[] = [
  {
    pattern: "open_redirect + oauth_callback_on_same_host",
    description: "An open redirect and an OAuth callback consistently appear on the same host before token-theft findings are raised.",
    frequency: 34,
    confidence: 0.82,
    first_seen_at: "2026-06-22T00:00:00Z",
    last_seen_at: "2026-09-01T00:00:00Z",
  },
  {
    pattern: "verbose_error_page + database_version_disclosure",
    description: "Stack-trace error pages are followed by database version disclosure on the same asset in most observed engagements.",
    frequency: 27,
    confidence: 0.74,
    first_seen_at: "2026-05-30T00:00:00Z",
    last_seen_at: "2026-08-28T00:00:00Z",
  },
  {
    pattern: "s3_public_read + backup_naming_convention",
    description: "Publicly readable buckets whose object keys match backup naming conventions correlate with sensitive data exposure.",
    frequency: 19,
    confidence: 0.68,
    first_seen_at: "2026-07-04T00:00:00Z",
    last_seen_at: "2026-08-30T00:00:00Z",
  },
  {
    pattern: "dormant_privileged_account + no_mfa",
    description: "Privileged accounts dormant for over 90 days are disproportionately the ones without MFA registered.",
    frequency: 12,
    confidence: 0.61,
    first_seen_at: "2026-07-19T00:00:00Z",
    last_seen_at: "2026-09-02T00:00:00Z",
  },
];

export const vaptMiningNote =
  "Mined from de-identified cross-organization patterns under your mining consent. Candidates are not active rules — SecureGraph staff review and promote them.";

// ── Product context and threat models ────────────────────────────────────────
// Shapes mirror app/engines/threat_model_engine/api/{context,threat_models}.py
// as encoded in src/lib/productContext.ts.

export const productProjects: ProductProject[] = [
  { id: 51, name: "Customer payments portal", stage: "live", active: true, created_at: "2026-05-12T10:00:00Z", updated_at: "2026-08-30T14:20:00Z" },
  { id: 52, name: "Open banking API", stage: "in_build", active: true, created_at: "2026-06-08T09:15:00Z", updated_at: "2026-09-01T11:05:00Z" },
  { id: 53, name: "Merchant onboarding service", stage: "planned", active: true, created_at: "2026-08-19T15:40:00Z", updated_at: "2026-08-19T15:40:00Z" },
  { id: 54, name: "Internal reconciliation tooling", stage: "live", active: true, created_at: "2026-05-29T08:05:00Z", updated_at: "2026-07-22T09:50:00Z" },
];

/** Parsed from each project's uploaded .drawio diagram. */
export const projectGraphs: Record<number, ProjectGraph> = {
  51: {
    boundaries: [
      { id: 1, name: "Internet", trusted: false },
      { id: 2, name: "Public DMZ", trusted: false },
      { id: 3, name: "Application tier", trusted: true },
      { id: 4, name: "Data tier", trusted: true },
    ],
    components: [
      { id: 901, name: "Customer browser", kind: "actor", boundary_id: 1, trusted: false, external: true },
      { id: 902, name: "CDN / WAF", kind: "gateway", boundary_id: 2, trusted: false, external: true },
      { id: 903, name: "Portal web app", kind: "service", boundary_id: 3, trusted: true, external: false },
      { id: 904, name: "Payments API", kind: "service", boundary_id: 3, trusted: true, external: false },
      { id: 905, name: "Session store", kind: "datastore", boundary_id: 3, trusted: true, external: false },
      { id: 906, name: "Card vault", kind: "datastore", boundary_id: 4, trusted: true, external: false },
      { id: 907, name: "Customer database", kind: "datastore", boundary_id: 4, trusted: true, external: false },
      { id: 908, name: "Payment processor", kind: "third_party", boundary_id: 1, trusted: false, external: true },
      { id: 909, name: "Audit log sink", kind: "datastore", boundary_id: 4, trusted: true, external: false },
    ],
    flows: [
      { id: 8001, source_component_id: 901, target_component_id: 902, source_name: "Customer browser", target_name: "CDN / WAF", crosses_boundary: true, roles: ["customer"], actions: ["http_request"], data: ["credentials", "card_number"] },
      { id: 8002, source_component_id: 902, target_component_id: 903, source_name: "CDN / WAF", target_name: "Portal web app", crosses_boundary: true, roles: ["customer"], actions: ["http_request"], data: ["credentials", "card_number"] },
      { id: 8003, source_component_id: 903, target_component_id: 905, source_name: "Portal web app", target_name: "Session store", crosses_boundary: false, roles: ["service"], actions: ["read", "write"], data: ["session_token"] },
      { id: 8004, source_component_id: 903, target_component_id: 904, source_name: "Portal web app", target_name: "Payments API", crosses_boundary: false, roles: ["service"], actions: ["rpc"], data: ["card_number", "amount"] },
      { id: 8005, source_component_id: 904, target_component_id: 906, source_name: "Payments API", target_name: "Card vault", crosses_boundary: true, roles: ["service"], actions: ["tokenize"], data: ["card_number"] },
      { id: 8006, source_component_id: 904, target_component_id: 908, source_name: "Payments API", target_name: "Payment processor", crosses_boundary: true, roles: ["service"], actions: ["authorize"], data: ["card_token", "amount"] },
      { id: 8007, source_component_id: 903, target_component_id: 907, source_name: "Portal web app", target_name: "Customer database", crosses_boundary: true, roles: ["service"], actions: ["read", "write"], data: ["personal_data"] },
      { id: 8008, source_component_id: 904, target_component_id: 909, source_name: "Payments API", target_name: "Audit log sink", crosses_boundary: true, roles: ["service"], actions: ["append"], data: ["audit_event"] },
    ],
  },
  52: {
    boundaries: [
      { id: 1, name: "Third-party TPP", trusted: false },
      { id: 2, name: "API edge", trusted: false },
      { id: 3, name: "Core services", trusted: true },
    ],
    components: [
      { id: 921, name: "Third-party provider", kind: "actor", boundary_id: 1, trusted: false, external: true },
      { id: 922, name: "API gateway", kind: "gateway", boundary_id: 2, trusted: false, external: true },
      { id: 923, name: "Consent service", kind: "service", boundary_id: 3, trusted: true, external: false },
      { id: 924, name: "Accounts service", kind: "service", boundary_id: 3, trusted: true, external: false },
      { id: 925, name: "Consent store", kind: "datastore", boundary_id: 3, trusted: true, external: false },
    ],
    flows: [
      { id: 8101, source_component_id: 921, target_component_id: 922, source_name: "Third-party provider", target_name: "API gateway", crosses_boundary: true, roles: ["tpp"], actions: ["oauth_authorize"], data: ["client_credentials"] },
      { id: 8102, source_component_id: 922, target_component_id: 923, source_name: "API gateway", target_name: "Consent service", crosses_boundary: true, roles: ["tpp"], actions: ["rpc"], data: ["consent_grant"] },
      { id: 8103, source_component_id: 923, target_component_id: 925, source_name: "Consent service", target_name: "Consent store", crosses_boundary: false, roles: ["service"], actions: ["read", "write"], data: ["consent_grant"] },
      { id: 8104, source_component_id: 922, target_component_id: 924, source_name: "API gateway", target_name: "Accounts service", crosses_boundary: true, roles: ["tpp"], actions: ["rpc"], data: ["account_balance", "personal_data"] },
    ],
  },
  53: { boundaries: [], components: [], flows: [] },
  54: {
    boundaries: [
      { id: 1, name: "Corporate network", trusted: true },
      { id: 2, name: "Data tier", trusted: true },
    ],
    components: [
      { id: 941, name: "Finance analyst", kind: "actor", boundary_id: 1, trusted: true, external: false },
      { id: 942, name: "Reconciliation UI", kind: "service", boundary_id: 1, trusted: true, external: false },
      { id: 943, name: "Ledger warehouse", kind: "datastore", boundary_id: 2, trusted: true, external: false },
    ],
    flows: [
      { id: 8201, source_component_id: 941, target_component_id: 942, source_name: "Finance analyst", target_name: "Reconciliation UI", crosses_boundary: false, roles: ["analyst"], actions: ["http_request"], data: ["query"] },
      { id: 8202, source_component_id: 942, target_component_id: 943, source_name: "Reconciliation UI", target_name: "Ledger warehouse", crosses_boundary: true, roles: ["service"], actions: ["read"], data: ["transaction_records"] },
    ],
  },
};

/** Chunks returned by GET /context/projects/{id}/search. */
export const projectDocumentHits: Record<number, DocumentHit[]> = {
  51: [
    { id: 7101, title: "Payments portal requirements v4", chunk: "All cardholder data must be tokenised by the Payments API before it reaches any persistent store. The portal web app must never write a PAN to the customer database.", score: 0.91 },
    { id: 7102, title: "Payments portal requirements v4", chunk: "Session tokens are rotated on privilege change and on successful step-up authentication. Idle sessions expire after 15 minutes.", score: 0.84 },
    { id: 7103, title: "PCI scope narrative", chunk: "The card vault is the only component within PCI DSS scope for storage. The processor connection is outbound-only over mutual TLS.", score: 0.79 },
    { id: 7104, title: "Payments portal requirements v4", chunk: "Every authorisation attempt is appended to the audit log sink; the sink is append-only and readable by the compliance team.", score: 0.72 },
  ],
  52: [
    { id: 7201, title: "Open banking API specification", chunk: "Consent grants are explicit, time-bound and revocable by the customer at any time. A revoked grant must invalidate issued access tokens within 60 seconds.", score: 0.88 },
    { id: 7202, title: "Open banking API specification", chunk: "Third-party providers authenticate with mutual TLS and signed client assertions. Client secrets alone are not accepted.", score: 0.81 },
    { id: 7203, title: "Rate limiting policy", chunk: "Per-TPP quotas are enforced at the gateway. Breaching a quota returns 429 with a Retry-After header and raises a SOC signal.", score: 0.66 },
  ],
  54: [
    { id: 7401, title: "Reconciliation tooling brief", chunk: "The tool is read-only against the ledger warehouse. No component in this project may issue a write to the ledger.", score: 0.86 },
  ],
};

/**
 * Threat models keyed by model id. The API cannot list these, so the demo seeds
 * the same per-browser index a real session would build up by opening them.
 */
export const threatModels: Record<number, ThreatModelDetail> = {
  9001: {
    model: {
      id: 9001,
      project_id: 51,
      stage: "live",
      status: "complete",
      context_snapshot_hash: "3f9c1a7e0b482d6c",
    },
    threats: [
      { id: 9101, category: "Spoofing", title: "Session fixation on the customer portal", impact: "An attacker who plants a session identifier before sign-in can ride the authenticated session.", grade: "supported", verification_question: null, source_flow_id: 8003, source_component_id: 905, status: "open", owner_type: "component", owner_ref: 905 },
      { id: 9102, category: "Tampering", title: "Amount manipulation between portal and Payments API", impact: "The transaction amount crosses an internal boundary without an integrity check, so a compromised portal can alter it.", grade: "supported", verification_question: null, source_flow_id: 8004, source_component_id: 904, status: "open", owner_type: "flow", owner_ref: 8004 },
      { id: 9103, category: "Information disclosure", title: "PAN reaching the customer database", impact: "If tokenisation is bypassed, cardholder data lands in a store outside the declared PCI boundary.", grade: "speculative", verification_question: "Does the portal web app ever write a raw card number to the customer database?", source_flow_id: 8007, source_component_id: 907, status: "open", owner_type: "flow", owner_ref: 8007 },
      { id: 9104, category: "Repudiation", title: "Authorisation events missing from the audit sink", impact: "A failed append to the audit log sink is not retried, so a disputed transaction may have no record.", grade: "supported", verification_question: null, source_flow_id: 8008, source_component_id: 909, status: "open", owner_type: "flow", owner_ref: 8008 },
      { id: 9105, category: "Denial of service", title: "Unbounded retry against the payment processor", impact: "Retries to the third-party processor are not rate limited, which can exhaust the merchant quota.", grade: "speculative", verification_question: "Is there a circuit breaker on the processor authorize call?", source_flow_id: 8006, source_component_id: 908, status: "open", owner_type: "flow", owner_ref: 8006 },
      { id: 9106, category: "Elevation of privilege", title: "WAF bypass via direct origin access", impact: "If the application tier is reachable without traversing the CDN, the WAF ruleset is not applied.", grade: "supported", verification_question: null, source_flow_id: 8002, source_component_id: 903, status: "mitigated", owner_type: "component", owner_ref: 903 },
      { id: 9107, category: "Information disclosure", title: "Card token replay against the processor", impact: "A captured card token could be replayed if it is not bound to a single authorisation.", grade: "refuted", verification_question: null, source_flow_id: 8006, source_component_id: 908, status: "closed", owner_type: "flow", owner_ref: 8006 },
    ],
    questions: [
      { id: 9201, question: "Does the portal web app ever write a raw card number to the customer database?", answer: null, open: true },
      { id: 9202, question: "Is there a circuit breaker on the processor authorize call?", answer: null, open: true },
      { id: 9203, question: "Is the application tier reachable on a route that does not pass through the CDN?", answer: "No — the origin security group only accepts the CDN prefix list.", open: false },
    ],
  },
  9002: {
    model: {
      id: 9002,
      project_id: 52,
      stage: "in_build",
      status: "awaiting_clarification",
      context_snapshot_hash: "8b21d40fa7e35c69",
    },
    threats: [
      { id: 9301, category: "Spoofing", title: "Third-party provider impersonation", impact: "Client assertions signed with a long-lived key allow a leaked key to impersonate a TPP indefinitely.", grade: "supported", verification_question: null, source_flow_id: 8101, source_component_id: 921, status: "open", owner_type: "flow", owner_ref: 8101 },
      { id: 9302, category: "Elevation of privilege", title: "Consent scope widening after grant", impact: "If scope is re-read from the request rather than the stored grant, a TPP can widen its own access.", grade: "speculative", verification_question: "Is the effective scope always read from the consent store rather than the incoming token?", source_flow_id: 8102, source_component_id: 923, status: "open", owner_type: "flow", owner_ref: 8102 },
      { id: 9303, category: "Information disclosure", title: "Account data returned after consent revocation", impact: "Tokens issued before revocation may remain valid past the 60-second invalidation requirement.", grade: "supported", verification_question: null, source_flow_id: 8104, source_component_id: 924, status: "open", owner_type: "flow", owner_ref: 8104 },
      { id: 9304, category: "Denial of service", title: "Quota exhaustion by a single TPP", impact: "Per-TPP quotas are enforced at the gateway only, so an internal caller can bypass them.", grade: "speculative", verification_question: "Are per-TPP quotas enforced anywhere other than the gateway?", source_flow_id: 8104, source_component_id: 922, status: "open", owner_type: "component", owner_ref: 922 },
    ],
    questions: [
      { id: 9401, question: "Is the effective scope always read from the consent store rather than the incoming token?", answer: null, open: true },
      { id: 9402, question: "Are per-TPP quotas enforced anywhere other than the gateway?", answer: null, open: true },
      { id: 9403, question: "How long may an access token remain valid after its consent grant is revoked?", answer: "Tokens are checked against the consent store on every call, so revocation takes effect on the next request.", open: false },
    ],
  },
};

/** Seeds the per-browser model index so the demo has models to open. */
export const rememberedThreatModels: RememberedModel[] = [
  { modelId: 9001, projectId: 51, projectName: "Customer payments portal", seenAt: Date.parse("2026-09-01T10:15:00Z") },
  { modelId: 9002, projectId: 52, projectName: "Open banking API", seenAt: Date.parse("2026-08-27T16:40:00Z") },
];

// ── Code — GitHub App, branch-review wallet/settings/events, AutoFix ─────────

export const githubInstallation: GithubInstallation = {
  connected: true,
  status: "active",
  installation_id: 58214930,
  account_login: "acme-financial",
};

export const branchReviewWallet: BranchReviewWallet = {
  balance_ngn: 42500,
  currency: "NGN",
  updated_at: "2026-09-10T08:00:00Z",
};

export const githubRepositories: GithubRepo[] = [
  { id: 401, name: "core-ledger", full_name: "acme-financial/core-ledger", private: true, default_branch: "main", html_url: "https://github.com/acme-financial/core-ledger", can_analyze: true, analyze_blocked_reason: null, requires_premium: false },
  { id: 402, name: "payments-api", full_name: "acme-financial/payments-api", private: true, default_branch: "main", html_url: "https://github.com/acme-financial/payments-api", can_analyze: true, analyze_blocked_reason: null, requires_premium: false },
  { id: 403, name: "portal-web", full_name: "acme-financial/portal-web", private: true, default_branch: "main", html_url: "https://github.com/acme-financial/portal-web", can_analyze: true, analyze_blocked_reason: null, requires_premium: false },
  { id: 404, name: "mobile-android", full_name: "acme-financial/mobile-android", private: true, default_branch: "develop", html_url: "https://github.com/acme-financial/mobile-android", can_analyze: false, analyze_blocked_reason: "Android source review requires the premium AutoFix add-on.", requires_premium: true },
];

export const branchReviewSettings: ReviewSetting[] = [
  { github_repository_id: 401, enabled: true, watched_branch: "main", post_github_comment: true },
  { github_repository_id: 402, enabled: true, watched_branch: "main", post_github_comment: true },
  { github_repository_id: 403, enabled: false, watched_branch: "main", post_github_comment: false },
];

export const branchReviewEvents: ReviewEvent[] = [
  { id: 9501, repo: "acme-financial/core-ledger", repo_url: "https://github.com/acme-financial/core-ledger", sha: "a1b2c3d4e5f60718", ref: "refs/heads/main", size_tier: "M", status: "charged", amount_ngn: 350, created_at: "2026-09-10T14:22:00Z" },
  { id: 9502, repo: "acme-financial/payments-api", repo_url: "https://github.com/acme-financial/payments-api", sha: "f6e5d4c3b2a19087", ref: "refs/heads/feature/idempotency-keys", size_tier: "L", status: "reviewed", amount_ngn: 620, created_at: "2026-09-09T10:05:00Z" },
  { id: 9503, repo: "acme-financial/core-ledger", repo_url: "https://github.com/acme-financial/core-ledger", sha: "998877665544a1b2", ref: "refs/heads/main", size_tier: "S", status: "reserved", amount_ngn: 150, created_at: "2026-09-10T16:40:00Z" },
  { id: 9504, repo: "acme-financial/portal-web", repo_url: "https://github.com/acme-financial/portal-web", sha: "112233445566c3d4", ref: "refs/heads/hotfix/csp-header", size_tier: "S", status: "failed", created_at: "2026-09-08T07:12:00Z" },
];

export const autofixStatus: AutofixStatus = {
  continuous_pr: { opens_pr: true, signed_commits: true },
  queue: "2 queued",
};

// ── Posture — continuous loop surfaces, drift, accepted risks due ───────────

export const postureSnapshot: PostureSnapshot = {
  organization_id: 11,
  surfaces: {
    external: { score: 78, total: 42, reportable: 9, critical: 1, high: 3 },
    internal: { score: 64, total: 18, reportable: 6, critical: 0, high: 2 },
    cloud: { score: 71, total: 25, reportable: 5, critical: 1, high: 1 },
    code: { score: 58, total: 12, reportable: 4, critical: 1, high: 2 },
  },
  overall_score: 68,
  surfaces_covered: 4,
  generated_at: "2026-09-11T06:00:00Z",
};

export const postureReviewsDue: PostureDueRisk[] = [
  { id: 515, title: "Excessive IAM permissions on CI deploy role", risk_level: "critical", residual_risk_score: 58, residual_risk_level: "high", accepted_at: "2026-06-01T12:00:00Z", next_review_at: "2026-09-01T12:00:00Z", review_interval_days: 90, asset_id: null, vulnerability_key: "ci-deploy-role-overpermissioned", treatment_plan: "Scoped down pending Terraform module review; compensating CloudTrail alerting in place." },
  { id: 507, title: "OpenSSH backports missing", risk_level: "medium", residual_risk_score: 41, residual_risk_level: "medium", accepted_at: "2026-06-20T10:00:00Z", next_review_at: "2026-09-05T10:00:00Z", review_interval_days: 90, asset_id: 105, vulnerability_key: "openssh-8.9p1", treatment_plan: "Patch window scheduled with infra during the next maintenance cycle." },
  { id: 512, title: "Self-signed certificate on staging load balancer", risk_level: "low", residual_risk_score: 22, residual_risk_level: "low", accepted_at: "2026-05-15T09:30:00Z", next_review_at: "2026-08-15T09:30:00Z", review_interval_days: 90, asset_id: 111, vulnerability_key: "staging-selfsigned-cert", treatment_plan: "Accepted — staging is not internet-reachable outside the VPN." },
];

/** Keyed by product-context project id (see `productProjects`). */
export const postureDrift: Record<number, PostureDrift> = {
  51: { drift_count: 0, drift: [], projects: 1 },
  52: {
    drift_count: 1,
    drift: [{ project_name: "Open banking API", project_id: 52, reason: "New third-party consent flow added", detail: "2 components and 3 flows added since the last threat model; TPP token exchange now crosses a new trust boundary." }],
    projects: 1,
  },
  53: { drift_count: 0, drift: [], projects: 1 },
  54: {
    drift_count: 1,
    drift: [{ project_name: "Internal reconciliation tooling", project_id: 54, reason: "Data flow reclassified", detail: "Reconciliation export now includes customer PII that was not present in the last product-context snapshot." }],
    projects: 1,
  },
};

// ── Code review — the GitHub-style finding view (block · why · fix · PR) ─────
// Line content here stands in for what the live page reads from GitHub at the
// reviewed SHA; the platform never stores customer source, so in demo mode the
// "blob" is fixture text rather than a cached copy of anything real.

export const codeFindingCounts: CodeSeverityCounts = {
  critical: 1,
  high: 3,
  medium: 2,
  low: 0,
  info: 0,
  total: 6,
};

export const codeFindingFiles: CodeFindingFile[] = [
  { github_repository_id: 402, repo: "acme-financial/payments-api", path: "app/api/transfers.py", language: "python", findings: 2, worst_severity: "critical", layers: ["sast"], autofix_pr_url: null, sha: "f6e5d4c3b2a19087" },
  { github_repository_id: 401, repo: "acme-financial/core-ledger", path: ".github/workflows/release.yml", language: "yaml", findings: 2, worst_severity: "high", layers: ["pipeline"], autofix_pr_url: "https://github.com/acme-financial/core-ledger/pull/128", sha: "a1b2c3d4e5f60718" },
  { github_repository_id: 401, repo: "acme-financial/core-ledger", path: "infra/k8s/ledger-deployment.yaml", language: "yaml", findings: 1, worst_severity: "high", layers: ["iac"], autofix_pr_url: null, sha: "a1b2c3d4e5f60718" },
  { github_repository_id: 402, repo: "acme-financial/payments-api", path: "requirements.txt", language: "text", findings: 1, worst_severity: "medium", layers: ["sca"], autofix_pr_url: null, sha: "f6e5d4c3b2a19087" },
];

export const codeFindings: CodeFinding[] = [
  {
    id: 7101, github_repository_id: 402, repo: "acme-financial/payments-api", repo_url: "https://github.com/acme-financial/payments-api",
    layer: "sast", tool: "code_graph", rule_id: "sql-orm-execution-sinks", severity: "critical",
    title: "SQL / ORM execution sinks", path: "app/api/transfers.py", language: "python",
    start_line: 88, end_line: 91, cwe: "CWE-89", status: "open", reportable: true,
    sha: "f6e5d4c3b2a19087", ref: "refs/heads/feature/idempotency-keys", occurrences: 3,
    permalink: "https://github.com/acme-financial/payments-api/blob/f6e5d4c3b2a19087/app/api/transfers.py#L88-L91",
    autofix: { state: "none" }, why: "Query execution is where a string built from request data becomes database instructions.",
    last_seen_at: "2026-09-09T10:05:00Z",
  },
  {
    id: 7102, github_repository_id: 402, repo: "acme-financial/payments-api", repo_url: "https://github.com/acme-financial/payments-api",
    layer: "secrets", tool: "github_analysis", rule_id: "hardcoded-api-key-pattern", severity: "high",
    title: "Hardcoded API key pattern", path: "app/api/transfers.py", language: "python",
    start_line: 14, end_line: 14, cwe: "CWE-798", status: "open", reportable: false,
    sha: "f6e5d4c3b2a19087", ref: "refs/heads/feature/idempotency-keys", occurrences: 1,
    permalink: "https://github.com/acme-financial/payments-api/blob/f6e5d4c3b2a19087/app/api/transfers.py#L14",
    autofix: { state: "none" }, why: "An API key literal in source is readable by everyone with repository access.",
    last_seen_at: "2026-09-09T10:05:00Z",
  },
  {
    id: 7103, github_repository_id: 401, repo: "acme-financial/core-ledger", repo_url: "https://github.com/acme-financial/core-ledger",
    layer: "pipeline", tool: "code_layer_pipeline", rule_id: "workflow-uses-pull-request-target", severity: "high",
    title: "Workflow uses pull_request_target", path: ".github/workflows/release.yml", language: "yaml",
    start_line: 5, end_line: 5, cwe: "CWE-94", status: "open", reportable: true,
    sha: "a1b2c3d4e5f60718", ref: "refs/heads/main", occurrences: 2,
    permalink: "https://github.com/acme-financial/core-ledger/blob/a1b2c3d4e5f60718/.github/workflows/release.yml#L5",
    autofix: { state: "pr_open", pr_number: 128, pr_url: "https://github.com/acme-financial/core-ledger/pull/128", branch: "securegraph/autofix/workflow-uses-pull-request-target-7103-a1b2c3", commit_sha: "cc11dd22ee33ff44", signed: true, detail: "Draft PR open — a developer must review and merge it.", updated_at: "2026-09-10T15:02:00Z" },
    why: "pull_request_target runs the workflow with a read/write token and access to repository secrets.",
    last_seen_at: "2026-09-10T14:22:00Z",
  },
  {
    id: 7104, github_repository_id: 401, repo: "acme-financial/core-ledger", repo_url: "https://github.com/acme-financial/core-ledger",
    layer: "pipeline", tool: "code_layer_pipeline", rule_id: "action-pinned-to-a-moving-reference", severity: "medium",
    title: "Action pinned to a moving reference", path: ".github/workflows/release.yml", language: "yaml",
    start_line: 22, end_line: 22, cwe: "CWE-829", status: "open", reportable: true,
    sha: "a1b2c3d4e5f60718", ref: "refs/heads/main", occurrences: 2,
    permalink: "https://github.com/acme-financial/core-ledger/blob/a1b2c3d4e5f60718/.github/workflows/release.yml#L22",
    autofix: { state: "none" }, why: "A tag or branch is a pointer the action's owner can repoint at any time.",
    last_seen_at: "2026-09-10T14:22:00Z",
  },
  {
    id: 7105, github_repository_id: 401, repo: "acme-financial/core-ledger", repo_url: "https://github.com/acme-financial/core-ledger",
    layer: "iac", tool: "code_layer_iac", rule_id: "privileged-container", severity: "high",
    title: "Privileged container", path: "infra/k8s/ledger-deployment.yaml", language: "yaml",
    start_line: 31, end_line: 31, cwe: "CWE-250", status: "open", reportable: true,
    sha: "a1b2c3d4e5f60718", ref: "refs/heads/main", occurrences: 1,
    permalink: "https://github.com/acme-financial/core-ledger/blob/a1b2c3d4e5f60718/infra/k8s/ledger-deployment.yaml#L31",
    autofix: { state: "permission_required", detail: "GitHub App write access required: https://github.com/apps/securegraph/installations/new", updated_at: "2026-09-11T09:14:00Z" },
    why: "A privileged container runs with the host's full capability set and device access.",
    last_seen_at: "2026-09-10T14:22:00Z",
  },
  {
    id: 7106, github_repository_id: 402, repo: "acme-financial/payments-api", repo_url: "https://github.com/acme-financial/payments-api",
    layer: "sca", tool: "dependency_intel", rule_id: "vulnerable-dependency-cryptography-41-0-1-ghsa-jfhm-5ghh-2f97", severity: "medium",
    title: "Vulnerable dependency cryptography@41.0.1 (GHSA-jfhm-5ghh-2f97)", path: "requirements.txt", language: "text",
    start_line: null, end_line: null, cwe: "CWE-1395", status: "open", reportable: false,
    sha: "f6e5d4c3b2a19087", ref: "refs/heads/feature/idempotency-keys", occurrences: 4,
    permalink: "https://github.com/acme-financial/payments-api/blob/f6e5d4c3b2a19087/requirements.txt",
    autofix: { state: "none" }, why: "A dependency resolved here has a published advisory.",
    last_seen_at: "2026-09-09T10:05:00Z",
  },
];

const DEMO_WHY: Record<number, string> = {
  7101: "Query execution is where a string built from request data becomes database instructions. If any part of the statement is concatenated or interpolated rather than bound, an attacker controls the query's structure and can read or modify data the endpoint never intended to expose.",
  7102: "An API key literal in source is readable by everyone with repository access, survives in history after deletion, and is copied into every build artifact and container image. It also cannot be rotated without a code change and a deploy, so in practice it never gets rotated.",
  7103: "pull_request_target runs the workflow with a read/write token and access to repository secrets, in the context of the base repository — while the pull request's code comes from a fork anyone can open. If the job checks out or executes the head ref, attacker code runs with your secrets and can push to the repository.",
  7104: "A tag or branch is a pointer the action's owner can repoint at any time, and tags can be force-moved silently. Your pipeline therefore executes whatever that name means at run time — the supply-chain equivalent of `latest` — with your token and secrets in scope.",
  7105: "A privileged container runs with the host's full capability set and device access, so the kernel boundary that makes containers a security feature is gone. Any code execution inside this workload is effectively code execution on the node, and from there on every other pod scheduled there.",
  7106: "A dependency resolved here has a published advisory, so the vulnerable code is part of your build whether or not you call the affected function. Exploitation needs no access to your source — the advisory and often a proof of concept are public.",
};

const DEMO_FIX: Record<number, string> = {
  7101: "Use parameter binding for every value — placeholders with a params argument, or the ORM's expression language — and never f-strings, % , + or .format() in SQL. Identifiers that genuinely must be dynamic belong in a hard-coded allowlist, not in interpolation.",
  7102: "Treat the credential as compromised: rotate it at the provider first, because git history and every fork, clone and CI cache still hold the old value even after you delete the line. Then move the value to the platform's secret store and read it from the environment at run time.",
  7103: "Use the pull_request trigger for anything that touches PR code; it runs without secrets by design. If you need pull_request_target for labelling or commenting, never check out the head SHA in that job, and move any build step into a separate workflow_run job gated behind an environment approval.",
  7104: "Pin every third-party action to a full 40-character commit SHA with the version in a trailing comment, and let Dependabot raise the bumps so upgrades are reviewed diffs rather than silent changes.",
  7105: "Remove privileged: true and grant only the specific capabilities the process needs via securityContext.capabilities.add. Workloads that genuinely need host access belong in a separate, tightly reviewed DaemonSet, not in an application deployment.",
  7106: "Upgrade to the fixed version named in the advisory and keep the lockfile pinned so the resolution is reproducible. When no fix is released, remove or replace the package, or document the compensating control.",
};

const DEMO_BLOB_LINES: Record<number, { first: number; text: string }> = {
  7101: {
    first: 82,
    text: [
      "@router.get(\"/transfers/{account_id}\")",
      "async def list_transfers(account_id: str, db: AsyncSession = Depends(get_db)):",
      "    \"\"\"Recent transfers for one account.\"\"\"",
      "    if not account_id:",
      "        raise HTTPException(422, detail=\"account_id required\")",
      "",
      "    query = (",
      "        \"SELECT id, amount, created_at FROM transfers \"",
      "        \"WHERE account_id = '\" + account_id + \"' ORDER BY created_at DESC\"",
      "    )",
      "    rows = (await db.execute(text(query))).all()",
      "    return {\"items\": [dict(r._mapping) for r in rows]}",
    ].join("\n"),
  },
  7102: {
    first: 8,
    text: [
      "from fastapi import APIRouter, Depends, HTTPException",
      "from sqlalchemy import text",
      "",
      "from app.db.session import get_db",
      "",
      "router = APIRouter()",
      "",
      "PROVIDER_API_KEY = \"sk**********\"",
      "SETTLEMENT_WINDOW_HOURS = 24",
      "",
      "",
    ].join("\n"),
  },
  7103: {
    first: 1,
    text: [
      "name: release",
      "",
      "on:",
      "  workflow_dispatch:",
      "  pull_request_target:",
      "    types: [opened, synchronize]",
      "",
      "permissions:",
      "  contents: write",
      "",
    ].join("\n"),
  },
  7104: {
    first: 16,
    text: [
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "        with:",
      "          ref: ${{ github.event.pull_request.head.sha }}",
      "      - uses: actions/setup-python@main",
      "      - run: make release",
      "",
    ].join("\n"),
  },
  7105: {
    first: 25,
    text: [
      "    spec:",
      "      containers:",
      "        - name: ledger",
      "          image: ghcr.io/acme-financial/ledger:2.14.0",
      "          ports:",
      "            - containerPort: 8080",
      "          securityContext:",
      "            privileged: true",
      "            runAsNonRoot: false",
      "          resources:",
      "            limits:",
      "              memory: 1Gi",
    ].join("\n"),
  },
  7106: {
    first: 1,
    text: [
      "fastapi==0.115.0",
      "sqlalchemy==2.0.34",
      "cryptography==41.0.1",
      "httpx==0.27.2",
      "pydantic==2.9.2",
    ].join("\n"),
  },
};

export function codeFindingDetail(id: number): CodeFinding {
  const base = codeFindings.find((f) => f.id === id) ?? codeFindings[0];
  return {
    ...base,
    description: `${base.title} matched in ${base.path}`,
    why: DEMO_WHY[base.id] ?? base.why ?? null,
    fix: DEMO_FIX[base.id] ?? null,
    reference_url: "https://cheatsheetseries.owasp.org/",
    guidance_specific: true,
    detail: { rule_id: base.rule_id, layer: base.layer },
    ai_explanation: null,
    ai_explained_at: null,
  };
}

export function codeFindingBlob(id: number): CodeBlob {
  const finding = codeFindings.find((f) => f.id === id) ?? codeFindings[0];
  const fixture = DEMO_BLOB_LINES[finding.id] ?? { first: 1, text: "" };
  const rows = fixture.text.split("\n");
  const start = finding.start_line ?? null;
  const end = finding.end_line ?? start;
  return {
    ok: true,
    path: finding.path,
    language: finding.language,
    sha: finding.sha,
    repo: finding.repo,
    start_line: start,
    end_line: end,
    first_line: fixture.first,
    last_line: fixture.first + rows.length - 1,
    total_lines: fixture.first + rows.length + 40,
    anchored: start != null,
    redacted: finding.layer === "secrets",
    permalink: finding.permalink,
    lines: rows.map((content, i) => {
      const number = fixture.first + i;
      return {
        number,
        content,
        highlight: start != null && number >= start && number <= (end ?? start),
      };
    }),
  };
}

export function codeFindingExplanation(id: number): CodeAiExplanation {
  const finding = codeFindings.find((f) => f.id === id) ?? codeFindings[0];
  return {
    explanation: `In this repository the weakness is reachable from an authenticated but unprivileged caller: ${finding.path} is imported by the request path that serves customer-facing traffic, so the matched line runs on data that crosses the trust boundary.`,
    impact: "An attacker with a low-privilege account could read or modify records belonging to other tenants.",
    remediation: DEMO_FIX[finding.id] ?? "Apply the rule guidance above.",
    root_cause: "Input from the request is carried to the sink without passing through the validation layer the rest of the module uses.",
    confidence: 0.82,
    requires_human_review: false,
    hallucination_flagged: false,
    model_provider: "demo",
    model_name: "demo-reasoner",
  };
}

// ── VAPT intelligent plan — steps decomposed into vulnerability types ───────
// Mirrors POST /vapt/plan for a fintech tenant with product context and priors:
// one regression (transport security), one accepted risk (tech disclosure).

export const vaptPlan: VaptPlan = {
  plan_id: "plan_demo5f3c1ab7",
  organization_id: 11,
  name: "Full Security Assessment",
  scan_types: ["network_scan", "dns_scan", "web_scan", "vuln_scan", "api_scan", "secrets_scan"],
  frameworks: { required: ["ndpr", "pci_dss"], recommended: ["iso27001", "soc2"] },
  asset_count: 42,
  estimated_duration: "~2.2 hours",
  estimated_duration_minutes: 132,
  vuln_coverage: {
    total_types: 21,
    checks_selected: 58,
    catalog_total_checks: 90,
    auto_seeded: true,
    source: "scanner_engine/scans/<category>/*.yaml",
  },
  vuln_focus: [
    { vuln_class: "improper_authentication", title: "Improper authentication", rank: 1, verify_skill_id: "securegraph-verify-improper_authentication", requires_approval: false, signals_matched: ["login", "oauth", "session"], rationale: "Surface signals present: login, oauth, session." },
    { vuln_class: "missing_authz_check", title: "Missing authorization check", rank: 2, verify_skill_id: "securegraph-verify-missing_authz_check", requires_approval: false, signals_matched: ["api", "tenant", "record"], rationale: "Surface signals present: api, tenant, record." },
    { vuln_class: "unsafe_file_upload", title: "Unsafe file upload", rank: 3, verify_skill_id: "securegraph-verify-unsafe_file_upload", requires_approval: true, signals_matched: ["upload", "document"], rationale: "Surface signals present: upload, document." },
    { vuln_class: "ssrf", title: "Server-side request forgery", rank: 4, verify_skill_id: "securegraph-verify-ssrf", requires_approval: false, signals_matched: ["webhook", "pdf"], rationale: "Surface signals present: webhook, pdf." },
    { vuln_class: "idor", title: "Insecure direct object reference", rank: 5, verify_skill_id: "securegraph-verify-idor", requires_approval: false, signals_matched: ["account", "document"], rationale: "Surface signals present: account, document." },
  ],
  based_on: {
    asset_inventory: { total: 42 },
    detected_frameworks: { required: ["ndpr", "pci_dss"], recommended: ["iso27001", "soc2"] },
    product_context: {
      available: true,
      projects: [
        { id: 51, name: "Customer payments portal", stage: "live" },
        { id: 52, name: "Open banking API", stage: "in_build" },
      ],
      components: 17,
      boundaries: 4,
      flows: 13,
      cross_boundary_flows: 5,
      external_components: 3,
      roles: ["admin", "customer", "support", "tpp"],
      data_classes: ["payment_cards", "personal_data"],
      stages: ["in_build", "live"],
      role_expectations: 22,
      target_kinds: ["api", "web"],
    },
    organization_intelligence: {
      available: true,
      targets_considered: 8,
      targets_with_history: 6,
      prior_open_findings: 11,
      regressions: ["weak_crypto"],
      accepted_risks: ["tech_disclosure"],
      refuted: ["xss"],
      changed_since_last: 3,
    },
  },
  recommended_plan: {
    name: "Full Security Assessment",
    estimated_duration: "~2.2 hours",
    estimated_duration_minutes: 132,
    scan_types: ["network_scan", "dns_scan", "web_scan", "vuln_scan", "api_scan", "secrets_scan"],
    compliance_report: "NDPR + PCI_DSS gap analysis; recommended: iso27001, soc2",
    vulnerability_types: 21,
    checks_selected: 58,
    steps: [
      {
        step_type: "scan",
        step_name: "Vulnerability templates",
        tool: "vuln_scan",
        target: "9 vulnerability types, 32 checks; types=['domain', 'subdomain', 'api']",
        vuln_focus: [
          { vuln_class: "improper_authentication", rank: 1, requires_approval: false },
          { vuln_class: "ssrf", rank: 4, requires_approval: false },
        ],
        substeps: [
          { key: "transport_security", label: "Transport security (TLS / certificates)", description: "Certificate validity and expiry, HTTPS reachability and TLS posture.", rank: 1, check_count: 4, worst_severity: "high", severities: { high: 1, medium: 2, info: 1 }, vuln_classes: ["weak_crypto"], regression: true, accepted_risk: false, max_duration_minutes: 3, why: "Prioritised because a previously remediated weakness of this type has returned; the attack tree ranks its class #11 on this surface.", checks: [ { name: "ssl_cert_expired", display_name: "TLS certificate expired", severity: "high" }, { name: "ssl_expiring_30d", display_name: "TLS certificate expiring within 30 days", severity: "medium" }, { name: "ssl_self_signed", display_name: "Self-signed TLS certificate", severity: "medium" }, { name: "ssl_https_reachable", display_name: "HTTPS reachable", severity: "info" } ] },
          { key: "exposed_admin_surface", label: "Exposed admin & debug surfaces", description: "Dashboards, CI, metrics and debug endpoints answering without auth.", rank: 2, check_count: 8, worst_severity: "high", severities: { high: 5, medium: 3 }, vuln_classes: ["improper_access_control", "missing_authz_check"], regression: false, accepted_risk: false, max_duration_minutes: 6, why: "Prioritised because the attack tree ranks its class #4 on this surface; your product surface mentions admin, metrics.", checks: [ { name: "airflow_n8n_exposed", display_name: "Airflow / n8n exposed", severity: "high" }, { name: "grafana_anon", display_name: "Grafana anonymous access", severity: "high" }, { name: "jenkins_exposed", display_name: "Jenkins exposed", severity: "high" }, { name: "debug_info_endpoints", display_name: "Debug info endpoints", severity: "high" }, { name: "prometheus_metrics_exposed", display_name: "Prometheus metrics exposed", severity: "high" }, { name: "priority_admin_login_paths", display_name: "Admin login paths", severity: "medium" }, { name: "directory_listing", display_name: "Directory listing", severity: "medium" }, { name: "ollama_open_api", display_name: "Ollama open API", severity: "medium" } ] },
          { key: "known_cve", label: "Known CVE probes", description: "Checks for specific published vulnerabilities in deployed software.", rank: 3, check_count: 3, worst_severity: "critical", severities: { critical: 1, high: 1, medium: 1 }, vuln_classes: ["vulnerable_dependency", "code_injection"], regression: false, accepted_risk: false, max_duration_minutes: 3, why: "Prioritised because the attack tree ranks its class #9 on this surface.", checks: [ { name: "spring_actuator_exposed", display_name: "Spring actuator exposed", severity: "critical" }, { name: "apache_struts_cve_2017_5638_probe", display_name: "Apache Struts CVE-2017-5638 probe", severity: "high" }, { name: "log4j_path_probe", display_name: "Log4j-related path probe", severity: "medium" } ] },
          { key: "secret_exposure", label: "Exposed secrets & source control", description: "Credentials, environment files and repository metadata reachable over HTTP.", rank: 4, check_count: 2, worst_severity: "critical", severities: { critical: 2 }, vuln_classes: ["hardcoded_secret"], regression: false, accepted_risk: false, max_duration_minutes: 2, why: "Prioritised because the attack tree ranks its class #14 on this surface.", checks: [ { name: "backup_env_files", display_name: "Backup / .env files", severity: "critical" }, { name: "git_metadata_exposed", display_name: "Git metadata exposed", severity: "critical" } ] },
          { key: "security_headers", label: "Browser security headers", description: "Response headers that constrain what a browser will do with the page.", rank: 5, check_count: 4, worst_severity: "medium", severities: { medium: 3, low: 1 }, vuln_classes: ["xss"], regression: false, accepted_risk: false, max_duration_minutes: 3, why: "Kept for coverage but deprioritised because a previous run disproved this class here.", checks: [ { name: "http_security_headers", display_name: "Security headers missing", severity: "medium" }, { name: "http_csp_missing", display_name: "CSP missing", severity: "medium" }, { name: "clickjacking_xfo_missing", display_name: "X-Frame-Options missing", severity: "medium" }, { name: "x_xss_protection_missing", display_name: "X-XSS-Protection missing", severity: "low" } ] },
          { key: "tech_disclosure", label: "Technology & version disclosure", description: "Server, framework and CMS fingerprints that tell an attacker what to target.", rank: 6, check_count: 7, worst_severity: "medium", severities: { medium: 2, low: 4, info: 1 }, vuln_classes: ["vulnerable_dependency"], regression: false, accepted_risk: true, max_duration_minutes: 5, why: "Kept for coverage but deprioritised because the org accepted this risk — tested, but not re-raised as new.", checks: [ { name: "framework_wordpress_signals", display_name: "WordPress signals", severity: "medium" }, { name: "wordpress_users_api", display_name: "WordPress users API", severity: "medium" }, { name: "http_server_banner", display_name: "Server banner", severity: "low" }, { name: "server_apache_banner", display_name: "Apache banner", severity: "low" }, { name: "server_nginx_banner", display_name: "Nginx banner", severity: "low" }, { name: "wordpress_version", display_name: "WordPress version", severity: "low" }, { name: "framework_php_signals", display_name: "PHP signals", severity: "info" } ] },
        ],
      },
      {
        step_type: "scan",
        step_name: "API security surface",
        tool: "api_scan",
        target: "3 vulnerability types, 7 checks; types=['api', 'domain', 'subdomain']",
        vuln_focus: [
          { vuln_class: "missing_authz_check", rank: 2, requires_approval: false },
          { vuln_class: "idor", rank: 5, requires_approval: false },
        ],
        substeps: [
          { key: "api_authz", label: "API authentication & authorization", description: "Endpoints answering unauthenticated, and cross-origin policy that undoes auth.", rank: 1, check_count: 3, worst_severity: "medium", severities: { medium: 2, low: 1 }, vuln_classes: ["missing_authz_check", "improper_authentication", "incorrect_authorization"], regression: false, accepted_risk: false, max_duration_minutes: 7, why: "Prioritised because the attack tree ranks its class #1 on this surface; your product surface mentions api, tenant.", checks: [ { name: "api_missing_auth", display_name: "Endpoint answers unauthenticated", severity: "medium" }, { name: "api_cors_wildcard", display_name: "CORS wildcard", severity: "medium" }, { name: "api_rate_limit_test", display_name: "Rate limit headers absent", severity: "low" } ] },
          { key: "api_surface_discovery", label: "API surface discovery", description: "Schemas, specs and verbs that reveal the callable surface.", rank: 2, check_count: 3, worst_severity: "medium", severities: { medium: 2, info: 1 }, vuln_classes: ["idor", "missing_authz_check"], regression: false, accepted_risk: false, max_duration_minutes: 7, why: "Prioritised because the attack tree ranks its class #5 on this surface; your product surface mentions api, graphql.", checks: [ { name: "api_endpoint_discovery", display_name: "Swagger / OpenAPI discovery", severity: "medium" }, { name: "api_graphql_introspection", display_name: "GraphQL introspection enabled", severity: "medium" }, { name: "http_options_methods", display_name: "OPTIONS methods", severity: "info" } ] },
          { key: "exposed_admin_surface", label: "Exposed admin & debug surfaces", description: "Dashboards, CI, metrics and debug endpoints answering without auth.", rank: 3, check_count: 1, worst_severity: "high", severities: { high: 1 }, vuln_classes: ["improper_access_control", "missing_authz_check"], regression: false, accepted_risk: false, max_duration_minutes: 2, why: "Prioritised because the attack tree ranks its class #4 on this surface.", checks: [ { name: "mailhog_messages_api", display_name: "MailHog messages API", severity: "high" } ] },
        ],
      },
      {
        step_type: "scan",
        step_name: "Infrastructure / network scan",
        tool: "network_scan",
        target: "4 vulnerability types, 13 checks; types=['ip_address', 'domain', 'subdomain']",
        vuln_focus: [{ vuln_class: "improper_access_control", rank: 7, requires_approval: false }],
        substeps: [
          { key: "datastore_exposure", label: "Datastore exposure", description: "Databases, caches and search engines reachable without authentication.", rank: 1, check_count: 5, worst_severity: "high", severities: { high: 2, medium: 3 }, vuln_classes: ["improper_access_control", "sql_injection"], regression: false, accepted_risk: false, max_duration_minutes: 8, why: "Prioritised because your product surface mentions database, cache.", checks: [ { name: "redis_accessible", display_name: "Redis reachable", severity: "high" }, { name: "nfs_port_open", display_name: "NFS port open", severity: "high" }, { name: "postgres_accessible", display_name: "Postgres reachable", severity: "medium" }, { name: "mysql_accessible", display_name: "MySQL reachable", severity: "medium" }, { name: "mssql_accessible", display_name: "MSSQL reachable", severity: "medium" } ] },
          { key: "remote_access", label: "Remote access exposure", description: "Administrative remote-access services reachable from the scan origin.", rank: 2, check_count: 3, worst_severity: "high", severities: { high: 1, medium: 2 }, vuln_classes: ["improper_authentication", "improper_access_control"], regression: false, accepted_risk: false, max_duration_minutes: 5, why: "Prioritised because the attack tree ranks its class #1 on this surface.", checks: [ { name: "rdp_accessible", display_name: "RDP reachable", severity: "high" }, { name: "smb_port_open", display_name: "SMB port open", severity: "medium" }, { name: "snmp_port_open", display_name: "SNMP port open", severity: "medium" } ] },
          { key: "port_exposure", label: "Open ports & service reachability", description: "Which ports answer, and which services sit behind them.", rank: 3, check_count: 4, worst_severity: "low", severities: { low: 2, info: 2 }, vuln_classes: ["improper_access_control"], regression: false, accepted_risk: false, max_duration_minutes: 6, why: "Standard coverage for this surface — no org-specific signal.", checks: [ { name: "port_scan_common", display_name: "Common port scan", severity: "low" }, { name: "tcp_port_common", display_name: "Common TCP ports", severity: "low" }, { name: "icmp_sweep", display_name: "ICMP sweep", severity: "info" }, { name: "dns_resolve", display_name: "DNS resolve", severity: "info" } ] },
          { key: "tech_disclosure", label: "Technology & version disclosure", description: "Server, framework and CMS fingerprints that tell an attacker what to target.", rank: 4, check_count: 1, worst_severity: "info", severities: { info: 1 }, vuln_classes: ["vulnerable_dependency"], regression: false, accepted_risk: true, max_duration_minutes: 2, why: "Kept for coverage but deprioritised because the org accepted this risk — tested, but not re-raised as new.", checks: [ { name: "service_fingerprint", display_name: "Service fingerprint", severity: "info" } ] },
        ],
      },
      {
        step_type: "web_scan",
        step_name: "Web application scan",
        tool: "web_scan",
        target: "Targets: domain, subdomain, api, web_app",
        substeps: [],
        vuln_focus: [
          { vuln_class: "unsafe_file_upload", rank: 3, requires_approval: true },
          { vuln_class: "ssrf", rank: 4, requires_approval: false },
        ],
      },
      {
        step_type: "scan",
        step_name: "Secrets scan (repos)",
        tool: "secrets_scan",
        target: "1 vulnerability type, 3 checks; types=['github_repo']",
        substeps: [
          { key: "secret_exposure", label: "Exposed secrets & source control", description: "Credentials and repository metadata that should not be reachable.", rank: 1, check_count: 3, worst_severity: "critical", severities: { critical: 3 }, vuln_classes: ["hardcoded_secret"], regression: false, accepted_risk: false, max_duration_minutes: 10, why: "Prioritised because your product surface mentions repo, git.", checks: [ { name: "gitleaks_detect", display_name: "Gitleaks detection", severity: "critical" }, { name: "git_secrets_leaked", display_name: "Git secrets leaked", severity: "critical" }, { name: "exposed_env_file", display_name: "Exposed .env file", severity: "critical" } ] },
        ],
        vuln_focus: [{ vuln_class: "hardcoded_secret", rank: 14, requires_approval: false }],
      },
      { step_type: "correlate", step_name: "Cross-Scan Analysis", tool: "correlate", target: "Correlate findings across tools into attack paths", substeps: [], vuln_focus: [] },
      { step_type: "analyze", step_name: "Intelligence Analysis", tool: "analyze", target: "Complexity scoring, compliance analysis, and verification of the vulnerability classes this surface makes plausible", substeps: [], vuln_focus: [] },
    ],
  },
  narrative: [
    "Based on your organization, we'll run a **Full Security Assessment** covering:",
    "  ─ Infrastructure / network scan — 4 vulnerability types, 13 checks",
    "  ─ Vulnerability templates — 9 vulnerability types, 32 checks",
    "  ─ API security surface — 3 vulnerability types, 7 checks",
    "  ─ Compliance context: NDPR, PCI_DSS",
    "Coverage: 21 vulnerability types / 58 checks, seeded automatically from the scan catalog (90 checks available).",
    "Hunting first: improper_authentication, missing_authz_check, unsafe_file_upload, ssrf, idor.",
    "Product context applied: 17 components, 13 flows, 5 crossing a trust boundary, 4 roles.",
    "Sensitive data in scope: payment_cards, personal_data — authorization failures here are reportable, not cosmetic.",
    "Prior knowledge: 11 findings still open across 6 known targets.",
    "Regressions tested first (1): a fix that did not hold is stronger evidence than a first sighting.",
    "1 accepted risk still tested but not re-raised as new findings.",
    "Estimated time: ~2.2 hours",
    "Asset inventory considered: 42 active assets.",
  ].join("\n"),
};

// ── Report Solutions — the catalog + standing finding counts ─────────────────
// Mirrors GET /reports/types and the tracker summary the dashboard charts read.

export const reportTypes: ReportTypeEntry[] = [
  { report_type: "org_security_overview", title: "Organization security overview", audience: "Executive / board", use_case: "Where the organization stands across every attack surface, not one engagement: posture per surface, findings from all engines, what moved since the last report.", requires_campaign: false, featured: true, icon: "shield", sections: ["executive_summary", "posture_by_surface", "findings_lifecycle", "findings_register", "risk_register", "attack_paths", "compliance_mapping", "remediation_status", "asset_scope"], section_count: 9, formats: ["markdown", "json", "csv", "xlsx", "pdf", "docx", "pptx", "html"] },
  { report_type: "vapt_campaign", title: "VAPT campaign report", audience: "Technical / client deliverable", use_case: "The full engagement write-up for one campaign: scope, findings register, attack paths, evidence and remediation.", requires_campaign: true, featured: true, icon: "crosshair", sections: ["scope_definition", "executive_summary", "campaign_overview", "cvss_scorecard", "findings_register", "attack_paths", "risk_register", "compliance_mapping", "technical_findings", "nmap_output", "asset_scope", "remediation_status", "tracker_snapshot", "audit_trail", "methodology"], section_count: 15, formats: ["markdown", "json", "csv", "xlsx", "pdf", "docx", "pptx", "html"] },
  { report_type: "compliance", title: "Compliance report", audience: "Auditor / assessor", use_case: "Findings mapped to the frameworks in scope, with the control gaps and the evidence behind each mapping.", requires_campaign: false, featured: true, icon: "scale", sections: ["executive_summary", "compliance_mapping", "risk_register", "findings_register", "remediation_status", "audit_trail"], section_count: 6, formats: ["markdown", "json", "csv", "xlsx", "pdf", "docx", "pptx", "html"] },
  { report_type: "performance_sla", title: "Performance & SLA", audience: "Security leadership", use_case: "Whether the programme is getting faster: mean time to remediate by severity, closure rate, regressions, and what the automation cost.", requires_campaign: false, featured: true, icon: "gauge", sections: ["executive_summary", "performance_metrics", "findings_lifecycle", "remediation_status", "engine_activity", "ai_usage"], section_count: 6, formats: ["markdown", "json", "csv", "xlsx", "pdf", "docx", "pptx", "html"] },
  { report_type: "audit_activity", title: "Audit & user activity", audience: "Compliance / internal audit", use_case: "Who did what: sensitive actions, dual-control approvals and refusals, and per-user activity over the window.", requires_campaign: false, featured: false, icon: "clipboard", sections: ["executive_summary", "user_activity", "approvals_trail", "audit_trail"], section_count: 4, formats: ["markdown", "json", "csv", "xlsx", "pdf", "docx", "pptx", "html"] },
  { report_type: "engine_output", title: "Engine output (technical)", audience: "Engineering", use_case: "The technical appendix: what each engine ran and produced — scanner results, campaign steps, code findings, repo analysis.", requires_campaign: false, featured: false, icon: "terminal", sections: ["engine_activity", "technical_findings", "findings_register", "attack_paths", "nmap_output", "asset_scope"], section_count: 6, formats: ["markdown", "json", "csv", "xlsx", "pdf", "docx", "pptx", "html"] },
  { report_type: "executive", title: "Executive summary", audience: "Executive", use_case: "The short read: posture, top risks, attack paths and compliance standing.", requires_campaign: false, featured: false, icon: "file-text", sections: ["executive_summary", "cvss_scorecard", "attack_paths", "risk_register", "compliance_mapping"], section_count: 5, formats: ["markdown", "json", "csv", "xlsx", "pdf", "docx", "pptx", "html"] },
  { report_type: "tracker", title: "Remediation tracker", audience: "Remediation owners", use_case: "The working board: every tracked finding, its owner, status and target date.", requires_campaign: false, featured: false, icon: "list-checks", sections: ["tracker_snapshot", "remediation_status"], section_count: 2, formats: ["markdown", "json", "csv", "xlsx", "pdf", "docx", "pptx", "html"] },
];

/** Standing counts across the tracked population — drives the findings chart. */
export const trackerSummary: TrackerSummary = {
  total: 48,
  open: 19,
  in_progress: 7,
  fixed: 15,
  retest_failed: 2,
  regressed: 3,
  accepted: 2,
  bySeverity: { critical: 4, high: 11, medium: 18, low: 12, info: 3 },
  bySurface: { design: 5, code: 17, test: 6, cloud: 14, mobile: 6 },
  unassigned: 6,
};
