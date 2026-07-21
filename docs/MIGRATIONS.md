# Database migrations (Alembic)

Phantix uses **Alembic** for schema changes. Do **not** rely on SQLAlchemy `create_all` for production.

## Layout

```
alembic.ini                 # Alembic config (URL loaded from app settings)
alembic/
  env.py                    # Imports Base + all models; reads DATABASE_URL
  script.py.mako
  versions/
    4881a51d726b_initial_schema.py   # Full baseline schema
```

`DATABASE_URL` comes from `.env` (via `app.core.config.settings`).
Async URLs are converted for Alembic:

| App (async) | Alembic (sync) |
|-------------|----------------|
| `postgresql+asyncpg://...` | `postgresql://...` (psycopg2) |
| `sqlite+aiosqlite://...` | `sqlite://...` |

## Common commands

```bash
source .venv/bin/activate
cd "Phantix Backend"

# Current revision on the DB
alembic current

# History
alembic history

# Apply all pending migrations
alembic upgrade head

# Create a new migration after changing models
alembic revision --autogenerate -m "describe_your_change"

# Review the new file under alembic/versions/, then apply
alembic upgrade head

# Roll back one step
alembic downgrade -1
```

## Existing database (already created with create_all)

If tables already exist and match the models:

```bash
alembic stamp head
```

This records the baseline revision without re-running `CREATE TABLE`.

## Fresh database

```bash
alembic upgrade head
```

Creates all tables from the migration history.

## Application startup

By default `RUN_MIGRATIONS_ON_STARTUP=true` runs `alembic upgrade head` when the API starts.

For production you may prefer:

```env
RUN_MIGRATIONS_ON_STARTUP=false
```

…and run migrations in CI/CD:

```bash
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Workflow for schema changes

1. Edit models under `app/models/`.
2. `alembic revision --autogenerate -m "add_foo_column"`.
3. **Review** the generated file (autogenerate is not perfect).
4. `alembic upgrade head`.
5. Commit the migration file with your code.

## Dependencies

- `alembic` (in `requirements.txt`)
- `psycopg2-binary` — sync Postgres driver used only by Alembic
