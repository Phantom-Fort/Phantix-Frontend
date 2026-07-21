Tags: #architecture #platform

# Platform Architecture

Status: 🟢 Implemented (this note describes what's actually running)

Stack: FastAPI · SQLAlchemy 2 (async) · PostgreSQL · Alembic · asyncpg · Celery · Redis · Docker tools.

## The one non-negotiable: hybrid, privacy-first storage

Phantix runs the application and tooling (scanners, orchestration, eventually AI) in the cloud, but **all security data lives in the customer's own database**, not ours.

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

- **Platform DB**: tenancy, auth, encrypted connection credentials, billing, dual-control audit metadata. Never the system of record for security findings.
- **Customer security DB**: every asset, tag, scan, finding, risk, and (future) compliance/AI record. Reached dynamically via each org's `security_data_storage` connection. Asset IDs are local to that database (per-tenant `BIGSERIAL`).

Two connection purposes exist per [[14 - Infrastructure]] and [[03 - Control Plane]]:
- `config_inspection` — read-only security posture checks (roles, grants, RLS policies). Never reads business table contents.
- `security_data_storage` — full CRUD, but confined to the `phantix` schema only.

## Target layering (approved v1.0)

```text
                    Users
                      │
                      ▼
             Presentation Layer
                      │
                      ▼
                 API Gateway
                      │
                      ▼
                Control Plane
                      │
                      ▼
                 Engine Bus
                      │
      ┌───────────────┼────────────────┐
      ▼               ▼                ▼
 Asset Engine   Scanner Engine   Risk Engine
      │               │                │
      ▼               ▼                ▼
 AI Engine     Compliance Engine  Report Engine
      │
      ▼
 Alert Engine
      │
      ▼
 Infrastructure
```

Read this as **typical data-flow order**, not a permitted call chain — the hard rule underneath it is unchanged: **no Engine calls another Engine directly.** All cross-engine communication goes through events on the [[04 - Engine Bus]]. This diagram is the target; the section below is what's actually deployed today.

## Today's actual layering

This is what's really deployed — not the target diagram in [[00 - Vision]]:

```text
Presentation (org portal)
    ↓
FastAPI (single process)
    ↓
Routers  (organizations, org-users, audit, db-connections,
          assets, asset-tags, scans, risks, alerts, admin/*)
    ↓
Services (asset_service, scan_service, risk_service,
          alert_service, tool_executor, ssrf_protection, …)
    ↓
Models / Security Schema DDL
    ↓
Platform DB  +  per-org Customer Security DB (dynamic connection)
```

There is no Engine Bus and no Control-Plane/Engine split yet — routers call services directly, and services occasionally call each other's functions directly (e.g. scan completion triggers risk creation triggers alert enqueue, all as direct calls or Celery tasks today). [[04 - Engine Bus]] covers what changes here and when.

## Async work today

Celery + Redis already exists and is used two ways:
- `run_inline=true` (default): scans and discovery jobs execute in-process — fine for local/MVP.
- `run_inline=false`: dispatches to a Celery worker (`phantix.scan.run_job`, alert processing tasks).

This is the concrete substrate the future Engine Bus will likely be built on top of, rather than a new message broker. See [[04 - Engine Bus]].

## Related notes

[[00 - Vision]] · [[02 - Engine Registry]] · [[03 - Control Plane]] · [[14 - Infrastructure]]
