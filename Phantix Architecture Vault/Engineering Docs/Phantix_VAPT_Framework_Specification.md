# Phantix VAPT Framework Specification

**Version**: 0.1
**Date**: July 10, 2026
**Status**: Design Specification
**Module**: Vulnerability Assessment & Penetration Testing (VAPT) Framework

---

## 1. Overview

The **Phantix VAPT Framework** is the execution engine responsible for automated and semi-automated vulnerability assessment and penetration testing across multiple surfaces (API, Web, Infrastructure, and Mobile).

It is designed to be:

- **Controlled and governed** (central tool registry, admin-managed tools)
- **Hybrid in execution** (Direct Docker tooling as primary + Burp Pro via MCP as advanced path)
- **Intelligent but practical** (Scripted checks as primary, AI augmentation only when complexity is detected)
- **Secure by design** (Strict SSRF protection, Docker isolation, concurrency controls)
- **Deeply integrated** with Phantix core models (`scan_job`, `asset`, `risk`)

---

## 2. Core Design Principles

| Principle                    | Implementation |
|-----------------------------|----------------|
| **Primary Execution**       | Direct tooling via Docker containers |
| **Advanced Execution**      | Burp Pro + MCP (subscription gated) |
| **Tool Governance**         | Central Tool Registry (admin controlled) |
| **Intelligence Model**      | Scripted checks (primary) + AI (secondary, on complexity) |
| **Data Residency**          | All results written to customer’s Dedicated Security Database |
| **Isolation & Safety**      | Docker execution + strict SSRF controls |
| **Concurrency**             | Maximum 1 active scan job per organization |
| **Resumability**            | Pause and resume supported at scan job level |
| **Idempotency**             | A scan request cannot be duplicated while running |

---

## 3. Scan Job Model (Enhanced)

### 3.1 `scan_job` Table

```sql
CREATE TABLE scan_job (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    initiated_by_user_id INTEGER,

    scan_type VARCHAR(50) NOT NULL,
    -- api_scan, web_scan, infra_scan, mobile_dynamic, full_vapt, targeted_scan, custom_vapt

    target_filter JSONB,
    -- Example: {"tags": ["critical", "external"], "asset_types": ["domain", "api", "github_repo"]}

    status VARCHAR(30) DEFAULT 'pending',
    -- pending, queued, running, paused, completed, failed, cancelled

    progress_percentage INTEGER DEFAULT 0,
    current_stage VARCHAR(100),

    celery_task_id VARCHAR(255),
    parent_job_id BIGINT,                    -- For resumable/paused jobs

    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    resumed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
```

**Key Rules**:
- Only **one active scan job** per organization at any time.
- New scan requests are rejected while another job is `running` or `paused`.
- `scan_type` determines which workflow and tools are used.

---

## 4. Tool Registry

### 4.1 Purpose
Central management of all tools used by Phantix for VAPT execution.

### 4.2 `tool_registry` Table (Internal to Phantix)

```sql
CREATE TABLE tool_registry (
    id BIGSERIAL PRIMARY KEY,
    tool_name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    docker_image VARCHAR(255),
    status VARCHAR(30) DEFAULT 'active',
    -- active, deprecated, beta, disabled
    deprecation_date DATE,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE (tool_name, version)
);
```

**Admin Endpoints** (exposed only to admin role):
- `POST /admin/tools` — Add new tool version
- `PATCH /admin/tools/{id}` — Update status / deprecate
- `GET /admin/tools` — List all tools with status

Customers **cannot** bring their own tools. All execution happens inside Phantix-managed Docker containers.

---

## 5. Execution Architecture

### 5.1 Primary Path: Direct Tooling (Docker)

- Most scans start here.
- Tools (Nmap, Nuclei, ffuf, katana, etc.) run inside isolated Docker containers.
- One container = one tool execution.
- Maximum **1 concurrent shell/container per organization** during active scanning.

### 5.2 Advanced Path: Burp Pro + MCP

- Used for deeper, more complex testing (especially API and Web).
- Triggered based on subscription tier or explicit customer request.
- Always connected via **MCP Server**.
- Agent can control Burp (history, Repeater, site map) through MCP tools.

### 5.3 Execution Flow

```
scan_job created
       │
       ▼
Celery Worker picks job
       │
       ▼
Determine execution path (Direct Docker vs Burp MCP)
       │
       ▼
Spawn Docker container(s) or call Burp MCP
       │
       ▼
Execute tools (scripted checks first)
       │
       ▼
If complexity detected → Invoke AI for decision support
       │
       ▼
Parse results → Write to asset + scan_result tables
       │
       ▼
Trigger Risk Assessment engine
```

---

## 6. Intelligence Layer (Scripted + AI)

### 6.1 Philosophy
- **Scripted checks** are the **primary** mechanism.
- **AI** acts as a **secondary** layer — invoked only when scripted checks cannot complete the job or when high complexity is detected.
- Scripted and AI-augmented analysis **work hand in hand**.

### 6.2 AI Trigger Conditions (per scan job)
- High number of findings with mixed severity
- Complex business logic flows detected
- Ambiguous or conflicting results from multiple tools
- Specific high-risk asset types (e.g., APIs handling sensitive data)

AI is **not** used for basic checks that are already well-covered by scripts.

---

## 7. Pause & Resume Capability

- Supported at the **scan_job level**.
- When paused:
  - Current tool execution is gracefully stopped.
  - Partial results are saved.
  - Job status changes to `paused`.
- When resumed:
  - Job continues from the last known state where possible.
  - New `resumed_at` timestamp is recorded.

---

## 8. Data Flow & Integration

| Component       | Interaction with VAPT Framework |
|-----------------|---------------------------------|
| `asset`         | Discovery jobs create/update assets. Scan results enrich asset metadata. |
| `scan_result`   | Primary storage for structured findings from Nmap, Nuclei, Burp, etc. |
| `risk`          | Every `scan_result` can trigger risk creation or score update. |
| `scan_job`      | Central orchestrator and state holder for all VAPT activity. |

---

## 9. Security Controls

### 9.1 SSRF & Target Validation
- Positive allow list for URL schemes and domains.
- Block all private/internal IP ranges + DNS rebinding protection.
- Disable automatic HTTP redirects.
- Cloud metadata service protection (IMDSv2 enforcement + outbound firewall rules).

### 9.2 Execution Isolation
- All tools run inside Docker containers.
- No direct host execution for customer-initiated scans.
- Maximum 1 concurrent container/shell per organization.

### 9.3 Tool Supply Chain
- Tools are version-controlled via the Tool Registry.
- Only admin-approved versions can be executed.
- Deprecated tools are blocked from new jobs.

---

## 10. Scan Types (Initial Set)

| scan_type          | Description                              | Primary Tools          | AI Support |
|--------------------|------------------------------------------|------------------------|------------|
| `api_scan`         | API security testing                     | Nuclei, Burp, ffuf     | Yes        |
| `web_scan`         | Web application testing                  | Nuclei, Burp, katana   | Yes        |
| `infra_scan`       | Infrastructure & network testing         | Nmap, Nuclei           | Limited    |
| `mobile_dynamic`   | Dynamic APK testing                      | Frida, MobSF, Burp     | Yes        |
| `full_vapt`        | Combined multi-surface assessment        | All                    | Yes        |
| `targeted_scan`    | Scan specific assets or tags             | Flexible               | Conditional|

More VAPT-centered scan types can be added later (e.g., `secret_scan`, `config_audit`, `compliance_scan`).

---

## 11. Recommended Implementation Phases

### Phase 1: Foundation
- Enhance `scan_job` model with `scan_type` and pause/resume fields.
- Build Tool Registry + admin endpoints.
- Implement Docker-based execution engine.
- Create basic `api_scan` and `infra_scan` workflows.

### Phase 2: Core Automation
- Add Web application testing workflow.
- Integrate Burp MCP as advanced execution path.
- Implement scan result parsing into `scan_result` table.
- Add basic AI trigger logic (complexity detection).

### Phase 3: Intelligence & Polish
- Full integration with Risk module.
- Pause/Resume functionality at job level.
- Advanced result correlation and risk scoring.
- Mobile dynamic testing workflow.

---

## 12. Non-Functional Requirements

- All long-running operations must be **idempotent** and **resumable**.
- Strict separation between **customer data** (stored in their DB) and **Phantix control plane**.
- Clear audit trail for every scan job and tool execution.
- Graceful degradation when AI service is unavailable (fall back to scripted mode).

---

**Document Status**: Ready for team review.

**Next Recommended Action**: Begin implementation with the enhanced `scan_job` model and Tool Registry.

---

*This specification consolidates all architectural and functional decisions made on July 10, 2026.*
