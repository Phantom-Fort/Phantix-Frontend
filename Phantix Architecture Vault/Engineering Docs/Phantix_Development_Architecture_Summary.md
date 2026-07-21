# Phantix Backend – Development Architecture Summary

**Version**: 0.2
**Date**: July 10, 2026
**Status**: Active Design Document
**Audience**: Phantix Development Team

---

## 1. Core Architecture Principles

### 1.1 Hybrid + Privacy-First Model
- Phantix runs the application and all tooling (scanners, AI, orchestration) in the cloud.
- Customers provide their own **Dedicated Security Database**.
- **All security data** (assets, scan results, findings, compliance evidence, history) is stored **only** in the customer’s dedicated database.
- Phantix application servers process requests but **never store** customer security data centrally.
- `CustomerDBConnection` is used **only for database evaluation** (security configuration inspection). These connections are also recorded as assets.

### 1.2 Data Residency
- Every organization has its data isolated in its own database.
- Asset IDs are **unique per customer database** (not globally unique).
- The Phantix backend connects dynamically to the customer’s database for read/write operations.

---

## 2. Asset Discovery Module

### 2.1 Purpose
Asset Discovery builds a comprehensive view of an organization’s attack surface for vulnerability management, penetration testing, and compliance.

### 2.2 Supported Asset Types (MVP)
- `domain`
- `subdomain`
- `ip_address`
- `github_repo`
- `api` (REST/GraphQL endpoints)
- `port_service`
- `database_connection` (for security evaluation)
- `other`

### 2.3 Asset Table (`asset`)

```sql
CREATE TABLE asset (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    value TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    source VARCHAR(50) NOT NULL,
    discovered_via_connection_id BIGINT,
    is_verified BOOLEAN DEFAULT false,
    verification_method VARCHAR(50),
    first_discovered_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
```

**Key Rules**:
- All assets are stored in the customer’s Dedicated Security Database.
- `metadata` is flexible JSONB.
- `is_verified` is used for manual assets (basic ownership check using organization name in domain, GitHub org match, etc.).
- Automated discovery can bypass strict verification once assets are verified.

### 2.4 Asset Tagging (Normalized – for Reporting)

```sql
CREATE TABLE asset_tag (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

CREATE TABLE asset_tag_assignment (
    asset_id BIGINT REFERENCES asset(id) ON DELETE CASCADE,
    tag_id BIGINT REFERENCES asset_tag(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (asset_id, tag_id)
);
```

**Reason**: Normalized structure is required because a **Report solution** is part of the MVP and needs advanced filtering/reporting.

### 2.5 Asset History

```sql
CREATE TABLE asset_history (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES asset(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    changed_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.6 Discovery Sources (MVP Priority)
- Manual entry (with verification)
- Subdomain enumeration (passive)
- Port scanning (Nmap)
- GitHub integration (PAT first)
- API spec import (OpenAPI / Postman)
- IP resolution & enrichment

**GitHub Integration**:
- Support Personal Access Token (PAT) in MVP.
- Plan for GitHub App later.
- Store repository metadata.
- Future: secret scanning and dependency analysis.

**API Assets**:
- Treated as first-class assets.
- Import via OpenAPI or Postman.
- Categorize by endpoint name, parameters, and response structure.
- Used for future penetration testing and vulnerability management.

---

## 3. Scanning Module

### 3.1 Scan Job

```sql
CREATE TABLE scan_job (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    initiated_by_user_id INTEGER,
    job_type VARCHAR(50) NOT NULL,
    target_filter JSONB,                    -- e.g. {"tags": ["critical", "web"], "asset_types": ["domain", "api"]}
    status VARCHAR(30) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    celery_task_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Rules**:
- Scans are **on-demand / manual only** (no recurring/scheduled in MVP).
- A Scan Job can target assets using **tags / prioritization** (e.g. critical, web, API).
- Only **one active scan job per organization** at any time.
- New scan requests are rejected while another is running (idempotency + one-time request rule).

### 3.2 Scan Result

```sql
CREATE TABLE scan_result (
    id BIGSERIAL PRIMARY KEY,
    scan_job_id BIGINT REFERENCES scan_job(id),
    organization_id INTEGER NOT NULL,
    asset_id BIGINT REFERENCES asset(id),
    tool VARCHAR(50) NOT NULL,              -- nmap, nuclei
    severity VARCHAR(20),
    title TEXT,
    description TEXT,
    evidence JSONB,
    raw_output TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Stored so the **Report solution** and **AI module** can generate human-readable reports.

### 3.3 Message Queue & Task Processing

- **Technology**: Celery + Redis / RabbitMQ
- Workers pick up `scan_job` tasks from the queue.
- Strong **idempotency** — a scan should not run more than once per request.
- One active scan per organization enforced at the application/database level.

### 3.4 Tool Execution Environment

- **All tools** (Nmap, Nuclei, etc.) must run **inside Docker containers**.
- Maximum **1 shell / container spawned per user** at any time.
- Tools are executed in isolated containers for security and consistency.

### 3.5 SSRF Protection (Strict)

All scan targets must pass the following controls before execution:

- **Strict Input Validation**: Positive allow list for URL schemes (only `https://` allowed). Block dangerous schemes (`file://`, `gopher://`, etc.).
- **Block Internal Ranges**: Prevent scanning of private IP ranges (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.0.0/16`, etc.) and protect against DNS rebinding.
- **Disable Redirects**: Turn off automatic HTTP redirects.
- **Cloud Metadata Protection**: Enforce IMDSv2 on AWS and restrict outbound access to cloud metadata services.
- Additional firewall rules on outbound traffic from scanning containers.

---

## 4. Key Non-Functional Requirements

| Requirement                    | Decision                                                                 |
|--------------------------------|--------------------------------------------------------------------------|
| Multi-tenancy                  | Data lives in customer’s dedicated DB. Phantix only processes requests. |
| Encryption                     | Sensitive data in `metadata` and connection details must be encrypted before writing. |
| Concurrency                    | Only 1 active scan per organization at a time. Idempotent scan requests. |
| Tool Isolation                 | All scanning tools run in Docker containers. Max 1 shell per user.     |
| SSRF Protection                | Very strict (allow list + internal range blocking + no redirects).      |
| Data Storage                   | All assets and scan results go to customer’s Dedicated Security DB.     |
| Reporting & AI                 | Scan results must be structured so Report solution and AI can consume them. |

---

## 5. Current MVP Scope Summary

**In Scope (MVP)**:
- Normalized Asset model + Tagging + History
- Manual asset entry with verification
- Subdomain enumeration + Nmap port scanning
- GitHub integration (PAT)
- API asset import (OpenAPI / Postman) with categorization
- Scan Jobs (on-demand/manual)
- Celery + Redis/RabbitMQ
- Docker-based tool execution (Nmap + Nuclei)
- Strict SSRF protection
- Storage of results for reporting & AI

**Out of Scope (MVP)**:
- Recurring / scheduled scans
- Authenticated scanning
- Cloud provider connectors (AWS, Azure, GCP)
- Advanced secret scanning in GitHub
- Full Report solution UI (but data model must support it)

---

## 6. Recommended Next Implementation Steps

1. Finalize `asset`, `asset_tag`, `asset_tag_assignment`, and `asset_history` models + migrations.
2. Design and implement **Manual Asset Management** (CRUD + verification logic).
3. Build **Asset Discovery Jobs** (Subdomain enumeration + basic Nmap).
4. Implement **GitHub Connector** (PAT support).
5. Build **API Spec Importer** with categorization.
6. Design `scan_job` + `scan_result` models.
7. Set up **Celery + Redis/RabbitMQ** infrastructure.
8. Implement **Docker-based execution layer** for Nmap & Nuclei.
9. Build **SSRF protection + target validation** middleware.
10. Enforce **one active scan per organization** rule.

---

**Document maintained by**: Phantix Engineering Team
**Last Updated**: July 10, 2026

---

*This document consolidates all architectural decisions and requirements discussed between July 9–10, 2026.*
