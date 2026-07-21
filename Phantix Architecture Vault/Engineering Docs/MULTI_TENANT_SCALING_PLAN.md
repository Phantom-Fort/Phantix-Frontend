# Multi-Tenant Scaling Plan — 500+ Concurrent Organizations

**Version**: 1.1
**Date**: July 14, 2026
**Status**: Design + **Phase 1 foundation implemented** (see changelog); Phases 2–3 remain scale-out ops
**Audience**: Phantix Backend Engineers, Infrastructure Engineers
**Prerequisite Reading**: `CONCURRENCY_ANALYSIS.md`, `Phantix Architecture Vault/01 - Platform Architecture.md`, `Phantix Architecture Vault/14 - Infrastructure.md`

### Phase 1 progress (alongside CONCURRENCY_ANALYSIS remediation)

| Step | Status | Code |
|---|---|---|
| 1.1 Platform pool 30+60 | **Done** | `DB_POOL_SIZE=30`, `DB_MAX_OVERFLOW=60`, recycle 300s, pool_timeout 10s |
| 1.2 Security DB pools | **Done** | `SecurityDBPoolManager` + expire 120s + statement_timeout |
| 1.3 Credential cache | **Done** | `app/shared/database/credential_cache.py` (Redis TTL 300s) |
| 1.4 Rate limiting | **Done** | slowapi + Redis; heavy write endpoints |
| 1.5 Worker type-queues | **Done** | scans/vapt/alerts/reports/bus + RedBeat HA |
| 1.6 Redis tool locks | **Done** | fail-closed `org_tool_lock` |
| 1.7 Global Docker concurrency | **Done** | `GLOBAL_SCAN_CONCURRENCY=20` |
| 1.8 API request timeouts | **Done** | `RequestTimeoutMiddleware` (10s, path exemptions) |
| Report per-org lock | **Done** | `report_lock:org:{id}` around `generate_report` |
| Cache invalidation | **Done** | on connection create/update/delete |

---

## Table of Contents

1. [Target & Assumptions](#1--target--assumptions)
2. [Architecture Overview](#2--architecture-overview)
3. [Platform DB — Pool Sizing, Proxy, & Connection Budget](#3--platform-db--pool-sizing-proxy--connection-budget)
4. [Security DB — Connection Standard & Max_connections](#4--security-db--connection-standard--max_connections)
5. [Credential Cache — Removing the Platform DB Bottleneck](#5--credential-cache--removing-the-platform-db-bottleneck)
6. [Rate Limiting — Per-Org Budgets at Scale](#6--rate-limiting--per-org-budgets-at-scale)
7. [Celery Worker Scaling — Type-Queue Isolation at 500 Orgs](#7--celery-worker-scaling--type-queue-isolation-at-500-orgs)
8. [Locking Strategy — Distributed Locks at Scale](#8--locking-strategy--distributed-locks-at-scale)
9. [Per-Org Resource Budget Table](#9--per-org-resource-budget-table)
10. [Implementation Phases](#10--implementation-phases)
11. [Monitoring & Alerting Thresholds](#11--monitoring--alerting-thresholds)
12. [Capacity Planning (50 → 500 Orgs)](#12--capacity-planning-50--500-orgs)

---

## 1. — Target & Assumptions

### Target

- **500 organizations** actively using the platform simultaneously
- Each org runs **heavy usage**: multiple VAPT campaigns, continuous scanning, constant API requests
- **Fast APIs** — REST calls respond in <200ms p95 for non-scan operations
- **Scans are fully async** — creating a scan job returns instantly; the user receives status updates via polling or webhook
- **No org can block another org's requests** — fair scheduling at every resource layer
- **Hybrid scaling** — start on a single large server for 50 orgs, scale horizontally as org count grows

### Assumptions

| Property | Value |
|---|---|
| Orgs at launch | 50 (Phase 1) |
| Orgs at scale | 500+ (Phase 2-3) |
| Avg requests/org/hour | 200 (peak) |
| Peak platform DB RPS | ~100 (50 queries/request × 200 req/hr / 3600 × 500 orgs) |
| Avg security DB connections/org | 3 (during active scan) |
| Concurrent scan containers | up to 20 (global ceiling) |
| PDF report generation | up to 5 concurrent (worker-limited) |
| API response SLA (non-scan) | <200ms p95, <500ms p99 |
| Scan job creation SLA | <1s (queues async work) |
| Campaign step visibility | Status update within 5s of completion |

---

## 2. — Architecture Overview

### Layered Architecture

```
                         ┌─────────────────────────┐
                         │    Load Balancer         │
                         │  (nginx / HAProxy)       │
                         │  round-robin, health     │
                         │  checks every 5s         │
                         └───────────┬─────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
     ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
     │  API Server 1     │  │  API Server 2     │  │  API Server N     │
     │                   │  │                   │  │                   │
     │  4× uvicorn       │  │  4× uvicorn       │  │  4× uvicorn       │
     │  workers          │  │  workers          │  │  workers          │
     │                   │  │                   │  │                   │
     │  No local state   │  │  No local state   │  │  No local state   │
     │  No local files   │  │  No local files   │  │  No local files   │
     └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
              │                     │                      │
              └─────────────────────┼──────────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │           Redis Cluster          │
                    │                                 │
                    │  ┌──────────────────────────┐   │
                    │  │ • Celery broker            │   │
                    │  │ • Per-org rate limits     │   │
                    │  │ • Credential cache        │   │
                    │  │ • Distributed locks       │   │
                    │  │ • Session store           │   │
                    │  └──────────────────────────┘   │
                    └───────────────┬────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
     ┌────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
     │  Platform DB    │  │  Celery Workers   │  │  Object Storage    │
     │                 │  │                   │  │                     │
     │  PostgreSQL     │  │  ┌────┬────┬────┐ │  │  S3/MinIO          │
     │  + pgbouncer   │  │  │Scn │VAPT│Alrt│ │  │                     │
     │                 │  │  │Rpt │    │    │ │  │  Buckets:           │
     │  pool=50+100   │  │  └────┴────┴────┘ │  │  - apk-uploads      │
     │  max_conns=150 │  │                   │  │  - reports          │
     └────────────────┘  └──────────────────┘  └─────────────────────┘
                                    │
                                    ▼
     ┌────────────────────────────────────────────────────────────────┐
     │  500+ Customer Security Databases (one per org)                │
     │                                                                │
     │  Each: asyncpg pool (min=2, max=5, expire=120s)               │
     │  Hosted on customer infrastructure, reached via Tailscale/VPN │
     │  Connection credentials cached in Redis (5min TTL)            │
     └────────────────────────────────────────────────────────────────┘
```

### Stateless Design Rule

Every API server is **stateless**. No local filesystem is used for:
- APK binaries → object storage
- Report artifacts → object storage
- Rate limit counters → Redis
- Session data → Redis or JWT
- Locks → Redis

This is what makes horizontal scaling possible — add more API servers behind the load balancer with zero configuration.

---

## 3. — Platform DB — Pool Sizing, Proxy, & Connection Budget

### 3.1 Current State vs. Target

| Metric | Current | Target (50 orgs) | Target (500 orgs) |
|---|---|---|---|
| `pool_size` | 10 (doc says 20) | 30 | 50 |
| `max_overflow` | 20 (doc says 40) | 60 | 100 |
| Effective max connections | 30 | 90 | 150 |
| Connection proxy | None | None | pgbouncer (recommended) |
| Query timeout | None | 30s | 10s |
| Pool timeout | 30s | 10s | 5s |
| Prepared statements | No | Yes (asyncpg default) | Yes |

### 3.2 Connection Budget (500 orgs)

```
Available connections:  150 (pool 50 + overflow 100)

Budget allocation:

  API requests        40 connections   (4 servers × 10 concurrent requests)
  Celery scan tasks   20 connections   (8 workers × ~2 concurrent)
  Celery VAPT tasks   10 connections   (4 workers × ~2 concurrent)
  Celery alert tasks  5 connections    (2 workers × ~2 concurrent)
  Celery report tasks 5 connections    (2 workers × ~2 concurrent)
  Credential cache
    refresh           5 connections    (background, low priority)
  Alert daemon        2 connections    (single daemon)
  Headroom / burst    63 connections   (unallocated, for overflow)
                       ───
  Total budgeted:     87 connections
  Available burst:    63 connections
```

**150 connections is sufficient** because:
- Each API request holds a session for only the duration of a fast query (1-10ms)
- `async_sessionmaker` with `expire_on_commit=False` returns connections to the pool quickly
- Celery tasks acquire sessions briefly per step, not for the entire scan duration
- The credential cache eliminates ~90% of credential-resolution queries

### 3.3 pgbouncer (Connection Proxy)

For 500 orgs, add pgbouncer between the API and PostgreSQL:

```ini
; pgbouncer.ini
[databases]
phantix = host=localhost port=5432 dbname=phantix

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = trust
pool_mode = transaction          ; ← returns connection to pool after each transaction
max_client_conn = 300            ; ← can handle 300 waiting API connections
default_pool_size = 50           ; ← matches our pool_size
max_db_connections = 150         ; ← matches our effective max
reserve_pool_size = 10
reserve_pool_timeout = 5
server_idle_timeout = 300        ; ← close backend connections after 5min idle
query_timeout = 30               ; ← kill queries running >30s
```

**Why pgbouncer**: It decouples API connections from PostgreSQL connections. With `pool_mode=transaction`, an API worker that holds a session for 100ms uses a PostgreSQL connection for 100ms, not for the entire request lifetime. This lets us run with fewer actual PostgreSQL connections than API workers.

### 3.4 Connection Timeout Enforcement

```python
# app/db/session.py — production settings for 500 orgs

if settings.ENVIRONMENT in ("staging", "production"):
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,        # 50
        max_overflow=settings.DB_MAX_OVERFLOW,  # 100
        pool_recycle=300,                       # 5 min (was 1800)
        pool_pre_ping=True,
        pool_timeout=5,                         # 5s wait for connection (was 30s)
        connect_args={
            "command_timeout": 30,              # query timeout
            "timeout": 10,                      # connect timeout
        },
    )
```

### 3.5 Config Changes

```python
# app/core/config.py — updated defaults for multi-tenant production

DB_POOL_SIZE: int = 50
DB_MAX_OVERFLOW: int = 100
DB_POOL_RECYCLE: int = 300        # 5 min (aggressive recycle for high churn)
DB_POOL_PRE_PING: bool = True
DB_POOL_TIMEOUT: int = 5          # 5s wait (fail fast under load)
DB_QUERY_TIMEOUT: int = 30        # kill queries exceeding 30s
DB_CONNECT_TIMEOUT: int = 10
```

---

## 4. — Security DB — Connection Standard & Max_connections

### 4.1 The Standard

Every organization's dedicated security database MUST meet this standard for Phantix to operate correctly:

```sql
-- Required PostgreSQL configuration for the Phantix security database

-- 1. Connection limit (must be at least 20)
--    Phantix maintains a pool of up to 5 connections per org.
--    The remaining 15 are reserved for the customer's own use.
ALTER SYSTEM SET max_connections = 20;  -- minimum; 50+ recommended

-- 2. Statement timeout (prevents runaway queries)
ALTER SYSTEM SET statement_timeout = '30s';

-- 3. Idle session timeout
ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s';

-- 4. SSL (required for production)
ALTER SYSTEM SET ssl = 'on';

-- 5. Connection pooling (recommended for customers with many apps)
--    Use pgbouncer or the built-in pool to manage connections.
```

### 4.2 Phantix-Side Pool Configuration

```python
# app/shared/database/security_db.py — PoolManager for 500 orgs

class SecurityDBPoolManager:
    """
    Per-organization asyncpg pool manager.

    Pool limits (per org):
      min_size = 2    (always keep 2 connections warm)
      max_size = 5    (never exceed 5 concurrent connections per org)
      max_idle = 120  (close idle connections after 2 minutes)
      max_lifetime = 1800 (recycle connections every 30 min)

    Global limits (all orgs combined):
      total_across_all_orgs = 2500 (500 orgs × 5 max)
      BUT — this goes to 500 different databases, not one.
      The real limit is the outbound port range on the API server.
    """

    POOL_MIN_SIZE = 2
    POOL_MAX_SIZE = 5
    POOL_MAX_IDLE_SECONDS = 120
    POOL_MAX_LIFETIME_SECONDS = 1800
    CONNECT_TIMEOUT = 10
    COMMAND_TIMEOUT = 30
```

### 4.3 Per-Org Connection Tracking

```python
# Track per-org connection counts to detect anomalies
_org_connection_counter: dict[int, int] = {}
_org_connection_lock = asyncio.Lock()

async def track_acquire(org_id: int):
    async with _org_connection_lock:
        _org_connection_counter[org_id] = _org_connection_counter.get(org_id, 0) + 1
        if _org_connection_counter[org_id] > 20:  # per-org warning threshold
            logger.warning("Org %s has %s connections — possible leak", org_id, _org_connection_counter[org_id])

async def track_release(org_id: int):
    async with _org_connection_lock:
        _org_connection_counter[org_id] = max(0, _org_connection_counter.get(org_id, 0) - 1)
```

### 4.4 Loose Ends Tightened

| Loose End | Fix |
|---|---|
| No connection pool for security DBs | Per-org asyncpg.Pool with min=2, max=5, expire=120s |
| Credentials decrypted on every connect | Redis cache with 5-min TTL (see Section 5) |
| No limit on total concurrent security DB connections | Global `asyncio.Semaphore` capped at 50 across all orgs |
| No per-org connection leak detection | Per-org connection counter with warning at 20 |
| No connect timeout on security DBs | `asyncpg.connect(timeout=10)` |
| No query timeout | `statement_timeout=30s` set on each connection |
| DNS lookup on every connect | Cache resolved DNS in Redis (or use async DNS resolver) |

---

## 5. — Credential Cache — Removing the Platform DB Bottleneck

### 5.1 Why This Matters

Every security DB operation currently does:

```
Platform DB SELECT (5ms) → Fernet decrypt (1ms) → asyncpg.connect (10-50ms)
```

For a scan producing 10 results, that's 11× this chain = 176ms overhead just in credential resolution. For 500 orgs running scans, this creates **thousands of platform DB queries per minute** for a task that returns the same result 90% of the time.

### 5.2 Cache Design

```python
# app/shared/database/credential_cache.py

class CredentialCache:
    """Redis-backed cache for resolved security DB credentials.

    Key:    secdb:creds:{organization_id}
    Value:  JSON with host, port, database, user, schema, ssl_mode
    TTL:    300 seconds (5 minutes)
    Stale:  Serve stale while refreshing (to avoid thundering herd)

    Cache miss flow:
      1. Query platform DB for CustomerDBConnection
      2. Fernet-decrypt password
      3. Store in Redis with TTL=300
      4. Return credentials

    Cache hit flow:
      1. Read from Redis
      2. If TTL < 60s remaining: trigger async refresh (don't wait)
      3. Return credentials immediately

    Invalidation:
      - When org updates their DB connection (PUT /db-connections/{id})
      - Staff admin resets an org's connection
    """

    CACHE_KEY_PREFIX = "secdb:creds:"
    CACHE_TTL = 300        # 5 minutes
    STALE_TTL = 3600       # serve stale for up to 1 hour during Redis outage
    REFRESH_BEFORE = 60    # refresh when TTL < 60s remaining

    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    async def get_credentials(
        self,
        platform_db: AsyncSession,
        organization_id: int,
    ) -> SecurityDBCredentials:
        """Get cached credentials, or resolve and cache on miss.

        This is the only function external callers need.
        """
        # 1. Try cache
        cached = await self._read_cache(organization_id)
        if cached:
            # Trigger background refresh if expiring soon
            if cached["ttl_remaining"] < self.REFRESH_BEFORE:
                asyncio.create_task(self._refresh_in_background(platform_db, organization_id))
            return SecurityDBCredentials(**cached["data"])

        # 2. Cache miss — resolve from platform DB
        creds = await self._resolve_from_platform_db(platform_db, organization_id)

        # 3. Store in cache
        await self._write_cache(organization_id, creds)

        return creds

    async def _resolve_from_platform_db(
        self,
        db: AsyncSession,
        organization_id: int,
    ) -> SecurityDBCredentials:
        """Resolve + decrypt credentials from the platform DB."""
        from app.engines.control_plane.services.customer_db_service import (
            get_primary_security_storage,
        )
        from app.core.encryption import decrypt_value

        row = await get_primary_security_storage(db, organization_id)
        if row is None:
            raise SecurityDBNotConfigured(...)

        password = decrypt_value(row.encrypted_password)
        return SecurityDBCredentials(
            host=row.host,
            port=row.port,
            database=row.database_name,
            user=row.username,
            password=password,
            schema=row.target_schema or "phantix",
            ssl_mode=row.ssl_mode,
        )

    async def invalidate(self, organization_id: int):
        """Call this when an org updates their DB connection."""
        await self.redis.delete(f"{self.CACHE_KEY_PREFIX}{organization_id}")
```

### 5.3 Platform DB Load Impact

| Scenario | Queries Per Security DB Op | With Cache |
|---|---|---|
| Cache hit (steady state) | 1 × platform DB query | **0** — all from Redis |
| Cache miss (first use in 5 min) | 1 × platform DB query | **1** — then cached for 5 min |
| Cache miss (org updates connection) | 1 × platform DB query | **1** — cache invalidated |
| Fernet decryption | 1 per op | **0** — decrypted once, cached |

**At 500 orgs**, this eliminates ~450 of every 500 credential-resolution queries to the platform DB (90% reduction in read load).

### 5.4 Startup Behavior

On API server startup, the cache is cold. For the first 5 minutes, every org's first security DB operation will hit the platform DB. This is fine — it's a gradual warm-up as orgs become active.

---

## 6. — Rate Limiting — Per-Org Budgets at Scale

### 6.1 Architecture

Two-tier rate limiting using Redis sliding windows:

```
Tier 1: Per-org limit (soft — allows bursts within window)
Tier 2: Global limit (hard — protects platform from total overload)
```

### 6.2 Rate Limits

| Endpoint Category | Per-Org (Standard) | Per-Org (Enterprise) | Global (Hard) |
|---|---|---|---|
| Unauthenticated (register, login, public) | 5/min per IP | 5/min per IP | 100/min |
| Read (GET assets, risks, etc.) | 500/min | 2000/min | 50,000/min |
| Write (POST/PATCH/DELETE) | 100/min | 500/min | 10,000/min |
| Scan job creation | 5/min | 20/min | 200/min |
| Campaign creation | 2/min | 5/min | 50/min |
| Report generation | 1/min | 5/min | 20/min |
| Export (CSV/JSON) | 10/min | 50/min | 500/min |

### 6.3 Implementation

```python
# app/shared/rate_limiter.py

class RateLimiter:
    """Per-org and global rate limiter using Redis sliding window."""

    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    async def check(
        self,
        key: str,            # e.g., "org:42:scan_create" or "global:scan_create"
        limit: int,
        window_seconds: int = 60,
        cost: int = 1,
    ) -> tuple[bool, int]:
        """Check if request is allowed. Returns (allowed, current_count)."""
        now = time.time()
        window_start = now - window_seconds

        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)   # remove old entries
        pipe.zcard(key)                                 # count current
        pipe.zadd(key, {now: now})                      # add this request
        pipe.expire(key, window_seconds * 2)            # ensure TTL
        _, count, _, _ = await pipe.execute()

        if count > limit:
            return False, count

        return True, count


# Usage in middleware:
from app.shared.rate_limiter import RateLimiter

limiter = RateLimiter(settings.REDIS_URL)

@router.post("/api/v1/scans/jobs")
async def create_scan_job(org: Organization = Depends(get_current_org)):
    allowed, count = await limiter.check(
        f"org:{org.id}:scan_create",
        limit=5,        # 5 per minute for standard
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limit_exceeded",
                "message": f"Scan job limit reached (5/min). Current count: {count}",
                "retry_after_seconds": 60,
            },
        )
    ...
```

### 6.4 Rate Limit Headers

Every response should include rate limit headers:

```python
@router.middleware("http")
async def add_rate_limit_headers(request, call_next):
    response = await call_next(request)
    if hasattr(request.state, "rate_limit"):
        response.headers["X-RateLimit-Limit"] = str(request.state.rate_limit.limit)
        response.headers["X-RateLimit-Remaining"] = str(
            request.state.rate_limit.limit - request.state.rate_limit.count
        )
        response.headers["X-RateLimit-Reset"] = str(request.state.rate_limit.reset_at)
    return response
```

---

## 7. — Celery Worker Scaling — Type-Queue Isolation at 500 Orgs

### 7.1 Queue Architecture

```
                        ┌─────────────────────┐
                        │   Task Dispatcher    │
                        │  (routes by type)   │
                        └─────────────────────┘
                               │
         ┌─────────────────────┼──────────────────────┐
         ▼                     ▼                      ▼
   ┌──────────┐        ┌──────────┐          ┌──────────┐
   │  scans   │        │   vapt   │          │  alerts  │
   │ queue    │        │  queue   │          │  queue   │
   └────┬─────┘        └────┬─────┘          └────┬─────┘
        │                   │                     │
   ┌────▼─────┐        ┌────▼─────┐          ┌────▼─────┐
   │ Scan     │        │ VAPT     │          │ Alert    │
   │ Workers  │        │ Workers  │          │ Workers  │
   │ 4-8 pods │        │ 2-4 pods │          │ 2 pods   │
   │ prefetch │        │ prefetch │          │ prefetch │
   │ =1       │        │ =1       │          │ =1       │
   └──────────┘        └──────────┘          └──────────┘
                                                    │
                                              ┌─────▼─────┐
                                              │  Reports  │
                                              │  queue    │
                                              │           │
                                              │ 1-2 pods  │
                                              │ prefetch  │
                                              │ =1        │
                                              └───────────┘
```

### 7.2 Worker Sizing for 500 Orgs

| Queue | Worker Count | `-c` (concurrency) | `prefetch_multiplier` | Purpose |
|---|---|---|---|---|
| `scans` | 4-8 | 2 per pod | 1 | Running nmap/nuclei Docker containers. CPU-bound. Keep concurrency low per pod to avoid Docker contention. |
| `vapt` | 2-4 | 4 per pod | 1 | Campaign step orchestration. Mostly I/O and DB queries. Higher concurrency per pod is safe. |
| `alerts` | 2 | 4 per pod | 1 | SMTP delivery + channel dispatch. I/O-bound, can handle many concurrent deliveries. |
| `reports` | 1-2 | 1 per pod | 1 | PDF/DOCX generation. CPU + memory intensive. Max 1 per pod, limit to 2 total. |
| `default` | 2 | 4 per pod | 1 | Everything else (schedule polling, cache refresh, retention). |

### 7.3 Per-Org Fairness — How It's Achieved

Without per-org queues, fairness comes from **three mechanisms**:

```
Mechanism 1: worker_prefetch_multiplier=1
  → Each worker fetches at most 1 task at a time
  → Workers pick the next available task regardless of org
  → No org can reserve multiple worker slots

Mechanism 2: Type-dedicated worker pools
  → Scans don't compete with alerts for worker attention
  → A heavy VAPT campaign can't delay alert delivery

Mechanism 3: Task-level rate limiting
  → Each org has max 5 scan jobs/min, max 2 campaigns/min
  → Natural throttle prevents any org from flooding the queue
```

For 500 orgs, this is sufficient. If you need stricter fairness, the upgrade path is:

```python
# APPENDIX: Upgrading to per-org queues (for 1000+ orgs)

# In enqueue function, route to org-specific queue:
def enqueue_scan(org_id, data):
    if settings.ENABLE_PER_ORG_QUEUES:
        queue = f"scans_org_{org_id}"
    else:
        queue = "scans"

    run_scan_job_task.apply_async(
        args=[org_id, data],
        queue=queue,
    )

# Worker consumes all per-org queues dynamically:
# celery -A app.workers.celery_app worker --queues=scans,scans_org_1,scans_org_2,... --prefetch-multiplier=1
```

### 7.4 Startup Commands

```bash
# Docker Compose or K8s:
celery -A app.workers.celery_app worker -Q scans -c 2 --prefetch-multiplier=1 --max-tasks-per-child=50
celery -A app.workers.celery_app worker -Q vapt -c 4 --prefetch-multiplier=1
celery -A app.workers.celery_app worker -Q alerts -c 4 --prefetch-multiplier=1
celery -A app.workers.celery_app worker -Q reports -c 1 --prefetch-multiplier=1 --max-memory-per-child=500000
celery -A app.workers.celery_app worker -Q celery -c 4 --prefetch-multiplier=1
celery -A app.workers.celery_app beat --scheduler app.workers.celery_app.RedisScheduler
```

---

## 8. — Locking Strategy — Distributed Locks at Scale

### 8.1 What Needs Locks

| Resource | Lock Type | Scope | TTL |
|---|---|---|---|
| Tool execution (nmap/nuclei) | Per-org Redis lock | 1 per org across all workers | 600s (10 min) |
| Campaign advancement | DB-level check | 1 active campaign per org | N/A (DB-enforced) |
| Scan job creation | DB-level check | 1 active scan per org | N/A (DB-enforced) |
| Report generation per org | Per-org Redis lock | 1 active report gen per org | 3600s (1 hr) |
| Platform maintenance | Redis global flag | All orgs | Manual clear |

### 8.2 Redis Lock Implementation

```python
# app/shared/locks.py

class DistributedLock:
    """Redis-based distributed lock using SET NX EX.

    Safe across multiple API servers and Celery workers.
    """

    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    async def acquire(
        self,
        lock_key: str,
        ttl_seconds: int = 600,
        blocking: bool = False,
        block_timeout: int = 30,
    ) -> bool:
        """Acquire a distributed lock.

        Args:
            lock_key: Unique key for the resource (e.g., "tool_lock:org:42")
            ttl_seconds: Auto-release after this time (safety net)
            blocking: If True, retry until acquired or timeout
            block_timeout: Max seconds to wait for blocking acquire
        """
        if blocking:
            deadline = time.time() + block_timeout
            while time.time() < deadline:
                acquired = await self.redis.set(
                    lock_key, "locked", nx=True, ex=ttl_seconds
                )
                if acquired:
                    return True
                await asyncio.sleep(0.5)
            return False

        return await self.redis.set(lock_key, "locked", nx=True, ex=ttl_seconds)

    async def release(self, lock_key: str):
        """Release the lock. Safe to call even if lock expired."""
        await self.redis.delete(lock_key)

    async def __aenter__(self, lock_key: str, ttl_seconds: int = 600):
        self._key = lock_key
        acquired = await self.acquire(lock_key, ttl_seconds)
        if not acquired:
            raise LockNotAcquired(f"Could not acquire lock: {lock_key}")
        return self

    async def __aexit__(self, *args):
        await self.release(self._key)
```

### 8.3 Lock Key Namespace

```
tool_lock:org:{org_id}              — scan tool execution
report_lock:org:{org_id}            — report generation
campaign_lock:org:{org_id}          — campaign creation (backup for DB check)
platform_maintenance                — global pause flag (set by Operations Engine)
```

---

## 9. — Per-Org Resource Budget Table

Every organization operates within these budgets. These are enforced at the application layer, not by infrastructure:

| Resource | Per-Org Limit | Global Ceiling | Enforcement |
|---|---|---|---|
| **Platform DB connections** | Shared (no per-org limit) | 150 total | SQLAlchemy pool + pgbouncer |
| **Security DB connections** | min=2, max=5 | N/A (per-customer DB) | `asyncpg.Pool` per org |
| **API requests (standard)** | 500 GET/min, 100 POST/min | 50,000/min | Redis sliding window |
| **API requests (enterprise)** | 2000 GET/min, 500 POST/min | 50,000/min | Redis sliding window |
| **Scan job creation** | 5/min | 200/min | Redis sliding window |
| **Campaign creation** | 2/min | 50/min | Redis sliding window |
| **Active scan jobs** | 1 | N/A | DB constraint + Redis lock |
| **Active campaigns** | 1 | N/A | DB constraint |
| **Concurrent Docker containers** | 1 | 20 | `asyncio.Semaphore` + Redis lock |
| **Concurrent report generations** | 1 | 2 | Celery queue (1 worker) |
| **Security DB credential cache** | 1 key (5 min TTL) | 500 keys in Redis | CredentialCache manager |
| **Concurrent Celery tasks** | Unlimited (fair via prefetch=1) | Worker pool size | Celery prefetch config |
| **Object storage (APKs)** | 200 MB per upload | Unlimited by bucket | APK_MAX_SIZE_MB |
| **Platform DB storage** | Per-org rows | Shared PostgreSQL | Retention policies |

---

## 10. — Implementation Phases

### Phase 1: Foundation (50 orgs — current target)

**Goal**: Deployable architecture for 50 concurrent orgs with room to grow.

| Step | What | Effort |
|---|---|---|
| 1.1 | Increase platform DB pool: `pool_size=30, max_overflow=60` | Config change |
| 1.2 | Security DB pool manager (per-org asyncpg pools) | 2-3 days |
| 1.3 | Redis credential cache with 5-min TTL | 2 days |
| 1.4 | Per-org rate limiting on all write endpoints | 3 days |
| 1.5 | Worker type-queues (scans, vapt, alerts, reports) | 1 day |
| 1.6 | Distributed Redis locks for tool execution | 1 day |
| 1.7 | Global Docker concurrency semaphore (current default 5 → configurable) | 1 day |
| 1.8 | API request timeouts (10s on all endpoints) | 1 day |

**Phase 1 deliverable**: 50 orgs can use the platform concurrently without observable interference.

### Phase 2: Scale (50 → 200 orgs)

| Step | What | Effort |
|---|---|---|
| 2.1 | Increase platform DB pool to 50+100 | Config change |
| 2.2 | Add pgbouncer between API and PostgreSQL | 1 day |
| 2.3 | Scale Celery workers per Section 7 sizing | Ops config |
| 2.4 | Add `--max-tasks-per-child` to scan workers (prevent memory leaks) | Config change |
| 2.5 | Add per-org rate limit headers to all responses | 1 day |
| 2.6 | Implement query budgets per request (max 20 security DB queries) | 2 days |
| 2.7 | Add pool utilization metrics to Operations Engine | 1 day |

**Phase 2 deliverable**: 200 orgs with <200ms p95 API latency, no org-to-org interference.

### Phase 3: Scale (200 → 500+ orgs)

| Step | What | Effort |
|---|---|---|
| 3.1 | Deploy second API server behind load balancer | Ops |
| 3.2 | Deploy Celery workers across multiple hosts | Ops |
| 3.3 | Add Redis Cluster or Redis Sentinel for HA | Ops |
| 3.4 | Per-org Celery queues (optional, for finer fairness) | 2 days |
| 3.5 | Auto-scaling Celery workers based on queue depth | Ops |
| 3.6 | Staggered schedule execution (max 10 schedules per poll, rest deferred) | 1 day |
| 3.7 | Read replicas for platform DB (report queries to replica) | Ops |

**Phase 3 deliverable**: 500 orgs with fair scheduling — no org can block another regardless of load.

---

## 11. — Monitoring & Alerting Thresholds

### 11.1 Platform DB Metrics

| Metric | Warning | Critical | Action |
|---|---|---|---|
| Pool utilization % | >70% (105 of 150) | >90% (135 of 150) | Increase pool or scale workers |
| Pool waiters | >5 tasks waiting | >20 tasks waiting | Pool exhausted — add connections |
| Query latency p95 | >50ms | >200ms | Check for slow queries |
| Connection age | >pool_recycle | 2× pool_recycle | Connection may be stale |

### 11.2 Security DB Metrics

| Metric | Warning | Critical | Action |
|---|---|---|---|
| Per-org connection count | >15 | >25 | Possible connection leak |
| Cache hit rate | <80% | <60% | Check cache TTL or Redis connectivity |
| Connect latency | >200ms | >1s | Customer DB may be overloaded |
| DNS resolution time | >100ms | >500ms | DNS issue with customer host |

### 11.3 Celery Metrics

| Metric | Warning | Critical | Action |
|---|---|---|---|
| Queue depth (any type) | >100 tasks | >500 tasks | Scale workers for that queue |
| Task completion rate | <10/min | 0/min | Workers may be stuck |
| Task failure rate | >5% | >20% | Check error logs |
| Worker count | <expected | <50% expected | Workers crashed |

### 11.4 API Metrics

| Metric | Warning | Critical | Action |
|---|---|---|---|
| Per-org rate limit hits | >10/day | >100/hour | Investigate org behavior |
| p95 API latency | >200ms | >500ms | Check DB or worker load |
| p99 API latency | >500ms | >2s | Performance regression |
| Error rate (5xx) | >1% | >5% | Investigate immediately |

### 11.5 Logging

```python
# Structured logging for multi-tenant observability

LOGGING_FIELDS = {
    "org_id": organization_id,        # present on every log line
    "correlation_id": correlation_id,  # trace across API → bus → Celery
    "request_id": request_id,         # per-request
    "engine": source_engine,          # which engine produced the log
    "duration_ms": duration_ms,       # operation duration
}
```

---

## 12. — Capacity Planning (50 → 500 Orgs)

### 12.1 Server Sizing

| Org Count | API Servers | vCPU (total) | RAM (total) | Celery Workers | Platform DB |
|---|---|---|---|---|---|
| 50 | 1 | 4 | 8GB | 4 (shared) | 2 vCPU, 4GB RAM |
| 100 | 1 | 8 | 16GB | 6 (type-dedicated) | 4 vCPU, 8GB RAM |
| 200 | 2 | 16 | 32GB | 8 (type-dedicated) | 4 vCPU, 16GB RAM |
| 500 | 3-4 | 32 | 64GB | 12 (type-dedicated) | 8 vCPU, 32GB RAM |

### 12.2 Redis Sizing

| Org Count | Redis Memory | Notes |
|---|---|---|
| 50 | 256MB | Mainly Celery broker + rate limits |
| 100 | 512MB | Credential cache adds ~100KB per org |
| 200 | 1GB | Rate limit windows + locks add up |
| 500 | 2GB | Celery task backlog at peak |

### 12.3 Storage Growth

| Data Type | Per Org / Month | 500 Orgs / Month | Retention |
|---|---|---|---|
| Platform DB (metadata, audit) | 5MB | 2.5GB | 12 months |
| Security DB (assets, findings) | 100MB | 50GB | In customer's DB |
| APK binaries (object storage) | 50MB | 25GB | Indefinite |
| Reports (object storage) | 10MB | 5GB | 3 versions per org |

### 12.4 Bandwidth

| Activity | Per Operation | 500 Orgs Peak |
|---|---|---|
| API request (JSON) | ~2KB per request | ~1MB/s (500 RPS) |
| Security DB query (results) | ~10KB avg | ~5MB/s |
| APK upload | 10-200MB | Rare — not sustained |
| Report download (PDF) | 1-10MB | Rare — not sustained |
| Docker image pull (nmap) | ~200MB | First pull only — cached |

---

**End of Multi-Tenant Scaling Plan**

*This document covers the architecture, connection standards, rate limiting, worker scaling, and capacity planning required for Phantix to serve 500+ concurrent organizations fairly. Phase 1 (50 orgs) should be the immediate implementation target, with subsequent phases building toward 500+ orgs without architectural changes — only scaling.*
