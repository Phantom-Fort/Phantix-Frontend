# Phantix Backend — Concurrency & Multi-Tenancy Analysis

**Version**: 1.1
**Date**: July 14, 2026
**Status**: Analysis + **Tier 1–3 remediation applied** (see changelog below)
**Audience**: Phantix Backend Engineers, Infrastructure Engineers

### Remediation applied (2026-07-14)

| ID | Fix | Code |
|---|---|---|
| T-1.1 | Per-org security DB pools | `app/shared/database/security_db.py` (`SecurityDBPoolManager`) |
| T-1.2 | Redis tool locks (fail-closed) + global scan slots | `app/shared/concurrency/redis_lock.py`, `tool_executor.py` |
| T-1.3 | PostgreSQL required in production/staging | `app/main.py` `_assert_production_database` |
| T-1.4 / T-2.4 | slowapi + Redis rate limits | `app/core/rate_limit.py` + heavy route decorators |
| T-2.1 | Celery queues scans/vapt/alerts/reports/bus | `app/workers/celery_app.py`, `docker-compose.yml` |
| T-2.2 | Risk ingest via Celery + bus DLQ retry | `risk_engine/events/subscribers.py`, `tasks.py`, `publisher.py` |
| T-2.3 | Platform pool defaults 30+60 (MULTI_TENANT Phase 1) | `config.py`, `.env.example` |
| T-2.5 | uvicorn multi-worker | `Dockerfile` `UVICORN_WORKERS` |
| T-3.1 | Schedule poll cap | `VAPT_SCHEDULE_POLL_MAX` in `poll_vapt_schedules_task` |
| T-3.2 | Report worker `-c 1 --max-memory-per-child` | `docker-compose.yml` worker-reports |
| T-3.3 | Alert severity priority | `alert_service.process_pending_batch` |
| T-3.4 | RedBeat HA (2 beat instances) | `celery-redbeat`, compose `beat` + `beat-standby` |
| T-3.5 | Concurrent email recipients | `asyncio.gather` in `alert_channels.send_email` |
| Ops | Security pool + lock metrics | `GET /api/v1/admin/server/runtime` |
| Multi-tenant Phase 1 | Credential cache, pool 30+60, request timeout 10s, report locks, global scan 20 | See `MULTI_TENANT_SCALING_PLAN.md` |

---

## Table of Contents

1. [Scope of This Analysis](#1--scope-of-this-analysis)
2. [How Multi-Tenancy Works Today](#2--how-multi-tenancy-works-today)
3. [Database Layer Analysis](#3--database-layer-analysis)
4. [API Layer Analysis](#4--api-layer-analysis)
5. [Engine Bus Analysis](#5--engine-bus-analysis)
6. [Celery & Async Workers Analysis](#6--celery--async-workers-analysis)
7. [Scan & Tool Execution Analysis](#7--scan--tool-execution-analysis)
8. [Campaign & Scheduling Analysis](#8--campaign--scheduling-analysis)
9. [Alert Delivery Analysis](#9--alert-delivery-analysis)
10. [Report Generation Analysis](#10--report-generation-analysis)
11. [Risk Impact Matrix](#11--risk-impact-matrix)
12. [Remediation Plan — Tier 1: Must Fix Before Multi-Org Production](#12--remediation-plan--tier-1-must-fix-before-multi-org-production)
13. [Remediation Plan — Tier 2: Should Fix Before 10+ Concurrent Orgs](#13--remediation-plan--tier-2-should-fix-before-10-concurrent-orgs)
14. [Remediation Plan — Tier 3: Fix at Scale (50+ Orgs)](#14--remediation-plan--tier-3-fix-at-scale-50-orgs)
15. [Horizontal Scaling Architecture](#15--horizontal-scaling-architecture)
16. [Monitoring & Observability Recommendations](#16--monitoring--observability-recommendations)
17. [Capacity Planning Guide](#17--capacity-planning-guide)

---

## 1. — Scope of This Analysis

This document analyzes the Phantix Backend's ability to serve **multiple organizations concurrently**, where each organization has:

- Its own dedicated security database (customer-hosted PostgreSQL)
- Its own assets, scan jobs, VAPT campaigns, alerts, and reports
- Potentially overlapping schedules and concurrent activity

The analysis covers every layer: database connections, API request handling, the Engine Bus, Celery workers, scan tool execution, VAPT campaign management, alert delivery, and report generation. Each section identifies bottlenecks, rates severity, and proposes remediation.

---

## 2. — How Multi-Tenancy Works Today

### 2.1 The Hybrid Model

```
Org A ──▶ Phantix API ──▶ Platform DB (shared, pooled)
  │                            PostgreSQL
  │                            - org metadata
  │                            - encrypted credentials
  │                            - reports, schedules
  │                            - audit trail metadata
  │
  ├──▶ Org A's Security DB (customer-hosted, no pool)
  │       PostgreSQL
  │       - assets, tags, scan_results
  │       - risks, risk_assessments
  │       - correlated_findings
  │
  └──▶ Org A's Config DB (optional, config_inspection)
          customer-hosted
```

**Key property**: The platform DB is shared and pooled (max 30 connections). Each org's security DB gets **no connection pool** — every read/write opens a fresh `asyncpg.connect()` and closes immediately after.

### 2.2 Tenant Isolation Boundaries

| Resource | Isolation Mechanism | Shared or Per-Tenant |
|---|---|---|
| Platform DB data | `organization_id` column on every table | Shared database |
| Security DB data | Physically separate database per org | Per-tenant |
| Scan jobs | `organization_id` column in security DB | Per-tenant table |
| VAPT campaigns | `organization_id` column, one-active-per-org enforced | Shared table with tenant filter |
| Celery queue | Single queue for all orgs | Shared (no isolation) |
| Process locks | In-memory `_org_locks` dict (per-process) | Shared process memory |
| Alert daemon | Single daemon, FIFO processing | Shared (no per-org prioritization) |

---

## 3. — Database Layer Analysis

### 3.1 Platform DB Connection Pool

**Current configuration** (when using PostgreSQL):

```python
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,          # 10 persistent connections
    max_overflow=20,       # 20 burst connections
    pool_recycle=1800,     # recycle every 30 min
    pool_pre_ping=True,    # test before use
    pool_timeout=30,       # wait 30s before error
)
```

**Effective maximum**: **30 concurrent connections** to the platform DB.

#### Who Contends for These Connections

| Consumer | Typical Connection Pattern | Connections Per Operation |
|---|---|---|
| HTTP API request | `get_db()` → 1 session per request | 1 |
| Celery scan task | `AsyncSessionLocal()` → 1 session | 1 |
| Celery VAPT task | `AsyncSessionLocal()` → 1 session | 1 |
| Celery alert task | `AsyncSessionLocal()` → 1 session | 1 |
| Celery schedule poll | `AsyncSessionLocal()` → 1 session | 1 |
| Celery report gen | `AsyncSessionLocal()` → 1 session | 1 |
| Alert daemon | `AsyncSessionLocal()` → 1 session per tick | 1 |

**Bottleneck analysis**: With a single uvicorn worker handling HTTP requests, 1 Celery worker (with `prefetch_multiplier=1`), and the alert daemon, the platform DB pool rarely hits 30 simultaneous connections during normal operation. However, a burst of 5 concurrent VAPT campaigns + 10 scan tasks + a few API requests could exhaust the pool if all open sessions simultaneously.

**SQLite path**: No pooling at all. `check_same_thread=False`. Only safe for single-user development. Any concurrent Celery task hitting the platform DB while an API request has an open session will fail with `database is locked`. **SQLite is not suitable for multi-org use.**

#### Remediation

| Issue | Fix | Priority |
|---|---|---|
| Pool too small for burst scenarios | Increase `pool_size=20`, `max_overflow=40` | Tier 1 |
| SQLite in production | Document that PostgreSQL is required. Add startup check. | Tier 1 |
| No monitoring on pool utilization | Export pool stats (`pool.size()`, `pool.overflow()`, `pool.waiters()`) to Operations Engine | Tier 2 |
| Long-running VAPT tasks hold sessions | Sessions should be short-lived per step, not per campaign | Tier 2 |

### 3.2 Security DB Connections (No Pool) — 🔴 Critical Bottleneck

**Current implementation:**

```python
@asynccontextmanager
async def security_connection(platform_db, organization_id, ...):
    ctx = await resolve_security_storage(platform_db, organization_id)
    # Each call decrypts credentials + opens fresh asyncpg connection
    conn = await asyncpg.connect(host, port, user, password, database, ssl, timeout=...)
    try:
        yield conn, ctx
    finally:
        await conn.close()
```

**What happens on every call:**
1. Platform DB query to find the org's `CustomerDBConnection` row
2. Fernet decryption of `encrypted_password`
3. DNS resolution of the customer's hostname
4. TCP handshake to the customer's database
5. TLS handshake (if SSL enabled)
6. PostgreSQL authentication handshake
7. Query execution
8. Connection teardown (TCP FIN)

**For a single scan job producing 10 scan results**, this sequence runs at minimum:
- 1× resolve + connect for job status check
- 10× resolve + connect for result writes
- = **11 fresh TCP+TLS handshakes** per scan job per org

#### Why This Is Critical

| Factor | Impact |
|---|---|
| DNS resolution | Each call re-resolves the customer's hostname. No DNS cache. Slow and unnecessary for repeated connections to the same org. |
| TLS handshake | 2–3 round trips per connection. Adds 10-50ms per connect. |
| TCP setup | SYN/SYN-ACK/ACK for every single query. |
| Credential decryption | Fernet decrypt on every call — cheap but repeated unnecessarily. |
| No connection reuse | The same org's security DB is connected and disconnected for every single query. No benefits of connection pooling (keepalive, prepared statements, cached plan). |
| Scalability ceiling | For 10 concurrent orgs, each running 1 scan: ~110 connections opened per minute. Each connection involves DNS + TCP + TLS + auth. Latency accumulates additively. |

#### Remediation

```python
# Target implementation — per-org asyncpg connection pool

class SecurityDBPoolManager:
    """Manages per-organization asyncpg connection pools.

    Each org gets its own pool of connections to its security database.
    Pools are created lazily and expire after inactivity.
    """

    _pools: dict[int, asyncpg.Pool] = {}
    _locks: dict[int, asyncio.Lock] = {}
    _last_used: dict[int, datetime] = {}
    POOL_MIN_SIZE = 2
    POOL_MAX_SIZE = 10
    POOL_EXPIRE_SECONDS = 600  # 10 min inactivity → pool closed

    async def get_pool(self, platform_db, organization_id: int) -> asyncpg.Pool:
        """Get or create a connection pool for an org's security DB."""
        if organization_id in self._pools:
            self._last_used[organization_id] = datetime.utcnow()
            pool = self._pools[organization_id]
            if not pool._closed:
                return pool

        # Thread-safe creation
        if organization_id not in self._locks:
            self._locks[organization_id] = asyncio.Lock()

        async with self._locks[organization_id]:
            # Double-check after acquiring lock
            if organization_id in self._pools:
                pool = self._pools[organization_id]
                if not pool._closed:
                    return pool

            ctx = await resolve_security_storage(platform_db, organization_id)
            conn_info = await self._resolve_connection(ctx)

            pool = await asyncpg.create_pool(
                host=conn_info["host"],
                port=conn_info["port"],
                user=conn_info["user"],
                password=conn_info["password"],
                database=conn_info["database"],
                ssl=conn_info["ssl"],
                min_size=self.POOL_MIN_SIZE,
                max_size=self.POOL_MAX_SIZE,
                timeout=5,
            )

            self._pools[organization_id] = pool
            self._last_used[organization_id] = datetime.utcnow()
            return pool

    async def expire_idle_pools(self):
        """Background task: close pools not used in POOL_EXPIRE_SECONDS."""
        now = datetime.utcnow()
        idle = [
            org_id for org_id, last in self._last_used.items()
            if (now - last).total_seconds() > self.POOL_EXPIRE_SECONDS
        ]
        for org_id in idle:
            pool = self._pools.pop(org_id, None)
            self._last_used.pop(org_id, None)
            if pool:
                await pool.close()
```

**Changes required to `security_connection`:**

```python
# Before: opens and closes a connection every time
@asynccontextmanager
async def security_connection(platform_db, organization_id, ...):
    ctx = await resolve_security_storage(platform_db, organization_id)
    conn = await asyncpg.connect(...)
    try:
        yield conn, ctx
    finally:
        await conn.close()

# After: acquires from a persistent pool, returns to pool
pool_manager = SecurityDBPoolManager()

@asynccontextmanager
async def security_connection(platform_db, organization_id, ...):
    pool = await pool_manager.get_pool(platform_db, organization_id)
    conn = await pool.acquire()
    try:
        yield conn, await resolve_security_storage(platform_db, organization_id)
    finally:
        await pool.release(conn)
```

---

## 4. — API Layer Analysis

### 4.1 Single Uvicorn Worker

**Current configuration:**

```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**No `--workers N` flag.** A single Python process handles all HTTP requests. For an async ASGI app, this means a single event loop serving all orgs concurrently. This is:
- **CPU-bound stalls**: A sync endpoint or blocking call blocks ALL orgs' requests, not just the requester's.
- **Worker restart**: On deploy, all in-flight requests are interrupted.

#### Remediation

```dockerfile
# Production deployment
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

Or run behind a process manager (Gunicorn with UvicornWorker). This requires fixing the process-local `_org_locks` dict (see Section 7) since multiple workers need a shared lock mechanism.

### 4.2 No Request Rate Limiting — 🟡 Medium

**Current state**: Zero rate limiting on any endpoint. One org can send 1000 requests/second and consume all platform DB connections, starving other orgs.

#### Remediation

```python
# Add per-org rate limiting middleware or dependency

from slowapi import Limiter
from slowapi.util import get_remote_address
from app.engines.control_plane.models.organization import Organization

limiter = Limiter(key_func=get_remote_address)


# Per-org rate limit (requires authenticated request)
async def get_org_rate_limit_key(request):
    """Rate limit keyed by organization_id."""
    org = getattr(request.state, "organization", None)
    if org:
        return f"org:{org.id}"
    return "anonymous"


# Example usage on heavy endpoints
@router.post("/assets")
@limiter.limit("100/minute", key_func=get_org_rate_limit_key)
async def create_asset(...):
    ...

# Global per-IP limit for unauthenticated routes
@router.post("/organizations/register")
@limiter.limit("5/minute", key_func=get_remote_address)
async def register_organization(...):
    ...
```

---

## 5. — Engine Bus Analysis

### 5.1 In-Process Subscribers Block the Publisher — 🟡 Medium

**Current behavior:**

```python
async def publish(event_type, organization_id, payload, ...):
    event = EngineEvent(...)

    # Subscribers run in the SAME async context as the publisher
    for handler in handlers_for(event.event_type):
        await handler(event)  # ← blocks here until handler completes

    # Only AFTER all subscribers finish does publish() return
    return event
```

**What this means**: When VAPT Engine publishes `ScanCompleted`, the publishing task (e.g., a campaign step advancement) doesn't return until Risk Engine's `on_scan_completed()` handler finishes. For a campaign with multiple findings, this could be seconds — during which the publisher holds its DB session, tool locks, and campaign step state.

#### Impact Table

| Publisher | Subscriber(s) | Worst-Case Blocking Time | Impact |
|---|---|---|---|
| Scanner Engine (`ScanCompleted`) | Risk Engine (risk ingest + scoring) | 1–5s per scan | Campaign step advancement delayed |
| VAPT Engine (`CampaignCompleted`) | Reporting Engine (report gen start) | ~100ms (queues Celery task) | Negligible |
| Any engine (`AlertQueued`) | Alert Engine (delivery start) | ~50ms | Negligible |
| Control Plane (`AuditRecorded`) | Audit Engine (write event) | ~20ms | Negligible |

**The Risk Engine subscriber is the bottleneck.**

#### Remediation (Two Options)

**Option A: Fan out slow subscribers to Celery (recommended for Phase 1)**

```python
# In the subscriber itself, dispatch to Celery if the work is expensive

@subscribe("ScanCompleted")
async def on_scan_completed(event: EngineEvent):
    # Acknowledge immediately — don't block the publisher
    from app.workers.tasks import process_scan_completed_task
    process_scan_completed_task.delay(
        organization_id=event.organization_id,
        payload=event.payload,
    )
```

This matches the `fanout_celery=True` pattern already in the publisher, but moves the decision to the subscriber where it belongs.

**Option B: Use `asyncio.create_task` for fire-and-forget (lightweight)**

```python
@subscribe("ScanCompleted")
async def on_scan_completed(event: EngineEvent):
    # Fire and forget — publisher continues immediately
    asyncio.create_task(_ingest_scan_results_async(event))
```

Risky: if the background task fails, the error is lost. The publisher has no visibility into subscriber success/failure.

### 5.2 Subscriber Registry is Process-Local

**Current state**: `_SUBSCRIBERS` is a Python module-level dict. Every uvicorn worker and Celery worker has its own copy.

**Impact**: If you run 4 uvicorn workers and 2 Celery workers:
- Publisher in worker 1 publishes to subscribers in worker 1 only
- Workers 2-4 never see the event
- Celery task dispatched from worker 1 runs the subscriber in ONE Celery worker

This is correct behavior for the current architecture (no cross-worker bus needed) but becomes a problem if you ever want to split engines into separate processes. The existing `dispatch_engine_event_task` Celery task is the solution — it re-publishes the event to the Celery worker's local subscriber registry.

### 5.3 No Dead Letter Queue for Failed Subscribers

If a subscriber throws an exception, the error is logged but the publisher moves on. There's no retry mechanism for subscriber failures. For critical subscribers (Risk Engine processing scan results), a failure means the finding is never scored.

#### Remediation

```python
async def publish(event_type, organization_id, payload, ...):
    errors = []
    for handler in handlers_for(event.event_type):
        try:
            await handler(event)
        except Exception as exc:
            errors.append(...)

    if errors:
        # Enqueue a dead-letter event for later retry
        if settings.BUS_DEAD_LETTER_ENABLED:
            from app.workers.tasks import retry_bus_event_task
            retry_bus_event_task.delay(event.to_dict(), errors)
```

---

## 6. — Celery & Async Workers Analysis

### 6.1 Single Queue for All Orgs — 🟡 Medium

**Current state**: Every task type uses the default Celery queue. No task routing.

```
Default Queue (all orgs, all task types)
├── phantix.scan.run_job (org A)
├── phantix.scan.run_job (org B)
├── phantix.vapt.run_campaign (org C)
├── phantix.alerts.process_event (org A)
├── phantix.reporting.generate_report (org D)
├── phantix.vapt.execute_schedule (org E)
└── ...
```

**Problem**: A busy org with back-to-back campaigns can queue 50 tasks, delaying a quieter org's alert delivery. There's no per-org fairness.

#### Remediation

```python
# Task routing by org and priority

celery.conf.task_routes = {
    "phantix.alerts.*": {"queue": "alerts"},
    "phantix.vapt.*": {"queue": "vapt"},
    "phantix.scan.*": {"queue": "scans"},
    "phantix.reporting.*": {"queue": "reports"},
}

# Or for per-org isolation (more queues but full isolation):
celery.conf.task_routes = {
    f"phantix.org_{org_id}.*": {"queue": f"org_{org_id}"}
    for org_id in active_orgs
}
```

```bash
# Start per-queue workers
celery -A app.workers.celery_app worker -Q scans -c 2
celery -A app.workers.celery_app worker -Q vapt -c 1
celery -A app.workers.celery_app worker -Q alerts -c 1
```

### 6.2 `poll_vapt_schedules` Fires All Due Campaigns Simultaneously

When `poll_vapt_schedules_task()` runs, it fetches ALL due schedules across ALL orgs and fires `execute_schedule_task.delay()` for each one. If 50 orgs have schedules due at the same hour, 50 Celery tasks are enqueued simultaneously. Each one:
1. Opens a platform DB connection
2. Checks concurrency limits
3. Creates a campaign
4. Starts campaign execution

**50 concurrent DB operations** on the platform DB's 30-connection pool will cause contention.

#### Remediation

```python
# Rate-limit schedule execution
@celery.task(name="phantix.vapt.poll_schedules")
def poll_vapt_schedules_task() -> dict:
    async def _go():
        due = await sched.get_due_schedules(session)
        # Fire at most 10 at a time, remaining will be picked up next poll
        for s in due[:10]:
            execute_vapt_schedule_task.delay(s.id)
        # Log how many were deferred
        if len(due) > 10:
            logger.info("Deferred %s schedules to next poll cycle", len(due) - 10)
        ...
```

### 6.3 Celery Tasks Use `asyncio.run()` — One Event Loop Per Task

Every Celery task wraps its async code in `asyncio.run()`, which creates and destroys a new event loop. For short tasks (alert delivery: ~50ms), this overhead is negligible. For long tasks (scan execution: 10+ minutes), it doesn't matter. But for medium tasks (VAPT step: 30s), creating a loop per invocation is wasteful.

**Not a critical issue** — `asyncio.run()` overhead is ~1ms. But it prevents sharing async context (e.g., a connection pool) across Celery task invocations.

### 6.4 No Celery Beat HA

`celery beat` runs as a single process. If it crashes, `poll_vapt_schedules`, `process_pending_alerts`, and `refresh_cve_cache` stop running. For production, run two beat instances with `--scheduler` that supports leader election (e.g., `django-celery-beat`'s database scheduler, or `celery[redis]`'s beat scheduler).

---

## 7. — Scan & Tool Execution Analysis

### 7.1 Process-Local Tool Locks — 🔴 Critical

**Current implementation:**

```python
_org_locks: dict[int, asyncio.Lock] = {}

def _org_lock(organization_id: int) -> asyncio.Lock:
    if organization_id not in _org_locks:
        _org_locks[organization_id] = asyncio.Lock()
    return _org_locks[organization_id]
```

This `_org_locks` dict is a **module-level variable in process memory**. Every uvicorn worker and Celery worker has its own copy. With `--workers 4` and 2 Celery workers, you have **6 independent lock dicts** — 6 concurrent nmap runs for the same org.

**The scan_job table check prevents creating duplicate jobs across workers, but does not prevent executing the same job twice.**

#### Remediation

```python
import aioredis

class DistributedOrgLock:
    """Redis-based distributed lock for per-org tool execution."""

    def __init__(self, redis_url: str):
        self.redis = aioredis.from_url(redis_url)

    async def acquire(self, org_id: int, timeout: int = 600) -> bool:
        """Try to acquire the lock for an org. Returns True if acquired."""
        lock_key = f"tool_lock:org:{org_id}"
        # SET NX EX — atomically set if not exists, expire after timeout seconds
        result = await self.redis.set(lock_key, "locked", nx=True, ex=timeout)
        return result is not None

    async def release(self, org_id: int):
        """Release the lock for an org."""
        await self.redis.delete(f"tool_lock:org:{org_id}")

    async def __aenter__(self, org_id: int):
        """Context manager for use with async with."""
        self._org_id = org_id
        acquired = await self.acquire(org_id)
        if not acquired:
            raise ToolLockError(f"Another scan is already running for org {org_id}")
        return self

    async def __aexit__(self, *args):
        await self.release(self._org_id)
```

```python
# Usage in tool_executor.py:
lock = DistributedOrgLock(settings.REDIS_URL)
async with await lock.acquire(organization_id):
    # Run nmap/nuclei — guaranteed single execution per org across all workers
    result = await run_tool(...)
```

### 7.2 Docker Resource Contention

Every parallel scan job launches Docker containers for nmap/nuclei. Without container-level resource limits, N concurrent scans can saturate host CPU/memory. Each nmap scan with `-sV -T4` can consume ~500MB RAM.

#### Remediation

```yaml
# In docker-compose.yml or Docker run commands:
services:
  scanner:
    image: instrumentisto/nmap
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
```

Plus a global scan concurrency limit in `tool_executor.py`:

```python
_semaphore = asyncio.Semaphore(5)  # max 5 concurrent Docker containers globally

async def run_tool(...):
    async with _semaphore:
        async with await lock.acquire(org_id):
            return await _run_docker(...)
```

---

## 8. — Campaign & Scheduling Analysis

### 8.1 One VAPT Campaign Per Org — Correct by Design

The `start_campaign()` function enforces a DB-level check:

```python
other = await db.execute(
    select(VaptCampaign).where(
        VaptCampaign.organization_id == org.id,
        VaptCampaign.status.in_(["active", "paused", "pending_approval"]),
    )
)
```

This works across all workers/processes because it's a database query. It's also correct — you don't want two campaigns overlapping for the same org.

**Limitation**: A large org with multiple teams (IT Security, App Sec, Compliance) can only run one campaign at a time. Consider lifting this to a per-team or per-scope limit for enterprise orgs in the future.

### 8.2 Campaign Steps Run Inline (Block Celery Worker)

When `run_inline_scans=True` (the default), each scan step in a campaign blocks the Celery worker for the entire step duration. A 3-step campaign (nmap 5min + nuclei 5min + correlate 1min) ties up a Celery worker for 11 minutes.

#### Remediation

```python
# In step_executor.py — for scan steps, offload to the scan queue
async def _run_scan_step(db, org, campaign, step, *, run_inline=True):
    if run_inline:
        # Current behavior: blocks the Celery worker
        job = await scanner_adapter.create_scan_for_step(db, org, step)
        scan_job_id = job["id"]
        await wait_for_scan_completion(scan_job_id, timeout=3600)
    else:
        # New: dispatch to Celery scan queue, resume when done
        job = await scanner_adapter.create_scan_for_step(db, org, step)
        scan_job_id = job["id"]
        step.config["scan_job_id"] = scan_job_id
        step.status = "waiting_for_scan"
        # Publisher will be notified via ScanCompleted event
```

### 8.3 Schedule Polling Burst

`get_due_schedules()` fires all due schedules simultaneously. For 50 orgs with daily schedules, 50 campaigns start at the same hour.

#### Remediation

```python
# Add staggering to schedules
async def get_due_schedules(db, max_results=10):
    """Return at most max_results due schedules. Remaining wait for next poll."""
    result = await db.execute(
        select(VaptSchedule).where(
            VaptSchedule.is_active == True,
            VaptSchedule.next_run_at <= datetime.utcnow(),
        ).limit(max_results)
    )
    return result.scalars().all()
```

---

## 9. — Alert Delivery Analysis

### 9.1 Sequential Per-Batch Processing — 🟢 Low Risk

The alert daemon processes alerts sequentially within each batch:

```python
async def tick(batch_size=50):
    for event in pending_events:
        await process_alert_event(session, event.id)  # ← sequential
```

At 50 alerts/batch × 5 seconds, throughput is ~10 alerts/second. For a critical alert that needs email + WhatsApp + Telegram delivery to 5 recipients, that's 15 deliveries for one alert. At 10 alerts/sec, worst-case latency from queue to delivery is ~5 seconds.

**Adequate for current scale.** If alert volume grows to 1000+/minute, switch to concurrent delivery:

```python
async def tick(batch_size=50):
    tasks = [process_alert_event(session, e.id) for e in pending_events]
    await asyncio.gather(*tasks)  # ← concurrent
```

### 9.2 No Per-Org Alert Priority

Alerts are processed FIFO across all orgs. A volume of low-severity alerts from one org can delay critical alerts from another.

#### Remediation

```python
# Process critical alerts first, regardless of queue position
SELECT * FROM alert_events
WHERE status = 'pending'
ORDER BY
    CASE severity
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
    END,
    created_at ASC
LIMIT $1
```

---

## 10. — Report Generation Analysis

### 10.1 Report Generation is CPU-Bound and Memory-Intensive

PDF generation (WeasyPrint) and DOCX generation (python-docx) are CPU-bound operations. For large reports with 500+ findings and embedded charts, report generation can consume:
- **CPU**: 10-30s of sustained CPU for WeasyPrint PDF rendering
- **Memory**: 200-500MB for large reports in memory

#### Remediation

```python
# Report generation already runs as a Celery task — good.
# Add resource limits to the report worker:
celery.conf.task_routes = {
    "phantix.reporting.*": {"queue": "reports"},
}
```

```bash
# Run report worker with limited concurrency
celery -A app.workers.celery_app worker -Q reports -c 1 --max-memory-per-child 500000
```

### 10.2 Concurrent Report Generation Contends for Platform DB Pool

Report generation pulls sections from multiple engines, each requiring platform DB queries. 5 concurrent report generations × 5 section queries each = 25 platform DB connections (out of 30).

---

## 11. — Risk Impact Matrix

| Issue | Layer | Severity | Likelihood | Impact | Risk Score |
|---|---|---|---|---|---|
| No security DB connection pooling | Database | 🔴 Critical | Certain with 5+ orgs | Connection exhaustion, latency spikes | **25** |
| Process-local tool locks | Scans | 🔴 Critical | Certain with 2+ workers | Concurrent scan execution (data races) | **25** |
| No rate limiting | API | 🟡 Medium | Likely with automated clients | API DoS from single org | **16** |
| Single Celery queue | Workers | 🟡 Medium | Likely with 10+ orgs | Head-of-line blocking | **12** |
| SQLite DB in production | Database | 🔴 Critical | Certain if undetected | `database is locked` errors | **20** |
| In-process bus subscribers block publisher | Engine Bus | 🟡 Medium | Likely with concurrent campaigns | Campaign step delays | **12** |
| Platform DB pool too small | Database | 🟡 Medium | Possible with peak load | Connection timeouts | **9** |
| Schedule polling burst | Campaigns | 🟢 Low | Likely at scheduled times | Short DB spike | **6** |
| No per-org alert priority | Alerts | 🟢 Low | Possible with diverse orgs | Critical alert delay | **4** |
| No Celery Beat HA | Workers | 🟢 Low | Unlikely (one service) | Scheduled tasks stop | **3** |

**Risk Score = Severity (5/4/3/2/1) × Likelihood (5/4/3/2/1)**

---

## 12. — Remediation Plan — Tier 1: Must Fix Before Multi-Org Production

These issues will cause failures with 2+ concurrent orgs in production.

### T-1.1: Security DB Connection Pooling

**Effort**: 2-3 days
**Files**: `app/shared/database/security_db.py`
**Risk**: Medium (changes core DB access pattern)

Add a `SecurityDBPoolManager` class (see Section 3.2 above) that maintains per-org `asyncpg.Pool` instances. Replace `asyncpg.connect()` → `pool.acquire()` and `await conn.close()` → `pool.release(conn)`. Add pool expiry (close pools after 10 minutes of inactivity).

### T-1.2: Distributed Tool Locks

**Effort**: 1-2 days
**Files**: `app/engines/scanner_engine/adapters/tool_executor.py`
**Risk**: Low (locks are additive, existing behavior preserved)

Replace `_org_locks` dict with Redis-based distributed lock using `SET NX EX`. The `scan_service.py` scan job guard already prevents duplicate job creation — the Redis lock adds cross-process execution serialization.

### T-1.3: Document PostgreSQL Requirement

**Effort**: 1 hour
**Files**: `README.md`, `docs/LOCAL_DEV.md`, `app/core/config.py`
**Risk**: None

Add a startup check that rejects SQLite in production (`ENVIRONMENT=production`). Document that PostgreSQL is required for any deployment with more than 1 concurrent user.

### T-1.4: Rate Limit Unauthenticated Endpoints

**Effort**: 1 day
**Files**: `app/main.py`, organization registration + login routes
**Risk**: Low

Add rate limiting on `/organizations/register` (5/min per IP) and `/organizations/login` (10/min per IP). These are the only unauthenticated endpoints and the most vulnerable to abuse.

---

## 13. — Remediation Plan — Tier 2: Should Fix Before 10+ Concurrent Orgs

### T-2.1: Separate Celery Queues

**Effort**: 1 day
**Files**: `app/workers/celery_app.py`, Docker Compose
**Risk**: Low

Route tasks to `scans`, `vapt`, `alerts`, `reports` queues. Update `docker-compose.yml` to start per-queue Celery workers with appropriate concurrency.

### T-2.2: Bus Subscriber Resilience

**Effort**: 1 day
**Files**: `app/bus/publisher.py`, `app/bus/subscriber.py`
**Risk**: Low

Fan out heavy subscribers (Risk Engine's `on_scan_completed`) to Celery tasks so they don't block the publisher. Add dead-letter tracking for failed subscribers.

### T-2.3: Platform DB Pool Tuning

**Effort**: 30 minutes
**Files**: `.env.example`, `app/core/config.py`
**Risk**: None

Increase `DB_POOL_SIZE` to 20 and `DB_MAX_OVERFLOW` to 40 in production configuration. Add pool utilization metrics to Operations Engine.

### T-2.4: Rate Limit Authenticated Endpoints

**Effort**: 2 days
**Files**: Engine API route files
**Risk**: Low

Add per-org rate limits on heavy endpoints:
- `POST /api/v1/assets` : 100/min per org
- `POST /api/v1/scans/jobs` : 5/min per org
- `POST /api/v1/vapt/campaigns` : 2/min per org
- All other authenticated endpoints: 500/min per org

### T-2.5: uvicorn Multi-Worker

**Effort**: 30 minutes
**Files**: `Dockerfile` or deployment config
**Risk**: Medium (requires distributed locks from T-1.2)

Add `--workers 4` to uvicorn. Only after Redis-based tool locks are in place (T-1.2).

---

## 14. — Remediation Plan — Tier 3: Fix at Scale (50+ Orgs)

### T-3.1: Staggered Schedule Execution

**Effort**: 1 day
**Files**: `app/engines/vapt_engine/tasks/scheduled_campaigns.py`
**Risk**: Low

Limit `poll_vapt_schedules` to fire at most 10 schedule executions per poll cycle. Deferred schedules are picked up by the next cycle (60s later).

### T-3.2: Report Worker Resource Limits

**Effort**: 1 day
**Files**: Docker Compose, Celery configuration
**Risk**: Low

Run report generation worker with `-c 1` and `--max-memory-per-child 500000` to prevent memory leaks from affecting other workers.

### T-3.3: Per-Org Alert Priority

**Effort**: 1 day
**Files**: `app/engines/alert_engine/services/alert_service.py`
**Risk**: Low

Order pending alerts by severity before processing. Critical alerts always process first regardless of queue order.

### T-3.4: Celery Beat HA

**Effort**: 1 day
**Files**: Docker Compose
**Risk**: Low

Run two Celery Beat instances with Redis-based scheduling (`--scheduler app.workers.celery_app.RedisScheduler`). Only one actively dispatches; the other takes over if the first fails.

### T-3.5: Async Report Concurrent Delivery

**Effort**: 1 day
**Files**: `app/engines/alert_engine/services/alert_channels.py`
**Risk**: Low

Use `asyncio.gather()` for concurrent email delivery to multiple recipients within the same alert. Current sequential delivery doesn't scale for alerts with 10+ recipients.

---

## 15. — Horizontal Scaling Architecture

### 15.1 Current Single-Process Bottleneck

```
                          ┌──────────────┐
Request ──▶ FastAPI ──────▶ Platform DB   │
           (1 worker)     │ Redis         │
                          │ Celery        │
                          └──────────────┘
```

### 15.2 Target Scaling Architecture

```
                         ┌──────────────────┐
                         │ Load Balancer     │
                         │ (nginx / HAProxy) │
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
     │ FastAPI       │   │ FastAPI       │   │ FastAPI       │
     │ Worker 1     │   │ Worker 2     │   │ Worker N     │
     │ (uvicorn)    │   │ (uvicorn)    │   │ (uvicorn)    │
     └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
            │                  │                  │
            └──────────────────┼──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │     Redis            │
                    │  (broker + locks)    │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ┌───────────┐      ┌───────────┐       ┌───────────┐
   │ Celery     │      │ Celery     │       │ Celery     │
   │ Scan Queue │      │ VAPT Queue │       │ Alert Q   │
   │ (2-4 pods)  │      │ (1-2 pods) │       │ (1 pod)    │
   └───────────┘      └───────────┘       └───────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  Platform DB         │
                    │  PostgreSQL (pooled) │
                    └─────────────────────┘
```

### 15.3 Key Enablers for Horizontal Scaling

| Component | Prerequisites |
|---|---|
| Multiple uvicorn workers | Distributed Redis locks (T-1.2), per-worker statelessness |
| Multiple Celery workers | Per-queue task routing (T-2.1), distributed locks |
| Multiple Beat instances | Redis-based beat scheduler (T-3.4) |
| Load balancer | Health check endpoints exist (`/health`, `/status`) |

---

## 16. — Monitoring & Observability Recommendations

### 16.1 Metrics to Add

| Metric | Source | What It Detects |
|---|---|---|
| Platform DB pool size + waiters | SQLAlchemy engine | Pool exhaustion |
| Per-org security DB pool size | SecurityDBPoolManager | Orgs with high connection usage |
| Bus subscriber execution time | `publish()` timing | Slow subscribers |
| Tool lock acquisition time | Redis lock | Lock contention |
| Per-queue Celery task backlog | Celery inspect | Queue buildup |
| Active campaigns per org | VaptCampaign table | Campaign concurrency |
| Alert delivery latency | AlertEvent created → delivered | Delivery pipeline delay |
| Report generation time + memory | Report generation task | Heavy report detection |

### 16.2 Add to Operations Engine

```python
# app/engines/operations_engine/api/routes.py — add these endpoints

@router.get("/runtime/pools")
async def db_pool_status():
    """Report platform DB pool + per-org security DB pool stats."""
    return {
        "platform_db": {
            "size": engine.pool.size(),
            "overflow": engine.pool.overflow(),
            "waiters": engine.pool.waiters(),
        },
        "security_db_pools": {
            "active_pools": len(security_pool_manager._pools),
            "orgs": list(security_pool_manager._pools.keys()),
        },
    }

@router.get("/runtime/bus")
async def bus_subscriber_status():
    """Report bus subscribers and their execution history."""
    from app.bus.subscriber import list_subscribers
    return {
        "subscribers": list_subscribers(),
        "total_events_published": bus_event_counter,
        "failed_subscribers": bus_failure_counter,
    }
```

---

## 17. — Capacity Planning Guide

### 17.1 Connection Budget

| Component | Max Connections | Notes |
|---|---|---|
| Platform DB pool | 30 (owner: pool) | Increase to 60 for production |
| Per-org security DB pool | 10 per org (owner: pool) | Scales with org count |
| Redis | Celery-managed | Typically 10-20 connections |
| Customer DB max_connections | Customer-configured | Phantix uses at most 10 per org |

**Formula for platform DB connection budget**:

```
Total connections = API workers + Celery workers + Alert daemon + Headroom

  API workers   = 4 uvicorn workers × 2 sessions     =  8
  Celery workers = 2 scan + 1 vapt + 1 alert + 1 report =  5
  Alert daemon  = 1 session                          =  1
  Headroom (50%)                                      =  7
                                                       ───
  Total                                               = 21
```

**For production**: Set `pool_size=20`, `max_overflow=40`. This gives 60 max connections with 21 budgeted.

### 17.2 Memory Budget

| Component | Per Instance | Typical Count | Total |
|---|---|---|---|
| uvicorn worker | 100MB | 4 | 400MB |
| Celery scan worker | 200MB (scan containers extra) | 2 | 400MB |
| Celery VAPT worker | 150MB | 1 | 150MB |
| Celery alert worker | 100MB | 1 | 100MB |
| Celery report worker | 300MB (PDF generation) | 1 | 300MB |
| Redis | 100MB | 1 | 100MB |
| Platform DB (PostgreSQL) | 500MB | 1 | 500MB |
| | | **Total** | **~2GB** |

**Minimum production server**: 4GB RAM, 2-4 vCPUs.

### 17.3 Per-Org Scale Estimates

| Metric | Per Small Org | Per Medium Org | Per Large Org |
|---|---|---|---|
| Assets | 50 | 500 | 5,000 |
| Scan jobs/month | 5 | 20 | 100 |
| Campaigns/month | 1 | 5 | 20 |
| Reports/month | 1 | 5 | 20 |
| Platform DB storage | 1MB | 10MB | 50MB |
| Security DB storage | 10MB | 100MB | 500MB |

**Scaling rule of thumb**: 1 Celery scan worker per 50 concurrent scanning orgs. 1 Celery VAPT worker per 100 orgs. Security DB pool scales linearly with active orgs (each pool is 2-10 connections to the customer's database, not to Phantix's infrastructure).

---

## 18. — Tenant Isolation Audit

### 18.1 What This Audit Covers

An organization should never be able to see, modify, or infer another organization's data. This section audits every layer of the stack — database, API, services, file storage, event bus, and auth — for cross-tenant leakage paths.

### 18.2 Platform DB Models — Organization Scoping

Every per-organization table in the platform database has an `organization_id` foreign key:

#### ✅ Models WITH `organization_id` (correctly scoped):

| Table | Engine | Has `organization_id`? |
|---|---|---|
| `Organization` | Control Plane | N/A (root tenant — org IS the tenant) |
| `OrganizationUser` | Control Plane | ✅ FK → organizations |
| `OrganizationUserSession` | Control Plane | ✅ FK → organizations |
| `CustomerDBConnection` | Control Plane | ✅ FK → organizations |
| `OtpChallenge` | Control Plane | ✅ FK → organizations |
| `SupportTicket` | Control Plane | ✅ FK → organizations |
| `OrganizationSubscription` | Control Plane | ✅ FK → organizations |
| `PaymentTransaction` | Control Plane | ✅ FK → organizations |
| `OrganizationIntegration` | Asset Engine | ✅ FK → organizations |
| `OrganizationAlertSettings` | Alert Engine | ✅ FK → organizations |
| `AlertEvent` | Alert Engine | ✅ FK → organizations |
| `AlertDelivery` | Alert Engine | ✅ FK → organizations |
| `OrganizationControlRoles` | Audit Engine | ✅ FK → organizations |
| `AuditEvent` | Audit Engine | ✅ FK → organizations |
| `AuditPendingAction` | Audit Engine | ✅ FK → organizations |
| `Report` | Reporting Engine | ✅ FK → organizations |
| `ReportFindingTracker` | Reporting Engine | ✅ FK → organizations |
| `ReportTrackerHistory` | Reporting Engine | ✅ FK → organizations |
| `VaptCampaign` | VAPT Engine | ✅ FK → organizations |
| `VaptCampaignStep` | VAPT Engine | ✅ FK → organizations |
| `VaptOrgSettings` | VAPT Engine | ✅ FK → organizations |
| `VaptSchedule` | VAPT Engine | ✅ FK → organizations |
| `VaptCorrelatedFinding` | VAPT Engine | ✅ FK → organizations |
| `VaptApprovalRequest` | VAPT Engine | ✅ FK → organizations |
| `ClientToolProvision` | Control Plane | ✅ FK → organizations |
| `ToolSubscription` | Control Plane | ✅ FK → organizations |

#### ✅ Models WITHOUT `organization_id` (correctly global — not per-org):

| Table | Justification |
|---|---|
| `PlatformStaff` | Phantix employees, not customers |
| `PlatformBillingSettings` | Singleton — platform-wide pricing config |
| `PlatformDiscoverySettings` | Singleton — admin-set Nmap defaults |
| `ExperienceServiceConfig` | Platform-wide service definitions |
| `PlatformTool` | Tool catalog — same for all orgs |
| `VaptProcedure` | Procedure templates — platform-wide |
| `VaptCorrelationRule` | Correlation rules — platform-wide |
| `ReportCveCache` | Global CVSS cache |

#### ⚠️ Minor Design Fragility: `SupportTicketMessage`

`SupportTicketMessage` lacks its own `organization_id` column — it relies entirely on `message.ticket_id → SupportTicket.id → SupportTicket.organization_id`. Any future code that queries this table directly without joining through `SupportTicket` could leak across orgs. Current code does NOT do this — all queries go through the `SupportTicket` relationship. **Design fragility, not an active vulnerability.**

**Recommendation**: Add `organization_id` to `SupportTicketMessage`.

### 18.3 Security DB Queries — SQL-Level Scoping

Every query to the customer's security database includes `organization_id` in the `WHERE` clause:

| Service | Operations | Scoping Verified |
|---|---|---|
| `asset_service.py` | create, get, list, update, delete | ✅ All `WHERE organization_id = ?` |
| `discovery_service.py` | create, get, list, update jobs | ✅ All scoped |
| `scan_service.py` | create, get, list, run scan jobs; insert results | ✅ All scoped |
| `risk_service.py` | ingest, list, get, update risks; treatments; assessments; history | ✅ All scoped |
| `asset_tag_service.py` | CRUD tags, assign/unassign | ✅ All scoped |

**No security DB query in the codebase was found without `WHERE organization_id = ?`.**

### 18.4 API Route Handlers — JWT-to-Org Binding

Every authenticated API route follows the same pattern:

```python
async def some_endpoint(
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_active_organization),  # ← JWT auth
):
    ...
    await some_service(db, org.id, ...)  # ← org.id passed to every call
```

This is consistent across ALL engine APIs examined: Asset, Scanner, Risk, Alert, Audit, Control Plane, Reporting, VAPT.

**Staff routes** use `Depends(get_current_staff)` with separate staff JWT — staff can access any org's data by design (admin/support portal).

### 18.5 Authentication Chain — JWT Type Enforcement

```
Request → oauth2_scheme → extract Bearer token
        → decode_access_token(token)
            → jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            → verify type == "access" (rejects staff tokens)        ← TYPE CHECK
            → return subject (org_id)
        → int(subject) → org_id
        → get_organization_by_id(db, org_id) → Organization
        → check org.is_active → 403 if inactive
        → return Organization
```

| Token Type | Allowed Routes | Rejected From |
|---|---|---|
| `type=access` (org JWT) | `/api/v1/organizations/*`, `/api/v1/assets/*`, ... | `/api/v1/staff/*`, `/api/v1/admin/*` |
| `type=staff` (staff JWT) | `/api/v1/staff/*`, `/api/v1/admin/*` | Org routes (raises 403) |
| Dual-control session token | `/audit/pending/*`, risk treatment approve/reject | Must be combined with valid org JWT |

**No token of one type can access routes of the other type.** No cross-org token reuse possible.

### 18.6 Celery Tasks — Org ID Propagation

| Task | Receives `organization_id` | Uses It |
|---|---|---|
| `run_scan_job_task(organization_id, scan_job_id)` | ✅ Parameter | ✅ All queries scoped |
| `process_alert_event_task(alert_event_id)` | ✅ From DB row | ✅ `event.organization_id` |
| `run_vapt_campaign_task(organization_id, campaign_id)` | ✅ Parameter | ✅ Passed to services |
| `execute_vapt_schedule_task(schedule_id)` | ✅ From DB row | ✅ Schedule has `organization_id` |
| `generate_report_task(organization_id, ...)` | ✅ Parameter | ✅ All queries scoped |
| `dispatch_engine_event_task(event_dict)` | ✅ From event | ✅ `event_dict["organization_id"]` |

All tasks either receive `organization_id` as a parameter or derive it from the database row they process. No cross-org task was found.

### 18.7 File Storage — Per-Org Directory Isolation

Both APK uploads and report artifacts use per-org directory paths:

```python
# APK storage:  {bucket}/{org_id}/{sha256}.apk  (via app/shared/storage/)
def _apk_key(organization_id: int, sha256: str) -> str:
    return f"{organization_id}/{sha256}.apk"

# Report storage:  {bucket}/{org_id}/{report_type}/v{version}/{filename}  (via app/shared/storage/)
def _report_key(org_id: int, report_type: str, version: int, filename: str) -> str:
    return f"{org_id}/{report_type}/v{version}/{filename}"
```

**Path traversal protection** is enforced:

```python
def resolve_stored_path(organization_id: int, meta: dict[str, Any]) -> Path | None:
    candidate = (root / Path(str(rel)).name).resolve()
    if not str(candidate).startswith(str(root)):   # ← GUARD
        return None
```

### 18.8 Bus Events — Org ID Required

The `EngineEvent` dataclass requires `organization_id`:

```python
@dataclass
class EngineEvent:
    event_type: str
    organization_id: int        # ← REQUIRED, NOT OPTIONAL
    ...
```

Every publisher passes it. Every subscriber extracts and uses it:

```python
@subscribe("ScanCompleted")
async def on_scan_completed(event: EngineEvent):
    org_id = event.organization_id                 # ← extracted
    await risk_service.ingest_scan_result(session, int(org_id), ...)  # ← used
```

No subscriber in the codebase ignores the `organization_id` field.

### 18.9 Alert Delivery — Per-Org Credential Isolation

SMTP credentials for alert delivery are Fernet-encrypted per-org:

```python
# Storage — encrypted at rest
OrganizationAlertSettings.encrypted_smtp_password  # ← Fernet-encrypted

# Retrieval — decrypted at delivery time for that org only
password = decrypt_value(settings_row.encrypted_smtp_password)
```

Alert delivery is scoped to the event's organization:

```python
settings_row = await get_or_create_settings(db, event.organization_id)
org = await db.get(Organization, event.organization_id)  # ← org-scoped recipients
```

No credential leakage path exists between orgs.

### 18.10 Summary

| Area | Status | Notes |
|---|---|---|
| Platform DB Models | ✅ PASS | All per-org tables have `organization_id` FK |
| Security DB Queries | ✅ PASS | Every SQL query `WHERE organization_id = ?` |
| API Route Handlers | ✅ PASS | All extract org from JWT, pass to services |
| Authentication Chain | ✅ PASS | Strict JWT type separation (org vs staff) |
| Celery Tasks | ✅ PASS | All receive/derive `organization_id` |
| File Storage | ✅ PASS | Per-org directories + path traversal guard |
| Bus Events | ✅ PASS | `organization_id` required on all events |
| Alert Delivery | ✅ PASS | Per-org encrypted credentials |
| **Overall Verdict** | **✅ ISOLATED** | **Org A cannot see Org B's data** |

### 18.11 One Minor Fix — **DONE**

| Finding | File | Status |
|---|---|---|
| `SupportTicketMessage` lacked `organization_id` | `control_plane/models/support_ticket.py` | **Fixed** — column + FK + index; writers set `organization_id` from ticket/org; migration `m3a4b5c6d7e8` backfills existing rows |

Also added to the “WITH organization_id” table:

| Table | Engine | Has `organization_id`? |
|---|---|---|
| `SupportTicketMessage` | Control Plane | ✅ FK → organizations (denormalized for direct-query safety) |
| `OrgApplicationLog` | Operations | ✅ FK → organizations (platform log mirror) |

---

## 19. — Capacity Planning vs Current Defaults (alignment)

Section 17 guidance matches what is now configured:

| Knob | §17 guidance | Current code/default |
|---|---|---|
| Platform pool | 20 + overflow 40 | `DB_POOL_SIZE=20`, `DB_MAX_OVERFLOW=40` |
| Security pool | 2–10 per org | `SECURITY_DB_POOL_MIN=2`, `SECURITY_DB_POOL_MAX=10` |
| Scan workers | scale with concurrent scanners | compose `worker-scans -c 2` |
| Report worker | 1 + memory cap | `worker-reports -c 1 --max-memory-per-child=500000` |
| Min host RAM | ~2GB soft / 4GB prod | Documented in §17.2 |

---

**End of Concurrency & Multi-Tenancy Analysis**

*This analysis covers the Phantix Backend codebase as of July 14, 2026. Bottlenecks (Tier 1–3) remediated; §17 capacity planning aligned with defaults; §18 tenant isolation audit PASS with SupportTicketMessage org scoping applied. Remaining product deliberations (async campaign steps, per-org Celery queues, load tests) are intentionally deferred.*
