Tags: #engine #operations

# Operations Engine

Status: 🟢 Implemented (July 2026). Staff-only (admin/superadmin JWT) — no org ever touches this engine directly.

## Goals

1. **Observe** — process RSS/CPU, related workers, host capacity, DB pool, Celery.
2. **Recommend** — a scored health value plus actionable tuning advice.
3. **Optimize safely** — GC, pool recycle, idle-lock cleanup, alert-queue drain. Deliberately **no** arbitrary process kill or Redis purge.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/server/overview` | Full picture + health score + recommendations |
| `GET` | `/admin/server/processes` | This API's PID + related uvicorn/celery/alert_daemon processes |
| `GET` | `/admin/server/resources` | Host CPU / memory / disk / load |
| `GET` | `/admin/server/runtime` | DB pool, asyncio tasks, GC, tool locks, Celery inspect |
| `GET` | `/admin/server/recommendations` | Optimization advice only |
| `POST` | `/admin/server/optimize` | Run safe optimization actions |

## Optimize actions

| Action | Effect |
|---|---|
| `gc_collect` | Python GC generations 0–2 |
| `dispose_db_pool` | Dispose the SQLAlchemy engine pool |
| `clear_idle_tool_locks` | Remove idle per-org [[06 - Scanner Engine]] tool locks from memory |
| `process_pending_alerts` | Drain pending [[11 - Alert Engine]] deliveries |
| `all` | Every action above |

## Health score

`overview.health.score` (0–100): optimal ≥90 · good ≥75 · degraded ≥50 · critical <50, derived from recommendation severities and host pressure.

## Target engine boundary vs. what exists

| Sub-component | Status |
|---|---|
| Process Monitor | 🟢 (`/processes`) |
| Metrics | 🟢 (`/resources`) |
| Worker Monitor | 🟢 (Celery inspect via `/runtime`) |
| Health | 🟢 (scored, `/overview`) |
| Queue Health | 🟢 (Celery inspect, folded into `/runtime`) |
| Database Health | 🟢 (DB pool stats via `/runtime`) |
| Redis Health | 🟡 Partial — reachable indirectly via Celery inspect; no dedicated Redis-specific health check yet |
| Container Health | 🔴 Not started — no Docker/container-level health surfaced today, only host-process level |
| Optimization | 🟢 (`/optimize`) |
| Garbage Collection | 🟢 (`gc_collect` action) |
| Resource Usage | 🟢 (`/resources`) |
| Diagnostics | 🟡 Partial — covered by `/overview` + `/recommendations`, no dedicated deep-diagnostics endpoint |

This engine is already essentially at its target shape — the smallest gap between "what was proposed" and "what's built" of any engine in the registry.

## Deployment target (v1.0)

The approved plan states this engine **should eventually become a completely separate deployment** — it's the one engine explicitly called out for early extraction, since it monitors the platform and shouldn't share fate with the process it's monitoring (if the main API process is unhealthy, you want Operations Engine still reachable to diagnose why). See [[16 - Deployment Roadmap]]'s Stage 2/3 for where this lands in sequence — likely one of the first candidates once any extraction happens at all, precisely because it's staff-only and has no org-facing dependency to coordinate around.

## Explicitly not exposed (by design, not oversight)

Killing arbitrary PIDs, force-killing Celery workers without orchestration, purging Redis/Celery queues wholesale, changing host OS limits remotely. Those belong to the process supervisor (systemd, Docker, K8s) — Operations Engine reports and self-tunes within its own process only.

## Related notes

[[02 - Engine Registry]] · [[06 - Scanner Engine]] · [[11 - Alert Engine]] · [[14 - Infrastructure]] · [[16 - Deployment Roadmap]]
