# Legacy Migration Plan — Flat Services/Routers to Engine Folders

**Version**: 1.2
**Date**: July 14, 2026
**Status**: **Migration complete** — flat product packages removed; engines + bus + Shared SDK are SoR
**Audience**: Phantix Backend Engineers
**Prerequisite Reading**: `ARCHITECTURE_MIGRATION_GUIDE.md`, `Phantix Architecture Vault/02 - Engine Registry.md`, `Phantix Architecture Vault/03 - Control Plane.md`

### Completion summary (2026-07-14)

| Area | State |
|---|---|
| Product services / routers / schemas / models | Live under `app/engines/{engine}/` |
| Shared SDK (`security_db`, schema bootstrap) | `app/shared/database/` |
| Flat `app/services`, `app/routers`, `app/schemas` | **Deleted** |
| Flat `app/models` | Registry package only (`__init__.py` imports engine models for Alembic) |
| Domain events | `app/bus/domain_events.py` (pure publishers; no engine service imports) |
| Alert side-effects | Alert Engine subscribers: ScanCompleted/Failed, RiskCreated/Critical, ReportGenerated/Archived, AlertQueued |
| Route mounting | Engine Registry — all product engines loaded (~209 routes) |
| Tests | Engine paths + `import app.models` in conftest; suite green |
| Remaining intentional cross-reads | Reporting consolidator reads peer engines (assemble-only); audit trail write from API layers; ops may invoke alert batch drain |

---

## Table of Contents

1. [What This Plan Is](#1--what-this-plan-is)
2. [Current State](#2--current-state)
3. [Target State](#3--target-state)
4. [Migration Strategy — Incremental, Not Big-Bang](#4--migration-strategy--incremental-not-big-bang)
5. [Engine-by-Engine File Map](#5--engine-by-engine-file-map)
6. [Phase 1: Audit & Shared SDK Hardening](#6--phase-1-audit--shared-sdk-hardening)
7. [Phase 2: Core Engines Migration](#7--phase-2-core-engines-migration)
8. [Phase 3: Remaining Engines + Cleanup](#8--phase-3-remaining-engines--cleanup)
9. [Phase 4: Cross-Engine Import Replacement](#9--phase-4-cross-engine-import-replacement)
10. [Common Migration Patterns](#10--common-migration-patterns)
11. [Rollout & Testing Strategy](#11--rollout--testing-strategy)
12. [Files to Delete After Migration](#12--files-to-delete-after-migration)

---

## 1. — What This Plan Is

This is an implementation plan for migrating the remaining 43 flat service files, 21 flat router files, and associated models/schemas into their designated engine folders under `app/engines/`. The engine folders already exist with the Phase 4 folder standard — what's missing is the code.

This is not a refactoring. It's a **file move with import path updates and cross-engine dependency cleanup**. Business logic stays exactly as it is. The only changes are:

1. Files move from `app/services/`, `app/routers/`, `app/models/`, `app/schemas/` to `app/engines/{engine}/`
2. Import paths update to reflect new locations
3. Cross-engine direct imports get replaced with bus events or Shared SDK imports
4. Flat directories get removed after all consumers are migrated

---

## 2. — Current State

### What Lives in Flat Directories

```
app/
    services/         → 43 files (42 .py + _events.py)
    routers/          → 21 files (all .py)
    models/           → 14 files (all .py, excluding vapt.py which already lives in VAPT Engine)
    schemas/          → 21 files (all .py)
```

### What Lives in Engine Folders (post-migration)

```
app/engines/
    control_plane/     → organizations, org-users, staff, billing, support, tools, admin/*
    asset_engine/      → assets, tags, discovery, APK/GitHub/API adapters
    scanner_engine/    → scans, nmap/tool_executor adapters, SSRF validators
    risk_engine/       → risks + scoring + prioritization + bus subscribers
    alert_engine/      → alerts + channels + bus subscribers
    audit_engine/      → immutable audit trail API + models
    operations_engine/ → admin server ops + status_service
    vapt_engine/       → campaigns, procedures, correlation, schedules
    reporting_engine/  → reports, tracker, enrichment, renderers
    ai_engine/         → scaffold
    compliance_engine/ → scaffold
```

### Pre-migration problem (resolved)

Previously flat files held product logic while engine folders were scaffolds. **Resolved**: logic lives under engines; flat modules re-export for compatibility.

### File Ownership Map (Flat → Engine)

| Engine | Flat Services | Flat Routers | Flat Models | Flat Schemas |
|---|---|---|---|---|
| **control_plane** | 19 | 12 | 10 | 9 |
| **asset_engine** | 7 | 2 | 1 | 2 |
| **scanner_engine** | 7 | 1 | 0 | 1 |
| **risk_engine** | 3 | 1 | 0 | 1 |
| **alert_engine** | 2 | 1 | 1 | 1 |
| **audit_engine** | 1 | 1 | 1 | 1 |
| **operations_engine** | 1 | 1 | 0 | 1 |

**Total**: 40 services + 19 routers + 14 models + 16 schemas = 89 files to migrate
(Excluding `vapt.py` model which is already in VAPT Engine, and excluding `__init__.py`, `_events.py`, `connection_options.py` which are handled differently.)

---

## 3. — Target State

```
app/
    engines/
        control_plane/
            api/              ← organizations.py, org_users.py, db_connections.py, staff.py, ...
            services/         ← organization_service.py, otp_service.py, staff_service.py, ...
            repositories/     ← data access layer (extracted from services)
            models/           ← organization.py, organization_user.py, platform_staff.py, ...
            schemas/          ← organization.py, org_setup.py, staff.py, ...
            events/           ← catalog.py, publishers.py, subscribers.py
            adapters/         ← external integrations
            interfaces/       ← abstract contracts
            validators/       ← domain validation
            workers/          ← Celery tasks
            tasks/            ← task definitions
            cache/
            tests/
            docs/
        asset_engine/
            api/              ← assets.py, asset_tags.py
            services/         ← asset_service.py, asset_tag_service.py, ...
            models/           ← (security DB — no platform models)
            schemas/          ← assets.py, tags.py
            ...
        scanner_engine/
            api/              ← scans.py
            services/         ← scan_service.py, tool_executor.py, ...
            interfaces/       ← scanner.py (already exists)
            adapters/         ← nmap_adapter.py, nuclei_adapter.py, apk_adapter.py
            ...
        risk_engine/
            api/              ← risks.py
            services/         ← risk_service.py, risk_scoring.py, ...
            ...
        alert_engine/
            api/              ← alerts.py
            services/         ← alert_service.py, alert_channels.py
            ...
        audit_engine/
            api/              ← audit.py
            services/         ← audit_service.py
            ...
        operations_engine/
            api/              ← admin_server.py
            services/         ← server_ops_service.py
            ...
        vapt_engine/          ← already fully migrated
        reporting_engine/     ← Phase 4 of Reporting Engine plan
        ai_engine/            ← Phase 5 (post-data-residency decision)
        compliance_engine/    ← Phase 5
    services/                 ← DELETED (after migration complete)
    routers/                  ← DELETED (after migration complete)
    models/                   ← DELETED or reduced to shared-only
    schemas/                  ← DELETED or reduced to shared-only
    shared/                   ← SDK (already exists, used by all engines)
    bus/                      ← already exists, used by all engines
```

---

## 4. — Migration Strategy — Incremental, Not Big-Bang

### Core Principle

> Migrate one engine at a time. Each engine migration includes its services, routes, models, and schemas in a single atomic move. The app stays working at every step.

### Engine Migration Order

The migration is ordered by **dependency count** — engines with the fewest cross-engine imports move first. This minimizes risk and validates the pattern on the simplest cases first.

| Order | Engine | Dependencies on Other Engines | Reason |
|---|---|---|---|
| 1 | **operations_engine** | None (staff-only, self-contained) | Easiest — no cross-engine imports to untangle |
| 2 | **alert_engine** | Subscribes to events from others | Simple — mostly receives, doesn't call out |
| 3 | **asset_engine** | None (owns asset data exclusively) | Clean boundary — other engines read from it |
| 4 | **scanner_engine** | Asset Engine (reads assets as targets) | Mostly reads from Asset Engine |
| 5 | **risk_engine** | Scanner Engine (consumes scan results) | Consumes from Scanner, feeds Reporting |
| 6 | **audit_engine** | Control Plane (pending actions stay in CP) | Split needed: immutable trail moves here |
| 7 | **control_plane** | Everything (auth used by all engines) | Last — highest risk, most dependencies |
| 8+ | reporting/ai/compliance | Eventually | These are new engine builds, not migrations |

### How Each Engine Migration Works

```
Step 1: Create real files in the engine folder
         └── Copy logic from flat files into app/engines/{engine}/
         └── Update imports to use SDK/bus instead of flat cross-references
         └── Keep flat files in place (with deprecation warning)

Step 2: Update routing
         └── Update engine's api/routes.py to mount the real routes
         └── Registry mounts engine routes at correct /api/v1/ paths
         └── Flat router files still work (no sudden breakage)

Step 3: Update all imports
         └── Any code importing from flat locations updates to engine paths
         └── Flat files become thin re-export wrappers during transition

Step 4: Remove flat files
         └── After all consumers are migrated, delete the flat file
         └── Update test imports
         └── Done
```

---

## 5. — Engine-by-Engine File Map

### 5.1 operations_engine (Migration #1 — Easiest)

**Current location** → **Target location**

| Current Flat File | Target Engine File | Notes |
|---|---|---|
| `routers/admin_server.py` | `engines/operations_engine/api/` | Replace scaffold routes.py |
| `services/server_ops_service.py` | `engines/operations_engine/services/` | Direct move |
| `schemas/server_ops.py` | `engines/operations_engine/schemas/` | Direct move |

**Cross-engine imports to resolve:**
- None. Operations Engine is entirely staff-facing, reads system state, no dependencies on other engines.

### 5.2 alert_engine (Migration #2)

| Current Flat File | Target Engine File | Notes |
|---|---|---|
| `routers/alerts.py` | `engines/alert_engine/api/` | Replace scaffold |
| `services/alert_service.py` | `engines/alert_engine/services/` | Direct move |
| `services/alert_channels.py` | `engines/alert_engine/services/` | Direct move |
| `models/alerts.py` | `engines/alert_engine/models/` | Direct move |
| `schemas/alerts.py` | `engines/alert_engine/schemas/` | Direct move |

**Cross-engine imports to resolve:**
- Alert Engine is mostly a receiver — other engines call `enqueue_alert()`. This should go through the bus instead.
- `enqueue_alert()` becomes a bus publisher call. Alert Engine subscribes to `AlertQueued`.

### 5.3 asset_engine (Migration #3)

| Current Flat File | Target Engine File | Notes |
|---|---|---|
| `routers/assets.py` | `engines/asset_engine/api/` | Replace scaffold |
| `routers/asset_tags.py` | `engines/asset_engine/api/` | Separate router |
| `services/asset_service.py` | `engines/asset_engine/services/` | Direct move |
| `services/asset_tag_service.py` | `engines/asset_engine/services/` | Direct move |
| `services/asset_history_service.py` | `engines/asset_engine/services/` | Direct move |
| `services/asset_verification.py` | `engines/asset_engine/validators/` | Belongs in validators |
| `services/discovery_service.py` | `engines/asset_engine/services/` | Direct move |
| `services/integration_service.py` | `engines/asset_engine/adapters/` | Adapter to external services |
| `services/github_connector.py` | `engines/asset_engine/adapters/` | GitHub adapter |
| `services/api_import_service.py` | `engines/asset_engine/adapters/` | API spec import adapter |
| `services/apk_service.py` | `engines/asset_engine/adapters/` | APK upload + analysis adapter |
| `schemas/assets.py` | `engines/asset_engine/schemas/` | Direct move |
| `schemas/tags.py` | `engines/asset_engine/schemas/` | Direct move |
| `models/organization_integration.py` | `engines/asset_engine/models/` | Platform model for GitHub PATs |

**Cross-engine imports to resolve:**
- Asset Engine is a data owner. Other engines read from it. This is the cleanest boundary.

### 5.4 scanner_engine (Migration #4)

| Current Flat File | Target Engine File | Notes |
|---|---|---|
| `routers/scans.py` | `engines/scanner_engine/api/` | Replace scaffold |
| `services/scan_service.py` | `engines/scanner_engine/services/` | Direct move |
| `services/tool_executor.py` | `engines/scanner_engine/adapters/` | Adapter pattern (Phase 1 of ARCHITECTURE_MIGRATION_GUIDE) |
| `services/nmap_service.py` | `engines/scanner_engine/adapters/` | Nmap adapter |
| `services/ssrf_protection.py` | `engines/scanner_engine/validators/` | Security validation |
| `services/discovery_settings_service.py` | `engines/scanner_engine/services/` | Nmap admin settings |
| `services/security_db_client.py` | `engines/shared/database/` or stay in scanner | Used by multiple engines — SDK candidate |
| `services/security_schema_bootstrap.py` | `engines/shared/database/` or stay | Infrastructure — SDK candidate |
| `schemas/scans.py` | `engines/scanner_engine/schemas/` | Direct move |

**Cross-engine imports to resolve:**
- `scan_service.py` calls `risk_service.ingest_scan_result()` — this should become a `ScanCompleted` bus event instead
- `security_db_client.py` is used by Scanner, Risk, VAPT, Reporting — move to Shared SDK `shared/database/security_db.py`
- `security_schema_bootstrap.py` is infrastructure — move to `shared/database/schema_bootstrap.py`

### 5.5 risk_engine (Migration #5)

| Current Flat File | Target Engine File | Notes |
|---|---|---|
| `routers/risks.py` | `engines/risk_engine/api/` | Replace scaffold |
| `services/risk_service.py` | `engines/risk_engine/services/` | Direct move |
| `services/risk_scoring.py` | `engines/risk_engine/services/` | Direct move |
| `services/risk_prioritization.py` | `engines/risk_engine/services/` | Direct move |
| `schemas/risks.py` | `engines/risk_engine/schemas/` | Direct move |

**Cross-engine imports to resolve:**
- Risk Engine exposes `ingest_scan_result()` — Scanner calls this directly. Move to bus: Scanner publishes `ScanCompleted`, Risk subscribes.
- Risk Engine's export (`GET /risks/export`) should conceptually move to Reporting Engine once it exists. For now, leave a stub in Risk Engine that forwards to Reporting Engine's export handler.

### 5.6 audit_engine (Migration #6)

This is the trickiest migration because of the **Control Plane split**:

**What stays in Control Plane:**
- Dual-control session management (`org_user_auth_service.py`)
- Pending action queue (`POST /audit/pending`, `/authorize`, `/reject`)
- Initiator/authorizer assignment

**What moves to Audit Engine:**
- Immutable trail write (`audit_events` table writes)
- `GET /audit/events` and `GET /audit/events/{id}`
- `GET /audit/export`
- `GET /audit/pending` (read-only — Control Plane still owns create/authorize/reject)

| Current Flat File | Target Engine File | Notes |
|---|---|---|
| `routers/audit.py` | Split: parts to CP, parts to audit_engine/api/ | See above |
| `services/audit_service.py` | Split: immutable trail to audit_engine/services/ | Pending action logic stays in CP |
| `models/audit.py` | Split: `AuditEvent` to audit_engine/models/, `AuditPendingAction` stays in CP models | Two different owners |
| `schemas/audit.py` | Split accordingly | Two different schemas |

### 5.7 control_plane (Migration #7 — Last, Largest)

| Current Flat File | Target Engine File | Notes |
|---|---|---|
| `routers/organizations.py` | `engines/control_plane/api/` | |
| `routers/org_users.py` | `engines/control_plane/api/` | |
| `routers/customer_db_connections.py` | `engines/control_plane/api/` | |
| `routers/staff.py` | `engines/control_plane/api/` | |
| `routers/support.py` | `engines/control_plane/api/` | |
| `routers/billing.py` | `engines/control_plane/api/` | |
| `routers/tools.py` | `engines/control_plane/api/` | |
| `routers/admin_*.py` (7 files) | `engines/control_plane/api/admin/` | Group admin routers |
| `services/organization_service.py` | `engines/control_plane/services/` | |
| `services/organization_user_service.py` | `engines/control_plane/services/` | |
| `services/org_user_auth_service.py` | `engines/control_plane/services/` | Dual-control sessions |
| `services/otp_service.py` | `engines/control_plane/services/` | |
| `services/org_setup_service.py` | `engines/control_plane/services/` | |
| `services/company_verification.py` | `engines/control_plane/services/` | |
| `services/customer_db_service.py` | `engines/control_plane/services/` | |
| `services/staff_service.py` | `engines/control_plane/services/` | |
| `services/support_service.py` | `engines/control_plane/services/` | |
| `services/billing_service.py` | `engines/control_plane/services/` | |
| `services/tooling_service.py` | `engines/control_plane/services/` | |
| `services/tooling_defaults.py` | `engines/control_plane/services/` | |
| `services/experience_service.py` | `engines/control_plane/services/` | |
| `services/experience_catalog.py` | `engines/control_plane/services/` | |
| `services/admin_experience_service.py` | `engines/control_plane/services/` | |
| `services/admin_clients_service.py` | `engines/control_plane/services/` | |
| `services/privacy_content.py` | `engines/control_plane/services/` | |
| `services/status_service.py` | `engines/operations_engine/services/` | Status belongs in Operations, not Control Plane |
| Models (10 files) | `engines/control_plane/models/` | |
| Schemas (9 files) | `engines/control_plane/schemas/` | |

**Status note**: `services/status_service.py` is a mis-classification — it serves the `/status` endpoint which reports system health. This belongs in Operations Engine, not Control Plane.

---

## 6. — Phase 1: Audit & Shared SDK Hardening

**Before any file moves**, harden the Shared SDK so engines can depend on it instead of importing from each other.

### 6.1 Identify Shared Dependencies

Run an audit of cross-engine imports in the flat files:

```bash
# Find all imports between flat service files
grep -r "^from app\.services\." app/services/ | grep -v "__init__" | sort -u
grep -r "^from app\.models\." app/services/ app/routers/ | sort -u
grep -r "^from app\.routers\." app/services/ app/routers/ | sort -u
```

This produces a dependency matrix showing which flat files import from which other flat files.

### 6.2 Promote Frequently Imported Modules to Shared SDK

Based on the import audit, promote shared modules into `app/shared/`:

| Module | Used By | Move To |
|---|---|---|
| `security_db_client.py` | Scanner, Risk, VAPT, any engine reading security DB | `shared/database/security_db.py` |
| `security_schema_bootstrap.py` | Customer DB connection setup | `shared/database/schema_bootstrap.py` |
| `encryption.py` (in `app/core/`) | CP, Asset, Alert (encrypting credentials) | `shared/encryption/` (already exists as facade — update code to use it) |
| JWT helpers (in `app/core/security.py`) | All engines with auth | `shared/auth/` (already exists as facade) |
| Status enums | Shared by Scanner, Risk, Alert | `shared/constants/` (already exists) |

### 6.3 Verify Tests Still Pass

```bash
pytest -q  # All tests must pass before any migration starts
```

---

## 7. — Phase 2: Core Engines Migration

Migrate engines #1–4 in order: Operations → Alert → Asset → Scanner.

### 7.1 Migration Pattern (Same for Every Engine)

```python
# STEP 1: Create the engine's files
# app/engines/{engine}/api/routes.py

from app.core.config import settings
from fastapi import APIRouter

# Internal API router for this engine
router = APIRouter()

# Include routes from the engine's route handlers
from app.engines.{engine}.api import (
    resource_one,
    resource_two,
)
router.include_router(resource_one.router, prefix="/resource-one", tags=["{Engine} Engine"])
router.include_router(resource_two.router, prefix="/resource-two", tags=["{Engine} Engine"])

def get_route_mounts() -> list[tuple]:
    """Return (router, prefix, tags) for the Engine Registry."""
    p = settings.API_V1_STR
    return [
        (router, f"{p}/{engine_prefix}", ["{Engine}"]),
    ]
```

```python
# STEP 2: Copy the service file into the engine
# app/engines/{engine}/services/{service}.py
# Copied verbatim from app/services/{service}.py
# Update imports at the top to use new paths
```

```python
# STEP 3: Update the flat file to re-export
# app/services/{service}.py — after migration

import warnings
warnings.warn(
    "Import from app.engines.{engine}.services.{service} instead of app.services.{service}",
    DeprecationWarning,
    stacklevel=2,
)

from app.engines.{engine}.services.{service} import *  # noqa: F401, F403
```

This re-export pattern means:
- Existing importers continue to work (no sudden breakage)
- New code imports from the engine path
- After all importers are updated, the flat file is deleted

### 7.2 Engine #1: Operations Engine

**Files to create:**

```text
app/engines/operations_engine/
    api/
        __init__.py
        routes.py                    ← mounts status, staff admin routes
        server.py                    ← copied from routers/admin_server.py
        status.py                    ← split from main.py / health endpoint logic
    services/
        __init__.py
        server_ops_service.py        ← copied from services/server_ops_service.py
        status_service.py            ← MOVED from services/status_service.py
    schemas/
        __init__.py
        server_ops.py                ← copied from schemas/server_ops.py
    events/
        catalog.py                   ← already exists
```

**Route mounting:**

```python
# app/engines/operations_engine/api/routes.py

from app.engines.operations_engine.api.server import router as server_router
from app.engines.operations_engine.api.status import router as status_router

def get_route_mounts():
    p = settings.API_V1_STR
    return [
        (status_router, "", []),                                    # /health, /status
        (server_router, f"{p}/admin/server", ["operations-engine"]),
    ]
```

**Verification:**

```bash
# All endpoints still work
curl http://localhost:8000/health
curl http://localhost:8000/status
curl http://localhost:8000/api/v1/admin/server/overview
```

### 7.3 Engine #2: Alert Engine

**Files to create:**

```text
app/engines/alert_engine/
    api/
        __init__.py
        routes.py                    ← mounts alert routes
        alerts.py                    ← copied from routers/alerts.py
    services/
        __init__.py
        alert_service.py             ← copied from services/alert_service.py
        alert_channels.py            ← copied from services/alert_channels.py
    models/
        __init__.py
        alerts.py                    ← copied from models/alerts.py
    schemas/
        __init__.py
        alerts.py                    ← copied from schemas/alerts.py
    events/
        catalog.py                   ← already exists (PUBLISHES, SUBSCRIBES)
        subscribers.py               ← add subscriber for AlertQueued event
```

**Key migration step:** Replace direct `enqueue_alert()` calls from other engines with bus events.

```python
# Before (other engines call directly):
from app.services.alert_service import enqueue_alert
await enqueue_alert(db, org_id, ...)

# After (via bus):
from app.bus.publisher import publish
await publish("AlertQueued", {
    "organization_id": org_id,
    "event_type": "scan.completed",
    "severity": "high",
    "title": "Scan completed with critical findings",
    "body": "...",
    "payload": {...},
})

# Alert Engine subscribes:
from app.bus.subscriber import subscribe

@subscribe("AlertQueued")
async def handle_alert_queued(payload):
    await enqueue_alert(
        db=payload["db"],
        organization_id=payload["organization_id"],
        ...
    )
```

### 7.4 Engine #3: Asset Engine

**Files to create:**

```text
app/engines/asset_engine/
    api/
        __init__.py
        routes.py                    ← mounts asset + tag + discovery routes
        assets.py                    ← copied from routers/assets.py
        asset_tags.py                ← copied from routers/asset_tags.py
    services/
        __init__.py
        asset_service.py             ← copied
        asset_tag_service.py          ← copied
        asset_history_service.py      ← copied
        discovery_service.py          ← copied
    adapters/
        __init__.py
        integration_service.py       ← copied (external integrations)
        github_connector.py          ← copied (GitHub adapter)
        api_import_service.py        ← copied (OpenAPI/Postman adapter)
        apk_service.py               ← copied (APK upload adapter)
    validators/
        __init__.py
        asset_verification.py        ← moved from services/ (it's a validator)
    models/
        __init__.py
        organization_integration.py  ← copied from models/
    schemas/
        __init__.py
        assets.py                    ← copied
        tags.py                      ← copied
    events/
        catalog.py                   ← already exists
        publishers.py                ← publish AssetCreated, AssetUpdated
```

### 7.5 Engine #4: Scanner Engine

**Files to create:**

```text
app/engines/scanner_engine/
    api/
        __init__.py
        routes.py
        scans.py                     ← copied from routers/scans.py
    services/
        __init__.py
        scan_service.py              ← copied
        discovery_settings_service.py ← copied
    adapters/
        __init__.py
        tool_executor.py             ← moved (it's an execution adapter)
        nmap_adapter.py              ← split from tool_executor.py (if/when ready)
        nuclei_adapter.py            ← split from tool_executor.py (if/when ready)
    interfaces/
        __init__.py
        scanner.py                   ← already exists (ScannerInterface ABC)
    validators/
        __init__.py
        ssrf_protection.py           ← moved from services/
    schemas/
        __init__.py
        scans.py                     ← copied
    events/
        catalog.py                   ← already exists
        publishers.py                ← publish ScanCompleted, ScanFailed
```

**Key migration step:** Replace direct `risk_service.ingest_scan_result()` call with bus event:

```python
# In scan_service.py — after a scan completes:

# Before:
from app.services.risk_service import ingest_scan_result
await ingest_scan_result(db, ctx, result)

# After:
from app.bus.publisher import publish
await publish("ScanCompleted", {
    "organization_id": ctx.org_id,
    "scan_job_id": job_id,
    "results": [...],  # serialized results
})
```

---

## 8. — Phase 3: Remaining Engines + Cleanup

### 8.1 Engine #5: Risk Engine

```text
app/engines/risk_engine/
    api/
        __init__.py
        routes.py                    ← mounts risk + treatment routes
        risks.py                     ← copied from routers/risks.py
    services/
        __init__.py
        risk_service.py              ← copied
        risk_scoring.py              ← copied
        risk_prioritization.py       ← copied
    schemas/
        __init__.py
        risks.py                     ← copied
    events/
        catalog.py                   ← already exists
        subscribers.py               ← subscribe to ScanCompleted
```

### 8.2 Engine #6 & #7: Audit Engine + Control Plane (Split)

These must be done together because of the shared code.

```text
# Audit Engine gets:
app/engines/audit_engine/
    api/
        __init__.py
        routes.py                    ← GET /events, GET /events/{id}, GET /export, GET /pending
        audit.py                     ← copied from routers/audit.py (read-only parts)
    services/
        __init__.py
        audit_service.py             ← copied (immutable trail + export parts only)
    models/
        __init__.py
        audit.py                     ← AuditEvent model only
    schemas/
        __init__.py
        audit.py                     ← export + event read schemas
    events/
        catalog.py                   ← PUBLISHES: AuditRecorded
        subscribers.py               ← subscribe to AuditRecorded event

# Control Plane retains (pending action + auth parts):
app/engines/control_plane/services/
    audit_pending_service.py         ← POST /pending, authorize, reject logic
```

The split works via the bus:

```python
# Control Plane — after authorizing a pending action:
await publish("AuditRecorded", {
    "organization_id": org_id,
    "action_key": pending.action_key,
    "initiator_name": pending.initiator_name,
    "authorizer_name": staff.full_name,
    "timestamp": datetime.utcnow().isoformat(),
})

# Audit Engine — subscribes:
@subscribe("AuditRecorded")
async def record_audit_event(payload):
    event = AuditEvent(
        organization_id=payload["organization_id"],
        action_key=payload["action_key"],
        ...
    )
    db.add(event)
    await db.commit()
```

### 8.3 Control Plane (Migration #7 — Final Engine)

The largest migration. 19 services, 12 routers, 10 models, 9 schemas all move into `app/engines/control_plane/`.

```text
app/engines/control_plane/
    api/
        __init__.py
        routes.py                    ← master router mounting all CP routes
        organizations.py             ← copied
        org_users.py                 ← copied
        org_auth.py                  ← org login/logout
        db_connections.py            ← copied
        staff.py                     ← copied
        support.py                   ← copied
        billing.py                   ← copied
        tools.py                     ← copied
        setup.py                     ← org_setup endpoints
        admin/
            __init__.py
            clients.py               ← copied
            billing.py               ← copied
            tooling.py               ← copied
            discovery.py             ← copied
            support.py               ← copied
            experience.py            ← copied
    services/
        __init__.py
        organization_service.py      ← copied
        organization_user_service.py ← copied
        org_user_auth_service.py     ← copied
        otp_service.py               ← copied
        org_setup_service.py         ← copied
        company_verification.py      ← copied
        customer_db_service.py       ← copied
        staff_service.py             ← copied
        support_service.py           ← copied
        billing_service.py           ← copied
        tooling_service.py           ← copied
        tooling_defaults.py          ← copied
        experience_service.py        ← copied
        experience_catalog.py        ← copied
        admin_clients_service.py     ← copied
        admin_experience_service.py  ← copied
        privacy_content.py           ← copied
        audit_pending_service.py     ← split from audit_service.py
    models/
        __init__.py
        organization.py
        organization_user.py
        otp_challenge.py
        customer_db_connection.py
        platform_staff.py
        support_ticket.py
        support_ticket_message.py
        billing.py
        tooling.py
        experience_service_config.py
        discovery_settings.py
        audit_pending_action.py      ← stays in CP (authorization concern)
    schemas/
        __init__.py
        organization.py
        org_setup.py
        organization_user.py
        customer_db_connection.py
        staff.py
        support.py
        billing.py
        tooling.py
        experience.py
        admin_clients.py
        admin_experience.py
        discovery_settings.py
        audit.py                     ← kept minimal (export for queries)
```

---

## 9. — Phase 4: Cross-Engine Import Replacement

After all files are in engine folders, audit and replace every instance of one engine directly importing another engine's code.

### 9.1 Find All Cross-Engine Direct Imports

```bash
grep -r "^from app\.engines\.\(control_plane\|asset_engine\|scanner_engine\|risk_engine\|alert_engine\|audit_engine\|operations_engine\)" \
    app/engines/ --include="*.py" | \
    grep -v "__init__" | grep -v "events/catalog" | grep -v "manifest"
```

### 9.2 Replace With Bus Events

| Direct Import | Replace With |
|---|---|
| `from app.engines.risk_engine.services import ingest_scan_result` | Publish `ScanCompleted` event |
| `from app.engines.alert_engine.services import enqueue_alert` | Publish `AlertQueued` event |
| `from app.engines.asset_engine.services import get_asset` | Use SDK `shared.database.security_db` or bus query event |
| `from app.engines.control_plane.services import get_organization` | Use SDK `shared.database.organization` |

### 9.3 Replace With Shared SDK

| Direct Import | Replace With |
|---|---|
| `from app.engines.scanner_engine.services.security_db_client import ...` | `from app.shared.database.security_db import ...` |
| `from app.core.security import create_access_token` | `from app.shared.auth import create_access_token` |
| `from app.core.encryption import encrypt_value` | `from app.shared.encryption import encrypt_value` |

### 9.4 Deprecate Flat Files

```python
# app/services/asset_service.py — final state before deletion

import warnings
warnings.warn(
    "app.services.asset_service is deprecated. "
    "Use app.engines.asset_engine.services.asset_service instead.",
    DeprecationWarning,
    stacklevel=2,
)

from app.engines.asset_engine.services.asset_service import *  # noqa: F401, F403
```

### 9.5 Delete Flat Files

After all consumers are updated (check with grep that nothing imports from the flat path):

```bash
# For each flat file, verify zero imports remain:
grep -r "from app\.services\.asset_service import" app/ --include="*.py"
# If zero results, safe to delete

rm app/services/asset_service.py
rm app/routers/assets.py
# etc.
```

Final flat directory cleanup:

```bash
rm app/services/__init__.py
rmdir app/services/

rm app/routers/__init__.py
rmdir app/routers/
```

---

## 10. — Common Migration Patterns

### Pattern A: Service with No Cross-Engine Imports

**Simplest case.** Copy file, update internal imports, add re-export in old location.

```python
# Original flat file only imports from:
#   app.core.config
#   app.db.session
#   app.models.xyz
#   app.schemas.xyz
#   standard library / third-party

# → Copy to engine. Update imports to:
#   app.shared.database
#   app.engines.{engine}.models.xyz
#   app.engines.{engine}.schemas.xyz
```

### Pattern B: Service with Cross-Engine Import (to be bus-ified)

```python
# Original calls another engine's service directly:
from app.services.risk_service import ingest_scan_result
await ingest_scan_result(db, ctx, result)

# → Replace with bus event in the engine copy:
from app.bus.publisher import publish
await publish("ScanCompleted", serialize(db, ctx, result))
```

### Pattern C: Shared Infrastructure (move to SDK)

```python
# Used by multiple engines:
from app.services.security_db_client import resolve_storage, SecurityDbContext

# → Move to:
from app.shared.database.security_db import resolve_storage, SecurityDbContext
```

### Pattern D: Split Service (Audit)

When one flat file contains logic for two engines:

```python
# app/services/audit_service.py contains:
#   - create_audit_event()          → Audit Engine
#   - list_audit_events()           → Audit Engine
#   - create_pending_action()       → Control Plane
#   - authorize_pending_action()    → Control Plane
#   - export_audit_log()            → Audit Engine (→ Reporting Engine later)

# Split:
# app/engines/audit_engine/services/audit_service.py:
#   create_audit_event(), list_audit_events(), export_audit_log()

# app/engines/control_plane/services/audit_pending_service.py:
#   create_pending_action(), authorize_pending_action()
```

---

## 11. — Rollout & Testing Strategy

### 11.1 Per-Engine Test Checklist

Before declaring an engine migrated, verify:

```markdown
- [ ] All tests pass (pytest -q)
- [ ] All API endpoints for this engine respond correctly
- [ ] Flat re-export file in place (no 404s from old import paths)
- [ ] No circular imports introduced
- [ ] Cross-engine calls go through bus (not direct)
- [ ] Event catalog updated with correct PUBLISHES/SUBSCRIBES
- [ ] Engine manifest updated with correct status
- [ ] Engine appears in GET /api/v1/engines with correct metadata
```

### 11.2 Rollback Plan

If an engine migration causes issues:

1. **Step 1**: Remove the engine's `api/routes.py` mount from the registry
2. **Step 2**: Verify the flat re-export files are still in place (they should be)
3. **Step 3**: Confirm all endpoints work again via flat routers
4. **Step 4**: Debug and retry the migration

The re-export pattern means rollback is instant — just unmount the engine routes and the flat files pick up seamlessly.

### 11.3 Recommended Sequence

```text
Sprint 1: Phase 1 (SDK hardening) + Engine 1 (Operations)
Sprint 2: Engine 2 (Alert) + Engine 3 (Asset)
Sprint 3: Engine 4 (Scanner) + Engine 5 (Risk)
Sprint 4: Engines 6+7 (Audit split + Control Plane)
Sprint 5: Phase 4 (cross-engine import cleanup + flat file deletion)
```

---

## 12. — Files to Delete After Migration

### Flat Services Directory (43 files → 0)

```text
app/services/
    __init__.py          ← delete (no longer needed)
    _events.py           ← delete (replaced by app/bus/)
    organization_service.py, organization_user_service.py, ...
    [all 42 .py files]   ← delete
```

### Flat Routers Directory (21 files → 0)

```text
app/routers/
    __init__.py          ← delete
    organizations.py, org_users.py, assets.py, ...
    [all 20 .py files]   ← delete
```

### Flat Models (reduced to shared-only)

Engine-specific models move to their engines. Only truly shared models remain:

```text
app/models/
    __init__.py          ← reduced to re-export from engine models
    # Most files move to app/engines/{engine}/models/
```

### Flat Schemas (reduced to shared-only)

Same pattern as models:

```text
app/schemas/
    __init__.py          ← reduced to re-export from engine schemas
    # Most files move to app/engines/{engine}/schemas/
```

---

**End of Legacy Migration Plan**

*This plan covers the systematic migration of all product logic from flat `app/services/`, `app/routers/`, `app/models/`, and `app/schemas/` directories into their designated engine folders under `app/engines/`. Each engine is migrated incrementally. Re-export wrappers keep the app working at every step. The last step removes the flat directories entirely, leaving a clean engine-based modular monolith.*
