# Local development infrastructure

Validated local-first setup. **No cloud deploy pipeline yet** — run everything on your machine.

**Building the product UI?** Use [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) for auth, dual-control, async jobs, and VAPT polling contracts.

## Checklist vs plan

| Area | Priority | Status | Notes |
|------|----------|--------|--------|
| Docker + Compose | High | ✅ | `Dockerfile` + `docker-compose.yml` (Postgres, Redis, API) |
| Alembic migrations | High | ✅ | See [MIGRATIONS.md](./MIGRATIONS.md) |
| CI (GitHub Actions) | High | ✅ | Lint, types, tests, Docker build — **no deploy** |
| Pre-commit | Medium | ✅ | Black, Ruff, mypy + base hooks |
| `.env.example` + settings | High | ✅ | Pydantic Settings already; template added |
| Deploy pipeline | Medium | ⏸️ **Deferred** | Local only for now |

---

## Elasticsearch (optional)

```bash
docker compose up elasticsearch -d
# .env
ELASTICSEARCH_ENABLED=true
ELASTICSEARCH_URL=http://localhost:9200
```

Search API: `GET /api/v1/search?q=…` (org JWT). See [SEARCH.md](./SEARCH.md).

## Cold start (clean clone)

```bash
./start.sh
```

1. Creates `.env` / `.venv` as needed  
2. Starts **Postgres + Redis** only if `:5432` / `:6379` are free  
3. Migrations + Celery workers + uvicorn on `:8000`

## Warm start (infra already running)

When Redis/Postgres are already up (or you hit `address already in use` on 6379):

```bash
./start.sh warm
# or
./warm-start.sh
```

- **Does not** recreate Docker containers  
- Restarts API + Celery only  
- Skips pip install by default (`--reinstall` to force)

```bash
./start.sh status          # process + health + tunnel
./start.sh logs api        # tail API log
./start.sh logs tunnel     # tail Cloudflare tunnel log
./stop.sh                  # close API + workers + tunnel (leaves db/redis)
./start.sh stop            # same as ./stop.sh
./stop.sh --all            # also docker compose down
./start.sh --docker        # full stack in Compose
./start.sh --foreground    # API in foreground
./start.sh --sqlite        # SQLite platform DB
./start.sh --no-tunnel     # local only (skip cloudflared)
```

### Cloudflare tunnel (public staging)

Named tunnel **`phantix-staging`** maps **https://staging.phantix.site** → `http://localhost:8000`
(config: `~/.cloudflared/config.yml`).

```bash
# Started automatically with ./start.sh / ./warm-start.sh when cloudflared is installed
./tunnel.sh                 # start tunnel only
./tunnel.sh stop            # stop tunnel only
./tunnel.sh foreground      # run in this terminal (Ctrl+C)
# Manual:
cloudflared tunnel run phantix-staging
```

Close everything (test server):

```bash
./stop.sh
```

Logs and PIDs live under `.run/` (`api`, `worker`, `beat`, `tunnel`).

## Manual quick start (infra in Docker, API on host)

```bash
# 1) Secrets
cp .env.example .env
# edit SECRET_KEY, ENCRYPTION_KEY, STAFF_BOOTSTRAP_*

# 2) Postgres + Redis
docker compose up db redis -d

# 3) Python env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

# 4) Migrations
alembic upgrade head

# 5) API
uvicorn app.main:app --reload
```

Docs: http://localhost:8000/docs

---

## API errors: “Not Found” vs real auth/policy messages

There is **no separate service** that “turns on” error text. FastAPI/Starlette already return JSON `detail` when the request hits a registered route.

| What you see | Meaning |
|--------------|---------|
| HTTP **404** `{"detail":"Not Found"}` | **Wrong path or method** (or not talking to this API). Routes live under **`/api/v1/...`**. |
| HTTP **401** e.g. `Not authenticated` / `Invalid or expired organization token` | Missing or bad `Authorization: Bearer <org JWT>`. |
| HTTP **403** with dual-control message | Mutating org API needs initiator/authorizer **`X-Dual-Control-Session`** (domain-email OTP login with `purpose=dual_control`; see [RBAC_MFA.md](./RBAC_MFA.md)). |
| Org-user login returns `device_verification_required` | New browser/device while another session is active → complete `POST /org-users/auth/login/device` (send stable `device_id` / `X-Device-Id`). |
| HTTP **404** with a *specific* string (e.g. `Plan not found or expired`) | Resource missing — not a generic auth mask. |

**Common mistake:** calling `/assets` or `/vapt/plan` without the `/api/v1` prefix → real Starlette 404.

```bash
# Confirm API is up
curl -s http://127.0.0.1:8000/health

# Wrong path → 404 Not Found
curl -s -w "\n%{http_code}\n" http://127.0.0.1:8000/assets

# Correct path, no auth → 401 with explicit detail (not Not Found)
curl -s -w "\n%{http_code}\n" -X POST http://127.0.0.1:8000/api/v1/vapt/plan \
  -H 'Content-Type: application/json' -d '{}'

# List registered paths
curl -s http://127.0.0.1:8000/api/v1/openapi.json | python3 -c "import sys,json; print('\n'.join(sorted(json.load(sys.stdin).get('paths',{}))[:30]))"
```

**Client tip:** always surface `response.status` and JSON `detail` (string or `detail.message`). Do not map every non-2xx to “Not Found”.

Redis/Postgres/Celery affect features (plans, scans, workers), not whether error bodies are returned. If the API process is down, proxies/clients may show a generic not-found — run `./start.sh status`.

## Full stack in Docker

```bash
./start.sh --docker
# or:
cp .env.example .env   # ENCRYPTION_KEY still required
docker compose up --build
```

Compose overrides `DATABASE_URL` / `REDIS_URL` to service hostnames `db` and `redis`.

If port **5432** is already in use (old `phantix-postgres` container):

```bash
docker stop phantix-postgres   # or change compose ports
docker compose up db redis -d
```

---

## Quality tools

```bash
# Format
black app tests

# Lint
ruff check --fix app tests

# Types
mypy app

# Tests
pytest -q

# Install git hooks (once per clone)
pre-commit install
pre-commit run --all-files
```

---

## CI (GitHub Actions)

On push/PR to `main` / `master` / `develop`:

1. **lint-and-typecheck** — Black, Ruff, mypy
2. **test** — Postgres service, `alembic upgrade head`, `alembic check`, pytest
3. **docker-build** — ensures the image builds

No deploy job (by design for now).

---

## Secrets hygiene

| File | Commit? |
|------|---------|
| `.env` | **Never** |
| `.env.example` | Yes (placeholders only) |
| Real `ENCRYPTION_KEY` / `SECRET_KEY` | Secrets manager / local only |

Generate:

```bash
openssl rand -hex 32
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
