# Phantix Backend — Frontend Integration Guide

**Audience**: **Customer portal** (organization) frontend developers  
**Staff / admin / support app**: see **[STAFF_PORTAL.md](./STAFF_PORTAL.md)** (separate `type=staff` JWT — do not mix)  
**Base URL**: `https://staging.phantix.site` (staging) · `http://localhost:8000` (local)  
**API prefix**: `/api/v1`  
**OpenAPI**: `GET /docs` · `GET /api/v1/openapi.json`  
**Postman**: [`API Testing/phantix_postman_collection.json`](../API%20Testing/phantix_postman_collection.json)  

## Comprehensive FE implementation suite (preferred entry points)

| Guide | Surface |
|-------|---------|
| **[frontend/README.md](./frontend/README.md)** | Index of all FE docs |
| **[frontend/01_ORG_SETUP_IMPLEMENTATION.md](./frontend/01_ORG_SETUP_IMPLEMENTATION.md)** | Onboarding wizard |
| **[frontend/02_PLATFORM_IMPLEMENTATION.md](./frontend/02_PLATFORM_IMPLEMENTATION.md)** | `platform.phantix.site` management + product modules |
| **[frontend/03_APPLICATION_IMPLEMENTATION.md](./frontend/03_APPLICATION_IMPLEMENTATION.md)** | `app.phantix.site` dual-token operate |
| **[frontend/04_STAFF_ADMIN_IMPLEMENTATION.md](./frontend/04_STAFF_ADMIN_IMPLEMENTATION.md)** | Staff console |
| **[frontend/API_ENDPOINT_CATALOG.md](./frontend/API_ENDPOINT_CATALOG.md)** | Full generated catalog (~326 routes) |

**Related**: [STAFF_PORTAL.md](./STAFF_PORTAL.md) · [RBAC_MFA.md](./RBAC_MFA.md) · [TWO_PLATFORM_AUTH.md](./TWO_PLATFORM_AUTH.md) · [PLATFORM_APP_FE_CHECKLIST.md](./PLATFORM_APP_FE_CHECKLIST.md) · [AUDIT.md](./AUDIT.md) · [COMPLIANCE.md](./COMPLIANCE.md) · [ASSET_DISCOVERY.md](./ASSET_DISCOVERY.md) · [VAPT.md](./VAPT.md) · [REPORTING.md](./REPORTING.md) · [ALERTS.md](./ALERTS.md) · [CONNECTIONS.md](./CONNECTIONS.md) · [ENGINES.md](./ENGINES.md)

> **Two products**: organization **management** (`platform.phantix.site`) vs **application** access (`app.phantix.site`).  
> Service keys (1 per company), login links, and dual tokens (`app_session` + `device_token`) are documented in [TWO_PLATFORM_AUTH.md](./TWO_PLATFORM_AUTH.md) and the FE checklist [PLATFORM_APP_FE_CHECKLIST.md](./PLATFORM_APP_FE_CHECKLIST.md).

---

## 1. Auth model (realms)

| Realm | Login | Token use | Header |
|-------|--------|-----------|--------|
| **Company (org)** | `POST /api/v1/organizations/login` (+ MFA) | Company portal, bootstrap | `Authorization: Bearer` (`type=access`) |
| **Org user** | `POST /api/v1/org-users/auth/login` → `/mfa` (domain email + OTP; optional `/device`) | Named user reads + audit | `Authorization: Bearer` (`type=org_user`) |
| **Dual-control** | same org-user login with `purpose=dual_control` | Initiator/authorizer mutations | `X-Dual-Control-Session` (3‑min idle) |
| **Staff (platform)** | `POST /api/v1/staff/login` | `/api/v1/admin/*`, `POST /api/v1/staff` | `Authorization: Bearer` (`type=staff`) |

- Company JWT: `type: "access"`, `sub` = organization id.  
- Org-user JWT: `type: "org_user"`, `sub` = user id, `organization_id` claim.  
- Staff JWT is a separate realm — **never** mix tokens on wrong routes.  
- Details: [RBAC_MFA.md](./RBAC_MFA.md) · Compliance admin upload: [COMPLIANCE.md](./COMPLIANCE.md).

### 1.1 Company login (+ MFA)

```http
POST /api/v1/organizations/login
Content-Type: application/x-www-form-urlencoded

username=<company_email>&password=<password>
```

If MFA required:

```json
{ "mfa_required": true, "mfa_token": "...", "message": "..." }
```

```http
POST /api/v1/organizations/login/mfa
Content-Type: application/json

{ "mfa_token": "...", "code": "123456" }
```

Success → store `access_token`. With `OTP_DEV_EXPOSE=true` (dev only), OTP may appear as `dev_otp`.

### 1.2 Organization user login (any role — domain email + OTP)

Any registered org user (viewer, operator, initiator, …) logs in **without** the company password.

Email rules:

- Normally must **end with the organization domain** (e.g. `ada@acme.com` when domain is `acme.com`)
  **and** already exist as an organization user.
- **Exempt from domain check + auto-provisioned as org user:** org primary email, secondary email,
  and registration contact emails (`primary_contact_email`, `secondary_contact_email`,
  `security_contact_email`) — even free-mail. First OTP login creates the org-user row if missing.

**Device id (required for smooth re-login):** generate a UUID once per browser, store in
`localStorage`, and send as `device_id` (body) or `X-Device-Id` header on every login step.

```http
POST /api/v1/org-users/auth/login
Content-Type: application/json
X-Device-Id: <stable-browser-uuid>

{ "email": "ada@acme.com", "purpose": "access", "device_id": "<stable-browser-uuid>" }
```

→ `{ mfa_required: true, mfa_token, destination_masked }` — OTP emailed to that address.

```http
POST /api/v1/org-users/auth/login/mfa
Content-Type: application/json
X-Device-Id: <stable-browser-uuid>

{ "mfa_token": "...", "code": "123456", "device_id": "<stable-browser-uuid>" }
```

**Same browser / no other active session** →  
`{ access_token, token_type: "org_user", user }` — **identity JWT**, distinct from dual-control session.

**New browser/device while another session is still active** → **no tokens yet**:

```json
{
  "device_verification_required": true,
  "device_token": "...",
  "destination_masked": "a***@acme.com",
  "active_session": { "ip_address_masked": "1.2.3.*", "user_agent_preview": "..." },
  "message": "Confirm this new browser/device..."
}
```

Then:

```http
POST /api/v1/org-users/auth/login/device
Content-Type: application/json
X-Device-Id: <stable-browser-uuid>

{ "device_token": "...", "code": "654321", "device_id": "<stable-browser-uuid>" }
```

→ tokens issued; prior sessions revoked.

Use `Authorization: Bearer <access_token>` for reads/reports; audit records **who** logged in and **what data** was accessed.

`purpose: "dual_control"` also returns `session_token` for mutations (initiator/authorizer only).

### 1.3 Dual-control session (mutations)

After dual-control is configured, **most writes** need **both**:

```http
Authorization: Bearer <org_jwt_or_org_user_jwt>
X-Dual-Control-Session: <session_token>
```

Obtain dual-control session (same email OTP login with operate purpose + `device_id`):

```http
POST /api/v1/org-users/auth/login
Content-Type: application/json
X-Device-Id: <stable-browser-uuid>

{ "email": "initiator@acme.com", "purpose": "dual_control", "device_id": "<stable-browser-uuid>" }
```

Then verify MFA (`/login/mfa`) → `access_token` + `session_token` (short-lived inactivity ~3 min).  
If `device_verification_required`, complete `/login/device` before tokens are issued.

| Call type | Bearer (company or org_user) | Dual-control session |
|-----------|------------------------------|----------------------|
| `GET` / `HEAD` | Yes | No |
| `POST` reports | Yes | No |
| Other `POST`/`PUT`/`PATCH`/`DELETE` | Yes | **Yes** (after dual-control assigned) |
| Bootstrap create users / assign dual-control | Yes (company **or** org-user JWT) | **No** while dual-control not yet assigned |

**UI**: Keep a dual-control “operate” session; on 403 with `required_header`, prompt re-auth of initiator/authorizer via domain-email OTP (`purpose=dual_control`).

**Full dual-control setup process (wizard + APIs):** [DUAL_CONTROL_SETUP_FE.md](./DUAL_CONTROL_SETUP_FE.md).

Full rules: [RBAC_MFA.md](./RBAC_MFA.md).

---

## 2. Global conventions for UI

### 2.1 Status codes to handle

| HTTP | Meaning | FE action |
|------|---------|-----------|
| **200 / 201** | Done, JSON body | Show data |
| **202** | Accepted async (VAPT start, long jobs) | Poll resource; toast “running” |
| **204** | Done, **empty body** | Success — **not** “waiting for authorizer” |
| **400** | Business rule / validation | Show `detail` |
| **401** | Missing/expired JWT or dual-control session | Re-login |
| **403** | Dual-control not configured / wrong slot / no session | Dual-control UX |
| **409** | Conflict (active campaign, active scan, security DB not ready) | Clear blockers / message |
| **422** | Verification failed (assets) | Offer `confirm_ownership` |
| **429** | Rate limited | Backoff |
| **504** HTML (Cloudflare) | Origin too slow | Use async endpoints; never wait on long inline work |

`detail` may be a string **or** an object (`message`, `campaign_id`, `start_error`, `next_steps`, …). Always normalize in the client.

### 2.2 Async rule (staging / Cloudflare)

Long work **must not** block the browser request:

| Feature | Create/start response | Poll |
|---------|----------------------|------|
| Domain create + enum | **201** asset immediately | `GET /assets/discovery/jobs` |
| Discovery jobs | **201** job `pending`/`running` | `GET .../jobs/{id}` |
| Scan jobs | Prefer `run_inline: false` | `GET /scans/jobs/{id}` |
| VAPT start / plan execute | **202** + `async.poll_url` | `GET /vapt/campaigns/{id}` |

---

## 3. Onboarding checklist (product UI)

```text
1. Register / login (company JWT + MFA)
2. Org setup (privacy, OTP) — GET /organizations/me/setup
3. Create initiator + authorizer org users
4. PUT dual-control assignment
5. Dual-control session login
6. Create + bootstrap security_data_storage (Postgres)
7. Create domain assets → wait for domain_enum job
8. VAPT plan → execute → poll campaign
9. Show raw scan_results + correlated findings
```

Security DB is **required** before assets/scans/VAPT.  
`POST /api/v1/db-connections` → `POST .../{id}/test` → `POST .../{id}/bootstrap` (schema **1.4.1+**).

---

## 4. Assets & discovery (inventory UI)

### 4.1 Create domain (async enumeration)

```http
POST /api/v1/assets
Authorization: Bearer <org_jwt>
X-Dual-Control-Session: <session>
Content-Type: application/json

{
  "asset_type": "domain",
  "value": "dev.example.com",
  "name": "Primary domain",
  "criticality": "medium",
  "confirm_ownership": true
}
```

**Expected**: **201** with asset in **seconds** (not minutes).  
Side effect: queues `domain_enum` (subfinder + amass + ffuf/gobuster + soft-404).

**Do not** block the UI on create. Immediately:

```http
GET /api/v1/assets/discovery/jobs?limit=20
```

Poll until latest `domain_enum` for that domain has `status: "completed"` | `"failed"`.

### 4.2 Discovery job types

| `job_type` | Purpose | Typical duration |
|------------|---------|------------------|
| `domain_enum` | Subdomains + directory enum | 1–10+ min |
| `subdomain_enum` | DNS wordlist only | short |
| `dns_enrich` | DNS A/AAAA/CNAME + CDN/origin | short |
| `nmap` | Port scan discovery | medium |
| `apk_analyze` | Mobile APK re-analysis | medium |

Create job:

```http
POST /api/v1/assets/discovery/jobs
{
  "job_type": "domain_enum",
  "config": {
    "domain": "dev.example.com",
    "include_subdomains": true,
    "include_directories": true,
    "dir_tool": "auto",
    "wordlist_key": "seclists_common"
  },
  "run_inline": false
}
```

**Always use `run_inline: false`** behind Cloudflare.

### 4.3 Job status model

```ts
type DiscoveryJobStatus = "pending" | "running" | "completed" | "failed";

interface DiscoveryJob {
  id: number;
  organization_id: number;
  job_type: string;
  status: DiscoveryJobStatus;
  config: Record<string, unknown>;
  result_summary: {
    ok?: boolean;
    domain?: string;
    subdomains?: string[];
    endpoints?: string[];          // validated only (soft-404 filtered)
    priority_endpoints?: string[]; // admin/login/shell-class paths that validated
    tools_used?: string[];         // e.g. ["subfinder","amass","ffuf"]
    assets_upserted?: number;
    errors?: string[];
    method?: string;
  } | null;
  assets_discovered: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}
```

### 4.4 Asset list UI

```http
GET /api/v1/assets?asset_type=domain&is_active=true&limit=50
GET /api/v1/assets?asset_type=web_app&limit=100
GET /api/v1/assets?asset_type=subdomain
```

| `asset_type` | Show as |
|--------------|---------|
| `domain` / `subdomain` | Host inventory |
| `ip_address` | Resolved / edge / origin IPs |
| `web_app` / `api` | URLs / endpoints from dir enum |
| `port_service` | `host:port/proto` from nmap |

**Priority badge**: `metadata.priority === true` or `criticality === "high"` with `metadata.priority_reason` (`high_value_path` | `high_value_label`).

**Sources** (badge/filter): `manual`, `domain_enum`, `subdomain_enum`, `directory_enum`, `dns_enrich`, `nmap`, …

### 4.5 Soft-404 note for FE copy

Directory hits are **filtered** against WAF/Cloudflare catch-alls.  
Empty `endpoints` does **not** mean the job failed — it may mean no distinct paths vs baseline. Show `tools_used` and `errors` from `result_summary`.

---

## 5. Scanner jobs (on-demand scans)

```http
POST /api/v1/scans/jobs
{
  "job_type": "vulnerability_scan",
  "tools": ["network_scan", "dns_scan", "vuln_scan"],
  "target_filter": { "asset_types": ["domain", "subdomain", "web_app", "ip_address"] },
  "run_inline": false
}
```

| Tool key | FE label | Notes |
|----------|----------|--------|
| `network_scan` | Network | YAML + **real nmap** (JSON evidence) |
| `dns_scan` | DNS | SPF/DMARC/CDN enrich |
| `vuln_scan` | Vulnerabilities | YAML framework/server + **nuclei** |
| `nmap` | Nmap only | Structured JSON like nuclei |
| `nuclei` | Nuclei only | Full template JSONL evidence |
| `web` | Web pipeline | Via VAPT `web_scan` step |

**One active scan job per org** → 409 if conflict. Show active job:

```http
GET /api/v1/scans/jobs/active
GET /api/v1/scans/jobs
GET /api/v1/scans/jobs/{id}
POST /api/v1/scans/jobs/{id}/cancel   // cancel pending|queued|running
POST /api/v1/vapt/campaigns/{id}/cancel  // also cancels linked + active scan jobs
GET /api/v1/scans/results?scan_job_id={id}
// Nmap rows: evidence.format === "nmap_terminal_json"
//   evidence.terminal_text = classic -oN text
//   evidence.hosts / evidence.open_ports = structured
//   raw_output = JSON string of the same document
```

### 5.0 Skip already-scanned targets (unless retest)

By default the Scanner Engine **skips** assets that already have coverage from a
**completed** job with overlapping tools (`nmap`↔`network_scan`,
`nuclei`↔`vuln_scan`, …). Coverage is recorded in `result_summary.targets_scanned`
and a lightweight coverage result row.

To force a full re-run:

```http
POST /api/v1/scans/jobs
{
  "tools": ["vuln_scan"],
  "retest": true,
  "target_filter": { "asset_types": ["domain"] }
}
```

Or set `target_filter.retest: true` / campaign `asset_scope.retest: true`.

Job summary includes `skipped_already_scanned` and `skipped_count`.

### 5.1 Cancel a running scan (and VAPT cascade)

Cancelling a **VAPT campaign** cancels:
- all step-linked `scan_job_ids`
- any active job with `initiated_by_name` prefix `vapt:{campaign_id}`
- leftover active org scan jobs (one-active-scan slot)

```http
POST /api/v1/vapt/campaigns/{id}/cancel
{ "reason": "operator stop" }

POST /api/v1/scans/jobs/{id}/cancel
Authorization: Bearer <org_jwt>
X-Dual-Control-Session: <session>   // required after dual-control is configured
Content-Type: application/json

{ "reason": "Stopped by operator" }
```

| Response | Meaning |
|----------|---------|
| **200** | Job `status=cancelled` (idempotent if already cancelled) |
| **404** | Unknown job for this org |
| **409** | Job already `completed` or `failed` |

Effects: frees the one-active-job lock, best-effort Celery `revoke(terminate=True)`, publishes `ScanFailed` with `cancelled=true`. Multi-asset jobs check cancel **between assets** (current tool step may finish first).

**Ops workaround** (if API/worker is down and a row is stuck `running`):

```sql
-- On the org security_data_storage DB (schema usually phantix)
UPDATE phantix.scan_jobs
SET status = 'cancelled',
    completed_at = NOW(),
    updated_at = NOW(),
    error_message = 'Force-cancelled by operator (ops)'
WHERE organization_id = <org_id>
  AND status IN ('pending', 'queued', 'running');
```

Then restart workers if needed: `./start.sh warm`.

### 5.1 Scan result shape (for detail drawers / AI)

```ts
interface ScanResult {
  id: number;
  scan_job_id: number;
  asset_id: number | null;
  tool: string;           // "nmap" | "nuclei" | "yaml_dns" | "dns_enrich" | ...
  severity: string;       // critical|high|medium|low|info
  title: string;
  description: string;
  evidence: Record<string, unknown>; // nmap_terminal_json | port JSON | nuclei-like
  raw_output?: string;    // nmap terminal rows: JSON string of evidence
  created_at: string;
}
```

**Nmap terminal output (JSON)** — primary artifact for FE + reports + findings:

```ts
// title: "Nmap terminal output (JSON) for {target}"
// evidence.format === "nmap_terminal_json"
// raw_output === JSON.stringify(evidence)
{
  tool: "nmap",
  title: "Nmap terminal output (JSON) for 203.0.113.10",
  evidence: {
    format: "nmap_terminal_json",
    type: "nmap",
    target: "203.0.113.10",
    terminal_text: "Starting Nmap ...\nNmap scan report for ...",
    nmap_text: "Starting Nmap ...",
    hosts: [{ address: "203.0.113.10", ports: [] }],
    open_ports: [{ port: 22, protocol: "tcp", service: "ssh" }],
    stats: { host_count: 1, open_port_count: 4, terminal_chars: 1200 }
  },
  raw_output: "{\"format\":\"nmap_terminal_json\",...}"
}
```

Display: use `evidence` or `JSON.parse(raw_output)`; render `evidence.terminal_text` in `<pre>`.  
Filter: `tool==="nmap" && evidence.format==="nmap_terminal_json"`.  
Report section: `nmap_output` (terminal text + structured ports in metadata).

**Nmap port evidence** (structured / AI):

```json
{
  "template-id": "nmap-port-22-tcp",
  "type": "nmap",
  "info": { "name": "Open 22/tcp (ssh)", "severity": "medium", "tags": ["nmap","port-scan","ssh"] },
  "host": "dev.example.com",
  "ip": "1.2.3.4",
  "port": 22,
  "protocol": "tcp",
  "service": "ssh",
  "product": "OpenSSH",
  "version": "8.9",
  "cpe": ["cpe:/a:openbsd:openssh:8.9"],
  "scripts": {},
  "finding_types": ["open_port", "sensitive_port_open", "service_fingerprint"],
  "exploitdb": {
    "validated": true,
    "source": "searchsploit",
    "candidates": [
      { "edb_id": "45233", "title": "...", "url": "https://www.exploit-db.com/exploits/45233" }
    ]
  }
}
```

Also insert **host summary** rows: `template-id: "nmap-host-summary"` with `open_ports[]`.

**UI recommendation**:

- List view: title, severity, tool, asset  
- Detail: pretty-print `evidence` JSON; link Exploit-DB URLs when present  
- Do **not** use only VAPT correlated findings as the “scan results” screen  

---

## 6. VAPT campaigns (assessment UI)

### 6.1 Intelligent plan → execute

```http
POST /api/v1/vapt/plan
{}

POST /api/v1/vapt/plan/execute
{
  "plan_id": "plan_…",
  "start": true
}
```

Success path: **202** with campaign id + optional:

```json
{
  "id": 8,
  "status": "active",
  "async": {
    "execution": "async",
    "poll_url": "/api/v1/vapt/campaigns/8",
    "alert_on_completion": true
  }
}
```

Failure path (400 object):

```json
{
  "detail": {
    "message": "Campaign #7 created as draft but could not start: …",
    "campaign_id": 7,
    "status": "draft",
    "started": false,
    "start_error": "Organization already has an active or paused VAPT campaign",
    "next_steps": ["…"]
  }
}
```

**UI**: If `campaign_id` present but `started: false`, show start_error and link to cancel blockers / start later.

### 6.2 Campaign statuses

```ts
type CampaignStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";
```

| Status | UI |
|--------|-----|
| `active` | Progress (phase, step index) |
| `paused` | Waiting approval / resume |
| `completed` | Results |
| `failed` | Error + step failures |
| `cancelled` | Historical |
| `draft` | Not started — offer Start |

**One active/paused campaign per org.** Cancel before starting another:

```http
POST /api/v1/vapt/campaigns/{id}/cancel
{ "reason": "User cancelled for retest" }
```

Also clear stuck scans: `GET /scans/jobs/active`.

### 6.3 Polling

```http
GET /api/v1/vapt/campaigns
GET /api/v1/vapt/campaigns/{id}          // status, current_phase, steps, totals
GET /api/v1/vapt/campaigns/{id}/findings // CORRELATED only
```

**Correlated findings** ≠ raw scan results.

| Endpoint | Content |
|----------|---------|
| `/vapt/campaigns/{id}/findings` | Attack-path / evidence **correlations** (few rows) |
| `/scans/results` | **All** tool findings (nmap, nuclei, dns, …) |
| Campaign step `output_summary` | Per-step counts (web crawl, proxy_summary, …) |

### 6.4 Correlated finding shape

```ts
interface CorrelatedFinding {
  id: number;
  campaign_id: number;
  title: string;              // e.g. "[pivot_risk] Lateral pivot risk"
  description: string;
  severity: string;
  correlation_type: string;   // attack_path | evidence_correlation
  attack_path: {
    rule_key: string;
    steps: Array<{
      asset_id?: number;
      finding_id?: number;
      title: string;
      severity: string;
      types: string[];
    }>;
    risk_summary: string;
  };
  asset_id: number | null;
  false_positive: boolean;
  requires_human_review: boolean;
  ai_analysis_requested: boolean;
  created_at: string;
}
```

**Tightened rules** (expect fewer noisy rows):

- `pivot_risk` — needs many ports **and** non-web sensitive service  
- `default_port_exposure` — sensitive **non-web** only  
- `exploit_available_path` — fingerprint + Exploit-DB hit  
- `priority_endpoint_exposure` — validated high-value paths  

### 6.5 Campaign steps (progress UI)

From `GET /vapt/campaigns/{id}`:

| Field | Use |
|-------|-----|
| `current_phase` | Human label |
| `current_step_index` | Progress bar |
| steps[].`status` | `pending` \| `running` \| `completed` \| `failed` \| `skipped` |
| steps[].`output_summary` | Counts / scan_job_id / proxy_summary |

Typical intelligent assessment steps: network → DNS → web_scan → vuln → correlate → analyze.

---

## 7. Reports (Reporting Engine)

Full detail: [REPORTING.md](./REPORTING.md).

Reports consolidate VAPT / Risk / Scanner / Asset / Audit / Compliance sections, enrich with CVSS + AI narratives (template fallback if AI offline), and produce multi-format downloads.

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/reports` | Generate (`run_inline` or async Celery) — **no dual-control session required** |
| `GET` | `/api/v1/reports` | List reports for org |
| `GET` | `/api/v1/reports/{id}` | Metadata, sections, `output_files`, `status` |
| `GET` | `/api/v1/reports/{id}/download?format=` | File bytes (`markdown`·`json`·`csv`·`xlsx`·`pdf`·`docx`) |
| `POST` | `/api/v1/reports/export` | Ad hoc: `risks` \| `audit` \| `vapt_findings` \| `tracker` \| `compliance` |
| `GET` | `/api/v1/reports/tracker` | Cross-campaign finding lifecycle |
| `PATCH` | `/api/v1/reports/tracker/{finding_key}` | Status / owner / target fix date |

### Generate

```http
POST /api/v1/reports
Authorization: Bearer <org_jwt>
Content-Type: application/json

{
  "report_type": "vapt_campaign",
  "campaign_id": 12,
  "formats": ["markdown", "json", "xlsx", "pdf", "docx"],
  "run_inline": false
}
```

| Field | Guidance |
|-------|----------|
| `report_type` | `vapt_campaign` (default), `executive`, `compliance`, `tracker` |
| `run_inline` | `true` = wait for completion (OK for md/json); `false` = 200 with `status=generating`, poll until `complete` |
| `formats` | Prefer `markdown`+`json` always; add `xlsx` for remediations, `pdf`/`docx` for client delivery |

**UI pattern (async):**

1. `POST /reports` with `run_inline: false`
2. Poll `GET /reports/{id}` every 3–5s until `status` is `complete` or `failed`
3. Enable download buttons from `output_files` keys (ignore `*_error` keys)
4. `GET /reports/{id}/download?format=pdf` → save blob

Campaign auto-report: when a VAPT campaign completes, backend may auto-queue a report — list reports filtered by `campaign_id` / `report_type=vapt_campaign`.

### Tracker

Use for remediation boards. Status values: `open`, `in_progress`, `fixed`, `accepted`, `false_positive`, `retest_failed`, `regressed`.

---

## 8. Alerts (completion email)

VAPT completion **queues** a client alert; email only works if **org alert SMTP** is configured (separate from OTP `SMTP_*`).

```http
GET /api/v1/alerts/settings
PUT /api/v1/alerts/settings
POST /api/v1/alerts/test
GET /api/v1/alerts/events
```

```json
{
  "alerts_enabled": true,
  "smtp": {
    "enabled": true,
    "host": "smtp-relay.brevo.com",
    "port": 587,
    "username": "...",
    "password": "...",
    "from_email": "support@yourdomain.com",
    "from_name": "Phantix Alerts",
    "use_tls": true
  },
  "email_recipients": ["security@client.com"]
}
```

OTP/login email uses **platform** env SMTP; do not show those credentials in org UI.

---

## 9. Dual-control authorizer UX

| Pattern | Detect | UI |
|---------|--------|-----|
| Operate gate | 403 `required_header` / not assigned | Login as initiator/authorizer |
| **204 on mutation** | Empty success | Toast done — **no** second person |
| Audit pending | `POST /audit/pending` → **201** `status: pending` | Authorizer queue |
| VAPT approval | `approval_status: pending` / step `waiting_approval` | `GET .../approvals` → `POST .../decide` |

See [RBAC_MFA.md](./RBAC_MFA.md).

---

## 10. Staff / admin UI endpoints

| Area | Base |
|------|------|
| Staff login | `POST /api/v1/staff/login` |
| Tooling catalog (billing) | `/api/v1/admin/tooling/*` |
| **Compliance frameworks (upload)** | `POST /api/v1/admin/compliance/frameworks` (+ `/upload` file) |
| **Scanner recon tools** | `GET /api/v1/admin/scanner-tools` |
| Pull images + wordlists | `POST /api/v1/admin/scanner-tools/update` |
| Ensure SecLists | `POST /api/v1/admin/scanner-tools/wordlists/ensure` |
| Discovery nmap settings | `/api/v1/admin/discovery/*` |
| VAPT procedures | `/api/v1/admin/vapt/*` |
| Platform health | `GET /status` (nmap, docker, redis, smtp, …) |

### 9.1 Scanner tools response (admin)

```ts
interface ScannerToolsResponse {
  tools: Array<{
    tool_key: string;       // subfinder, amass, gobuster, ffuf, nuclei, nmap, searchsploit
    name: string;
    purpose: string;        // subdomain | directory | vuln | ...
    docker_image: string | null;
    host_binary: string | null;
    available: boolean;
    docker_available: boolean;
    version: string | null;
    update_action: string;
  }>;
  wordlists: Array<{
    key: string;
    name: string;
    purpose: string;
    path: string;
    present: boolean;
    bytes: number;
    source_url: string | null;
  }>;
  wordlist_root: string;
  notes: string[];
}
```

---

## 11. Suggested FE screens

| Screen | Primary APIs |
|--------|----------------|
| Company login / MFA | `/organizations/login`, `/login/mfa` |
| Org-user login (domain email + OTP) | `/org-users/auth/login` → `/login/mfa` → optional `/login/device` |
| Dual-control unlock | same with `purpose=dual_control` + stable `device_id` |
| Connections wizard | `/db-connections` + bootstrap |
| Inventory | `/assets` + filters + priority badges |
| Discovery activity | `/assets/discovery/jobs` (poll) |
| Scan runner | `/scans/jobs` + `/scans/results` |
| VAPT dashboard | `/vapt/campaigns` |
| Campaign detail | campaign + steps + **two tabs**: Correlations \| Raw findings |
| Compliance | `/compliance/frameworks`, map, profile, assessments |
| **Reports** | `/reports` generate + download + poll async |
| Remediation tracker | `/reports/tracker` |
| Alerts settings | `/alerts/settings` |
| Admin tools health | `/admin/scanner-tools`, `GET /status` |
| Admin compliance catalog | `/admin/compliance/frameworks` (upload JSON / file, toggle active) |

---

## 12. Polling intervals (recommended)

| Resource | Interval | Stop when |
|----------|----------|-----------|
| Discovery job | 3–5 s | `completed` / `failed` |
| Scan job | 3–5 s | `completed` / `failed` / `cancelled` |
| VAPT campaign | 5–10 s | `completed` / `failed` / `cancelled` / `paused` |
| Report generation | 3–5 s | `complete` / `failed` |
| Dual-control session | soft warn at 2 min idle | re-auth |

---

## 13. Error copy helpers

| Backend signal | User-facing copy |
|----------------|------------------|
| Cloudflare 504 HTML | “Request timed out at the edge. The server may still be working — check jobs list.” |
| Active campaign conflict | “Another assessment is running. Cancel or wait before starting a new one.” |
| Active scan conflict | “A scan is already running for this organization.” Use cancel on the active job first. |
| Scan cancel 409 | “This scan already finished (completed/failed).” |
| Security DB not bootstrapped | “Connect and bootstrap the security database first.” |
| Dual-control 403 | “Unlock with initiator or authorizer credentials.” |
| Asset 422 verification | “Ownership could not be auto-verified. Confirm ownership to continue.” |
| Empty domain_enum endpoints | “No distinct paths after WAF filtering — not necessarily a failure.” |

---

## 14. Minimal TypeScript API client sketch

```ts
const api = {
  async orgFetch(path: string, init: RequestInit = {}, tokens: {
    orgJwt: string;
    dcSession?: string;
  }) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${tokens.orgJwt}`);
    if (tokens.dcSession && init.method && init.method !== "GET") {
      headers.set("X-Dual-Control-Session", tokens.dcSession);
    }
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    if (res.status === 204) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html") && res.status >= 500) {
      throw new Error(`Gateway error ${res.status}`);
    }
    const data = ct.includes("json") ? await res.json() : await res.text();
    if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status, data });
    return data;
  },
};
```

---

## 15. Doc map for frontend teams

| Doc | Use when |
|-----|----------|
| **This file** | Primary FE contract |
| [RBAC_MFA.md](./RBAC_MFA.md) | Dual-control / 204 vs pending |
| [ASSET_DISCOVERY.md](./ASSET_DISCOVERY.md) | Asset types, discovery jobs detail |
| [VAPT.md](./VAPT.md) | Campaigns, orchestrator, web pipeline |
| [ALERTS.md](./ALERTS.md) | Client SMTP alerts |
| [REPORTING.md](./REPORTING.md) | Reports, tracker, formats |
| [CONNECTIONS.md](./CONNECTIONS.md) | Security DB purposes |
| [API Testing/PHANTIX_API_TESTING_GUIDE.md](../API%20Testing/PHANTIX_API_TESTING_GUIDE.md) | Curl cookbook |
| [dummy client setup for phantix/README.md](../dummy%20client%20setup%20for%20phantix/README.md) | E2E lab path |
| OpenAPI `/docs` | Exact schemas |

---

*Last updated: July 2026 — domain_enum async, nmap JSON evidence, soft-404 recon, tightened correlation, admin scanner-tools, Reporting Engine phases 1–4.*
