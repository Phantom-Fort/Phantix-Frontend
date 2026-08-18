# Platform: Connect a security database

**Where:** **Security Database** → `/connections`  
**Purpose:** Store assets, findings, risks, SOC data in **your** database (privacy-first).  
**Type:** `security_data_storage`

![Connections](../../screenshots/platform/connections.png)

---

## Process flow

```text
Prepare PostgreSQL (recommended)
 empty DB + user with create privileges
         │
         ▼
 Platform → Security Database → Add connection
         │
         ▼
 Purpose: security_data_storage
 Fill host, port, database, user, password, schema
         │
         ▼
 [Test connection]  ──fail──► fix network / creds / SSL
         │ ok
         ▼
 [Bootstrap]  → creates Phantix security schema + migrations
         │
         ▼
 Status: ready / bootstrapped
         │
         ▼
 Command Centre modules unblocked (no more 409 security DB)
```

```mermaid
flowchart TD
  A[Create empty PostgreSQL DB] --> B[Add connection on Platform]
  B --> C[Test]
  C -->|Fail| D[Fix firewall / user / SSL]
  D --> C
  C -->|OK| E[Bootstrap schema]
  E --> F[Ready]
  F --> G[Use Command Centre]
```

---

## Steps

1. Provision a database **you control** (cloud or on-prem PostgreSQL preferred).
2. Platform → **Security Database** (Connections).
3. **Add connection**:
   - **Purpose:** Security data storage (not config inspection)
   - Host, port, database name  
   - Username / password  
   - Schema (or default)  
   - SSL options as required by your host  
4. Click **Test**. Wait for success.
5. Click **Bootstrap** (or “Initialize schema”). Wait until status is **ready**.
6. Optionally mark as **primary**.
7. Open Command Centre and confirm assets/scans no longer show “security DB not ready”.

---

## Requirements

| Item | Notes |
|------|--------|
| Empty or dedicated DB | Do not point at production app OLTP blindly |
| Network path | Platform/backend must reach host:port |
| Privileges | Create schema / tables for bootstrap |
| One primary | Prefer a single primary security store per org |

---

## Troubleshooting

| Error | Action |
|-------|--------|
| Test timeout | Firewall / security group / wrong host |
| Auth failed | User/password; scram vs md5 |
| Bootstrap failed | Check privileges; read last error on connection card |
| 409 in app | Bootstrap not finished or not primary |

**Related:** [07-connect-config-database.md](./07-connect-config-database.md)
