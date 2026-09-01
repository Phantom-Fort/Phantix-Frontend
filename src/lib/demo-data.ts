import type {
  AgentSkill,
  AiStatus,
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
  IntelDashboard,
  IntelEventsResponse,
  IntelLookup,
  IntelligenceDashboard,
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
  SupportTicket,
  TrackerFinding,
  VaptApproval,
  VaptCampaign,
  VaptFinding,
  Severity,
  SocAdapter,
  SocCase,
  SocDetection,
  SocRule,
  SocStatus,
} from "./types";

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
  { id: 109, asset_type: "api", value: "OpenAPI Â· payments-v2", name: "Payments API spec", source: "openapi", is_verified: true, verification_method: "ownership_confirm", criticality: "critical", environment: "production", tags: [assetTags[0], assetTags[1]], first_discovered_at: "2026-05-12T14:00:00Z", last_seen_at: "2026-07-19T09:44:00Z" },
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
  { id: 901, scan_job_id: 88, asset_id: 104, asset_value: "portal.acme.ng", tool: "nuclei", severity: "critical", title: "CVE-2025-24104 --- Jetty remote code execution", description: " vulnerable Jetty 11.0.24 handler chain allows unauthenticated RCE via crafted URI.", verification_status: "auto_verified", confidence: 98, created_at: "2026-07-21T07:41:00Z", reportable: true, impact_level: "Critical", impact_score: 4, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_cve" }, impact_analysis: { impact_level: "Critical", impact_score: 4, summary: "Critical impact â€” remote code execution (service)", categories: ["remote_code_execution"], blast_radius: "service" } } },
  { id: 902, scan_job_id: 88, asset_id: 102, asset_value: "api.acme.ng", tool: "nuclei", severity: "high", title: "JWT accepts alg=none on /v2/auth/refresh", description: "Token validation bypass confirmed with forged claims.", verification_status: "auto_verified", confidence: 96, created_at: "2026-07-21T07:44:00Z", reportable: true, impact_level: "High", impact_score: 3, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "High", impact_score: 3, summary: "High impact â€” authentication bypass (service)", categories: ["authentication_bypass"], blast_radius: "service" } } },
  { id: 903, scan_job_id: 88, asset_id: 105, asset_value: "41.58.130.44", tool: "nmap", severity: "medium", title: "OpenSSH 8.9p1 --- outdated", description: "Version banner indicates missing security backports.", verification_status: "manually_verified", confidence: 88, created_at: "2026-07-21T07:35:00Z", reportable: true, impact_level: "Medium", impact_score: 2, evidence: { verification: { confidence: "manually-verified", verification_status: "manually_verified", reportable: true, method: "explicit_status" }, impact_analysis: { impact_level: "Medium", impact_score: 2, summary: "Medium impact â€” service disruption (host)", categories: ["supply_chain"], blast_radius: "host" } } },
  { id: 904, scan_job_id: 88, asset_id: 106, asset_value: "41.58.130.44:443", tool: "nuclei", severity: "high", title: "TLS 1.0 enabled on edge gateway", description: "Legacy protocol negotiated successfully.", verification_status: "auto_verified", confidence: 94, created_at: "2026-07-21T07:38:00Z", reportable: true, impact_level: "High", impact_score: 3, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "High", impact_score: 3, summary: "High impact â€” cryptographic weakness (internet-facing)", categories: ["cryptographic_weakness"], blast_radius: "internet_facing" } } },
  { id: 905, scan_job_id: 88, asset_id: 111, asset_value: "staging.acme.ng", tool: "nuclei", severity: "low", title: "Directory listing on /backups/", description: "Heuristic probe --- pattern match only.", verification_status: "unverified", confidence: 55, created_at: "2026-07-21T07:52:00Z", reportable: false, evidence: { verification: { confidence: "heuristic", verification_status: "unverified", reportable: false, method: "auto_http_evidence" } } },
  { id: 906, scan_job_id: 88, asset_id: 105, asset_value: "41.58.130.44", tool: "nmap", severity: "info", title: "ICMP echo reply", description: "Host reachability signal.", verification_status: "rejected", confidence: 20, created_at: "2026-07-21T07:33:00Z", reportable: false, evidence: { verification: { confidence: "heuristic", verification_status: "rejected", reportable: false, method: "explicit_status" } } },
  { id: 907, scan_job_id: 87, asset_id: 109, asset_value: "payments-v2", tool: "nuclei", severity: "high", title: "Mass assignment on /v2/transfers", description: "Amount field accepted from client body without server check.", verification_status: "manually_verified", confidence: 91, created_at: "2026-07-20T13:14:00Z", reportable: true, impact_level: "High", impact_score: 3, evidence: { verification: { confidence: "manually-verified", verification_status: "manually_verified", reportable: true, method: "explicit_status" }, impact_analysis: { impact_level: "High", impact_score: 3, summary: "High impact â€” data exposure (service)", categories: ["data_exposure"], blast_radius: "service" } } },
  { id: 908, scan_job_id: 87, asset_id: 104, asset_value: "portal.acme.ng", tool: "nuclei", severity: "medium", title: "Missing Content-Security-Policy", description: "No CSP header on authenticated pages.", verification_status: "auto_verified", confidence: 99, created_at: "2026-07-20T13:09:00Z", reportable: true, impact_level: "Medium", impact_score: 2, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "Medium", impact_score: 2, summary: "Medium impact â€” misconfiguration (service)", categories: ["misconfiguration"], blast_radius: "service" } } },
  { id: 909, scan_job_id: 87, asset_id: 104, asset_value: "portal.acme.ng", tool: "nuclei", severity: "medium", title: "Session cookie lacks SameSite", description: "Cookie flags: Secure, HttpOnly only.", verification_status: "auto_verified", confidence: 97, created_at: "2026-07-20T13:09:30Z", reportable: true, impact_level: "Medium", impact_score: 2, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "Medium", impact_score: 2, summary: "Medium impact â€” misconfiguration (service)", categories: ["misconfiguration"], blast_radius: "service" } } },
  { id: 910, scan_job_id: 86, asset_id: 110, asset_value: "ng.acme.mobile", tool: "apk", severity: "high", title: "Hardcoded API secret in strings.xml", description: "Static analysis recovered a base64 secret constant.", verification_status: "manually_verified", confidence: 89, created_at: "2026-07-19T09:15:00Z", reportable: true, impact_level: "High", impact_score: 3, evidence: { verification: { confidence: "manually-verified", verification_status: "manually_verified", reportable: true, method: "explicit_status" }, impact_analysis: { impact_level: "High", impact_score: 3, summary: "High impact â€” data exposure (host)", categories: ["data_exposure"], blast_radius: "host" } } },
  { id: 911, scan_job_id: 86, asset_id: 110, asset_value: "ng.acme.mobile", tool: "apk", severity: "medium", title: "Exported activity without permission check", description: "MainActivity exported=true.", verification_status: "auto_verified", confidence: 93, created_at: "2026-07-19T09:16:00Z", reportable: true, impact_level: "Medium", impact_score: 2, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "Medium", impact_score: 2, summary: "Medium impact â€” information disclosure (host)", categories: ["information_disclosure"], blast_radius: "host" } } },
  { id: 912, scan_job_id: 88, asset_id: 103, asset_value: "portal.acme.ng", tool: "nuclei", severity: "critical", title: "IDOR on /accounts/{id}/statement", description: "Sequential account ids return other customers' statements.", verification_status: "auto_verified", confidence: 97, created_at: "2026-07-21T07:49:00Z", reportable: true, impact_level: "Critical", impact_score: 4, evidence: { verification: { confidence: "scanner-confirmed", verification_status: "auto_verified", reportable: true, method: "auto_http_evidence" }, impact_analysis: { impact_level: "Critical", impact_score: 4, summary: "Critical impact â€” data exposure (service)", categories: ["data_exposure"], blast_radius: "service" } } },
];

export const vaptCampaigns: VaptCampaign[] = [
  { id: 13, name: "Q3 External Assessment", campaign_type: "external", procedure_key: "full_vapt", status: "active", phase: "Web application testing", progress: 58, asset_count: 9, findings_count: 17, requires_approval: true, created_by: "Ada Okonkwo", created_at: "2026-07-14T10:00:00Z", started_at: "2026-07-14T10:30:00Z", finished_at: null, current_step_index: 2, current_phase: "Vulnerability templates", asset_scope: { asset_types: ["domain", "subdomain", "ip_address"] }, procedure_snapshot: { source: "full_vapt", steps: [
    { step_type: "recon", step_name: "Asset & DNS recon", step_description: "Enumerate subdomains and hosts", status: "completed", config: { tools: ["subfinder", "dnsx"], max_duration_minutes: 15 }, output_summary: { assets_resolved: 22, unique_hosts: 14, targets_scanned: ["acme.ng", "www.acme.ng", "app.acme.ng", "portal.acme.ng", "api.acme.ng", "staging.acme.ng"], skipped_already_scanned: ["104.21.10.198 (IP skipped â€” domain/subdomain already in job; not re-scanned after hostname)", "172.67.131.182 (IP skipped â€” domain/subdomain already in job; not re-scanned after hostname)"], skipped_count: 2, time_budget_seconds: 900, elapsed_seconds: 540, results_written: 0, tools: ["subfinder", "dnsx"] } },
    { step_type: "scan", step_name: "Network surface (Nmap)", step_description: "Port and service discovery on live hosts", status: "completed", config: { tools: ["nmap"], max_duration_minutes: 20 }, output_summary: { assets_resolved: 9, unique_hosts: 9, targets_scanned: ["portal.acme.ng", "api.acme.ng", "staging.acme.ng"], skipped_already_scanned: [], skipped_count: 0, time_budget_seconds: 1200, elapsed_seconds: 1100, results_written: 41, tools: ["nmap"] } },
    { step_type: "scan", step_name: "Vulnerability templates", step_description: "YAML vulnerability checks on unique hosts (domain IPs skipped)", status: "running", config: { tools: ["vuln_scan"], max_duration_minutes: 35, dedupe_hosts: true, target_types: ["domain", "subdomain", "web_app", "api"] }, output_summary: { assets_resolved: 18, assets_considered: 12, unique_hosts: 12, targets_scanned: ["portal.acme.ng", "api.acme.ng", "app.acme.ng", "www.acme.ng", "staging.acme.ng"], skipped_already_scanned: ["41.58.130.44 (IP skipped â€” domain/subdomain already in job; not re-scanned after hostname)", "104.21.10.198 (IP skipped â€” domain/subdomain already in job; not re-scanned after hostname)"], skipped_count: 4, time_budget_seconds: 2100, elapsed_seconds: 1320, results_written: 17, tools: ["vuln_scan"], partial: true } },
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
  { id: 301, campaign_id: 13, title: "Edge â†’ Portal â†’ Core ledger attack path", severity: "critical", verification_status: "auto_verified", confidence: 96, asset_value: "portal.acme.ng", correlation_rule: "chain.auth_bypass_data_access", attack_path: ["41.58.130.44:443 TLS 1.0", "portal.acme.ng Jetty RCE", "core-ledger service account"], cve: "CVE-2025-24104", cvss: 9.8, created_at: "2026-07-19T12:00:00Z", reportable: true, impact_level: "Critical", impact_score: 4, impact_summary: "Critical impact â€” remote code execution (service)", business_impact: "High business impact from a verified critical-severity finding allowing unauthenticated control of the customer portal.", technical_impact: "Untrusted input reaches a trusted Jetty handler chain, enabling unauthenticated RCE on the portal tier.", impact_analysis: { impact_level: "Critical", impact_score: 4, cia: { confidentiality: "high", integrity: "high", availability: "high" }, categories: ["remote_code_execution"], blast_radius: "service", business_impact: "High business impact from a verified critical-severity finding allowing unauthenticated control of the customer portal.", technical_impact: "Untrusted input reaches a trusted Jetty handler chain, enabling unauthenticated RCE on the portal tier.", summary: "Critical impact â€” remote code execution (service)", analysis_method: "deterministic_v1", analyzed_at: "2026-07-21T10:00:00Z" } },
  { id: 302, campaign_id: 13, title: "IDOR exposes customer statements", severity: "critical", verification_status: "auto_verified", confidence: 97, asset_value: "portal.acme.ng", correlation_rule: null, attack_path: [], cve: null, cvss: 8.6, created_at: "2026-07-20T09:30:00Z", reportable: true, impact_level: "Critical", impact_score: 4, impact_summary: "Critical impact â€” data exposure (service)", business_impact: "Customers' financial statements can be read by any authenticated user by walking sequential ids.", technical_impact: "Object reference is not validated against the authenticated principal before returning the statement resource.", impact_analysis: { impact_level: "Critical", impact_score: 4, cia: { confidentiality: "high", integrity: "low", availability: "low" }, categories: ["data_exposure"], blast_radius: "service", business_impact: "Customers' financial statements can be read by any authenticated user by walking sequential ids.", technical_impact: "Object reference is not validated against the authenticated principal before returning the statement resource.", summary: "Critical impact â€” data exposure (service)", analysis_method: "deterministic_v1", analyzed_at: "2026-07-21T10:05:00Z" } },
  { id: 303, campaign_id: 13, title: "JWT alg=none auth bypass", severity: "high", verification_status: "auto_verified", confidence: 96, asset_value: "api.acme.ng", correlation_rule: "chain.token_forgery", attack_path: ["/v2/auth/refresh", "forged admin claims"], cve: null, cvss: 8.1, created_at: "2026-07-20T11:00:00Z", reportable: true, impact_level: "High", impact_score: 3, impact_summary: "High impact â€” authentication bypass (service)", business_impact: "Forged tokens grant administrative API access without credentials.", technical_impact: "Refresh endpoint accepts alg=none tokens, bypassing signature verification.", impact_analysis: { impact_level: "High", impact_score: 3, cia: { confidentiality: "high", integrity: "high", availability: "low" }, categories: ["authentication_bypass"], blast_radius: "service", business_impact: "Forged tokens grant administrative API access without credentials.", technical_impact: "Refresh endpoint accepts alg=none tokens, bypassing signature verification.", summary: "High impact â€” authentication bypass (service)", analysis_method: "deterministic_v1", analyzed_at: "2026-07-21T10:10:00Z" } },
  { id: 304, campaign_id: 13, title: "TLS 1.0 on edge gateway", severity: "high", verification_status: "manually_verified", confidence: 94, asset_value: "41.58.130.44", correlation_rule: null, attack_path: [], cve: null, cvss: 7.4, created_at: "2026-07-19T14:20:00Z", reportable: true, impact_level: "High", impact_score: 3, impact_summary: "High impact â€” cryptographic weakness (internet-facing)", business_impact: "Legacy TLS weakens transport security for internet-facing traffic.", technical_impact: "TLS 1.0 negotiation accepted, exposing the connection to protocol-level attacks.", impact_analysis: { impact_level: "High", impact_score: 3, cia: { confidentiality: "medium", integrity: "low", availability: "low" }, categories: ["cryptographic_weakness"], blast_radius: "internet_facing", business_impact: "Legacy TLS weakens transport security for internet-facing traffic.", technical_impact: "TLS 1.0 negotiation accepted, exposing the connection to protocol-level attacks.", summary: "High impact â€” cryptographic weakness (internet-facing)", analysis_method: "deterministic_v1", analyzed_at: "2026-07-21T10:15:00Z" } },
  { id: 305, campaign_id: 13, title: "Mass assignment on transfers", severity: "high", verification_status: "manually_verified", confidence: 91, asset_value: "payments-v2", correlation_rule: null, attack_path: [], cve: null, cvss: 7.1, created_at: "2026-07-21T06:10:00Z", reportable: true, impact_level: "High", impact_score: 3, impact_summary: "High impact â€” data exposure (service)", business_impact: "Client-controlled fields can alter transfer amounts and destinations.", technical_impact: "Request body fields are bound to the transfer model without an allowlist.", impact_analysis: { impact_level: "High", impact_score: 3, cia: { confidentiality: "low", integrity: "high", availability: "low" }, categories: ["data_exposure"], blast_radius: "service", business_impact: "Client-controlled fields can alter transfer amounts and destinations.", technical_impact: "Request body fields are bound to the transfer model without an allowlist.", summary: "High impact â€” data exposure (service)", analysis_method: "deterministic_v1", analyzed_at: "2026-07-21T10:20:00Z" } },
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
      { component: "Base (LÃ—I)", contribution: 80, detail: "Likelihood 4 Ã— Impact 4 normalized" },
      { component: "Tag rules", contribution: 8, detail: "crown-jewel, pci-scope, external" },
      { component: "Exposure", contribution: 4, detail: "Internet-facing confirmed" },
    ],
    treatment_status: "proposed", age_days: 3, created_at: "2026-07-19T12:05:00Z", updated_at: "2026-07-21T06:00:00Z",
  },
  {
    id: 502, title: "IDOR on account statements", asset_value: "portal.acme.ng", vulnerability_key: "idor-statements", status: "under_approval", level: "critical", inherent_score: 86, residual_score: null, likelihood: 4, impact: 4, owner_department: "Digital Channels", priority_band: "P1", priority_score: 87.2,
    priority_factors: { effective_severity: 86, treatment_urgency: 92, status_urgency: 80, asset_context: 95, age: 30 },
    scoring_breakdown: [
      { component: "Base (LÃ—I)", contribution: 78, detail: "Likelihood 4 Ã— Impact 4 normalized" },
      { component: "Data rules", contribution: 8, detail: "customer_data exposure" },
    ],
    treatment_status: "under_approval", age_days: 2, created_at: "2026-07-20T09:35:00Z", updated_at: "2026-07-21T05:30:00Z",
  },
  {
    id: 503, title: "JWT algorithm confusion on refresh endpoint", asset_value: "api.acme.ng", vulnerability_key: "jwt-alg-none", status: "assessed", level: "high", inherent_score: 71, residual_score: null, likelihood: 3, impact: 4, owner_department: "Platform Engineering", priority_band: "P2", priority_score: 68.9,
    priority_factors: { effective_severity: 71, treatment_urgency: 60, status_urgency: 62, asset_context: 80, age: 45 },
    scoring_breakdown: [
      { component: "Base (LÃ—I)", contribution: 63, detail: "Likelihood 3 Ã— Impact 4 normalized" },
      { component: "Tag rules", contribution: 8, detail: "crown-jewel, pci-scope" },
    ],
    treatment_status: null, age_days: 2, created_at: "2026-07-20T11:05:00Z", updated_at: "2026-07-20T11:05:00Z",
  },
  {
    id: 504, title: "Legacy TLS on edge gateway", asset_value: "41.58.130.44", vulnerability_key: "tls-1.0-edge", status: "in_progress", level: "high", inherent_score: 64, residual_score: 28, likelihood: 3, impact: 3, owner_department: "Infrastructure", priority_band: "P2", priority_score: 61.3,
    priority_factors: { effective_severity: 46, treatment_urgency: 40, status_urgency: 55, asset_context: 75, age: 55 },
    scoring_breakdown: [
      { component: "Base (LÃ—I)", contribution: 56, detail: "Likelihood 3 Ã— Impact 3 normalized" },
      { component: "Exposure", contribution: 8, detail: "Internet-facing confirmed" },
    ],
    treatment_status: "approved", age_days: 8, created_at: "2026-07-13T14:00:00Z", updated_at: "2026-07-20T08:00:00Z",
  },
  {
    id: 505, title: "Hardcoded secret in Android build", asset_value: "ng.acme.mobile", vulnerability_key: "apk-hardcoded-secret", status: "identified", level: "high", inherent_score: 58, residual_score: null, likelihood: 2, impact: 4, owner_department: "Mobile Team", priority_band: "P3", priority_score: 47.8,
    priority_factors: { effective_severity: 58, treatment_urgency: 55, status_urgency: 68, asset_context: 60, age: 25 },
    scoring_breakdown: [
      { component: "Base (LÃ—I)", contribution: 50, detail: "Likelihood 2 Ã— Impact 4 normalized" },
      { component: "Data rules", contribution: 8, detail: "customer_data on device" },
    ],
    treatment_status: "proposed", age_days: 2, created_at: "2026-07-19T09:20:00Z", updated_at: "2026-07-19T09:20:00Z",
  },
  {
    id: 506, title: "Missing CSP on authenticated pages", asset_value: "portal.acme.ng", vulnerability_key: "missing-csp", status: "identified", level: "medium", inherent_score: 34, residual_score: null, likelihood: 2, impact: 2, owner_department: null, priority_band: "P4", priority_score: 33.1,
    priority_factors: { effective_severity: 34, treatment_urgency: 40, status_urgency: 68, asset_context: 55, age: 10 },
    scoring_breakdown: [{ component: "Base (LÃ—I)", contribution: 34, detail: "Likelihood 2 Ã— Impact 2 normalized" }],
    treatment_status: null, age_days: 1, created_at: "2026-07-20T13:10:00Z", updated_at: "2026-07-20T13:10:00Z",
  },
  {
    id: 507, title: "OpenSSH backports missing", asset_value: "41.58.130.44", vulnerability_key: "openssh-8.9p1", status: "accepted", level: "medium", inherent_score: 41, residual_score: 41, likelihood: 2, impact: 3, owner_department: "Infrastructure", priority_band: "P5", priority_score: 18.6,
    priority_factors: { effective_severity: 41, treatment_urgency: 10, status_urgency: 8, asset_context: 75, age: 20 },
    scoring_breakdown: [{ component: "Base (LÃ—I)", contribution: 41, detail: "Likelihood 2 Ã— Impact 3 normalized" }],
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
  { id: 71, connector: "wazuh", evidence_type: "siem_alerts", title: "Wazuh --- authentication anomaly pack", status: "collected", collected_at: "2026-07-20T16:00:00Z", summary: "412 alerts normalized Â· 3 mapped to A.8.16" },
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
  { finding_key: "VAPT-301", title: "Edge â†’ Portal â†’ Core ledger attack path", severity: "critical", status: "in_progress", owner: "appsec@acme.ng", campaign_name: "Q3 External Assessment", asset_value: "portal.acme.ng", updated_at: "2026-07-21T06:30:00Z", priority: "P0", surface: "Web" },
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
  { id: 599, action_key: "data.access", action_label: "GET /api/v1/assets/intelligence/dashboard", category: "data_access", status: "completed", summary: "GET /api/v1/assets/intelligence/dashboard", details: { path: "/api/v1/assets/intelligence/dashboard", method: "GET", actor_user_id: 2, actor_email: "ada@phantixlabs.com", token_type: "app_session", passive: true }, source: "api_middleware", ip_address: "102.89.34.12", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "Phantix Test Org", authorizer_title: "org_admin", created_at: "2026-07-13T15:22:00Z" },
  { id: 598, action_key: "data.access", action_label: "GET /api/v1/scans/results", category: "data_access", status: "completed", summary: "GET /api/v1/scans/results", details: { path: "/api/v1/scans/results", method: "GET", actor_user_id: 2, actor_email: "ada@phantixlabs.com", token_type: "app_session", passive: true }, source: "api_middleware", ip_address: "102.89.34.12", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "Phantix Test Org", authorizer_title: "org_admin", created_at: "2026-07-13T15:20:00Z" },
  { id: 597, action_key: "compliance.assessment.run", action_label: "POST /api/v1/compliance/assessments/2/run", category: "compliance", status: "completed", summary: "Ran ISO 27001 assessment", details: { path: "/api/v1/compliance/assessments/2/run", method: "POST", actor_user_id: 2, actor_email: "ada@phantixlabs.com", token_type: "app_session", passive: false }, source: "api_middleware", ip_address: "102.89.34.12", initiator_name: "Ada Okonkwo", initiator_title: "IT Admin", authorizer_name: "Chidi Eze", authorizer_title: "CISO", created_at: "2026-07-12T11:00:00Z" },
  { id: 596, action_key: "data.access", action_label: "GET /api/v1/risks/prioritized", category: "data_access", status: "completed", summary: "GET /api/v1/risks/prioritized", details: { path: "/api/v1/risks/prioritized", method: "GET", actor_user_id: 3, actor_email: "chidi@phantixlabs.com", token_type: "app_session", passive: true }, source: "api_middleware", ip_address: "102.89.34.13", initiator_name: "Chidi Eze", initiator_title: "CISO", authorizer_name: "Phantix Test Org", authorizer_title: "org_admin", created_at: "2026-07-12T09:30:00Z" },
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
  { id: 1, name: "phantix-vapt-writeup", description: "Drafts verified VAPT finding write-ups from campaign data. Only references findings with a Phantix finding ID.", version: "1.0.0", domain: "vapt", status: "active", score: 0.94, uses: 187, last_used_at: "2026-07-21T09:00:00Z", created_at: "2026-06-02T10:00:00Z" },
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
  realtimeHub: "app.shared.realtime â€” SOC publishes socDetectionMatched, socAlertRaised, socTriageAssigned; stream at /api/v1/soc/dashboard/stream",
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
    summary: "Escalated for IR â€” unauthenticated RCE on the portal tier.",
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
  { id: "splunk", displayName: "Splunk", vendor: "splunk", configured: false, enabled: true, detail: "Not configured â€” interface only; engine works without this adapter" },
  { id: "microsoft_defender", displayName: "Microsoft Defender", vendor: "microsoft", configured: false, enabled: true, detail: "Not configured â€” interface only" },
  { id: "soar_generic", displayName: "Generic SOAR", vendor: "soar", configured: false, enabled: false, detail: "Not configured" },
];

// â”€â”€ Orchestration: Cloud Security connectors (cloud.md) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const cloudProviders: CloudProvider[] = [
  { id: "vercel", name: "Vercel", description: "Log drains + deployment telemetry", kind: "paas", webhook: { label: "Log drain / webhook", ingestUrlHint: "Vercel â†’ Project â†’ Integrations â†’ Log Drains", signatureHeader: "x-vercel-signature" } },
  { id: "aws", name: "AWS", description: "CloudTrail / EventBridge events", kind: "cloud", webhook: { label: "EventBridge target", ingestUrlHint: "AWS console â†’ EventBridge â†’ Rule target", signatureHeader: "X-Phantix-Signature" } },
  { id: "azure", name: "Azure", description: "Azure Monitor / Sentinel log analytics", kind: "cloud", webhook: { label: "Log Analytics workspace", ingestUrlHint: "Azure â†’ Log Analytics â†’ Custom log", signatureHeader: "X-Phantix-Signature" } },
  { id: "gcp", name: "Google Cloud", description: "Cloud logging sinks", kind: "cloud", webhook: { label: "Pub/Sub push subscription", ingestUrlHint: "GCP â†’ Logging â†’ Sink â†’ Pub/Sub", signatureHeader: "X-Phantix-Signature" } },
  { id: "hetzner", name: "Hetzner", description: "VPS / server events", kind: "vps", webhook: { label: "Webhook notification", ingestUrlHint: "Hetzner Cloud â†’ Project â†’ Webhooks", signatureHeader: "X-Phantix-Signature" } },
  { id: "digitalocean", name: "DigitalOcean", description: "Droplet / alert webhooks", kind: "vps", webhook: { label: "Alert webhook", ingestUrlHint: "DO â†’ Monitoring â†’ Alerts â†’ Notification channel", signatureHeader: "X-Phantix-Signature" } },
  { id: "github", name: "GitHub", description: "Audit log + security alerts", kind: "code", webhook: { label: "Repository webhook", ingestUrlHint: "GitHub â†’ Settings â†’ Webhooks", signatureHeader: "X-Hub-Signature-256" } },
  { id: "uptimekuma", name: "Uptime Kuma", description: "Availability notification webhooks", kind: "monitoring", webhook: { label: "Notification webhook URL", ingestUrlHint: "Uptime Kuma â†’ Settings â†’ Notifications", signatureHeader: "X-Phantix-Signature" } },
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
    { id: 5, ioc: "app.acme-financial.com", iocType: "domain", title: "TI signal â€” deploy error pattern", severity: "high", matchedAssetIds: [12], source: "vercel", evidence: { event_kind: "telemetry", provider: "vercel" }, firstSeenAt: "2026-08-20T00:00:00Z", lastSeenAt: "2026-08-23T18:01:00Z" },
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
    { id: 9001, title: "VirusTotal IP â€” 185.199.108.153", severity: "high", tool: "yaml_ti", asset_value: "185.199.108.153", ioc: "185.199.108.153", created_at: "2026-08-21T09:12:00Z" },
  ],
  note: "Org-scoped correlation of connector IOCs and scan reputation against inventory. Not a global threat-intel feed.",
};

export const intelEvents: IntelEventsResponse = {
  items: cloudEvents,
  total: 18,
  limit: 50,
  offset: 0,
};

// â”€â”€ Orchestration: External pentest scope + ROE (EXTERNAL_PENTEST_SCOPE_AND_ROE_FE.md) â”€
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
    title: "Q3 external pentest â€” acme.example",
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
