# Phantix Backend — Contributor Development Guide

**Audience**: Engineers tracking bugs, fixing features, or onboarding to the modular monolith
**Status**: Living document — keep in sync with `app/_engine_map.py` and `docs/ENGINES.md`
**Last updated**: July 2026

This is the **searchable map of the codebase**: where ownership lives, which database holds what, and how to go from a symptom or ticket to the right files.

---

## Quick navigation (search keywords)

| If you care about… | Go here first |
|--------------------|---------------|
| **Which engine owns X?** | [`app/_engine_map.py`](../app/_engine_map.py) · [`docs/ENGINES.md`](./ENGINES.md) · `GET /api/v1/engines` |
| **HTTP route / OpenAPI** | [`app/main.py`](../app/main.py) · `app/engines/*/api/routes.py` · `/docs` |
| **Business logic** | `app/engines/<engine>/services/` |
| **Platform DB models** | `app/engines/*/models/` · registry `app/models/__init__.py` · Alembic `alembic/versions/` |
| **Customer security inventory** | `app/security_schema/ddl.py` · `app/shared/database/security_db.py` |
| **Auth (org / staff / dual-control)** | `app/core/security.py` · `dependencies.py` · `staff_dependencies.py` · `org_user_dependencies.py` |
| **Config / env** | `app/core/config.py` · `.env.example` |
| **Background jobs** | `app/workers/` · Celery tasks in `tasks.py` |
| **Cross-engine events** | `app/bus/` · `app/bus/domain_events.py` · Architecture Vault `15 - Event Contracts.md` |
| **Compliance mapping** | [`docs/COMPLIANCE.md`](./COMPLIANCE.md) · `app/engines/compliance_engine/` · `/api/v1/compliance` |
| **Audit trail vs dual-control** | [`docs/AUDIT.md`](./AUDIT.md) · trail: `audit_engine` · pending/roles: `dual_control_service` |
| **Developer logs / per-org issues** | [§ Developer logs](#developer-logs-per-organization) · `GET /api/v1/admin/logs` · `GET /api/v1/logs` · `app/shared/logging/` |
| **Concurrency / multi-tenant scale** | `CONCURRENCY_ANALYSIS.md` · `MULTI_TENANT_SCALING_PLAN.md` · Redis locks · security pools · credential cache |
| **Architecture decisions** | `ARCHITECTURE_MIGRATION_GUIDE.md` · `Phantix Architecture Vault/` |
| **Local run / Docker** | [`docs/LOCAL_DEV.md`](./LOCAL_DEV.md) · `docker-compose.yml` · `README.md` |
| **Migrations** | [`docs/MIGRATIONS.md`](./MIGRATIONS.md) · `alembic upgrade head` |

---

## 1. Mental model (read this once)

Phantix Backend is a **modular monolith**:

- **One deployable process** (FastAPI + optional Celery workers / alert daemon).
- **Two data planes**:
  1. **Platform DB** (`DATABASE_URL`) — tenancy, auth, billing, dual-control audit, VAPT campaigns, alerts settings.
  2. **Customer security DB** (per org, `security_data_storage`) — assets, scans, risks, tags, history. Bootstrapped via `app/security_schema/ddl.py`.
- **Engines** are domain boundaries (not microservices). Prefer fixing inside the owning engine; cross-domain side effects go through `app/bus` / `app/bus/domain_events.py`.

```text
Client / Staff UI
      │  JWT (org type=access | staff type=staff)
      ▼
 app/main.py  ── mounts engines via app/engines/registry.py
      │
      ├─► Control Plane, Asset, Scanner, VAPT, Risk, Alert, Audit, Ops, …
      │
      ├─► Platform DB (SQLAlchemy async)
      └─► Security DB (asyncpg, dynamic per-org credentials)
```

**Golden rules**

1. Security inventory **never** goes into a customer production/business DB.
2. Dual-control **audit trails** live on the **platform DB** only.
3. Do not import another engine’s internals — use bus events or the Shared SDK (`app/shared/`).
4. New product work belongs to a registered engine (`register_engine` / `app/engines/<id>/`).

---

## 2. How to find “who owns this bug?”

### Step A — Name the domain

Use the symptom table below, or:

```bash
# Runtime: list engines + status
curl -s http://localhost:8000/api/v1/engines | jq '.engines[] | {id,status,description}'

# One engine
curl -s http://localhost:8000/api/v1/engines/vapt_engine | jq .

# Living code ownership map
rg "scan_service|asset_service|alert_service" app/_engine_map.py
```

### Step B — Follow the API path

1. Open Swagger: `http://localhost:8000/docs` or `GET /api/v1/openapi.json`.
2. Note the path prefix (`/assets`, `/scans`, `/vapt`, `/audit`, `/admin/...`).
3. Find the mount in `app/engines/<engine>/api/routes.py` (preferred) or `app/routers/`.
4. Follow into the service the router calls.

### Step C — Confirm data plane

| Kind of data | Where it lives | Typical code |
|--------------|----------------|--------------|
| Org login, staff, billing, support tickets | Platform DB | `app/models/organization.py`, `billing.py`, … |
| Dual-control users, sessions, audit events | **Platform DB** | `app/models/audit.py`, `organization_user.py` |
| Client alert SMTP / queue | Platform DB | `app/models/alerts.py` |
| VAPT campaigns, approvals, schedules | Platform DB | `app/models/vapt.py` |
| Assets, tags, discovery, scan_jobs, risks | **Security DB** | `app/security_schema/ddl.py` + services via `security_db_client` |
| APK binaries | Object storage (`OBJECT_STORAGE_BUCKET_APK`) | `app/shared/storage/`, `app/engines/asset_engine/adapters/apk_service.py` |

---

## 3. Engine → problem → code map

Search by engine name, path, or symptom.

### Control Plane (`control_plane`)

| Symptom / ticket | Primary code |
|------------------|--------------|
| Register / login / JWT | `app/routers/organizations.py` · `organization_service.py` · `app/core/security.py` |
| Org setup, email OTP, company verify | `org_setup_service.py` · `otp_service.py` · `company_verification.py` · docs `ORG_SETUP.md` |
| Customer DB connections / bootstrap | `customer_db_connections.py` · `customer_db_service.py` · `security_schema_bootstrap.py` · docs `CONNECTIONS.md` |
| Org users / dual-control assignment | `org_users.py` · `organization_user_service.py` · `org_user_auth_service.py` |
| Staff login / admin clients | `staff.py` · `admin_clients.py` · `staff_service.py` |
| Billing / tools catalog | `billing.py` · `tools.py` · `admin_billing.py` · `admin_tooling.py` |
| Support tickets | `support.py` · `admin_support.py` |
| Nmap admin flags | `admin_discovery.py` · `discovery_settings_service.py` |

**Mount**: `app/engines/control_plane/api/routes.py`

---

### Asset Engine (`asset_engine`)

| Symptom / ticket | Primary code |
|------------------|--------------|
| Asset CRUD / verification | `routers/assets.py` · `asset_service.py` · `asset_verification.py` |
| Tags / history | `asset_tags.py` · `asset_tag_service.py` · `asset_history_service.py` |
| GitHub import | `github_connector.py` · `integration_service.py` |
| OpenAPI / Postman import | `api_import_service.py` |
| APK upload | `apk_service.py` · `POST /assets/upload/apk` |
| Discovery jobs (subdomain, nmap) | `discovery_service.py` · docs `ASSET_DISCOVERY.md` |

**Security schema**: `assets`, `asset_tags`, `discovery_jobs` in `ddl.py`
**Mount**: `app/engines/asset_engine/api/routes.py`

---

### Scanner Engine (`scanner_engine`)

| Symptom / ticket | Primary code |
|------------------|--------------|
| Scan job create / one-active-per-org | `routers/scans.py` · `scan_service.py` |
| Nmap / Nuclei execution | `tool_executor.py` · `nmap_service.py` |
| APK as scan tool | `apk_service.py` + scan path in `scan_service.py` |
| SSRF / target validation | `ssrf_protection.py` |
| Celery scan worker | `app/workers/tasks.py` → `phantix.scan.run_job` |
| ScannerInterface (adapters target) | `app/engines/scanner_engine/interfaces/scanner.py` |

**Security schema**: `scan_jobs`, `scan_results`
**Docs**: architecture § scanning · `docs/architecture.md`
**Mount**: `app/engines/scanner_engine/api/routes.py`

---

### VAPT Engine (`vapt_engine`)

| Symptom / ticket | Primary code |
|------------------|--------------|
| Campaign CRUD / start / pause / resume | `app/engines/vapt_engine/services/campaign_manager.py` · `api/campaigns.py` |
| Procedure catalog | `procedures/builtin.py` · `services/procedure_resolver.py` |
| Step execution (scan/correlate/analyze/wait) | `services/step_executor.py` |
| Correlation rules | `correlation/engine.py` · `correlation/rules/builtin.py` |
| Complexity / AI gate | `analysis/complexity_classifier.py` |
| Dual-control approvals (platform DB) | `services/multi_party_approval.py` · `api/approvals.py` |
| Schedules / Celery Beat | `services/scheduler_service.py` · `tasks.py` (`phantix.vapt.*`) |
| Burp (stub until tooling) | `adapters/burp_adapter.py` |
| Mining / consent | `correlation/miner.py` · `PUT /vapt/settings` |

**Platform tables**: `vapt_*` in `app/models/vapt.py` · migrations `i9d0e1f2a3b4`, `j0e1f2a3b4c5`
**Docs**: [`docs/VAPT.md`](./VAPT.md) · `VAPT_ENGINE_IMPLEMENTATION_GUIDE.md`
**Mount**: `app/engines/vapt_engine/api/routes.py`

---

### Risk Engine (`risk_engine`)

| Symptom / ticket | Primary code |
|------------------|--------------|
| Auto-risk from scan results | `risk_service.py` |
| Scoring / prioritization | `risk_scoring.py` · `risk_prioritization.py` |
| Treatments / authorizer approve | `routers/risks.py` |
| Export | risk export endpoints in `risks` router |

**Security schema**: `risks`, `risk_treatments`, `risk_history`, …
**Docs**: [`docs/RISK.md`](./RISK.md)

---

### Alert Engine (`alert_engine`)

| Symptom / ticket | Primary code |
|------------------|--------------|
| Severity → email / WA / Telegram | `alert_service.py` (`channels_for_severity`) |
| Client SMTP (not OTP SMTP) | `alert_channels.py` · org settings API |
| Queue / deliveries | models `alerts.py` · `alert_events` / `alert_deliveries` |
| Daemon | `python -m app.workers.alert_daemon` · Celery `phantix.alerts.*` |

**Docs**: [`docs/ALERTS.md`](./ALERTS.md)
**Invariant**: Platform OTP uses env `SMTP_*`; client alerts use per-org SMTP.

---

### Audit Engine (`audit_engine`)

| Symptom / ticket | Primary code |
|------------------|--------------|
| Dual-control roles / pending / authorize | `audit_service.py` · `routers/audit.py` |
| Immutable trail / export | `audit_events` · `GET /audit/export` |
| Org user sessions | `org_user_auth_service.py` |

**Storage invariant**: **Platform DB only** (per `organization_id`). Never customer security DB.
**Docs**: [`docs/AUDIT.md`](./AUDIT.md)

---

### Operations Engine (`operations_engine`)

| Symptom / ticket | Primary code |
|------------------|--------------|
| Server health score / GC / pool | `server_ops_service.py` · `admin_server.py` |
| Public status / readiness | `status_service.py` · `GET /status` |
| Liveness | `GET /health` in `main.py` |

**Docs**: [`docs/SERVER_OPS.md`](./SERVER_OPS.md)

---

### Scaffold engines (not fully productized)

| Engine | Where to start | Notes |
|--------|----------------|--------|
| **AI** | `app/engines/ai_engine/` · `GET /engines/ai/status` | Background workers only; no blocking API |
| **Compliance** | `app/engines/compliance_engine/` · platform KB tables + staff upload | Seeds + `POST /admin/compliance/frameworks`; client `/compliance/*` |
| **Reporting** | `app/engines/reporting_engine/` | Lift exports from risk/audit later |

---

## 4. Symptom → fix checklist (common issues)

| Symptom | Likely cause | Where to look |
|---------|--------------|---------------|
| 401/403 on org API | Wrong JWT type or expired token | `security.py` · `access` / `org_user` / `staff` |
| Org-user login 401 | Email not on org domain or not registered | `org_user_auth_service.resolve_org_user_for_domain_login` |
| New-device gate (no token) | Active session on another browser | `POST /org-users/auth/login/device` · `device_fingerprint` |
| Dual-control 401 | Session idle > 3 min or missing header | `org_user_dependencies.py` · `X-Dual-Control-Session` |
| 409 “active scan” | One active scan job per org | `scan_service.py` unique/active check |
| 409 security DB | No bootstrap / wrong connection purpose | `security_db_client.py` · `CONNECTIONS.md` |
| Scan finds nothing / SSRF error | Target blocked | `ssrf_protection.py` |
| Nmap flags wrong | Admin discovery settings | `admin_discovery` · `nmap_service.py` |
| Alerts not delivered | Daemon/Celery down or client SMTP off | `alert_daemon.py` · org `/alerts/settings` |
| Critical not on WA/TG | Channel policy | `channels_for_severity` — non-critical email only |
| OTP email vs client alert mix-up | Two SMTP systems | OTP: env `SMTP_*` · Alerts: org settings |
| Migration failed | Platform Alembic head | `alembic current` · `docs/MIGRATIONS.md` |
| Security table missing | Schema version drift | `SCHEMA_VERSION` in `ddl.py` · re-bootstrap connection |
| VAPT stuck `pending_approval` | Dual-control not approved | `/vapt/approvals/{id}/decide` then `/start` |
| VAPT schedule not firing | Beat not running / blackout / maintenance | Celery beat · `PLATFORM_MAINTENANCE` · `vapt_schedules` |
| Cross-engine side effect missing | No bus publish/subscribe | `app/bus/` · `app/bus/domain_events.py` |
| Import cycle / wrong engine | Leaked cross-engine import | Prefer `app.shared` or bus |

---

## 5. Directory reference (searchable tree)

```text
app/
  main.py                 # Entrypoint: lifespan, health/status, engine mounts
  _engine_map.py          # Ownership map (update when moving code)
  core/                   # config, JWT, encryption, Depends()
  db/                     # engine, session, migration helpers
  models/                 # Platform SQLAlchemy models
  schemas/                # Pydantic request/response (many still shared)
  routers/                # HTTP handlers (legacy home; mounted by engines)
  services/               # Business logic (legacy home; migrating to engines)
  engines/                # Domain packages (target architecture)
    registry.py           # list/register engines, mount routes
    meta.py               # GET /api/v1/engines
    <engine_id>/
      api/routes.py       # Route mounts for this engine
      services/           # Engine-local logic (when migrated)
      events/catalog.py   # Publishes / subscribes
      docs/README.md      # MUST NOT + pointers
  bus/                    # Engine Bus (publish/subscribe)
  shared/                 # Shared SDK facades
  security_schema/ddl.py  # Customer security DB DDL + SCHEMA_VERSION
  workers/
    celery_app.py         # Celery + beat schedule
    tasks.py              # scan, alerts, vapt, bus fan-out
    alert_daemon.py       # Standalone alert poller
alembic/versions/         # Platform schema only
docs/                     # Product & ops docs (this guide)
tests/                    # pytest
Phantix Architecture Vault/  # Specs & event contracts
ARCHITECTURE_MIGRATION_GUIDE.md
VAPT_ENGINE_IMPLEMENTATION_GUIDE.md
```

---

## 6. Runtime tools for tracking issues

| Tool | Use |
|------|-----|
| `GET /health` | Process up? |
| `GET /status` | DB, Redis, migrations, engines, route inventory |
| `GET /api/v1/engines` | Engine registry + MUST NOT lists |
| `GET /api/v1/admin/bus/events` | Event catalog + in-process subscribers |
| `GET /api/v1/admin/server/overview` | Staff: CPU/mem/pool/recommendations |
| Swagger `/docs` | Reproduce API contract |
| Logs (process) | `phantix.*` loggers (e.g. `phantix.app`, `phantix.vapt`, `phantix.bus`) |
| Logs (per org, visit) | **`GET /api/v1/admin/logs?organization_id=`** · **`GET /api/v1/logs`** |

```bash
# Tests for a domain
pytest tests/test_vapt_engine.py tests/test_alerts.py tests/test_org_logging.py -q

# Ownership grep
rg -n "def create_scan_job|enqueue_alert|create_campaign" app/

# Platform migration state
alembic current && alembic heads
```

---

## Developer logs (per organization)

**Purpose**: Track issues by client/organization with a stable `issue_id`. Contributors and support visit the APIs below; each org also keeps a copy in its **security database**.

### Where logs live

| Store | Table | Role |
|-------|--------|------|
| **Platform DB** | `org_application_logs` | Staff-searchable mirror (filter by `organization_id`) |
| **Org security DB** | `{schema}.application_logs` | Client SoR copy (bootstrap schema **1.4.0+**) |
| **Process stdout** | `phantix.app` logger | Always (even if DBs fail) |

### Visit / query

```http
# Staff (support/admin) — platform mirror (fast)
GET /api/v1/admin/logs?organization_id=42&level=error&limit=50
Authorization: Bearer <staff JWT>

# Staff — org security DB SoR
GET /api/v1/admin/logs?organization_id=42&source=security_db

# Staff — full timeline for one issue
GET /api/v1/admin/logs/issues/ISS-42-A1B2C3D4?organization_id=42

# Client (org JWT) — own logs
GET /api/v1/logs
GET /api/v1/logs/issues/ISS-42-A1B2C3D4

# Record a diagnostic note
POST /api/v1/admin/logs?organization_id=42
POST /api/v1/logs
{ "message": "…", "level": "error", "engine": "scanner_engine", "category": "scan" }
```

Every HTTP response includes **`X-Correlation-ID`** (pass the same header to group related work).

### Emit logs from code

```python
from app.shared.logging import log_event, bind_logger, generate_issue_id

# Inside an async service with platform AsyncSession:
await log_event(
    platform_db,
    organization_id,
    message="Scan job failed: nmap binary missing",
    level="error",
    engine="scanner_engine",
    category="scan",
    context={"scan_job_id": job_id},
)
# Returns { issue_id, storage_targets, correlation_id, … }
# storage_targets e.g. "platform+security_db"
```

**Code map**

| Piece | Path |
|-------|------|
| Shared SDK | `app/shared/logging/` |
| Write/list service | `app/engines/operations_engine/services/log_service.py` |
| HTTP routes | `app/engines/operations_engine/api/logs.py` |
| Platform model | `app/engines/operations_engine/models/org_application_log.py` |
| Security DDL | `app/security_schema/ddl.py` (`application_logs`, schema 1.4.0) |
| Platform migration | `alembic/versions/l2f3a4b5c6d7_org_application_logs.py` |
| Middleware | `app/core/logging_middleware.py` |

**Rules**

1. Always pass `organization_id` for client issues (never mix orgs).
2. Prefer `issue_id` reuse when continuing the same investigation.
3. Security inventory DB only — never write logs into a customer production/business DB.
4. Log writes must not break product flows (`log_event` swallows storage errors).

---

## 7. Fix workflow (recommended)

1. **Reproduce** with `/docs` or a failing test.
2. **Identify engine** via path, `_engine_map.py`, or symptom table.
3. **Confirm data plane** (platform vs security DB).
4. **Patch** in the owning service/router/engine package.
5. **If cross-engine**: publish via `app.bus` / `domain_events` — do not deep-import foreign services for new code.
6. **Log the failure** with `app.shared.logging.log_event(..., organization_id=…)` so staff can find it under `/api/v1/admin/logs`.
7. **Migrations**: platform → new Alembic revision; security inventory → bump `SCHEMA_VERSION` + bootstrap DDL.
8. **Tests**: unit near the module + route auth smoke if API changed.
9. **Docs**: update the relevant `docs/*.md` and this guide’s map if ownership moved.

---

## 8. Doc index (by topic)

| Topic | Document |
|-------|----------|
| Overview / quick start | [`README.md`](../README.md) |
| Engines list | [`docs/ENGINES.md`](./ENGINES.md) |
| Architecture | [`docs/architecture.md`](./architecture.md) |
| Migration phases | [`ARCHITECTURE_MIGRATION_GUIDE.md`](../ARCHITECTURE_MIGRATION_GUIDE.md) |
| Architecture Vault (specs) | [`Phantix Architecture Vault/`](../Phantix%20Architecture%20Vault/) |
| Connections / security DB | [`docs/CONNECTIONS.md`](./CONNECTIONS.md) |
| Org setup / OTP | [`docs/ORG_SETUP.md`](./ORG_SETUP.md) |
| Assets | [`docs/ASSET_DISCOVERY.md`](./ASSET_DISCOVERY.md) |
| Risk | [`docs/RISK.md`](./RISK.md) |
| Alerts | [`docs/ALERTS.md`](./ALERTS.md) |
| Audit / dual control | [`docs/AUDIT.md`](./AUDIT.md) |
| VAPT | [`docs/VAPT.md`](./VAPT.md) · [`VAPT_ENGINE_IMPLEMENTATION_GUIDE.md`](../VAPT_ENGINE_IMPLEMENTATION_GUIDE.md) |
| Server ops | [`docs/SERVER_OPS.md`](./SERVER_OPS.md) |
| Local dev | [`docs/LOCAL_DEV.md`](./LOCAL_DEV.md) |
| Migrations | [`docs/MIGRATIONS.md`](./MIGRATIONS.md) |
| Staging (Hetzner/Coolify) | [`Phantix_Hetzner_Coolify_Tailscale_Staging_Setup.md`](../Phantix_Hetzner_Coolify_Tailscale_Staging_Setup.md) |

---

## 9. Auth realms (do not mix)

| Realm | Login | Token | Use for |
|-------|--------|--------|---------|
| Organization (company) | `POST /api/v1/organizations/login` (+ MFA) | JWT `type=access` | Company portal / bootstrap |
| Organization user | `POST /api/v1/org-users/auth/login` (domain email + OTP; optional `/login/device`) | JWT `type=org_user` | Named user reads + data-access audit |
| Dual-control actor | Same org-user login with `purpose=dual_control` | Header `X-Dual-Control-Session` (3‑min idle) | Initiate / authorize mutations |
| Staff | `POST /api/v1/staff/login` | JWT `type=staff` | `/admin/*`, server ops |

Company/org-user JWTs **cannot** call staff routes and vice versa. See [RBAC_MFA.md](./RBAC_MFA.md).  
**Staff / admin / support application development**: [STAFF_PORTAL.md](./STAFF_PORTAL.md).  
**Security hardening & implementation roadmap**: [SECURITY_AND_BACKLOG.md](./SECURITY_AND_BACKLOG.md).

---

## 10. Adding or fixing across engines

| Task | Action |
|------|--------|
| New feature | Assign an engine; put code under `app/engines/<id>/` when practical; register mounts in `api/routes.py` |
| New event | PascalCase in `app/bus/contracts.py` + engine `events/catalog.py` |
| New platform table | Model in `app/models/` + Alembic revision |
| New security table/column | `security_schema/ddl.py` + bump `SCHEMA_VERSION` |
| New 11th+ engine | Package under `app/engines/` + add to `load_official_engines()` |
| Temporary cross-call | Prefer `app.bus.domain_events` + engine subscribers |

---

## 11. Contribution conventions

- Prefer **small, domain-scoped PRs** (one engine or one migration theme).
- Preserve **MUST NOT** lists in engine `__init__.py` / docs.
- Keep secrets out of git; use `.env.example` for new settings.
- Dual-control and VAPT approvals always stay on the **platform DB**.
- When in doubt about ownership, update or consult `app/_engine_map.py`.

---

**Maintainer note**: If you move a service into an engine package, update this guide’s section 3, `ENGINE_MAP`, and `docs/ENGINES.md` in the same PR so search stays accurate.
