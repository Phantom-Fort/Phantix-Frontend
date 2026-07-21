# Server Process Management & Optimization

**Status**: Implemented July 2026
**Auth**: Staff JWT with **admin** or **superadmin** role

Operators use these endpoints to keep the Phantix API process and related workers serving at highest sustained optimum.

---

## Goals

1. **Observe** — process RSS/CPU, related workers, host capacity, DB pool, Celery
2. **Recommend** — scored health + actionable tuning advice
3. **Optimize safely** — GC, pool recycle, idle lock cleanup, alert queue drain
   (no arbitrary process kill / Redis purge)

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/admin/server/overview` | Full picture + health score + recommendations |
| `GET` | `/api/v1/admin/server/processes` | This API PID + related uvicorn/celery/alert_daemon |
| `GET` | `/api/v1/admin/server/resources` | Host CPU / memory / disk / load |
| `GET` | `/api/v1/admin/server/runtime` | DB pool, asyncio tasks, GC, tool locks, Celery inspect |
| `GET` | `/api/v1/admin/server/recommendations` | Optimization advice only |
| `POST` | `/api/v1/admin/server/optimize` | Run safe optimization actions |

Also linked from public `/status` under `links.server_overview` (staff auth still required for the admin routes).

---

## Optimize actions

```http
POST /api/v1/admin/server/optimize
Authorization: Bearer <staff_jwt>
Content-Type: application/json

{
  "actions": ["all"],
  "alert_batch_limit": 50
}
```

| Action | Effect |
|--------|--------|
| `gc_collect` | Python GC generations 0–2 |
| `dispose_db_pool` | Dispose SQLAlchemy engine pool (fresh connections next request) |
| `clear_idle_tool_locks` | Remove idle per-org scan tool locks from memory |
| `process_pending_alerts` | Drain pending client alert deliveries |
| `all` | Run every action above |

---

## Pool / engine tuning (env)

| Variable | Default | Role |
|----------|---------|------|
| `DB_POOL_SIZE` | `10` | Core asyncpg pool size |
| `DB_MAX_OVERFLOW` | `20` | Burst connections |
| `DB_POOL_RECYCLE` | `1800` | Recycle connections (seconds) |
| `DB_POOL_PRE_PING` | `true` | Drop dead connections before use |
| `DB_ECHO` | `false` | SQL logging — **keep false in production** |

---

## Health score

`overview.health.score` is 0–100 derived from recommendation severities and host pressure:

| Label | Score |
|-------|-------|
| optimal | ≥ 90 |
| good | ≥ 75 |
| degraded | ≥ 50 |
| critical | < 50 |

---

## Related processes detected

On Linux (`/proc`), processes whose cmdline matches:

`uvicorn`, `gunicorn`, `phantix`, `celery`, `alert_daemon`, `app.main`, `app.workers`

Roles: `api`, `celery_worker`, `celery_beat`, `alert_daemon`, `other`.

---

## Example ops loop

```bash
# Staff login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/staff/login \
  -d "username=admin@phantix.local&password=…" | jq -r .access_token)

# Inspect
curl -s http://localhost:8000/api/v1/admin/server/overview \
  -H "Authorization: Bearer $TOKEN" | jq '.health, .recommendations[:3]'

# Optimize
curl -s -X POST http://localhost:8000/api/v1/admin/server/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"actions":["gc_collect","clear_idle_tool_locks"]}'
```

---

## What is intentionally not exposed

- Killing arbitrary PIDs
- Force-killing Celery workers without orchestration
- Purging Redis / Celery queues wholesale
- Changing host OS limits remotely

Those belong in your process supervisor (systemd, Docker, K8s) — Phantix reports and self-tunes within the API process.
