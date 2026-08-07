# Security database setup

Phantix uses a **hybrid privacy model**:

- **Platform** holds your login, billing, and settings.
- **Your security database** holds assets, scans, findings, risks, and evidence.

Phantix never uses this connection to read your production business rows (customers, orders, etc.).

---

## Coming soon: Phantix-hosted databases

We will offer **managed security databases** provisioned for you (one click).

Until that ships:

- Connect **your own** PostgreSQL (recommended), or another supported engine.
- Endpoint `POST /api/v1/db-connections/provision` is reserved for hosted provisioning.

Watch the product changelog or ask sales for availability.

---

## What you need to create

| Item | Recommendation |
|------|----------------|
| Database name | e.g. `phantix_security` (separate from your app DB) |
| Schema | `phantix` (default) |
| User | Dedicated role with rights **only** on that DB/schema |
| Network | Allow Phantix platform IPs / your staging IP on port 5432 (or provider SSL port) |
| TLS | Prefer `require` / `verify-full` in production |

---

## PostgreSQL — provider guides

### A. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database** → copy:
   - Host
   - Port (usually `5432`)
   - Database name (often `postgres`)
   - User (often `postgres`)
   - Password
3. Prefer **connection pooling** host only if SSL and schema bootstrap succeed; otherwise use the **direct** connection for first bootstrap.
4. In Phantix: **Connections → Add** → engine `postgresql`, purpose `security_data_storage`.
5. SSL mode: typically `require`.
6. **Test connection** → **Bootstrap schema**.

> Optional: create a dedicated database/schema later for cleaner isolation from Supabase app tables.

### B. Neon

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string or host / db / user / password.
3. Ensure the compute is not suspended when testing (wake the project).
4. SSL: `require`.
5. Add in Phantix as PostgreSQL security storage → Test → Bootstrap.

### C. Amazon RDS / Aurora PostgreSQL

1. Create a PostgreSQL instance (private subnet OK if Phantix can reach it via VPN/allowlist).
2. Security group: allow inbound **5432** from Phantix egress IPs (ask support for the list).
3. Create database `phantix_security` and user (see SQL below).
4. SSL often required (`ssl_mode=require`).
5. Connect from Phantix → Test → Bootstrap.

### D. DigitalOcean Managed Postgres

1. Create a managed database → PostgreSQL.
2. Add Phantix IPs to **Trusted sources**.
3. Create DB + user, or use the default and a dedicated schema.
4. Use the provided host, port, SSL mode.
5. Phantix → Test → Bootstrap.

### E. Railway / Render / other PaaS

1. Provision **PostgreSQL** add-on.
2. Copy `DATABASE_URL` or discrete host/user/password/db.
3. If only one DB is available, use schema `phantix` exclusively for Phantix.
4. Open public networking only if required; prefer private + allowlist.
5. Phantix → Test → Bootstrap.

### F. Self-hosted / VPS Postgres

```sql
CREATE DATABASE phantix_security;
CREATE ROLE phantix_writer LOGIN PASSWORD '...strong...';
GRANT CONNECT ON DATABASE phantix_security TO phantix_writer;

\c phantix_security
GRANT CREATE ON DATABASE phantix_security TO phantix_writer;
-- Or pre-create:
CREATE SCHEMA phantix AUTHORIZATION phantix_writer;
```

Then grant DML after bootstrap (or let bootstrap run with `CREATE` privilege).

---

## SQL template (dedicated role)

```sql
CREATE DATABASE phantix_security OWNER postgres;

CREATE ROLE phantix_writer LOGIN PASSWORD 'use-a-long-random-password';
GRANT CONNECT ON DATABASE phantix_security TO phantix_writer;

\c phantix_security

GRANT CREATE ON DATABASE phantix_security TO phantix_writer;
-- Phantix bootstrap will create schema "phantix" and tables
```

After bootstrap succeeds, you can tighten privileges if your DBA requires it.

---

## In the Phantix app

1. Open **Database connections** (or Setup → Security storage).
2. **Add connection**:
   - Purpose: **Security data storage**
   - Engine: **PostgreSQL** (or another supported engine)
   - Host, port, database, user, password
   - SSL mode as required by your provider
3. **Test connection**.
4. **Bootstrap schema** (creates Phantix tables).
5. Mark as **primary security storage** if asked.

API equivalents (for advanced users):

| Action | Endpoint |
|--------|----------|
| List | `GET /api/v1/db-connections` |
| Create | `POST /api/v1/db-connections` |
| Hints | `GET /api/v1/db-connections/connection-option-hints` |
| Test | `POST /api/v1/db-connections/{id}/test` |
| Bootstrap | `POST /api/v1/db-connections/{id}/bootstrap` |
| Primary | `GET /api/v1/db-connections/primary-security-storage` |

---

## Optional: config inspection connection

A separate connection type can inspect **security metadata** (roles, grants, policies) on a production DB **without reading business rows**. Use a least-privilege inspector role. Not required for basic inventory and scanning.

---

## Other engines

PostgreSQL is recommended. Also supported or optional for inspection:

| Engine | Notes |
|--------|--------|
| PostgreSQL / Supabase / Neon / RDS | First-class |
| MSSQL | Supported for inspection (ODBC on platform) |
| MySQL / MariaDB, MongoDB, Firestore | Optional drivers |

---

## Checklist

- [ ] Dedicated DB (or dedicated schema)
- [ ] Strong unique password
- [ ] Network allowlist
- [ ] SSL enabled
- [ ] Test OK
- [ ] Bootstrap OK
- [ ] Backup policy on your side

**Next:** [Email & SMTP →](./03-email-and-smtp.md)
