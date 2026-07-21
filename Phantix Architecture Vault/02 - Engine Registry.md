Tags: #architecture #engines #registry

# Engine Registry

Status: 🟢 Scaffolded — all **10 engines** exist under `app/engines/*` with the full folder standard; Engine Registry + Bus + Shared SDK live in code (`app/engines/registry.py`, `app/bus/`, `app/shared/`). Product logic is still partly in legacy `app/services` / `app/routers` and is **mounted through** each engine’s `api/routes.py`. Discovery: `GET /api/v1/engines`. This table remains the binding domain map: **every new feature must belong to an Engine.**

## The ten official engines

| Engine | Responsibility | Status today | Lives in (current code) | Note |
|---|---|---|---|---|
| Control Plane | Platform management: auth, orgs, billing, licensing, API keys, customer setup, staff portal, support | 🟢 Implemented | Org auth/setup, org-users, db-connections, staff admin routers | [[03 - Control Plane]] |
| Asset Engine | Asset inventory and discovery | 🟢 Implemented | `asset_service.py`, `asset_tag_service.py`, `/api/v1/assets*` | [[05 - Asset Engine]] |
| Scanner Engine | Scan orchestration | 🟢 Implemented | `scan_service.py`, `tool_executor.py`, `/api/v1/scans*` | [[06 - Scanner Engine]] |
| Risk Engine | Risk analysis | 🟢 Implemented (v0.1) | `/api/v1/risks*` | [[07 - Risk Engine]] |
| AI Engine | AI analysis | 🔴 Not started | `ai_analyses` table exists, unused | [[08 - AI Engine]] |
| Compliance Engine | Compliance frameworks | 🔴 Not started | `compliance_evidence` table exists, unused | [[09 - Compliance Engine]] |
| Reporting Engine | Report generation | 🔴 Not started | Ad hoc exports live inside Risk and Audit | [[10 - Reporting Engine]] |
| Alert Engine | Notifications | 🟢 Implemented | `alert_daemon.py`, `alert_service.py`, `/api/v1/alerts*` | [[11 - Alert Engine]] |
| Audit Engine | Audit trail | 🟡 Partial — **promoted to first-class in v1.0** | Currently `audit_events`/`audit_pending_actions` logic lives inside Control Plane's dual-control code | [[12 - Audit Engine]] |
| Operations Engine | Platform monitoring | 🟢 Implemented | `/api/v1/admin/server/*` (staff-only) | [[13 - Operations Engine]] |

### What changed from the pre-v1.0 draft of this vault

**Audit is now its own Engine**, not folded into Control Plane. The earlier version of this note argued Audit was inseparable from "who's allowed to act" and left it inside Control Plane. The approved plan draws the line differently: Control Plane owns *authorization* (who can act — the dual-control session mechanism), Audit Engine owns *the record of what happened* ("nothing outside this Engine writes audit records directly"). That's a cleaner boundary and the vault now follows it — see [[12 - Audit Engine]] for exactly where the split falls.

## Engine boundary rule

> No Engine should directly call another Engine. All communication must occur through Events or Engine Contracts.

Every engine note in this vault now states its explicit **MUST NOT** list — the things adjacent engines might be tempted to absorb but shouldn't. Read those before adding a feature to make sure it lands in the right engine.

## Engine folder standard (exact, no exceptions)

Every engine that gets physically split out follows this layout — note this supersedes the looser draft layout from the original brainstorm (no `policies/` folder; `schemas/` and `tasks/` added):

```text
engine_name/
    api/
    services/
    repositories/
    models/
    schemas/
    workers/
    tasks/
    adapters/
    interfaces/
    validators/
    events/
    cache/
    tests/
    docs/
```

Engines import shared contracts from [[17 - Shared SDK]]. They never import another engine's internal implementation — only its published events or its documented public API.

## Development rules

**Do:**
- Keep engines independent.
- Use dependency injection.
- Publish events instead of calling another engine's code.
- Keep business logic inside engines, not in Control Plane or Infrastructure.
- Write unit tests per engine.
- Document each engine's public API.

**Don't:**
- Share repositories across engines.
- Call another engine's internals directly.
- Mix business domains inside one engine.
- Put business logic into the infrastructure layer.
- Put scanning logic inside Control Plane.
- Put AI logic directly inside API endpoints (AI Engine runs as background workers only — see [[08 - AI Engine]]).

## Rule for physically splitting an engine out

Being on this table doesn't mean an engine has its own folder tree yet — most don't. Before promoting a service module to the full folder standard above, it should have: its own tables in the security schema, at least one other engine depending on its published events, and enough internal complexity that a single `service.py` file is genuinely unwieldy. Symmetry with this table is not, by itself, a reason to split something out — see the phased approach in [[16 - Deployment Roadmap]].

## Related notes

[[00 - Vision]] · [[04 - Engine Bus]] · [[16 - Deployment Roadmap]] · [[17 - Shared SDK]]
