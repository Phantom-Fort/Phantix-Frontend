# Phantix Backend — Architecture Migration Guide

**From: Flat FastAPI Monolith**
**To: Modular Monolith (10-Engine Architecture)**

**Version**: 1.1
**Date**: July 14, 2026
**Status**: Living Document — **Phase 0 + scaffold of Phase 4 complete** (all 10 engines + bus + shared SDK exist under `app/engines`, `app/bus`, `app/shared`). Product logic still largely under `app/services` / `app/routers` and is mounted via each engine’s `api/routes.py`. Work engines one-by-one next.
**Audience**: Phantix Backend Engineers

---

## Table of Contents

1. [What & Why](#1--what--why)
2. [The Rule That Overrides Everything](#2--the-rule-that-overrides-everything)
3. [Track 2: Engine Architecture Migration (Phased)](#3--track-2-engine-architecture-migration-phased)
   - [Phase 0 — Now (No structural change, name with intent)](#phase-0--now-no-structural-change-name-with-intent)
   - [Phase 1 — First Real Split: Scanner Tool Adapters + Event Proof](#phase-1--first-real-split-scanner-tool-adapters--event-proof)
   - [Phase 2 — Join the Bus, Split Audit Out for Real](#phase-2--join-the-bus-split-audit-out-for-real)
   - [Phase 3 — Build the Not-Yet-Started Engines](#phase-3--build-the-not-yet-started-engines)
   - [Phase 4 — Full Folder Standard (If Warranted)](#phase-4--full-folder-standard-if-warranted)
4. [The Engine Folder Standard](#4--the-engine-folder-standard)
5. [Engine-by-Engine Migration Checklist](#5--engine-by-engine-migration-checklist)
6. [Event Contract Migration Plan](#6--event-contract-migration-plan)
7. [Shared SDK Extraction Path](#7--shared-sdk-extraction-path)
8. [The Infrastructure That Stays Shared](#8--the-infrastructure-that-stays-shared)
9. [Common Traps & Rules of Thumb](#9--common-traps--rules-of-thumb)

---

## 1. — What & Why

### The problem

The current codebase works. It's a clean FastAPI monolith with well-structured services, but:

- **Cross-domain calls are direct function calls** — scan completion directly instantiates risk creation which directly queues alerts. Every module knows about every other module.
- **No formal event system** — there's no publish/subscribe layer. Adding a new consumer of an existing event means editing the producer's code.
- **No engine isolation** — everything lives in flat `routers/`, `services/`, `models/` directories. There's nothing stopping asset logic from leaking into a scan handler.
- **Audit has no home of its own** — it's functionally a separate concern but its code is inside Control Plane.
- **Event names are inconsistent** — dot.case (`scan.completed`) in Alert Engine, no PascalCase events anywhere else yet.
- **No shared contracts** — encryption helpers, auth validation, and type definitions are casually duplicated across modules.

### The target

A **Modular Monolith** — one deployable unit, one codebase, one database, but internally divided into ten independent Engines, each with:

- Its own internal folder structure
- Its own tables (in the right database)
- Published events (not direct calls) for cross-engine communication
- A clear **MUST NOT** boundary defining what it doesn't own

No engine is a microservice. Most will never become one. But every engine behaves as though it *could* — clean boundaries, no shared repositories, no direct imports of another engine's internals.

### The principle that keeps this practical

> **Optimize for modularity before distribution.**
> A well-designed modular monolith with clear Engine boundaries is significantly easier to develop, test, deploy, and maintain than a prematurely distributed system.
> Every architectural decision should preserve the ability to extract an Engine into its own service without requiring major refactoring.

---

## 2. — The Rule That Overrides Everything

> **We are not freezing feature work to do a big-bang decomposition.**

Every week spent restructuring code nobody's using yet is a week not spent finding out if the product works. The migration is **incremental, triggered by need, not the calendar**.

The phases below are ordered by **least disruption to shipping velocity**. Each phase produces a working, deployable system *before* the next phase starts.

If a phase would block a customer-facing feature for more than one development cycle, restructure the approach — don't restructure the code.

---

## 3. — Track 2: Engine Architecture Migration (Phased)

### Phase 0 — Now (No structural change, name with intent)

**Goal**: Keep shipping on the current monolith while consistently naming things toward the target architecture.

**No folder moves. No code splits. No Engine Bus.**

#### What to do

1. **Name new files, classes, and routers after their Engine** before they touch the codebase:

   ```text
   # Instead of:
   app/routers/scans.py
   app/services/scan_service.py

   # Name new additions as:
   app/routers/scanner_engine/          # or just prefix clearly
   app/services/scanner_engine/
   ```

   This doesn't require moving existing files. It just means new work lands in aligned locations.

2. **Write the MUST NOT list in every new service's module docstring**:

   ```python
   """Scanner Engine — Scan orchestration and result normalization.

   MUST NOT:
   - Calculate risk scores
   - Send email or alerts
   - Call AI or compliance code
   - Generate reports
   """
   ```

3. **Name all new cross-engine events in PascalCase** (`ScanCompleted`, `RiskCreated`) even though Alert Engine still uses dot.case. The migration in Phase 2 will reconcile them. New events should follow the approved catalog in `Phantix Architecture Vault/15 - Event Contracts.md`.

4. **When you need to reach across engine boundaries**, wrap the call in a thin publish-style function rather than importing and calling the other engine's service directly:

   ```python
   # Instead of:
   from app.services.risk_service import create_risk_from_scan
   await create_risk_from_scan(db, result)

   # Do:
   from app.services._events import publish_scan_completed
   await publish_scan_completed(db, organization_id, result)
   ```

   The `_events.py` module is a temporary shim — it calls `create_risk_from_scan` internally today but already has the signature that will later publish to the Engine Bus. When the bus exists, you change one file instead of every call site.

5. **Start a file `app/_engine_map.py`** that documents which routers/services belong to which engine. This is the living cross-reference while files still live in flat directories. Update it as you go:

   ```python
   # app/_engine_map.py
   ENGINE_MAP = {
       "Control Plane": {
           "routers": ["organizations", "org_users", "db_connections", ...],
           "services": ["organization_service", "otp_service", ...],
       },
       "Asset Engine": {
           "routers": ["assets", "asset_tags"],
           "services": ["asset_service", "asset_tag_service", ...],
       },
       # ...
   }
   ```

#### How to know Phase 0 is done

- Every new module or class created for the last two sprints has an engine-aligned name.
- `app/_engine_map.py` exists and is reasonably complete.
- `app/services/_events.py` exists as the cross-engine call boundary.
- New event names follow PascalCase.

#### What Phase 0 does not include

- Moving existing files.
- Building the Engine Bus.
- Splitting Audit out of Control Plane.

---

### Phase 1 — First Real Split: Scanner Tool Adapters + Event Proof

**Trigger**: When more than one person is editing `tool_executor.py` or `scan_service.py` and their changes conflict, or when the third `if tool == "x"` branch gets added to `tool_executor.py`.

**Goal**: Demonstrate the Engine pattern works by refactoring the most organic candidate — Scanner Engine's tool execution — and proving the event concept with the scan → risk handoff.

#### Step 1.1 — Tool Adapters (highest-leverage refactor in the codebase)

The current `tool_executor.py` is a flat file with `if tool == "nmap"`, `if tool == "nuclei"` branches. Replace this with a proper adapter pattern:

```text
app/services/scanner_engine/
    adapters/
        __init__.py          # adapter registry
        base.py              # ScannerInterface (ABC)
        nmap_adapter.py      # NmapScanner implements ScannerInterface
        nuclei_adapter.py    # NucleiScanner implements ScannerInterface
        apk_adapter.py       # ApkScanner (already somewhat separate)
    tool_executor.py         # now just uses the registry
```

The `ScannerInterface` should define:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

@dataclass
class ScanTarget:
    identifier: str
    asset_type: str
    metadata: dict[str, Any]

@dataclass
class ScanResult:
    tool: str
    severity: str | None
    title: str
    description: str
    evidence: dict[str, Any] | None
    raw_output: str | None

class ScannerInterface(ABC):
    """Contract every scanner adapter must implement."""

    @property
    @abstractmethod
    def tool_name(self) -> str: ...

    @abstractmethod
    async def scan(self, target: ScanTarget, config: dict[str, Any]) -> list[ScanResult]: ...

    @abstractmethod
    async def validate_target(self, target: ScanTarget) -> bool: ...
```

Each adapter goes in its own file. Adding a new scanner (OpenVAS, Naabu, ffuf, etc.) becomes: write one adapter class, register it, done. No more `if tool ==` branches.

The Docker/fallback execution logic stays as a shared utility that adapters call — they shouldn't each reimplement container orchestration.

#### Step 1.2 — First Event Proof: Scan → Risk as a published event

Currently, scan completion directly calls risk creation:

```python
# In scan_service.py — current state
results = await run_scan(...)
await risk_service.create_or_update_risk_from_scan(db, org_id, result)
```

Replace this with a publish/subscribe shape using the existing Celery infrastructure. This is the proof case for the Engine Bus.

```python
# app/services/_events.py — during migration transition

async def publish_scan_completed(
    db: AsyncIterator[AsyncSession],
    organization_id: int,
    job_id: int,
    results: list[ScanResult],
) -> None:
    """Publish ScanCompleted event.

    Currently dispatches directly to Risk Engine.
    Will publish to Engine Bus when it exists.
    """
    payload = {
        "event_type": "ScanCompleted",
        "organization_id": organization_id,
        "scan_job_id": job_id,
        "results_summary": {
            "total": len(results),
            "critical": sum(1 for r in results if r.severity == "critical"),
            "high": sum(1 for r in results if r.severity == "high"),
        },
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Today: direct call to Risk Engine
    from app.services.risk_service import process_scan_results
    await process_scan_results(db, organization_id, job_id, results)

    # Also queue to Alert Engine
    if any(r.severity in ("critical", "high") for r in results):
        from app.services.alert_service import enqueue_alert
        await enqueue_alert(
            db, organization_id,
            event_type="ScanCompleted",
            severity="high" if any(r.severity == "critical" for r in results) else "medium",
            title=f"Scan completed with {payload['results_summary']['critical']} critical findings",
            body="",
            payload=payload,
        )

    # Future: bus.publish("ScanCompleted", payload)
```

The key: Risk Engine and Alert Engine no longer know about each other. The `_events.py` module is the only place that coordinates cross-engine flows. When the real bus arrives, you change this one file.

#### Step 1.3 (Optional) — Add an event subscriber pattern

Create a lightweight subscriber registry that can live alongside Celery:

```python
# app/services/_subscribers.py

from typing import Any, Callable, Awaitable

EventCallback = Callable[..., Awaitable[None]]

_subscribers: dict[str, list[EventCallback]] = {}

def subscribe(event_type: str):
    """Decorator to register an event subscriber."""
    def wrapper(func: EventCallback):
        _subscribers.setdefault(event_type, []).append(func)
        return func
    return wrapper

async def emit(event_type: str, **kwargs):
    """Call all subscribers for an event."""
    for callback in _subscribers.get(event_type, []):
        await callback(**kwargs)
```

This is intentionally simple — no queue, no persistence, same-process only. It lets you write subscriber functions today that will move to real bus subscribers later:

```python
# In risk_service.py
from app.services._subscribers import subscribe

@subscribe("ScanCompleted")
async def on_scan_completed(organization_id: int, scan_job_id: int, results: list, **kwargs):
    await process_scan_results(...)
```

Phase 1 doesn't require this step — the `_events.py` shim is enough. The subscriber pattern adds clarity when you have 3+ engines reacting to the same event and want to see all subscribers in one place.

#### How to know Phase 1 is done

- Tool adapter pattern replaces the `if tool ==` branches in `tool_executor.py`.
- A new scanner can be added by writing one file and registering it.
- Scan → Risk handoff goes through `publish_scan_completed()` in `_events.py`, not a direct service call.
- All Engine subscribers are registered in `_subscribers.py` (if you chose that path).

#### What Phase 1 does not include

- Moving all files into engine folders.
- Renaming existing dot.case events.
- Splitting Audit out.
- Building any of the not-yet-started engines.

---

### Phase 2 — Join the Bus, Split Audit Out for Real

**Trigger**: Phase 1 is stable and shipping. At least two engines (Scanner + one other) are publishing events that another engine consumes.

**Goal**: Formalize the Engine Bus on top of existing Celery/Redis infrastructure. Move every cross-engine communication to events. Split Audit Engine's code out of Control Plane.

#### Step 2.1 — Formalize the Engine Bus

Build a thin event bus layer using Redis pub/sub backed by Celery tasks. **Do not introduce a second message broker** (no Kafka, no RabbitMQ separate from what Celery already uses).

```text
app/bus/
    __init__.py
    publisher.py       # publish(event_type, payload)
    subscriber.py      # @bus.subscribe("ScanCompleted")
    router.py          # maps events to Celery task chains
    contracts.py       # typed payload dataclasses per event
```

The bus should:

1. Accept strongly-typed event payloads (dataclasses or Pydantic models)
2. Route to Celery tasks for async delivery
3. Support same-process delivery for the MVP convenience (matching today's `run_inline=true`)
4. Log every event to a structured log for observability

```python
# app/bus/contracts.py

from dataclasses import dataclass
from datetime import datetime

@dataclass
class ScanCompletedEvent:
    event_type: str = "ScanCompleted"
    organization_id: int
    scan_job_id: int
    total_findings: int
    critical_count: int
    high_count: int
    completed_at: str  # ISO datetime
```

```python
# app/bus/publisher.py

from app.bus.contracts import ScanCompletedEvent
from app.workers.celery_app import celery

async def publish(event_type: str, payload: dict) -> None:
    """Publish an event to the bus.

    Currently dispatches via Celery task.
    """
    celery.send_task(
        "phantix.bus.dispatch",
        kwargs={"event_type": event_type, "payload": payload},
    )
```

Migrate the `_events.py` shim from Phase 1 to use the real bus:

```python
# app/bus/publisher.py — after migration

async def publish_scan_completed(
    organization_id: int,
    scan_job_id: int,
    results: list[ScanResult],
) -> None:
    event = ScanCompletedEvent(
        organization_id=organization_id,
        scan_job_id=scan_job_id,
        total_findings=len(results),
        critical_count=sum(1 for r in results if r.severity == "critical"),
        high_count=sum(1 for r in results if r.severity == "high"),
        completed_at=datetime.utcnow().isoformat(),
    )
    await publish("ScanCompleted", dataclasses.asdict(event))
```

#### Step 2.2 — Settle the event naming migration

Choose one of two options and commit to it in `app/bus/contracts.py`:

**Option A — Rename in place** (cleaner long-term, more work now):
Change Alert Engine's constants from `scan.completed` to `ScanCompleted`. Update all call sites. One naming convention everywhere.

**Option B — Translation shim** (safer, two conventions coexist):
The bus accepts both. A mapping dict in `app/bus/router.py` translates legacy dot.case to PascalCase at the boundary:

```python
# app/bus/router.py

EVENT_NAME_MAP = {
    "scan.completed": "ScanCompleted",
    "scan.failed": "ScanFailed",
    "risk.created": "RiskCreated",
    "risk.critical": "RiskCritical",
    "custom.test": "CustomTest",
}

def normalize_event_type(raw: str) -> str:
    return EVENT_NAME_MAP.get(raw, raw)
```

Make the choice visible. Record it in `app/bus/README.md` or the bus module docstring so new developers know which convention to follow.

#### Step 2.3 — Split Audit Engine out of Control Plane

This is **only a file move and boundary change** — no functionality changes.

**What stays in Control Plane** (`app/services/control_plane/` or existing `app/services/`):

- Org user directory (`organization_user_service.py`)
- Initiator/authorizer assignment (`audit_service.py` — control roles part)
- Dual-control session management (`org_user_auth_service.py`)
- Pending action queue (`POST /audit/pending`, `.../authorize`, `.../reject`)
- Session expiry enforcement

**What moves to Audit Engine** (`app/services/audit_engine/`):

- Immutable completed trail write (`audit_events` table)
- `GET /audit/events` and `GET /audit/events/{id}`
- `GET /audit/export` (CSV/JSON)
- Historical retention logic
- The rule: **nothing outside this module writes `audit_events` directly**

The split works like this: when an action completes (pending action authorized/rejected, or any other event that needs recording), **Control Plane publishes an `AuditRecorded` event to the bus**, and **Audit Engine subscribes to it** to write the immutable record. This is the first real test of the bus with a new subscriber that didn't previously exist.

```python
# In Control Plane — after authorizing a pending action

from app.bus.publisher import publish

await publish("AuditRecorded", {
    "organization_id": org_id,
    "action_key": pending.action_key,
    "category": pending.category,
    "initiator_name": pending.initiator_name,
    "authorizer_name": staff.full_name,
    "resource_type": pending.resource_type,
    "resource_id": pending.resource_id,
    "ip_address": request.client.host,
    "user_agent": request.headers.get("user-agent"),
    "timestamp": datetime.utcnow().isoformat(),
})
```

```python
# In Audit Engine (new module)

from app.bus.subscriber import subscribe

@subscribe("AuditRecorded")
async def record_audit_event(db, payload):
    event = AuditEvent(
        organization_id=payload["organization_id"],
        action_key=payload["action_key"],
        # ...
    )
    db.add(event)
    await db.commit()
```

**File layout after the split:**

```text
app/
  services/
    audit_engine/
      __init__.py
      audit_service.py       # immutable write + read + export
      audit_subscribers.py   # handles AuditRecorded event
    # Control Plane retains:
    organization_service.py
    organization_user_service.py
    org_user_auth_service.py
    audit_service.py          # trimmed to pending actions + control roles only
```

#### Step 2.4 — Move remaining implemented engines onto the bus

- **Alert Engine**: Already subscribes to `scan.completed` etc. — migrate to the bus subscriber pattern. Alert Engine should call `subscribe("ScanCompleted")` rather than having anyone call `enqueue_alert` directly for scan completion.
- **Risk Engine**: Already subscribes via the Phase 1 shim — formalize as `subscribe("ScanCompleted")`.
- **Asset Engine**: Publish `AssetCreated` and `AssetUpdated` events so Scanner and Risk Engines can react without polling.

#### How to know Phase 2 is done

- `app/bus/` exists with publisher, subscriber, contracts, and router modules.
- The event naming migration decision is documented and applied.
- No cross-engine direct calls remain — all go through the bus.
- Audit Engine has its own module with the immutable trail write path.
- The pending action queue stayed in Control Plane; only the completed record moved.
- Alert Engine and Risk Engine both use the subscriber pattern.

---

### Phase 3 — Build the Not-Yet-Started Engines

**Trigger**: Phases 0–2 are stable. Upstream engines (Scanner, Risk) have stable, well-understood output shapes. Customers are asking for compliance or AI features.

**Goal**: Seed Reporting Engine from existing exports, then build Compliance and AI Engines in dependency order.

**Constraint**: Build these **last** — they depend on Asset, Scanner, and Risk having stable schemas. Building against a moving target guarantees rework.

#### Step 3.1 — Reporting Engine (seeded from existing exports)

Do not build this from scratch. Lift the two existing ad hoc exports into a dedicated engine:

```text
app/services/reporting_engine/
    __init__.py
    exports/
        __init__.py
        risk_export.py       # lifted from risk_service.py
        audit_export.py      # lifted from audit engine (post-split)
    reports/
        executive.py
        technical.py
        board.py
    generators/
        pdf.py               # new work
        csv.py               # already works
        json.py              # already works
    subscribers.py           # subscribe to events to auto-generate
```

The existing `GET /risks/export?format=json|csv` and `GET /audit/export?format=json|csv` should continue working during the move — change the router to point to the new service, keep the old service as a thin wrapper if needed, remove the wrapper in the next cycle.

New capabilities to add in dependency order:
1. Cross-domain export (risk + scan results + asset context in one report)
2. Executive summary (prioritized findings + asset scale)
3. PDF generation (requires a library like WeasyPrint or ReportLab)
4. Scheduled delivery (requires bus subscription to periodic trigger)

#### Step 3.2 — Compliance Engine

This engine is a **consumer** — it maps findings to frameworks. Build it only when at least one customer needs a compliance report.

Start with a single framework (likely NDPR if early customers are Nigeria-based, or ISO 27001 for broader appeal):

```text
app/services/compliance_engine/
    __init__.py
    frameworks/
        __init__.py
        base.py             # FrameworkInterface (ABC)
        ndpr.py             # NDPR control mappings
        iso27001.py         # ISO 27001 control mappings
        soc2.py             # SOC 2 control mappings
    services/
        evidence_service.py     # CRUD for compliance_evidence table
        status_service.py       # per-framework status rollup
        gap_service.py          # what's missing analysis
    subscribers.py              # subscribe to FindingCreated, RiskUpdated
```

Tables already exist in the security schema DDL (`compliance_evidence`). No schema changes needed to start.

#### Step 3.3 — AI Engine (last, deliberately)

**Do not write AI code until the data residency question is answered.** Specifically: where do embeddings live?

- **If pgvector in the customer's security DB** — A+ design, maintains the hybrid privacy model. Requires the customer's PostgreSQL to have the pgvector extension installed. Document this as a prerequisite.
- **If a separate vector store** — you must explicitly disclose this to customers and update the privacy notice. This is a policy decision, not a technical one.

When you do build AI Engine:

```text
app/services/ai_engine/
    __init__.py
    llm/
        base.py             # LLMInterface (provider-agnostic)
        openai_adapter.py
        anthropic_adapter.py
    rag/
        retriever.py
        vector_store.py     # pgvector or other
    prompts/
        templates/          # versioned, not inlined
        manager.py
    insights/
        finding_explanation.py
        root_cause.py
        attack_path.py
        remediation.py
    summaries/
        executive.py
        technical.py
    subscribers.py          # subscribe to ScanCompleted, FindingCreated
```

AI Engine runs entirely as background workers. API requests must never wait for AI completion — the pattern is request → queue → poll/webhook, matching how `run_inline=false` scan jobs work today.

#### How to know Phase 3 is done

- Reporting Engine owns all exports (Risk, Audit, and any new ones).
- Compliance Engine maps at least one framework with working evidence collection.
- AI Engine is capable of at least one insight (e.g., finding explanation) running as a background worker.
- All three engines use the bus for cross-engine communication.

---

### Phase 4 — Full Folder Standard (If Warranted)

**Trigger**: Phases 1–3 are complete, and you're experiencing genuine contributor friction from files living in flat directories. If you're not feeling that friction, **skip this phase**.

**Goal**: Every engine gets the full approved folder standard. No engine imports another engine's internals — only from the Shared SDK (see §7 below) or published events.

#### What this means

Each engine gets its own subtree:

```text
app/
    engines/
        control_plane/
            api/             # router files
            services/
            repositories/
            models/
            schemas/
            workers/
            tasks/
            adapters/
            interfaces/
            validators/
            events/          # event definitions this engine publishes
            cache/
            tests/
            docs/
        asset_engine/
            # same structure
        scanner_engine/
            # same structure
        ...
```

**This is a file move, not a logic change.** The imports, routes, and module names stay the same — they just live in different directories. Do this with a script, test thoroughly, and don't mix it with feature work.

#### When to actually do it

Only if you have **multiple people** working on different engines simultaneously and they keep editing each other's files by accident. If you don't have that problem, the cost of moving files outweighs the benefit. The architecture map in `app/_engine_map.py` and the bus in `app/bus/` already enforce the important boundaries.

#### How to know Phase 4 is done (if you do it)

- Every file lives in its engine's subtree.
- Every engine has the full folder structure (even if some subdirectories are empty).
- No engine imports from another engine's `services/` or `models/`.
- All cross-engine communication goes through the bus.

---

## 4. — The Engine Folder Standard

Every engine that gets physically split out follows this exact structure:

```text
engine_name/
    api/                 # Route handlers (FastAPI routers)
    services/            # Business logic
    repositories/        # Data access layer
    models/              # SQLAlchemy / DB models
    schemas/             # Pydantic schemas (request/response)
    workers/             # Celery task definitions
    tasks/               # Background job logic
    adapters/            # External system integrations
    interfaces/          # Abstract base classes / contracts
    validators/          # Domain validation rules
    events/              # Event definitions this engine publishes/subscribes to
    cache/               # Caching logic
    tests/               # Unit + integration tests
    docs/                # Engine-specific documentation
```

**Rules:**

- No exceptions to the folder list. Empty directories are fine — they indicate "not yet needed" rather than "not part of the standard."
- `interfaces/` holds ABCs; `adapters/` holds implementations. Scanner's `ScannerInterface` goes in `interfaces/`, `NmapScanner` goes in `adapters/`.
- `events/` holds event dataclass definitions, not the publish/subscribe logic — that lives in `app/bus/`.
- `models/` are SQLAlchemy ORM models for the platform DB. Security DB tables are defined in DDL (`app/security_schema/`) and managed via asyncpg — those don't move.

---

## 5. — Engine-by-Engine Migration Checklist

Use this to track progress per engine.

### Control Plane (03)

- [ ] Pending action queue stays (authorization concern)
- [ ] Session management stays
- [ ] Org user directory stays
- [ ] Completed trail write moves to Audit Engine (Phase 2.3)
- [ ] Audit export moves to Reporting Engine (Phase 3.1)
- [ ] MUST NOT: execute scans, calculate risk, generate reports

### Asset Engine (05)

- [ ] Publish `AssetCreated` / `AssetUpdated` events (Phase 2.4)
- [ ] Ensure no other engine modifies assets directly
- [ ] MUST NOT: execute scans, calculate risk

### Scanner Engine (06)

- [ ] Tool Adapter pattern with `ScannerInterface` (Phase 1.1)
- [ ] Scan → Risk handoff through bus (Phase 1.2)
- [ ] Publish `ScanCompleted` / `ScanFailed` events (Phase 2.1)
- [ ] MUST NOT: generate reports, calculate risk, send email, call AI, calculate compliance

### Risk Engine (07)

- [ ] Subscribe to `ScanCompleted` event (Phase 1.2 / 2.1)
- [ ] Publish `RiskCreated` / `RiskUpdated` / `TreatmentApproved` events
- [ ] Export logic moves to Reporting Engine (Phase 3.1)
- [ ] MUST NOT: invoke scanners directly

### AI Engine (08)

- [ ] **Resolve data residency question first** (pgvector vs. external vector store)
- [ ] Build as background workers only
- [ ] Subscribe to relevant events
- [ ] MUST NOT: block API requests, run inline

### Compliance Engine (09)

- [ ] Implement first framework (NDPR or ISO 27001)
- [ ] Subscribe to `FindingCreated`, `RiskUpdated`
- [ ] MUST NOT: own remediation decisions (overlap with Risk Engine's `accepted` status)

### Reporting Engine (10)

- [ ] Lift Risk export out of Risk Engine (Phase 3.1)
- [ ] Lift Audit export out of Audit Engine (Phase 3.1)
- [ ] Add PDF generation
- [ ] Subscribe to events for auto-generation
- [ ] MUST NOT: perform scanning

### Alert Engine (11)

- [ ] Migrate from direct `enqueue_alert` calls to `subscribe()` pattern (Phase 2.4)
- [ ] Settle event naming migration (Phase 2.2)
- [ ] Wire real WhatsApp/Telegram providers (Track 1 — not engine architecture, but required for production)
- [ ] MUST NOT: decide what constitutes a risk (that's Risk Engine's job)

### Audit Engine (12)

- [ ] Split from Control Plane (Phase 2.3)
- [ ] Own the immutable trail write path
- [ ] Subscribe to `AuditRecorded` event
- [ ] Export moves to Reporting Engine in Phase 3.1
- [ ] MUST NOT: decide whether an action is allowed (that's Control Plane's job)

### Operations Engine (13)

- [ ] Already at target shape — smallest gap of any engine
- [ ] Consider early extraction to separate deployment (it monitors the process, so it should stay reachable when the process is unhealthy)
- [ ] MUST NOT: include business logic

---

## 6. — Event Contract Migration Plan

### Current state

| Event (dot.case) | Used by | Approved PascalCase equivalent |
|---|---|---|
| `scan.completed` | Alert Engine | `ScanCompleted` |
| `scan.failed` | Alert Engine | `ScanFailed` (not in approved catalog — add it) |
| `risk.created` | Alert Engine | `RiskCreated` |
| `risk.critical` | Alert Engine | `RiskCritical` (not in approved catalog — add it) |
| `custom.test` | Alert Engine | test-only, no equivalent needed |

### Target state (all PascalCase, strongly typed)

Full catalog from the Architecture Vault:

```
AssetCreated       AssetUpdated       ScanRequested
ScanQueued         ScanStarted        ScanCompleted
ScanFailed         FindingCreated     RiskCreated
RiskUpdated        TreatmentApproved  ComplianceUpdated
AIRequested        AICompleted        ReportGenerated
AlertQueued        AlertDelivered     AuditRecorded
```

Note: `ScanFailed`, `RiskCritical`, and `RiskCalculated` appear in reference flows but aren't in the formal approved catalog. Add them when you build the bus.

### Migration steps

1. **Phase 0**: New events use PascalCase.
2. **Phase 2.2**: Settle the naming decision (rename in place or translation shim).
3. **After Phase 2.2**: If you chose rename-in-place, rename all legacy events. If shim, document the shim and keep both working.
4. **Once all consumers have migrated**: Remove the translation shim (if you used one).

---

## 7. — Shared SDK Extraction Path

### When to build it

At the start of Phase 1, alongside the first real engine split. Not before — you'd be designing against guesses. Not after — engines need a shared contract before they can stop importing each other's internals.

### What goes in it

```text
sdk/
    __init__.py
    auth/
        __init__.py
        jwt.py              # JWT verification helpers (moved from app/core/security.py)
        dual_control.py     # session validation helpers
    database/
        __init__.py
        session.py          # engine factory + get_db (moved from app/db/session.py)
        security_db.py      # per-org security DB client (moved from services/security_db_client.py)
    events/
        __init__.py
        types.py            # shared event type definitions
    encryption/
        __init__.py
        fernet.py           # encrypt_value / decrypt_value (moved from core/encryption.py)
    exceptions/
        __init__.py
        base.py             # PhantixError, common HTTP exceptions
    constants/
        __init__.py
        severity.py         # Severity enum shared by Scanner, Risk, Alert
        statuses.py         # shared status enums
    types/
        __init__.py
        pagination.py       # shared pagination schemas
        datetime.py         # shared ISO datetime handling
    utilities/
        __init__.py
        logging.py          # structured logging setup
        telemetry.py        # metrics/tracing hooks (feeds Operations Engine)
```

### Extraction rule

Move a module into the SDK only when **two or more engines need it**. Don't pre-emptively extract. If only one engine uses a utility, keep it in that engine's code.

### How to extract incrementally

1. Create `sdk/` directory and `sdk/__init__.py`.
2. Move a module (e.g., `sdk/encryption/fernet.py`). Update imports in the original location to re-export from the SDK, keeping existing imports working.
3. Update call sites one at a time in subsequent PRs.
4. Remove the re-export shim once all call sites use the SDK path.

---

## 8. — The Infrastructure That Stays Shared

Some things **never** get split by engine. They stay shared across the entire platform:

| Component | Why it stays shared |
|---|---|
| **Platform DB** (`app/db/`) | Single PostgreSQL instance. One engine's tables are in the same database as another's — the schema name/prefix is the isolation boundary, not the connection. |
| **Security Schema DDL** (`app/security_schema/`) | Bootstraps customer security DBs. Shared DDL runner, shared version tracking. |
| **Celery app** (`app/workers/celery_app.py`) | One Celery cluster. Engine-specific task files are fine; separate Celery apps are not. |
| **Core config** (`app/core/config.py`) | One `Settings` class for the entire application. |
| **Alembic** (`alembic/`) | One migration chain for the platform DB. |
| **Docker Compose** | One `docker-compose.yml` for local dev. |
| **Logging, metrics, tracing** | Shared observability infrastructure. |

---

## 9. — Common Traps & Rules of Thumb

### Traps

1. **"Let's just move all files now."** — Don't. Moving files that work is not shipping. Move files only when you need to touch them for a feature change, or when contributor friction is costing more time than the move.

2. **"Let's add Kafka for the event bus."** — Don't. You have Celery + Redis. That is enough for well past MVP scale. Adding a second broker increases operational complexity before you've shipped.

3. **"The engine folder standard is the goal."** — It's not. The goal is clean boundaries. The folder structure is just one way to enforce them. The bus and the SDK do more for boundary enforcement than directory layout ever will.

4. **"AI Engine first because it's exciting."** — Don't. AI Engine depends on every other engine having stable output. Building it early means constant rework of prompt templates and vector indices. Build it last, on purpose.

5. **"Audit is just part of Control Plane."** — That was the earlier call. The v1.0 plan overrides it: authorization (Control Plane) and the record of what happened (Audit Engine) are different concerns. They share a router prefix today, but they shouldn't share code ownership.

### Rules of thumb

- **If it touches one table, it belongs to one engine.** Shared tables are the #1 cause of boundary erosion.
- **If it's a question about risk, it belongs in Risk Engine.** If it's a question about scanning, it belongs in Scanner Engine. If it's both, it's an event.
- **Write the MUST NOT list first.** Before you build a feature in an engine, write down what the engine is not allowed to do. Then don't do those things.
- **The bus should be boring.** It doesn't need to be fast, fancy, or distributed. It needs to be reliable, typed, and audited.
- **Phase 4 is optional.** The architecture is complete when Phase 3 is done. Phase 4 (moving files into engine subtrees) is a developer-ergonomics step, not an architectural requirement. If the bus + SDK + naming conventions are working, you may never need it.

---

**End of Migration Guide**

*This document is a living artifact of the Phantix Backend Architecture Refactoring Plan v1.0 (July 2026). It should be updated as each phase completes and as experience reveals better approaches. The Architecture Vault (`Phantix Architecture Vault/`) is the source of truth for the target state; this guide is the path.*

## Status update (July 2026)

- **Audit Engine split**: pending/roles → `control_plane.services.dual_control_service`; immutable trail → `audit_engine.services.audit_service` (status **implemented**).
- **Compliance Engine**: MVP NDPR/ISO27001/SOC2 mapping + report sections (status **implemented**); Reporting collector no longer uses compliance placeholder.
