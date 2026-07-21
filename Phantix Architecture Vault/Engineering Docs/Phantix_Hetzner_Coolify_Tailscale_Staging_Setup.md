# Phantix Staging Environment Setup
**Hetzner Cloud VPS + Coolify + Tailscale**
Secure Backend Development & Scanning Against Local Multi-Database Mock Client Stores (Windows)

**Document Version**: 1.1
**Date**: July 2026
**Phase**: Architecture & Research (6-month planning window)
**Purpose**: Development/Staging environment for Phantix backend utilities (FastAPI API endpoints, Celery/RQ workers, AI analysis engine, Nmap/Nuclei/OpenVAS orchestration, multi-DB CRUD against realistic mock client security stores).
**Local Mock Databases (Windows)**:
- **PostgreSQL** → Mock security / asset / findings store
- **Microsoft SQL Server (MSSQL)** → Typical SME ERP / business application database
- **Google Cloud Firestore** → Modern NoSQL / document store used by many Nigerian fintech & e-commerce SMEs
**Production Target**: Own VPS (this setup mirrors the eventual production pattern).
**Core Principles Applied**: Simplicity First · Security by Default · Zero Trust at SME Scale · African Market Fit (low cost, high control) · AI-Assisted Human-Approved

---

## 1. Why This Architecture?

Phantix must support realistic multi-database environments that Nigerian SMEs actually use (MSSQL for legacy/on-prem apps, Firestore for modern cloud apps, PostgreSQL for security/asset data).

During development we need the cloud-hosted FastAPI + workers to perform:
- Authenticated & unauthenticated scans
- CRUD operations
- AI prioritization & plain-language explanations

…against **private mock databases** running on the developer’s Windows machine — without ever exposing those databases to the public internet.

**Solution**:
Hetzner CX22 VPS running Coolify + Tailscale WireGuard mesh. The Windows machine joins the same Tailscale network. All mock databases listen only on the Tailscale interface (or localhost + port-forward via Tailscale). Zero public ports. Full Git-push deploys. Automatic SSL. Perfect for the current architecture phase.

**Cost Target**: ≈ €4–6 / month for the VPS + free Tailscale personal plan + free Coolify.

**Relevant Reading**:
- *Zero Trust Networks* (Rais et al.) — continuous verification across heterogeneous data stores.
- *Security Engineering* (Ross Anderson) — real-world multi-system security, economics, failure modes.
- *The Web Application Hacker’s Handbook* & *Penetration Testing* (Weidman) — how to model realistic multi-DB attack surfaces for SME prioritization.
- *Building LLM Powered Applications* (Alto) — safe RAG and multi-source context for the AI engine.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     DEVELOPER WINDOWS MACHINE (Local)                            │
│  ┌────────────────────┐                                                          │
│  │ Tailscale Client   │  ← 100.x.x.x (your Windows Tailscale IP)                 │
│  └────────────────────┘                                                          │
│         │                                                                        │
│         ├── PostgreSQL (mock security store)          port 5432                  │
│         ├── Microsoft SQL Server (MSSQL)              port 1433                  │
│         └── Google Cloud Firestore (emulator or real)  (HTTP/gRPC via Tailscale) │
│                                                                                  │
│  All databases bound to Tailscale IP or localhost + Tailscale Serve/Funnel if    │
│  needed. Never exposed on 0.0.0.0 public interfaces.                             │
└──────────────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ Encrypted Tailscale WireGuard Mesh
                                      │ (Zero Trust private network)
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       HETZNER CLOUD (Germany / Finland)                          │
│  Hetzner Firewall                                                                │
│  ├── Inbound: 22 (SSH), 80/443 (HTTP/S), 8000 (Coolify UI)                       │
│  └── Outbound: Any (required for Nmap / Nuclei / OpenVAS + Firestore if cloud)  │
│                                                                                  │
│  CX22 VPS (Ubuntu 24.04 LTS · 2 vCPU · 4 GB RAM · 40 GB NVMe)                    │
│  ├── Coolify (orchestration, reverse proxy, SSL, Git deploys)                    │
│  ├── Tailscale Client                                                            │
│  ├── Platform PostgreSQL (internal — orgs, auth, audit, posture scores)          │
│  ├── Redis (Celery queues)                                                       │
│  ├── FastAPI API                                                                 │
│  └── Celery Workers (scan orchestration + multi-DB AI analysis)                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1: Local Mock Databases on Windows + Tailscale

### Step 1.1 — Install Tailscale on Windows
1. Download the Windows installer from [https://tailscale.com/download](https://tailscale.com/download).
2. Install and sign in with your account.
3. Open PowerShell or Command Prompt and confirm:
   ```powershell
   tailscale status
   tailscale ip -4
   ```
   Note your Windows Tailscale IPv4 (example: `100.110.120.130`).
   **This IP will be used by all cloud services.**

### Step 1.2 — Mock PostgreSQL (Security / Asset / Findings Store)
**Recommended**: Use Docker Desktop for Windows (easiest and consistent with Linux containers later).

```powershell
docker run -d `
  --name phantix-mock-postgres `
  -p 5432:5432 `
  -e POSTGRES_DB=client_security_store `
  -e POSTGRES_USER=phantix_crud_user `
  -e POSTGRES_PASSWORD="client_secret_pass_abc" `
  -e POSTGRES_HOST_AUTH_METHOD=scram-sha-256 `
  postgres:16-alpine
```

- Bind only to the Tailscale interface if possible (advanced: use `-p 100.110.120.130:5432:5432`).
- Or leave as `localhost` and use Tailscale Serve later if needed.

### Step 1.3 — Microsoft SQL Server (MSSQL) Mock Business Database
**Option A – Docker (recommended for isolation)**
```powershell
docker run -d `
  --name phantix-mock-mssql `
  -e "ACCEPT_EULA=Y" `
  -e "MSSQL_SA_PASSWORD=YourStrong!Passw0rd" `
  -e "MSSQL_PID=Developer" `
  -p 1433:1433 `
  mcr.microsoft.com/mssql/server:2022-latest
```

**Option B – Native Windows install**
Install SQL Server Express / Developer Edition and enable TCP/IP on port 1433.
Configure Windows Firewall to allow inbound only from Tailscale interface (or use `netsh` / firewall rules restricted to Tailscale subnet).

Create a dedicated login:
```sql
CREATE LOGIN phantix_crud_user WITH PASSWORD = 'client_secret_pass_abc';
CREATE DATABASE client_business_store;
USE client_business_store;
CREATE USER phantix_crud_user FOR LOGIN phantix_crud_user;
ALTER ROLE db_owner ADD MEMBER phantix_crud_user;
```

### Step 1.4 — Google Cloud Firestore Mock
**Preferred for development**: Use the official Firestore Emulator (no cost, fully local).

1. Install Firebase CLI:
   ```powershell
   npm install -g firebase-tools
   ```
2. Initialize and start the emulator:
   ```powershell
   firebase init emulators
   # Select Firestore
   firebase emulators:start --only firestore --project=phantix-mock
   ```
   Default ports: 8080 (Firestore), 4000 (Emulator UI).

3. Point your application at the emulator via environment variables:
   ```
   FIRESTORE_EMULATOR_HOST=100.110.120.130:8080
   ```
   (or `localhost:8080` + Tailscale Serve if required).

**Alternative**: Use a real (free tier) Firestore project in Google Cloud and restrict access via service account + Tailscale (more realistic but requires careful IAM).

### Step 1.5 — Windows Firewall Hardening (Critical)
- Open Windows Defender Firewall → Advanced settings.
- Create inbound rules **only** for the ports you need (5432, 1433, 8080) and scope them to the Tailscale interface or the Tailscale subnet (`100.64.0.0/10`).
- Never leave them open to “Any IP”.

### Step 1.6 — Verify Local Reachability from Windows
```powershell
# PostgreSQL
docker exec -it phantix-mock-postgres psql -U phantix_crud_user -d client_security_store -c "SELECT 1;"

# MSSQL (using sqlcmd or Azure Data Studio)
sqlcmd -S localhost,1433 -U sa -P "YourStrong!Passw0rd" -Q "SELECT 1"

# Firestore Emulator UI → http://localhost:4000
```

---

## 4. Phase 2–5: Hetzner + Coolify (Mostly Unchanged)

Follow the previous document for:
- Creating the Hetzner project & Firewall
- Launching the CX22 Ubuntu 24.04 server
- Installing Tailscale + Coolify
- Connecting the GitHub repository
- Creating the internal Platform PostgreSQL

**Key update for environment variables** (use these in Coolify Docker Compose / Service settings):

```yaml
environment:
  # Platform internal DB
  - DATABASE_URL=postgresql+asyncpg://coolify_user:SECURE_PASS@platform-db:5432/phantix_platform
  - REDIS_URL=redis://redis:6379/0

  # === Local Mock Databases via Tailscale ===
  - MOCK_POSTGRES_URL=postgresql+asyncpg://phantix_crud_user:client_secret_pass_abc@100.110.120.130:5432/client_security_store
  - MOCK_MSSQL_URL=mssql+pyodbc://phantix_crud_user:client_secret_pass_abc@100.110.120.130:1433/client_business_store?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
  - FIRESTORE_EMULATOR_HOST=100.110.120.130:8080
  # or for real Firestore:
  # - GOOGLE_APPLICATION_CREDENTIALS=/secrets/phantix-firestore-sa.json
  # - FIRESTORE_PROJECT_ID=phantix-mock-staging

  - SECRET_KEY=...
  - ENCRYPTION_KEY=...
  - ENVIRONMENT=staging
```

**Recommended Docker Compose service additions** (for the workers that need multi-DB drivers):

```yaml
  celery_worker:
    # ... existing config ...
    environment:
      # all the MOCK_* variables above
    # Ensure the image has the necessary drivers:
    # - asyncpg / psycopg2 for Postgres
    # - pyodbc + ODBC Driver 18 for MSSQL
    # - google-cloud-firestore for Firestore
```

Install the ODBC driver in your Dockerfile if needed:
```dockerfile
# For MSSQL connectivity from Linux containers
RUN apt-get update && apt-get install -y unixodbc-dev curl gnupg \
  && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
  && curl https://packages.microsoft.com/config/ubuntu/24.04/prod.list > /etc/apt/sources.list.d/mssql-release.list \
  && apt-get update \
  && ACCEPT_EULA=Y apt-get install -y msodbcsql18
```

---

## 5. Verification Checklist (Multi-DB)

- [ ] Tailscale connected on Windows and Hetzner (`tailscale status` shows both).
- [ ] From Hetzner you can reach:
  ```bash
  # Postgres
  docker run --rm --network host postgres:16-alpine \
    psql "postgresql://phantix_crud_user:client_secret_pass_abc@100.110.120.130:5432/client_security_store" -c "SELECT version();"

  # MSSQL (install sqlcmd or use a test container)
  # Firestore emulator responds on the Tailscale IP:8080
  ```
- [ ] FastAPI can open connections to all three mock stores.
- [ ] A Celery scan job successfully reads from / writes to each mock DB.
- [ ] No public ports are open on Windows for 5432 / 1433 / 8080.
- [ ] Coolify logs show successful multi-DB health checks.

---

## 6. Security & Operational Notes

1. **Never** put real customer data in any of these mock databases.
2. Rotate all mock credentials regularly and store them only in Coolify environment variables / secrets.
3. Prefer the Firestore Emulator for day-to-day development; switch to a real project only when testing IAM / production-like auth.
4. For MSSQL, always use a low-privilege login (`phantix_crud_user`) — never SA in application code.
5. Monitor Tailscale ACL if you later add more team members (least-privilege access to the mock DBs).
6. Document every connection string and driver requirement in the Developer Contributor Guide so other contributors can reproduce the multi-DB environment.

---

## 7. Cost Reminder

| Item                        | Cost                  |
|-----------------------------|-----------------------|
| Hetzner CX22                | ~€3.79–5.50 / month  |
| Tailscale Personal          | Free                  |
| Coolify                     | Free                  |
| Local Docker / SQL Server   | Free                  |
| Firestore Emulator          | Free                  |
| **Total staging**           | **≈ €5 / month**      |

---

## 8. Next Recommended Actions

1. Update your FastAPI dependency injection / database session factories to support the three mock connection strings (use SQLAlchemy multi-bind or separate engines).
2. Create a small “mock data seeder” script that populates realistic SME data in all three stores (fintech transactions in MSSQL, security findings in Postgres, customer documents in Firestore).
3. Add health-check endpoints that report connectivity status for every mock store.
4. Update the Phantix AI engine prompts so the LLM can reason across multi-database findings (this is a strong differentiator for the platform).

---

**Document Owner**: Phantix Architecture Team
**Last Updated**: 11 July 2026
**Related Documents**:
- Previous version 1.0 (single Postgres)
- `02_what_we_are_building_phantix.md`
- `03_book_summaries_tailored_to_phantix.md`
- Developer Contributor Guide

This multi-database staging setup gives Phantix a realistic playground that mirrors the heterogeneous environments Nigerian SMEs actually run — while remaining fully private and Zero-Trust aligned.

**PROTECT. PREVENT. PERFORM.**
