# Phantix Backend – Development Architecture Summary

**Version**: 0.2  
**Date**: July 10, 2026  
**Status**: Active Design Document (implemented baseline + extensions)  
**Audience**: Phantix Development Team  
**Stack**: FastAPI · SQLAlchemy 2 (async) · PostgreSQL · Alembic · asyncpg · Celery · Redis · Docker tools  
**Frontend API contract**: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)

---

## 1. Core Architecture Principles

### 1.1 Hybrid + Privacy-First Model

- Phantix runs the application and tooling (scanners, AI, orchestration) in the cloud.
- Customers provide their own **Dedicated Security Database**.
- **All security data** (assets, tags, history, discovery jobs, scan results, findings) is stored **only** in the customer’s dedicated database under `target_schema` (default `phantix`).
- Phantix **platform DB** holds tenancy, auth, encrypted connection credentials, billing, audit dual-control metadata — **not** the security inventory system of record.
- `CustomerDBConnection` purposes:
  - `config_inspection` — read-only security configuration evaluation
  - `security_data_storage` — full CRUD inside Phantix schema only
  Config-inspection connections may also be recorded as `database_connection` assets.

### 1.2 Data Residency

- Every organization is isolated in its own security DB/schema.
- Asset IDs are **unique per customer database** (BIGSERIAL local to that DB).
- The API connects **dynamically** via the org’s primary `security_data_storage` connection for asset/scan writes.

```text
┌─────────────┐   org JWT    ┌──────────────────────┐
│ Org portal  │─────────────▶│  Phantix Backend     │
└─────────────┘              │  (stateless process) │
                             └──────────┬───────────┘
                    platform DB         │  asyncpg + decrypted creds
              (orgs, connections,       ▼
               dual-control users)  ┌─────────────────────────┐
                                    │ Customer security DB    │
                                    │ phantix.assets / tags / │
                                    │ history / scan_jobs …   │
                                    └─────────────────────────┘
```

---

## 2. Asset Discovery Module

### 2.1 Purpose

Build a comprehensive attack-surface inventory for VM, pentest, and compliance.

### 2.2 Supported Asset Types (MVP)

`domain`, `subdomain`, `ip_address`, `github_repo`, `api`, `port_service`, `mobile_apk`, `database_connection`, `cloud_resource`, `other`

**APK upload**: `POST /api/v1/assets/upload/apk` analyzes and stores the binary in object storage (S3-compatible), then maps a `mobile_apk` asset (metadata + tags) into the security DB.

### 2.3 Asset table (security DB)

Implemented as **`{schema}.assets`** (plural; design-equivalent to `asset`):

| Column | Notes |
|--------|--------|
| `id` | BIGSERIAL — per-tenant local ID |
| `organization_id` | Tenant marker |
| `asset_type`, `value`, `name` | Core identity |
| `metadata` | JSONB flexible |
| `source` | manual, nmap, github, openapi, … |
| `discovered_via_connection_id` | Optional platform connection link |
| `is_verified`, `verification_method` | Manual ownership checks |
| `first_discovered_at`, `last_seen_at` | Timeline |

**Rules**: All rows live only in the dedicated security DB. Automated discovery can mark verified when ownership is established.

### 2.4 Asset tagging (normalized — reporting)

```text
asset_tags (id, organization_id, name, color, description)
asset_tag_assignments (asset_id, tag_id, assigned_at)  PK(asset_id, tag_id)
```

API: `/api/v1/asset-tags` — create/list/delete tags; assign/unassign to assets; filter assets by tags for scan target filters.

### 2.5 Asset history

```text
asset_history (asset_id, organization_id, change_type, previous_value, new_value, changed_by, created_at)
```

Recorded on create/update and tag changes (best-effort; never fails primary write).

### 2.6 Discovery sources (MVP)

| Source | Status |
|--------|--------|
| Manual + verification | ✅ |
| Subdomain enumeration | ✅ |
| Nmap port scanning | ✅ (real nmap; admin flags; Docker-capable executor) |
| GitHub PAT | ✅ |
| OpenAPI / Postman import | ✅ |
| IP resolution & enrichment | Partial (via discovery) |

Security schema version: **1.3.1** (`app/security_schema/ddl.py`) — risk tables + `mobile_apk` inventory type. Re-bootstrap upgrades existing customer DBs.

### 2.7 Risk Assessment & Management

- Tables: `risks`, `risk_assessments`, `risk_treatments`, `risk_history` (security DB only).
- Auto-created/updated from each `scan_result` (deduped by asset + vulnerability key).
- Hybrid score = Likelihood×Impact (normalized) + rules engine (tags, type, findings, exposure).
- **Client ownership only** (`owner_department`); Phantix never owns risks.
- Treatment approve/reject requires dual-control **authorizer** session.
- Residual risk calculated and stored; export JSON/CSV for billable expert review.

See [RISK.md](./RISK.md).

### 2.8 Client alerting daemon

- **Platform DB** tables: `organization_alert_settings`, `alert_events`, `alert_deliveries`.
- **Severity routing (enforced)**:
  - `critical` → email + WhatsApp + Telegram
  - `high` / `medium` / `low` / `info` → **email only**
- **Client SMTP** is per-org (`organization_alert_settings`) and is **not** the Phantix registration OTP SMTP (`SMTP_*` env).
- WhatsApp / Telegram adapters are stubs (`provider=log`) until real APIs are wired.
- Delivery: standalone daemon `python -m app.workers.alert_daemon`, or Celery tasks `phantix.alerts.process_event` / `process_pending`.
- Hooks: scan completion/failure, risk created / critical (extensible via `enqueue_alert`).

See [ALERTS.md](./ALERTS.md).

---

## 3. Scanning Module

### 3.1 Scan job (`scan_jobs`)

| Field | Purpose |
|-------|---------|
| `job_type` | e.g. vulnerability_scan |
| `target_filter` | JSON: tags, asset_types, asset_ids, criticality |
| `tools` | `["nmap"]`, `["nuclei"]`, or both |
| `status` | pending → queued/running → completed/failed |
| `idempotency_key` | Client dedupe |
| `celery_task_id` | Worker correlation |
| `initiated_by_*` | Dual-control / contact attribution |

**Rules**:

- On-demand / manual only (no schedules in MVP).
- **One active job per organization** (`pending|queued|running`) via unique partial index + app check.
- Duplicate `idempotency_key` returns the existing job.

API: `/api/v1/scans/jobs`, `/jobs/active`, `/jobs/{id}/run`, `/results`.

### 3.2 Scan results (`scan_results`)

Structured for **Report** and **AI** consumption: tool, severity, title, description, evidence JSONB, raw_output, asset_id, scan_job_id.

### 3.3 Message queue

- **Celery + Redis** (`app/workers/celery_app.py`, `tasks.py`).
- `run_inline=true` (default) executes in-process for local/MVP.
- `run_inline=false` enqueues `phantix.scan.run_job` when Celery is up.

```bash
celery -A app.workers.celery_app.celery worker -l info
```

### 3.4 Tool execution environment

- `app/services/tool_executor.py`:
  - Prefer **Docker** (`instrumentisto/nmap`, `projectdiscovery/nuclei`)
  - Fall back to host binary for local dev
  - Per-organization asyncio lock (max 1 concurrent tool run per org in-process)

### 3.5 SSRF protection (strict)

`app/services/ssrf_protection.py`:

- Allow schemes: `http` / `https` only (block `file://`, `gopher://`, …)
- Block private/loopback/link-local/CGNAT/`169.254.169.254` metadata
- Resolve DNS and reject if any address is internal (rebinding defense)
- Reject illegal shell characters in targets
- HTTP clients for tools should disable redirects (executor uses tool-native options)

---

## 4. Platform modules (control plane)

| Module | Location | Notes |
|--------|----------|--------|
| Org auth / setup | `/organizations` | Email OTP; company verification modes |
| Dual-control users | `/org-users` | Domain-email OTP identity (`org_user` JWT) + optional dual-control session (3 min idle) |
| Compliance | `/compliance`, `/admin/compliance` | DB knowledge base; staff upload frameworks; client select/map/assess |
| Audit trail | `/audit` | Initiator + authorizer names; login + data-access events; CSV/JSON export |
| DB connections | `/db-connections` | Dual purpose + security schema bootstrap |
| Assets / tags / discovery | `/assets`, `/asset-tags` | Security DB only; APK upload → `mobile_apk` |
| Scans | `/scans` | On-demand jobs + results |
| Risks | `/risks` | Auto from scans; hybrid scoring; client-owned treatments + authorizer approval |
| Client alerts | `/alerts` | Per-org SMTP + WA/TG; severity routing; queue + daemon |
| Billing / tools / support | respective routers | Platform DB |
| Staff admin | `/admin/*` | Separate JWT realm (clients, tooling, compliance frameworks, …) |
| Server ops | `/admin/server/*` | Process mgmt, pool/GC optimize, health score |

---

## 5. Key Non-Functional Requirements

| Requirement | Decision |
|-------------|----------|
| Multi-tenancy | Security data in customer dedicated DB; Phantix processes requests |
| Encryption | Connection secrets & PATs Fernet-encrypted on platform DB |
| Concurrency | 1 active scan job per org; tool lock per org |
| Tool isolation | Docker preferred for Nmap/Nuclei |
| SSRF | Strict allow-list + private IP block + DNS check |
| Reporting / AI | `scan_results` + tagged assets support filters |
| Dual control | Org users assigned initiator/authorizer; domain-email OTP + `X-Dual-Control-Session` for operate; new-device confirm when another session is active |
| Client alerts | Critical → email+WA+TG; else email; client SMTP ≠ OTP SMTP |
| Dual-control audit trail | **Platform DB only** (per org); not customer security DB |

---

## 6. MVP Scope

**In scope**

- Privacy-first hybrid storage model
- Assets + verification + tags + history
- Discovery (manual, subdomain, nmap, github, API import)
- Scan jobs (on-demand) + results storage
- Risk assessment + prioritization
- Client alerting daemon (severity-routed channels)
- Celery/Redis scaffolding
- Docker tool executor + SSRF validation
- Dual-control audit + export

**Out of scope (MVP)**

- Recurring/scheduled scans
- Authenticated scanning
- Cloud connectors (AWS/Azure/GCP)
- Advanced GitHub secret scanning
- Full Report UI (data model supports it)

---

## 7. Implementation map (code)

| Concern | Path |
|---------|------|
| Security DDL 1.2.0 | `app/security_schema/ddl.py` |
| Asset CRUD | `app/services/asset_service.py` |
| Tags / history | `app/services/asset_tag_service.py`, `asset_history_service.py` |
| SSRF | `app/services/ssrf_protection.py` |
| Scan orchestration | `app/services/scan_service.py` |
| Docker tools | `app/services/tool_executor.py` |
| Celery | `app/workers/celery_app.py`, `tasks.py` |
| Alert daemon | `app/workers/alert_daemon.py`, `alert_service.py`, `alert_channels.py` |
| Dual-control sessions | `app/services/org_user_auth_service.py` |

**Bootstrap after upgrade**:
`POST /api/v1/db-connections/{id}/bootstrap` (auto-upgrades when `SCHEMA_VERSION` advances).

---

## 8. Recommended next steps

1. Production Celery deployment + Redis HA
2. Wire real WhatsApp / Telegram providers for critical alerts
3. Nuclei template policy + severity mapping
4. Report service reading `scan_results` + tags
5. Authenticated API scanning
6. Cloud connectors
7. Per-user org login (beyond dual-control session)

---

**Document maintained by**: Phantix Engineering Team
**Last Updated**: July 10, 2026

*Consolidates architectural decisions from July 9–10, 2026 and maps them to the current codebase.*
