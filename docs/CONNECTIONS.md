# Phantix Database Connections

## Hybrid privacy model

Phantix **never stores customer business data**. Each organization configures two kinds of connections:

| Purpose | Access | What Phantix does |
|---------|--------|-------------------|
| `config_inspection` | **Read metadata / security config only** | Inspect security posture: roles, privileges, policies (e.g. RLS), grants, engine settings, schema inventory. **Does not read application table rows or business data.** |
| `security_data_storage` | Full CRUD on **Phantix schema only** | Write findings, assets, scans, evidence, remediation, AI analysis |

Platform DB holds only **connection metadata + encrypted credentials**.

### What “read access” means for config inspection

**Yes — Phantix may read security rules and configuration**, for example:

- Server version and security-related settings
- Logins / roles / users and their privileges
- Grants on schemas and objects (permission catalog)
- Policy definitions (e.g. Postgres RLS policy metadata)
- Object inventory (schema/table/view **names**, not contents)
- Auth/TLS posture where the engine exposes it

**No — Phantix must not use this connection to:**

- `SELECT` customer business / PII rows
- Export production datasets
- Read document/collection **contents** (Mongo/Firestore: names/ids only)

Least privilege: grant a role that can see catalogs and security metadata, **not** `SELECT` on application tables.

### Connections need more than username + password

| Engine | Typical extra options (`connection_options`) |
|--------|-----------------------------------------------|
| **MSSQL** | `odbc_driver`, `encrypt`, `trust_server_certificate`, `instance_name`, `trusted_connection` (Windows auth), `application_intent` |
| **Postgres / Supabase** | `ssl_mode` (top-level), `search_path`, `connect_timeout_seconds`, `application_name` |
| **MySQL / MariaDB** | `charset`, TLS paths |
| **MongoDB** | `auth_source`, `replica_set`, `tls` |
| **Firestore** | `project_id`, `credentials_path` / service-account JSON |

See `GET /api/v1/db-connections/connection-option-hints` for live hints and a MSSQL example.

---

## 1. Isolation (same server, separate DB/schema)

**Recommended layout**

```
PostgreSQL server (customer-owned)
├── app_production          ← customer app data (Phantix does NOT write here)
│   └── public / app schemas
└── phantix_security        ← dedicated database (preferred)
    └── phantix             ← target_schema (default)
        ├── assets
        ├── findings
        ├── scans
        ├── compliance_evidence
        ├── remediation_tasks
        ├── ai_analyses
        └── schema_migrations
```

Alternatively, same database as the app **only if** Phantix is confined to schema `phantix` and the app never uses that schema.

| Setting | Recommendation |
|---------|----------------|
| `database_name` | `phantix_security` |
| `target_schema` | `phantix` |
| App tables | Outside `phantix` schema |

---

## 2. Least privilege

### Config inspection role (read / metadata)

```sql
-- Example: PostgreSQL
CREATE ROLE phantix_inspector LOGIN PASSWORD '...strong...';

-- Catalog visibility (typical defaults may already allow this)
GRANT CONNECT ON DATABASE app_production TO phantix_inspector;
GRANT USAGE ON SCHEMA public TO phantix_inspector;  -- only if needed for object lists

-- Prefer roles that can read pg_catalog / information_schema only.
-- Do NOT grant SELECT on application tables containing PII/business data.
-- Optional: use a restricted role that can only see system catalogs.
```

**Capabilities Phantix needs for inspection**

- `CONNECT` to the database
- Read `pg_catalog` / `information_schema` (roles, schemas, privileges, settings)
- **No** `SELECT` on business tables

### Security data storage role (DDL + DML on Phantix schema)

```sql
CREATE DATABASE phantix_security OWNER postgres;

CREATE ROLE phantix_writer LOGIN PASSWORD '...strong...';
GRANT CONNECT ON DATABASE phantix_security TO phantix_writer;

\c phantix_security

-- Either let Phantix bootstrap create the schema:
GRANT CREATE ON DATABASE phantix_security TO phantix_writer;

-- Or pre-create and hand over ownership:
CREATE SCHEMA phantix AUTHORIZATION phantix_writer;

-- After bootstrap, ensure ongoing DML:
GRANT USAGE ON SCHEMA phantix TO phantix_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA phantix TO phantix_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA phantix TO phantix_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA phantix
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO phantix_writer;
```

**Capabilities Phantix needs for storage**

| Privilege | Why |
|-----------|-----|
| `CONNECT` | Open connection |
| `CREATE` on database **or** ownership of schema `phantix` | Bootstrap tables |
| `USAGE` on schema `phantix` | Access objects |
| `SELECT/INSERT/UPDATE/DELETE` on Phantix tables | Findings, scans, … |
| Sequence usage | `BIGSERIAL` IDs |

Do **not** grant access to application schemas/tables.

---

## 3. Schema bootstrap

After a healthy `security_data_storage` connection test, Phantix can auto-create tables:

```http
POST /api/v1/db-connections/{id}/test?auto_bootstrap=true
```

Or run explicitly:

```http
POST /api/v1/db-connections/{id}/bootstrap
POST /api/v1/db-connections/{id}/bootstrap?force=true
```

Tables (version `1.1.0` — Asset Discovery):

- `schema_migrations`
- `assets` — inventory (`value`, `source`, `is_verified`, discovery metadata, …)
- `discovery_jobs` — subdomain enum / nmap / future connectors
- `scans`
- `findings`
- `compliance_evidence`
- `remediation_tasks`
- `ai_analyses`

Idempotent (`CREATE … IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`).
Re-run bootstrap when `SCHEMA_VERSION` advances (e.g. 1.0.0 → 1.1.0); no need for `force` unless you want a full re-apply.

Asset Discovery API (org JWT): ` /api/v1/assets ` — **all writes go only to this security schema**, never production DBs.

---

## 4. Optional drivers (config inspection live probes)

| Engine | Package | Status |
|--------|---------|--------|
| PostgreSQL / Supabase | `asyncpg` | Bundled |
| SQLite | `aiosqlite` | Bundled |
| MySQL / MariaDB | `aiomysql` | Optional |
| MSSQL | `aioodbc` + ODBC Driver 18 | Optional |
| MongoDB | `motor` | Optional |
| Firestore | `google-cloud-firestore` | Optional |

```bash
pip install -r requirements-optional.txt
# or individual packages
```

Credentials can always be stored encrypted without the optional driver.
Live `POST …/test` for that engine requires the package.
Check status: `GET /api/v1/db-connections/drivers`.

---

## 5. Phantix-hosted provisioning (later)

```http
POST /api/v1/db-connections/provision
```

Currently returns **501** with roadmap. Until then, customers bring their own dedicated database (BYO) using the steps above.

---

## Quick start

```bash
# 1. Login
TOKEN=...

# 2. Register dedicated security store
curl -X POST /api/v1/db-connections -H "Authorization: Bearer $TOKEN" -d '{
  "name": "Phantix Security Store",
  "connection_purpose": "security_data_storage",
  "db_type": "postgresql",
  "host": "127.0.0.1",
  "port": 5432,
  "database_name": "phantix_security",
  "username": "phantix_writer",
  "password": "...",
  "ssl_mode": "disable",
  "target_schema": "phantix",
  "is_primary": true
}'

# 3. Test + auto-bootstrap
curl -X POST /api/v1/db-connections/1/test?auto_bootstrap=true \
  -H "Authorization: Bearer $TOKEN"
```
