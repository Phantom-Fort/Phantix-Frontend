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

## 4. Database drivers (config inspection live probes)

| Engine | Package | Status |
|--------|---------|--------|
| PostgreSQL / Supabase | `asyncpg` | **Bundled** |
| SQLite | `aiosqlite` | **Bundled** |
| **MSSQL** | `aioodbc` + `pyodbc` + **system** ODBC Driver 17/18 | **Supported** (config_inspection) |
| MySQL / MariaDB | `aiomysql` | Optional (`requirements-optional.txt`) |
| MongoDB | `motor` | Optional |
| Firestore | `google-cloud-firestore` | Optional |

```bash
pip install -r requirements.txt            # includes aioodbc + pyodbc
# Other engines:
pip install -r requirements-optional.txt
```

Credentials can always be stored encrypted even if the live probe driver is missing.
Live `POST …/test` for that engine requires the package (and for MSSQL, system ODBC).

Check status:

```http
GET /api/v1/db-connections/drivers
```

---

## 5. MSSQL connections (config inspection)

MSSQL is supported for **`connection_purpose = config_inspection` only** — posture/metadata (version, login, schema counts, role membership). Phantix does **not** use MSSQL as `security_data_storage` (security inventory stays on Postgres/Supabase).

### 5.1 Host prerequisites

| Layer | Requirement |
|-------|-------------|
| Python | `aioodbc`, `pyodbc` (in `requirements.txt`) |
| OS | `unixodbc` + **Microsoft ODBC Driver 18** (or 17) for SQL Server |

**Docker image** (`Dockerfile`): installs `unixodbc` + `msodbcsql18` automatically.

**Bare metal / WSL / host API** (needs root once):

```bash
sudo ./scripts/install_mssql_odbc.sh
odbcinst -q -d    # expect: ODBC Driver 18 for SQL Server
# restart API / workers after install
```

Manual Microsoft docs:  
https://learn.microsoft.com/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server

### 5.2 Register connection

```http
POST /api/v1/db-connections
Authorization: Bearer <org JWT>
# + X-Dual-Control-Session when dual-control is configured
```

```json
{
  "name": "Prod MSSQL Config Inspection",
  "description": "Read-only posture probe — no business row access",
  "connection_purpose": "config_inspection",
  "db_type": "mssql",
  "host": "sql.customer.internal",
  "port": 1433,
  "database_name": "AppDb",
  "username": "phantix_ro",
  "password": "…",
  "ssl_mode": "require",
  "environment": "production",
  "connection_options": {
    "odbc_driver": "ODBC Driver 18 for SQL Server",
    "encrypt": true,
    "trust_server_certificate": true,
    "application_intent": "ReadOnly",
    "connect_timeout_seconds": 15
  }
}
```

| Option | Purpose |
|--------|---------|
| `odbc_driver` | Must match an installed driver name (`odbcinst -q -d`) |
| `encrypt` | TLS to SQL Server (default true if omitted and ssl_mode is not disable) |
| `trust_server_certificate` | Accept self-signed certs (common in lab/internal) |
| `instance_name` | Named instance → `SERVER=host\instance` (port ignored) |
| `application_intent` | e.g. `ReadOnly` for AG secondaries |
| `auth_method` / `trusted_connection` | Windows auth when set (`windows` / true) |
| `connect_timeout_seconds` | ODBC connection timeout |

### 5.3 Test

```http
POST /api/v1/db-connections/{id}/test
```

Success `details` include `engine`, `current_user`, `current_database`, `server_name`, `schema_count`, `database_roles`, `odbc_driver`, `inspection_scope`.

### 5.4 Least privilege (customer DBA)

Grant a **read metadata** SQL login — not `db_owner` on production app data:

```sql
CREATE LOGIN phantix_ro WITH PASSWORD = '…strong…';
USE AppDb;
CREATE USER phantix_ro FOR LOGIN phantix_ro;
-- Enough for @@VERSION / SYSTEM_USER / sys.schemas / role membership
GRANT VIEW DEFINITION TO phantix_ro;  -- optional, environment-specific
-- Prefer: no SELECT on application tables with PII
```

### 5.5 Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Live probe for 'mssql' requires optional driver` / `libodbc.so.2` | Install `unixodbc` + `msodbcsql18`; `pip install aioodbc pyodbc` |
| `Can't open lib` / `IM002` | Wrong `odbc_driver` name or driver not installed |
| Login failed | Check SQL auth vs Windows auth; firewall; `Encrypt`/`TrustServerCertificate` |
| Credentials stored but test fails | Storage still works encrypted; only live probe needs ODBC |

Hints endpoint: `GET /api/v1/db-connections/connection-option-hints` (includes `mssql_example`).

---

## 6. GitHub PAT connection (asset discovery)

GitHub is **not** a `db-connections` engine. It is an **organization integration** on the Asset Engine: a Personal Access Token (PAT) used to discover repositories as `github_repo` assets.

### 6.1 How it works (flow)

```text
1. Operator creates a GitHub PAT (classic or fine-grained) with repo read scope
2. POST /api/v1/assets/integrations/github
      body: { personal_access_token, optional github_login, label }
3. Backend calls GitHub GET /user with the token
      - Validates the token
      - Resolves login (and id, type, html_url)
4. PAT is Fernet-encrypted into platform table organization_integrations
      - Token never returned on GET
      - config JSON stores github_login + public metadata only
5. POST /api/v1/assets/import/github
      - discover_all: true  → GET /user/repos (owner + org member, paginated)
      - or repo: "owner/name" / URL → GET /repos/{owner}/{repo}
6. Each repo is upserted as asset_type=github_repo in the org security DB
      - value = html_url
      - metadata = stars, language, default_branch, visibility, …
      - is_verified if repo owner matches stored github_login (or force_verify)
```

**Storage split**

| What | Where |
|------|--------|
| Encrypted PAT + login | **Platform DB** `organization_integrations` |
| Repo assets / inventory | **Security DB** `assets` (`asset_type=github_repo`) |

### 6.2 Required PAT scopes

| PAT type | Minimum |
|----------|---------|
| Classic | `repo` (private repos) or `public_repo` (public only) |
| Fine-grained | Repository access: **Contents: Read-only** (and metadata) for the orgs/repos you want imported |

Optional: org membership visibility if importing org repos the user can see.

### 6.3 API

**Store / update PAT**

```http
POST /api/v1/assets/integrations/github
Authorization: Bearer <org JWT>
Content-Type: application/json

{
  "personal_access_token": "ghp_… or github_pat_…",
  "github_login": "optional-override",
  "label": "default"
}
```

Response (no token):

```json
{
  "id": 1,
  "organization_id": 11,
  "provider": "github",
  "label": "default",
  "github_login": "acme-eng",
  "is_active": true,
  "token_configured": true,
  "created_at": "…"
}
```

**List integrations** (never exposes secrets)

```http
GET /api/v1/assets/integrations/github
```

**Import repositories**

```http
POST /api/v1/assets/import/github
{
  "discover_all": true,
  "force_verify": false
}
```

or single repo:

```json
{ "repo": "acme/payments-api" }
{ "repo": "https://github.com/acme/payments-api" }
```

### 6.4 Verification rules

- If `github_login` matches the repo owner → asset `is_verified=true` (`github_owner_match`).
- Manual `POST /assets` for a github URL uses the same linked login when present.
- `force_verify=true` on import marks verified without owner match (use carefully).

### 6.5 Security notes

- PAT is encrypted at rest with the platform `ENCRYPTION_KEY` (Fernet).
- Rotate PAT: call `POST …/integrations/github` again with the new token (same `label` upserts).
- Revoke on GitHub when an org leaves Phantix; delete integration row if you add a delete API path or via admin ops.
- GitHub App (installation tokens) is **not** implemented yet — PAT only.

### 6.6 Frontend UX sketch

1. Settings → Integrations → GitHub → paste PAT → Save (POST integrations).
2. Show linked `github_login` + “Token configured”.
3. Button “Import all repos” / “Import one repo”.
4. Assets list filters `asset_type=github_repo`.
5. Dual-control session required for these mutations when org dual-control is enabled.

Code: `app/engines/asset_engine/adapters/github_connector.py`, `integration_service.py`.

---

## 7. Phantix-hosted provisioning (later)

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

# If bootstrap returns password authentication failed:
#   PUT /api/v1/db-connections/{id}  with the correct password
#   then retry test or POST …/bootstrap
# The stored connection password must match a real Postgres role.

# 4. Optional: MSSQL config inspection (after ODBC install)
curl -X POST /api/v1/db-connections -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{
  "name": "Prod MSSQL",
  "connection_purpose": "config_inspection",
  "db_type": "mssql",
  "host": "sql.internal",
  "port": 1433,
  "database_name": "AppDb",
  "username": "phantix_ro",
  "password": "...",
  "connection_options": {
    "odbc_driver": "ODBC Driver 18 for SQL Server",
    "encrypt": true,
    "trust_server_certificate": true
  }
}'

# 5. Optional: GitHub PAT for repo discovery
curl -X POST /api/v1/assets/integrations/github -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"personal_access_token":"ghp_…","label":"default"}'
curl -X POST /api/v1/assets/import/github -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"discover_all":true}'
```
