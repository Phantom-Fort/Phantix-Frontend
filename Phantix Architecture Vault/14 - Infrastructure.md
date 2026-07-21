Tags: #infrastructure #devops

# Infrastructure

Status: 🟢 Local-first setup implemented. 🔴 No deploy pipeline yet (deliberately deferred).

## Scope (v1.0)

Infrastructure provides platform capabilities only and contains **zero business logic** — that constraint is what keeps it from slowly turning into an eleventh engine. It owns: PostgreSQL, Redis, Celery, Docker, object storage, encryption, secrets, monitoring, logging, metrics.

| Component | Status | Notes |
|---|---|---|
| PostgreSQL | 🟢 | Platform DB + per-org customer security DBs |
| Redis | 🟢 | Celery broker today; candidate substrate for [[04 - Engine Bus]] |
| Celery | 🟢 | Scan jobs, alert delivery |
| Docker | 🟢 | Compose for local dev; tool execution sandboxing in [[06 - Scanner Engine]] |
| Object storage | 🟢 | APK binaries and report artifacts stored via `app/shared/storage/` abstraction layer (S3-compatible or local filesystem fallback). Two backends: `local` for dev, `s3` for production. |
| Encryption | 🟢 | Fernet, for connection credentials, GitHub PATs, client SMTP passwords |
| Secrets | 🟢 | `.env` locally; see hygiene table below — no secrets manager wired yet for production |
| Monitoring / Logging / Metrics | 🟡 Partial | Covered functionally by [[13 - Operations Engine]] today; no separate observability stack (e.g. Prometheus/Grafana) yet |

## Simulating a customer environment (approved, not yet reflected in local dev docs)

v1.0 formalizes a development-environment pattern that today's `LOCAL_DEV.md` doesn't mention:

```text
Windows Host
    │
    │ Mock Customer Environment
    │
    ▼
WSL Ubuntu
    │
    ├── FastAPI
    ├── PostgreSQL
    ├── Redis
    ├── Celery
    ├── Docker
    └── Event Bus
```

The idea: WSL hosts the actual Phantix platform (everything in the quick-start below), while the Windows host plays the role of a customer's environment — running a second, separate Postgres instance that stands in for a customer's "Dedicated Security Database," reachable the same way a real customer's database would be. That lets `security_data_storage` and `config_inspection` connections be tested against something that behaves like a genuinely external database (different host, different network path) without provisioning any cloud infrastructure — closer to how the [[01 - Platform Architecture]] hybrid model will actually be exercised in production than pointing everything at `localhost`.

**Status: 🟡 approved, not yet documented as a concrete setup.** `LOCAL_DEV.md` currently describes a WSL/Docker-only workflow with no Windows-host customer simulation step. Action item: once someone actually sets this up, document the specific Windows-side Postgres install/config here, not just the concept.

## Local development

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

Full stack in Docker: `docker compose up --build` (compose overrides `DATABASE_URL`/`REDIS_URL` to service hostnames `db`/`redis`).

| Area | Status | Notes |
|---|---|---|
| Docker + Compose | 🟢 | `Dockerfile` + `docker-compose.yml` (Postgres, Redis, API) |
| Alembic migrations | 🟢 | See below |
| CI (GitHub Actions) | 🟢 | Lint, types, tests, Docker build — **no deploy** |
| Pre-commit | 🟢 | Black, Ruff, mypy + base hooks |
| `.env.example` + settings | 🟢 | Pydantic Settings |
| Deploy pipeline | 🔴 Deferred | Local only for now — first real deploy is itself a roadmap item, see [[16 - Deployment Roadmap]] |

## Quality tools

```bash
black app tests          # format
ruff check --fix app tests   # lint
mypy app                 # types
pytest -q                # tests
pre-commit install       # once per clone
```

## CI pipeline (GitHub Actions, on push/PR to main/master/develop)

1. `lint-and-typecheck` — Black, Ruff, mypy
2. `test` — Postgres service container, `alembic upgrade head`, `alembic check`, pytest
3. `docker-build` — ensures the image builds

No deploy job, by design, until the platform actually ships.

## Migrations (Alembic)

`DATABASE_URL` comes from `.env`; async URLs get converted for Alembic (`postgresql+asyncpg://` → `postgresql://`, sync psycopg2 driver only for migrations).

```bash
alembic current                                    # current DB revision
alembic upgrade head                                # apply pending
alembic revision --autogenerate -m "add_foo_column"  # after model changes — review before applying
alembic downgrade -1                                 # rollback one step
alembic stamp head                                   # baseline an existing create_all() DB without re-running DDL
```

`RUN_MIGRATIONS_ON_STARTUP=true` by default (runs `alembic upgrade head` on API start); set `false` in production and run migrations in CI/CD instead.

**Important distinction**: Alembic only migrates the **platform DB**. The **customer security DB** schema is versioned separately (`app/security_schema/ddl.py`, currently v1.3.1) and upgraded via `POST /db-connections/{id}/bootstrap`, not Alembic — see [[01 - Platform Architecture]] and [[03 - Control Plane]].

## Secrets hygiene

| File | Commit? |
|---|---|
| `.env` | Never |
| `.env.example` | Yes, placeholders only |
| Real `ENCRYPTION_KEY` / `SECRET_KEY` | Secrets manager or local only |

```bash
openssl rand -hex 32
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Connection drivers (optional, for `config_inspection` live probes)

| Engine | Package | Status |
|---|---|---|
| PostgreSQL / Supabase | `asyncpg` | Bundled |
| SQLite | `aiosqlite` | Bundled |
| MySQL / MariaDB | `aiomysql` | Optional |
| MSSQL | `aioodbc` + ODBC Driver 18 | Optional |
| MongoDB | `motor` | Optional |
| Firestore | `google-cloud-firestore` | Optional |

Credentials can always be stored encrypted without the driver installed; live `POST …/test` for that engine requires the package. Check status: `GET /db-connections/drivers`.

## Related notes

[[01 - Platform Architecture]] · [[03 - Control Plane]] · [[16 - Deployment Roadmap]]
