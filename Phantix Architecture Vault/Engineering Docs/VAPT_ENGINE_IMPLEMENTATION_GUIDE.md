# Phantix VAPT Engine — Implementation Guide

**Version**: 1.2
**Date**: July 14, 2026
**Status**: Design Document — **Updated plan §§14–18 implemented** under `app/engines/vapt_engine/` (dual control, mining, schedules, Burp **stub** adapter; live Burp tooling later). See `docs/VAPT.md`.
**Audience**: Phantix Backend Engineers, Security Engineering Team
**Prerequisite Reading**: `Phantix Architecture Vault/` (particularly 00–06, 15), `ARCHITECTURE_MIGRATION_GUIDE.md`

---

## Table of Contents

1.  [What This Document Is](#1--what-this-document-is)
2.  [Architecture Decision: Standalone Engine with Orchestration](#2--architecture-decision-standalone-engine-with-orchestration)
3.  [VAPT Engine in the Engine Flow](#3--vapt-engine-in-the-engine-flow)
4.  [Data Model](#4--data-model)
5.  [Procedure System (Hybrid: Code + DB)](#5--procedure-system-hybrid-code--db)
6.  [Campaign Lifecycle & State Machine](#6--campaign-lifecycle--state-machine)
7.  [Correlation Engine (Rule-Based → Data-Driven)](#7--correlation-engine-rule-based--data-driven)
8.  [Complexity Classifier & AI Trigger](#8--complexity-classifier--ai-trigger)
9.  [Engine Folder Structure](#9--engine-folder-structure)
10. [Integration Map: Existing Engines This VAPT Engine Uses](#10--integration-map-existing-engines-this-vapt-engine-uses)
11. [Implementation Phases](#11--implementation-phases)
12. [Security Expert Workflow: How They Tune the Engine](#12--security-expert-workflow-how-they-tune-the-engine)
13. [Edge Cases & Failure Modes](#13--edge-cases--failure-modes)

---

## 1. — What This Document Is

This is an implementation guide for building the VAPT Engine. It translates the `Phantix_VAPT_Framework_Specification.md` into concrete architectural decisions, module layouts, data models, and phased implementation steps that a developer can execute.

The decisions here were made after deliberating the following questions against the existing Architecture Vault and codebase:

| Question | Decision |
|---|---|
| Engine type | **Standalone Engine** with orchestration responsibility (not a thin coordinator) |
| Value-add over individual engines | Both: attack-path correlation + campaign lifecycle management |
| Position in engine flow | **Parallel track alongside Scanner Engine** — not a replacement |
| Campaign persistence | **Hybrid**: campaign state table (platform DB) + events (Engine Bus) |
| Scan procedure definitions | **Hybrid**: code defaults with database overrides (factory pattern) |
| Correlation engine approach | **Rule-based first**, data-driven pattern matching later once a corpus exists |
| AI trigger | **Built-in complexity classifier** + per-org configurable thresholds |

---

## 2. — Architecture Decision: Standalone Engine with Orchestration

### Why a Standalone Engine, Not a Thin Coordinator

The VAPT Engine has enough domain-specific logic to warrant its own engine boundary:

| Concern | What VAPT Engine Owns | Why It Can't Live Elsewhere |
|---|---|---|
| Campaign state machine | Campaign lifecycle, pause/resume across engine boundaries | No other engine manages cross-engine workflows spanning hours or days |
| Attack-path correlation | Rule-based correlation linking findings across scan types into exploitable chains | Risk Engine scores single risks; VAPT Engine finds relationships *between* findings |
| Procedure definitions | Scan procedure catalog | Scanner Engine runs individual scans; it shouldn't know about multi-step sequences |
| Complexity classification | Rules that decide if deeper analysis is needed | AI Engine is too expensive for every finding; VAPT Engine is the gate |
| Pre-AI analysis | Deduplication, signal-vs-noise filtering, cross-tool evidence reconciliation | Would otherwise be scattered across Scanner adapters or Risk scoring rules |

### Boundary Rule

> VAPT Engine orchestrates Scanner Engine tasks and consumes Asset Engine data. It never executes scans directly, never calculates risk scores, and never sends alerts. It produces **correlated findings** and **campaign artifacts** — not raw tool output.

### MUST NOT List

```
VAPT Engine MUST NOT:
- Execute scan tools directly (uses Scanner Engine for that)
- Calculate risk scores (that's Risk Engine's job)
- Send email or notifications (that's Alert Engine's job)
- Generate final customer-facing reports (that's Reporting Engine's job)
- Call LLMs or AI models directly (uses AI Engine for that, via the bus)
- Store raw tool output (Scanner Engine already owns scan_results)
- Modify asset records (that's Asset Engine's job)
```

---

## 3. — VAPT Engine in the Engine Flow

The VAPT Engine runs as a **parallel track alongside Scanner Engine**. Both produce findings that Risk Engine consumes:

- **Scanner Engine** produces individual `scan_results` — one tool, one target, one run
- **VAPT Engine** produces **correlated campaign results** — aggregated across tools, targets, and campaign steps

```
                        ┌──────────────────────────────────────┐
                        │            Asset Engine               │
                        │  (provides asset scope for campaign) │
                        └────────────┬─────────────────────────┘
                                     │ asset context
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         VAPT Engine                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌────────────────┐   │
│  │ Campaign │──▶│ Procedure│──▶│ Correlation   │──▶│ Finding        │   │
│  │ Manager  │   │ Executor │   │ Engine        │   │ Enricher       │   │
│  └──────────┘   └────┬─────┘   └──────────────┘   └───────┬────────┘   │
│                       │                                     │           │
└───────────────────────┼─────────────────────────────────────┼───────────┘
                        │ orchestrates via bus                 │ publishes via bus
                        ▼                                     ▼
              ┌──────────────────┐                  ┌──────────────────┐
              │  Scanner Engine   │                  │   Risk Engine    │
              │  (nmap, nuclei,   │                  │  (scores enriched│
              │   burp, etc.)     │                  │   findings)      │
              └──────────────────┘                  └──────────────────┘
                                                           │
                                                           ▼
                                              ┌──────────────────────┐
                                              │  AI Engine            │
                                              │  (if complexity       │
                                              │   threshold met)      │
                                              └──────────────────────┘
                                                           │
                                                           ▼
                                              ┌──────────────────────┐
                                              │  Reporting Engine     │
                                              │  (campaign report)    │
                                              └──────────────────────┘
```

### What Flows Through the Bus

| Event | Publisher | Subscribers |
|---|---|---|
| `CampaignCreated` | VAPT Engine | Audit Engine |
| `CampaignStepStarted` | VAPT Engine | Audit Engine |
| `CampaignStepCompleted` | VAPT Engine | Audit Engine, (future: UI websocket) |
| `CorrelatedFindingCreated` | VAPT Engine | Risk Engine, AI Engine |
| `CampaignPaused` | VAPT Engine | Audit Engine |
| `CampaignResumed` | VAPT Engine | Audit Engine |
| `CampaignCompleted` | VAPT Engine | Risk Engine, Alert Engine, Reporting Engine, Audit Engine |
| `CampaignFailed` | VAPT Engine | Alert Engine, Audit Engine |

---

## 4. — Data Model

### 4.1 Platform DB Tables

These tables live in the **platform database** (Phantix-owned, not customer security DB).

#### `vapt_campaigns`

```sql
CREATE TABLE vapt_campaigns (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL,
    -- full_vapt, targeted_scan, api_scan, web_scan, infra_scan, mobile_dynamic, custom

    asset_scope JSONB NOT NULL DEFAULT '{}',
    -- {"asset_ids": [1,2,3], "asset_types": ["domain","api"], "tags": ["critical","external"]}

    procedure_key VARCHAR(100) NOT NULL,
    procedure_snapshot JSONB,                -- frozen copy of procedure at creation time

    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    -- draft, active, paused, completed, failed, cancelled

    current_step_index INTEGER DEFAULT 0,
    current_phase VARCHAR(100),

    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    resumed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    initiated_by_user_id INTEGER,
    approved_by_user_id INTEGER,
    cancellation_reason TEXT,

    total_findings INTEGER DEFAULT 0,
    critical_findings INTEGER DEFAULT 0,
    high_findings INTEGER DEFAULT 0,
    correlation_summary JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vapt_campaigns_org ON vapt_campaigns (organization_id);
CREATE INDEX idx_vapt_campaigns_status ON vapt_campaigns (status);
```

#### `vapt_campaign_steps`

```sql
CREATE TABLE vapt_campaign_steps (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES vapt_campaigns(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL,

    step_index INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL,          -- scan, correlate, analyze, wait_for_approval
    step_name VARCHAR(255),
    step_description TEXT,

    config JSONB NOT NULL DEFAULT '{}',
    -- For scan steps: {"tool": "nmap", "target_type": "domain", "ports": "top-1000"}
    -- For correlate steps: {"correlation_rule_ids": [1,2,3]}
    -- For analyze steps: {"ai_analysis": true, "complexity_threshold": "high"}
    -- For wait_for_approval steps: {"requires_authorizer": true}

    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- pending, running, completed, failed, skipped, waiting_approval

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,

    scan_job_ids INTEGER[],
    finding_count INTEGER DEFAULT 0,
    output_summary JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vapt_steps_campaign ON vapt_campaign_steps (campaign_id, step_index);
```

#### `vapt_procedures` (DB override table)

```sql
CREATE TABLE vapt_procedures (
    procedure_key VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL,
    -- [
    --   {"step_type": "scan", "config": {"tools": ["nmap"], ...}},
    --   {"step_type": "correlate", "config": {"rule_ids": ["default_cross_scan"]}},
    --   ...
    -- ]
    source VARCHAR(20) NOT NULL DEFAULT 'override',  -- 'builtin' or 'override'
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `vapt_correlation_rules`

```sql
CREATE TABLE vapt_correlation_rules (
    id BIGSERIAL PRIMARY KEY,
    rule_key VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,           -- attack_path, evidence_correlation, false_positive

    conditions JSONB NOT NULL,
    -- {"requires": [{"finding_type": "open_port", "port": 22}, ...], "relationship": "AND"}

    conclusion_type VARCHAR(50) NOT NULL,
    conclusion_template TEXT NOT NULL,
    severity_override VARCHAR(20),
    metadata JSONB,

    is_active BOOLEAN DEFAULT true,
    source VARCHAR(20) NOT NULL DEFAULT 'builtin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `vapt_correlated_findings`

```sql
CREATE TABLE vapt_correlated_findings (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES vapt_campaigns(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,

    source_scan_job_ids INTEGER[],
    source_scan_result_ids INTEGER[],
    source_step_indices INTEGER[],

    correlation_rule_id BIGINT REFERENCES vapt_correlation_rules(id),
    correlation_type VARCHAR(50) NOT NULL,    -- attack_path, evidence_correlation, single_finding
    attack_path JSONB,
    -- {"steps": [{"asset_id": 1, "finding": "open_port_22", ...}], "risk_summary": "..."}

    ai_analysis_requested BOOLEAN DEFAULT false,
    ai_analysis_id VARCHAR(100),
    ai_enhanced_description TEXT,

    risk_id INTEGER,
    false_positive BOOLEAN DEFAULT false,
    requires_human_review BOOLEAN DEFAULT false,
    reviewed_by_user_id INTEGER,
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vapt_findings_campaign ON vapt_correlated_findings (campaign_id);
CREATE INDEX idx_vapt_findings_severity ON vapt_correlated_findings (severity);
```

### 4.2 Security DB Tables (No Changes Needed)

Existing `scan_jobs` and `scan_results` tables in the security schema DDL are sufficient. VAPT Engine reads from them via `security_db_client.py`.

---

## 5. — Procedure System (Hybrid: Code + DB)

Built-in procedures ship as Python data structures. Security experts override them via `vapt_procedures` table. Factory resolves which to use.

```python
# app/services/vapt_engine/procedures/builtin.py

BUILTIN_PROCEDURES: dict[str, dict] = {
    "full_vapt": {
        "display_name": "Full VAPT",
        "steps": [
            {"step_type": "scan", "step_name": "Infrastructure Reconnaissance",
             "config": {"tools": ["nmap"], "target_types": ["ip_address", "domain", "subdomain"],
                        "nmap_flags": ["-sT", "-sV", "-T4", "--open"], "ports": "top-1000"}},
            {"step_type": "scan", "step_name": "Web Application Scan",
             "config": {"tools": ["nuclei"], "target_types": ["domain", "api"],
                        "nuclei_templates": ["cves", "exposures", "misconfigurations"]}},
            {"step_type": "correlate", "step_name": "Cross-Scan Correlation",
             "config": {"rule_ids": ["default_attack_path", "default_port_exposure"]}},
            {"step_type": "analyze", "step_name": "Complexity Analysis",
             "config": {"ai_threshold": "high"}},
            {"step_type": "wait_for_approval", "step_name": "Human Review",
             "config": {"requires_authorizer": True, "timeout_hours": 72}},
        ],
    },
    "api_scan": {
        "display_name": "API Security Scan",
        "steps": [
            {"step_type": "scan", "step_name": "API Discovery & Recon",
             "config": {"tools": ["nuclei"], "target_types": ["api"],
                        "nuclei_templates": ["api-security"]}},
            {"step_type": "scan", "step_name": "API Endpoint Testing",
             "config": {"tools": ["nuclei"], "target_types": ["api"],
                        "advanced": True, "burp_mcp_enabled": True}},
            {"step_type": "correlate", "step_name": "API Attack Path Analysis",
             "config": {"rule_ids": ["api_authentication_bypass", "api_data_exposure"]}},
        ],
    },
    "infra_scan": {
        "display_name": "Infrastructure Scan",
        "steps": [
            {"step_type": "scan", "step_name": "Port & Service Discovery",
             "config": {"tools": ["nmap"], "target_types": ["ip_address", "domain"],
                        "nmap_flags": ["-sT", "-sV", "-T4", "--open"], "ports": "top-1000"}},
            {"step_type": "scan", "step_name": "Vulnerability Detection",
             "config": {"tools": ["nuclei"], "target_types": ["ip_address", "port_service"],
                        "nuclei_templates": ["cves", "exposures"]}},
            {"step_type": "correlate", "step_name": "Network Attack Path Analysis",
             "config": {"rule_ids": ["default_port_exposure", "pivot_risk"]}},
        ],
    },
}


def get_procedure(procedure_key: str) -> dict:
    """Resolve a procedure. Priority: DB override → built-in."""
    # 1. Try vapt_procedures table (source='override')
    # 2. Fall back to BUILTIN_PROCEDURES
    proc = BUILTIN_PROCEDURES.get(procedure_key)
    if not proc:
        raise ValueError(f"Unknown procedure: {procedure_key}")
    return proc
```

### Expert Workflow

```http
POST /api/v1/admin/vapt/procedures
{
    "procedure_key": "full_vapt_pci",
    "display_name": "Full VAPT (PCI DSS Scope)",
    "steps": [...],
    "source": "override"
}
```

No deploy needed. Engine checks DB first, falls back to built-in.

---

## 6. — Campaign Lifecycle & State Machine

### States

```
draft → active ⇄ paused → completed | failed | cancelled
```

### Campaign State Machine

```python
class CampaignStatus(str, Enum):
    DRAFT = "draft"; ACTIVE = "active"; PAUSED = "paused"
    COMPLETED = "completed"; FAILED = "failed"; CANCELLED = "cancelled"

CAMPAIGN_TRANSITIONS = {
    CampaignStatus.DRAFT: {CampaignStatus.ACTIVE},
    CampaignStatus.ACTIVE: {CampaignStatus.PAUSED, CampaignStatus.FAILED,
                            CampaignStatus.CANCELLED, CampaignStatus.COMPLETED},
    CampaignStatus.PAUSED: {CampaignStatus.ACTIVE, CampaignStatus.CANCELLED},
    CampaignStatus.FAILED: set(),
    CampaignStatus.COMPLETED: set(),
    CampaignStatus.CANCELLED: set(),
}
```

Pause coordinates with in-flight Scanner Engine jobs via the bus (`ScanJobPauseRequested` event). Resume re-executes from current step index or advances if the step already completed during the pause window.

---

## 7. — Correlation Engine (Rule-Based → Data-Driven)

### Why Rule-Based First

No existing training dataset exists — Phantix hasn't shipped. The `scan_results` table is defined but empty. Data-driven requires thousands of labeled findings. Start with expert-authored rules for immediate value.

### Built-in Correlation Rules

```python
BUILTIN_CORRELATION_RULES = [
    {
        "rule_key": "ssh_brute_force_path",
        "category": "attack_path",
        "conditions": {
            "requires": [
                {"finding_type": "open_port", "port": 22},
                {"finding_type": "exposed_service", "service": "ssh"},
                {"finding_type": "missing_brute_force_protection"},
            ],
            "relationship": "AND", "scope": "same_asset",
        },
        "conclusion_template": "Asset has open SSH port with no brute-force protection...",
        "severity_override": "high",
    },
    {
        "rule_key": "api_without_auth",
        "category": "attack_path",
        "conditions": {
            "requires": [
                {"finding_type": "api_endpoint_exposed"},
                {"finding_type": "missing_authentication"},
            ],
            "relationship": "AND", "scope": "same_asset",
        },
        "conclusion_template": "API endpoint exposed without authentication...",
        "severity_override": "critical",
    },
    # ... more rules in the full document
]
```

### Correlation Engine Flow

1. Collect all scan results from relevant campaign steps
2. Load rules (DB overrides first, then builtins)
3. Group findings by asset for same-asset rules
4. Evaluate each rule against each asset's findings
5. Run cross-asset rules (pivot chains)
6. Deduplicate: higher-severity wins on same conclusion

### Data-Driven Evolution Path

Once 10,000+ labeled findings accumulate:
- Pattern mining for frequently co-occurring findings not yet covered by rules
- Statistical anomaly detection per org baseline
- False-positive feedback loop (rules with >80% FP rate are auto-disabled)

---

## 8. — Complexity Classifier & AI Trigger

Deterministic, rule-based. No ML, no LLM. Weighted signals:

| Signal | Weight | Logic |
|---|---|---|
| Finding count | 0.15 | min(100, count × 5) |
| Severity distribution | 0.25 | critical × 25 + high × 10 |
| Attack paths discovered | 0.30 | min(100, count × 15) |
| Ambiguous results | 0.20 | min(100, count × 20) |
| False positive rate | 0.10 | Historical FP rate |

Total score → level: 0–39 low, 40–59 medium, 60–79 high, 80+ critical.

Per-org threshold configurable: `off`, `critical`, `high` (default), `medium`, `low`, `always`.

If score >= threshold → publish `AIAnalysisRequested` event to the bus. If AI Engine unavailable, campaign completes without AI enrichment.

---

## 9. — Engine Folder Structure

```text
app/services/vapt_engine/
    __init__.py
    api/
        campaigns.py           # Campaign CRUD + start/pause/resume/cancel
        procedures.py          # Admin procedure management
        correlation_rules.py   # Admin correlation rule CRUD
    services/
        campaign_manager.py    # State machine, step sequencing
        procedure_resolver.py  # Factory: DB overrides → builtins
        step_executor.py       # Runs individual campaign steps
    repositories/
        campaign_repo.py       # vapt_campaigns + vapt_campaign_steps queries
        procedure_repo.py
        finding_repo.py
    models/
        campaign.py            # SQLAlchemy model for vapt_campaigns
        step.py
        procedure.py
        correlation_rule.py
        finding.py
    schemas/
        campaign.py            # Pydantic request/response schemas
        procedure.py
        correlation.py
        finding.py
    correlation/
        engine.py              # CorrelationEngine — main orchestrator
        evaluator.py           # Rule condition matcher
        deduplicator.py
        rules/
            builtin.py         # Built-in correlation rules
            registry.py        # Rule loader (DB + builtins)
    analysis/
        complexity_classifier.py
        finding_enricher.py
        signal_analyzer.py
    procedures/
        builtin.py             # Built-in procedure definitions
    workers/
        campaign_worker.py     # Celery task: execute a campaign step
        correlation_worker.py
    tasks/
        run_step.py            # Celery task def: phantix.vapt.run_step
        run_correlation.py
    adapters/
        scanner_adapter.py     # Talks to Scanner Engine via bus
        asset_adapter.py       # Reads asset scope via bus/SDK
    events/
        publishers.py
        subscribers.py
    validators/
        campaign_validator.py
        scope_validator.py
    tests/
        test_campaign_manager.py
        test_correlation_engine.py
        test_complexity_classifier.py
        test_step_executor.py
    docs/
        __init__.py
```

---

## 10. — Integration Map

| Engine | Interaction | Direction |
|---|---|---|
| **Asset Engine** | Reads asset scope at campaign creation | VAPT → Asset (query) |
| **Scanner Engine** | Creates scan jobs via bus per campaign step | VAPT → Scanner (orchestrate via bus) |
| **Risk Engine** | Sends `CorrelatedFindingCreated` event | VAPT → Risk (event) |
| **AI Engine** | Sends `AIAnalysisRequested` (if threshold met), receives `AICompleted` | VAPT ⇄ AI (event) |
| **Alert Engine** | Sends `CampaignCompleted`/`CampaignFailed` events | VAPT → Alert (event) |
| **Audit Engine** | Sends lifecycle events for immutable trail | VAPT → Audit (event) |
| **Reporting Engine** | Sends `CampaignCompleted` for report generation | VAPT → Report (event) |
| **Control Plane** | Uses dual-control session for destructive campaigns | VAPT → Control (SDK) |

**Does NOT touch:** Operations Engine, Compliance Engine (directly).

---

## 11. — Implementation Phases

### Phase 1: Foundation (Ship in one sprint)

Campaign creation, basic step execution, pause/resume, one built-in procedure.

| Step | Files |
|---|---|
| Platform DB tables + Alembic migration | `alembic/versions/xxxx_add_vapt_tables.py` |
| Campaign models + schemas | `models/campaign.py`, `schemas/campaign.py` |
| Campaign Manager (state machine) | `services/campaign_manager.py` |
| Step Executor (scan step type only) | `services/step_executor.py` |
| Scanner Adapter | `adapters/scanner_adapter.py` |
| Campaign API (CRUD + start/pause/resume) | `api/campaigns.py` |
| Procedure Resolver + `infra_scan` | `procedures/builtin.py`, `services/procedure_resolver.py` |
| Celery worker + task | `workers/campaign_worker.py`, `tasks/run_step.py` |

**Milestone**: Create campaign → run two scan steps → pause → resume → complete.

### Phase 2: Correlation

Correlation rules engine produces attack-path findings.

| Step | Files |
|---|---|
| Correlation rule table + built-in rules | `models/correlation_rule.py`, `correlation/rules/builtin.py` |
| Correlation Engine | `correlation/engine.py`, `correlation/evaluator.py` |
| Correlated finding table + model | `models/finding.py`, `schemas/finding.py` |
| Correlation API | `api/correlation_rules.py` |
| Deduplicator | `correlation/deduplicator.py` |
| Correlation Celery task | `tasks/run_correlation.py` |

**Milestone**: Two-step campaign produces correlated findings with attack paths.

### Phase 3: Intelligence Layer

Complexity classifier, AI integration stub, signal analysis.

| Step | Files |
|---|---|
| Complexity Classifier | `analysis/complexity_classifier.py` |
| Finding Enricher | `analysis/finding_enricher.py` |
| AI subscriber (works with/without AI Engine) | `events/subscribers.py` |
| Per-org config integration | Update `complexity_classifier.py` |
| Campaign completion AI trigger gate | Update `services/campaign_manager.py` |

**Milestone**: Complex campaigns trigger AI analysis. Simple campaigns skip it. Per-org thresholds work.

### Phase 4: Procedures & Rules Management (Ongoing)

Experts manage procedures and rules without deploying code.

| Step | Files |
|---|---|
| Admin procedure API | `api/procedures.py` |
| Admin correlation rule API | `api/correlation_rules.py` |
| Expand built-in procedures (all scan types) | `procedures/builtin.py` |
| Procedure versioning | `services/procedure_resolver.py` |

**Milestone**: Expert adds/edits procedures and rules via admin API, no deploy needed.

### Phase 5: Advanced (Post-MVP)

- Full VAPT procedure chaining all scan types
- Burp MCP integration
- Data-driven correlation (pattern mining)
- Scheduled campaigns (recurring infra scan, monthly full VAPT)
- Campaign templates with parameterized scope

---

## 12. — Security Expert Workflow

### Tunable Without Code

| What | How |
|---|---|
| Scan procedure steps | Insert into `vapt_procedures` table |
| Correlation rules | Insert/update `vapt_correlation_rules` |
| Complexity classifier weights | Config update |
| AI trigger threshold | Per-org `vapt_ai_threshold` setting |

### Requires Code Change

| What | Why |
|---|---|
| New scanner adapter | Must implement `ScannerInterface` |
| New scan tool integration | Requires Scanner Engine adapter |
| New correlation signal type | New factor in classifier |
| Event contract changes | New event types need PR |

### Typical Iteration

```
1. Run campaign → review correlated findings
2. Spot false positive → disable noisy rule (DB update)
3. Spot missing attack path → insert new rule (DB insert)
4. Re-run campaign to validate
5. Once proven → export as built-in in next code release
```

---

## 13. — Edge Cases & Failure Modes

### Campaign Failures

| Scenario | Behavior |
|---|---|
| Scanner Engine down | Step times out → campaign fails |
| Scan job timeout | Optional step → move to next. Required step → fail campaign |
| Missing correlation data | Rule silently skips (logged DEBUG) |
| AI Engine unavailable | Campaign completes without AI enrichment |

### Pause/Resume Edge Cases

| Scenario | Behavior |
|---|---|
| Scan completes during pause | Step marked completed. On resume → advance to next. |
| Resume after 30+ days | Return to paused with warning. User re-approves. |
| Double resume | Idempotency check: 409 if already active. |

### Performance

| Scenario | Strategy |
|---|---|
| 10,000+ results per campaign | Batch by asset. 100 assets per Celery task. |
| 50 concurrent campaigns | Each has own task chain. Scanner Engine enforces per-org limit. |
| Rule with 15 conditions | Short-circuit on AND. First failed → stop for that asset. |

---

## 14. — Burp MCP Integration

### 14.1 Philosophy

Burp Suite is the **advanced path** in the VAPT execution model — not a replacement for scripted tooling, but a deeper analysis layer for API and web application testing where automated scanners miss business logic flaws, auth bypass chains, and complex injection points.

The integration has two modes:

| Mode | When | How |
|---|---|---|
| **Inline (Basic)** | Routine API/web scans in a campaign step | Step executor calls Burp's REST API via MCP protocol synchronously. Burp runs as a managed Docker container. Scoped to predefined tests (passive crawl, active scan predefined scope). |
| **Agent (Advanced)** | High-complexity targets, business logic testing, exploitation | A dedicated agent (powered by Burp's AI via MCP, optionally enhanced by Phantix's own AI Engine) controls Burp autonomously — makes testing decisions, follows attack chains, modifies requests, and reports findings asynchronously. |

### 14.2 Burp MCP Protocol Layer

The integration wraps Burp's MCP (Model Context Protocol) server in a dedicated adapter. This is not a thin HTTP wrapper — it's a stateful protocol layer that translates campaign step configs into Burp operations and Burp findings back into `scan_results`.

```python
# app/services/vapt_engine/adapters/burp_adapter.py

class BurpMCPAdapter:
    """Adapter for Burp Suite via MCP protocol.

    Two operation modes controlled by the campaign step config:
    - mode="inline": synchronous, predefined scope, returns findings
    - mode="agent": asynchronous, autonomous decision-making, streams findings
    """

    def __init__(self, config: dict):
        self.mcp_endpoint = config.get("burp_mcp_endpoint", "http://burp:8084/mcp")
        self.mode = config.get("burp_mode", "inline")
        self.burp_api = config.get("burp_api_url", "http://burp:8080")
        self.session = None

    async def inline_scan(self, target: ScanTarget, config: dict) -> list[ScanResult]:
        """Basic inline mode: predefined scope, synchronous.

        Flow:
        1. Configure Burp scope from target
        2. Start passive crawler
        3. Start active scanner with predefined scan configuration
        4. Poll for completion
        5. Retrieve findings via REST API
        6. Normalize into ScanResult format
        """
        # 1. Configure scope via MCP
        await self._mcp_command("set_scope", {
            "urls": [target.identifier],
            "include_subdomains": config.get("include_subdomains", True),
        })

        # 2. Start passive crawl
        crawl_task = await self._mcp_command("start_passive_crawl", {
            "scope": "defined",
            "timeout_seconds": config.get("crawl_timeout", 600),
        })

        # 3. Start active scan
        scan_task = await self._mcp_command("start_active_scan", {
            "scan_type": config.get("scan_type", "crawl_and_audit"),
            "insertion_points": config.get("insertion_points",
                ["params", "headers", "cookies", "body"]),
        })

        # 4. Poll until complete (with timeout)
        results = await self._poll_for_results(
            crawl_task["task_id"], scan_task["task_id"]
        )

        # 5. Normalize findings into ScanResult format
        return await self._normalize_findings(results)

    async def agent_scan(self, target: ScanTarget, config: dict) -> list[ScanResult]:
        """Advanced agent mode: autonomous, AI-driven, asynchronous.

        Flow:
        1. Configure Burp scope and initial access (auth tokens, session cookies)
        2. Launch MCP agent session with high-level objectives
        3. Agent uses Burp AI via MCP to autonomously:
           - Crawl and map the application
           - Identify testable insertion points
           - Attempt exploits (SQLi, XSS, SSTI, business logic bypasses)
           - Chain vulnerabilities into attack paths
           - Report findings with evidence (request/response pairs)
        4. Phantix AI Engine can optionally enhance Burp's AI decisions
        5. Agent completes or hits timeout → retrieve all findings
        """
        # 1. Configure agent session
        session = await self._mcp_command("create_agent_session", {
            "target": target.identifier,
            "objectives": config.get("objectives", [
                "map_application",
                "identify_auth_bypasses",
                "test_business_logic",
                "chain_vulnerabilities",
            ]),
            "ai_assist": config.get("burp_ai_enabled", True),
            "max_duration_minutes": config.get("max_duration", 120),
        })

        # 2. If Phantix AI Engine is available, subscribe to agent events
        #    so AI Engine can influence Burp's decisions in real-time
        if config.get("phantix_ai_enhance", False):
            await self._subscribe_to_agent_events(session["agent_id"])

        # 3. Wait for agent completion (or timeout)
        #    This is async — the campaign step stays in 'running' state
        results = await self._wait_for_agent_completion(session["agent_id"])

        return await self._normalize_findings(results)

    async def _mcp_command(self, command: str, params: dict) -> dict:
        """Send a command to Burp's MCP server."""
        # POST to MCP endpoint with command + params
        # Returns structured response with task_id, status, results
        ...

    async def _normalize_findings(
        self, raw_findings: list[dict]
    ) -> list[ScanResult]:
        """Convert Burp findings into Phantix ScanResult format.

        Burp provides rich evidence (request/response pairs, timing,
        insertion point details). We preserve all of it in evidence JSONB.
        """
        results = []
        for finding in raw_findings:
            results.append(ScanResult(
                tool="burp_suite",
                severity=self._map_burp_severity(finding.get("severity")),
                title=finding.get("name", "Burp Finding"),
                description=finding.get("description", ""),
                evidence={
                    "burp_type": finding.get("type"),
                    "url": finding.get("url"),
                    "insertion_point": finding.get("insertion_point"),
                    "request": finding.get("request"),
                    "response": finding.get("response"),
                    "confidence": finding.get("confidence"),
                    "burp_ai_explanation": finding.get("ai_explanation"),
                },
                raw_output=json.dumps(finding, indent=2),
            ))
        return results
```

### 14.3 How Campaign Steps Use Burp

Procedures declare Burp usage per step:

```python
{
    "step_type": "scan",
    "step_name": "Deep API Security Assessment",
    "config": {
        "tools": ["burp"],
        "target_types": ["api"],
        "burp_mode": "inline",
        "burp_ai_enabled": True,
        "phantix_ai_enhance": False,
        "scan_type": "crawl_and_audit",
        "max_duration_minutes": 30,
    },
},
{
    "step_type": "scan",
    "step_name": "Advanced Business Logic Analysis",
    "config": {
        "tools": ["burp"],
        "target_types": ["api", "domain"],
        "burp_mode": "agent",
        "burp_ai_enabled": True,
        "phantix_ai_enhance": True,
        "objectives": [
            "map_application",
            "identify_auth_bypasses",
            "test_business_logic",
            "chain_vulnerabilities",
        ],
        "max_duration_minutes": 120,
    },
},
```

### 14.4 The Burp AI Bridge

The VAPT Engine never controls Burp at the keystroke level. It sends **high-level objectives** via MCP, and Burp AI handles the low-level testing decisions (what parameter to fuzz, what payload to try, whether a response indicates a vulnerability).

```
┌──────────────────────────────────────────────────────────────┐
│  VAPT Engine Step Executor                                    │
│                                                               │
│  MCP command: "create_agent_session" with objectives           │
│  ← Events: finding_discovered, ai_decision, scan_complete      │
│                                                               │
│  Events are:                                                  │
│  1. Stored immediately in scan_results (progressive findings)  │
│  2. Forwarded to Phantix AI Engine (if phantix_ai_enhance)    │
│  3. Used to update campaign step progress                      │
└──────────────────────┬────────────────────────────────────────┘
                       │ MCP
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Burp Suite (Docker)                                          │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌────────────────┐ │
│  │ Crawler │ │ Scanner  │ │ Burp AI    │ │ MCP Server     │ │
│  │         │ │          │ │ (LLM via   │ │ (exposes all   │ │
│  │         │ │          │ │  MCP)      │ │  capabilities) │ │
│  └─────────┘ └──────────┘ └────────────┘ └────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

When `phantix_ai_enhance=True`, Burp's decisions are also streamed to Phantix's AI Engine for additional context — but that's optional and additive, not required.

### 14.5 Infrastructure

```yaml
burp:
  image: burpsuite:professional
  ports:
    - "8080:8080"      # REST API
    - "8084:8084"      # MCP server
  environment:
    - BURP_LICENSE_KEY=${BURP_LICENSE_KEY}
    - BURP_AI_ENABLED=true
    - BURP_MCP_ALLOWED_ORIGINS=http://api:8000
    - BURP_HEADLESS=true
  volumes:
    - burp_data:/root/.BurpSuite
  networks:
    - phantix_scan_network
  deploy:
    resources:
      limits:
        memory: 4G
```

---

## 15. — Correlation Mining

### 15.1 Philosophy

The correlation engine starts with expert-authored rules. But the real value comes from **mining actual findings data** to discover patterns the experts didn't anticipate. Mining runs as a background process that learns from real scan results and proposes new correlation rules.

The critical constraint: **data residency and consent.** Customer security data lives in their own database — we cannot blindly pull it into Phantix infrastructure.

### 15.2 Three Mining Modes

```
┌─────────────────────────────────────────────────────────────────┐
│                    Correlation Miner                             │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │ Per-Org Real-Time     │    │ Cross-Org Batch (Opt-In)     │   │
│  │                       │    │                              │   │
│  │ Runs inside the org's │    │ Runs on Phantix platform DB │   │
│  │ security DB queries   │    │ using AGGREGATED metadata   │   │
│  │ only                  │    │ only — never raw findings   │   │
│  │                       │    │                              │   │
│  │ Signals: anomaly,     │    │ Signals: emerging patterns, │   │
│  │ baseline drift,       │    │ cross-vendor correlations,  │   │
│  │ false positive        │    │ rule candidate proposals    │   │
│  │ correlation           │    │                              │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Local Cache (Ephemeral, Per-Process)                     │   │
│  │ In-memory cache of recent mining results. Never written  │   │
│  │ to disk. Cleared on process restart. Used for real-time  │   │
│  │ anomaly detection during active campaigns.               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 15.3 Per-Org Real-Time Mining (Always Active, No Consent Needed)

During every campaign's correlation phase, the engine runs lightweight mining queries against the org's own `scan_results` table. No data leaves the customer's database.

```python
# app/services/vapt_engine/correlation/miner.py

class CorrelationMiner:
    """Real-time pattern mining on per-org data."""

    async def mine_anomalies(
        self,
        ctx: SecurityDbContext,
        campaign_findings: list[dict],
    ) -> list[dict]:
        """Detect patterns in the current campaign that deviate from the org's baseline.

        Queries historical scan_results (last 90 days) to establish baseline
        frequencies, then flags combinations in this campaign that are unusual.
        """
        baseline = await self._get_baseline(ctx)
        combinations = self._extract_combinations(campaign_findings)

        anomalies = []
        for combo, count in combinations.items():
            expected = baseline.get(combo, 0)
            if expected > 0 and count / expected > 3.0:
                anomalies.append({
                    "type": "elevated_frequency",
                    "combination": combo,
                    "observed": count,
                    "expected": expected,
                    "ratio": round(count / expected, 2),
                })

        self._cache_anomalies(ctx.org_id, anomalies)
        return anomalies

    async def _get_baseline(self, ctx: SecurityDbContext) -> dict:
        """Query historical scan_results for finding frequency baselines.

        SELECT severity, title, tool, COUNT(*) as freq
        FROM {schema}.scan_results
        WHERE organization_id = $1
          AND created_at > NOW() - INTERVAL '90 days'
        GROUP BY severity, title, tool
        """
        ...
```

### 15.4 Cross-Org Batch Mining (Opt-In Only)

Requires explicit consent. The org must opt in:

```python
organization_settings = {
    "vapt_mining_consent": {
        "enabled": False,          # default: off
        "consent_granted_at": None,
        "data_scope": "aggregated_only",
        "can_opt_out_anytime": True,
    }
}
```

Opt-in orgs contribute **only aggregated metadata** to the platform:

| Data Point | Stored? | Example |
|---|---|---|
| Finding type (severity + title + tool) | ✅ | `("high", "open_port_22", "nmap")` |
| Asset type context | ✅ | `domain`, `api` |
| Correlation rule matched | ✅ | `ssh_brute_force_path` |
| False positive flag | ✅ | Boolean |
| Raw request/response | ❌ | — |
| Asset identity (domain, IP) | ❌ | — |
| Organization identity | ✅ | Internal ID only, never customer name |

```sql
CREATE TABLE vapt_mining_patterns (
    id BIGSERIAL PRIMARY KEY,
    pattern_hash VARCHAR(64) UNIQUE NOT NULL,
    finding_types TEXT[] NOT NULL,
    asset_type VARCHAR(50),
    correlation_rule_suggested VARCHAR(100),
    frequency INTEGER DEFAULT 0,
    false_positive_count INTEGER DEFAULT 0,
    first_observed_at TIMESTAMPTZ,
    last_observed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 15.5 Rule Candidate Proposal

```python
async def propose_rule_candidates(self) -> list[dict]:
    """Scan mining_patterns for frequently co-occurring finding types
    that don't have an existing correlation rule. Each candidate
    requires human review before activation."""
    candidates = []
    existing_patterns = await self._get_existing_rule_patterns()
    patterns = await self._get_high_frequency_patterns(min_frequency=10)

    for pattern in patterns:
        if pattern["finding_types"] in existing_patterns:
            continue

        candidates.append({
            "rule_key": f"mined_{pattern['pattern_hash'][:12]}",
            "display_name": f"Mined: {' + '.join(pattern['finding_types'])}",
            "category": "attack_path",
            "conditions": {
                "requires": [
                    {"finding_type": ft.split(":")[1],
                     "severity": ft.split(":")[0]}
                    for ft in pattern["finding_types"]
                ],
                "relationship": "AND",
                "scope": "same_asset" if pattern.get("same_asset") else "cross_asset",
            },
            "conclusion_template": "Auto-generated...",
            "severity_override": "medium",
            "source": "mined",
            "needs_review": True,
        })

    return candidates
```

### 15.6 Consent Flow

```
1. Org creates/manages a campaign
2. At campaign creation (or in org settings):
   "Allow Phantix to learn from this campaign's results?
    Only aggregated, anonymized pattern data is stored.
    Raw findings never leave your database.
    You can opt out at any time."
3. If accepted → vapt_mining_consent.enabled = true
4. Miner writes to vapt_mining_patterns during correlation phase
5. If rejected → miner runs per-org only, no cross-org data stored
6. Opt-out → existing rows for that org are anonymized
   (org_id removed, pattern data retained)
```

---

## 16. — Richer Dual Control

### 16.1 Three Levels

The VAPT Engine extends the existing initiator/authorizer model to three levels of granularity:

| Level | What It Controls | When |
|---|---|---|
| **Campaign-level** | Whether the campaign scope and objectives are acceptable | Before campaign starts (if procedure requires it) |
| **Step-level** | Whether a specific step (e.g., exploitation) can proceed | During campaign execution |
| **Multi-party** | Requires 2+ different authorizers for high-risk campaigns | Campaign-level or step-level for destructive operations |

### 16.2 Campaign-Level Approval

```sql
ALTER TABLE vapt_campaigns ADD COLUMN approval_required BOOLEAN DEFAULT false;
ALTER TABLE vapt_campaigns ADD COLUMN approval_status VARCHAR(30)
    DEFAULT 'not_required';
-- not_required, pending, approved, rejected
ALTER TABLE vapt_campaigns ADD COLUMN approved_by_user_id INTEGER;
ALTER TABLE vapt_campaigns ADD COLUMN approved_at TIMESTAMPTZ;
```

Procedures declare whether approval is needed:

```python
BUILTIN_PROCEDURES["full_vapt"] = {
    "requires_approval": True,
    "approval_roles": ["security_officer"],
    # ...
}
```

When starting a campaign that requires approval, the state machine routes through `pending_approval` instead of going directly to `active`.

### 16.3 Step-Level Approval

Any step in a procedure can require authorizer approval before execution:

```python
{
    "step_type": "wait_for_approval",
    "step_name": "Authorize Exploitation Phase",
    "config": {
        "requires_authorizer": True,
        "message": "This step will run exploitation tools against production APIs.
                    Please review the findings so far and approve or reject.",
        "timeout_hours": 72,
    },
}
```

This step type doesn't execute a scan — it pauses campaign progress until an authorizer acts. The campaign remains `active`, but step progress halts at `waiting_approval`.

### 16.4 Multi-Party Approval

For the highest-risk campaigns, two different authorizers must approve independently:

```python
class MultiPartyApproval:
    REQUIRED_ROLES = {
        "full_vapt": ["security_officer", "cto_or_ciso"],
        "production_web_test": ["security_officer", "vp_engineering"],
    }

    async def check_approval_status(self, db, campaign_id: int) -> str:
        """Returns: 'pending', 'approved', 'rejected', 'partially_approved'."""
        requests = await self._get_approval_requests(db, campaign_id)
        statuses = [r.status for r in requests]

        if all(s == "approved" for s in statuses):
            return "approved"
        elif any(s == "rejected" for s in statuses):
            # Single rejection blocks the campaign
            return "rejected"
        elif any(s == "approved" for s in statuses):
            return "partially_approved"
        return "pending"
```

### 16.5 Approval Data Model

```sql
CREATE TABLE vapt_approval_requests (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES vapt_campaigns(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL,

    approval_level VARCHAR(20) NOT NULL,    -- 'campaign', 'step', 'multi_party'
    step_index INTEGER,                     -- for step-level approval

    required_role VARCHAR(100) NOT NULL,
    authorizer_user_id INTEGER NOT NULL,
    authorizer_name_snapshot VARCHAR(255),

    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- pending, approved, rejected

    decided_by_user_id INTEGER,
    decided_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT,

    expires_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vapt_approvals_campaign
    ON vapt_approval_requests (campaign_id, approval_level);
CREATE INDEX idx_vapt_approvals_authorizer
    ON vapt_approval_requests (authorizer_user_id, status);
```

### 16.6 Extended State Machine

```
draft
  │
  │ (if approval_required)
  ▼
pending_approval ──┬── approved ──▶ active
                   └── rejected ──▶ cancelled
  │
  │ (if no approval required)
  └──▶ active
         │
         ├── normal step ──▶ next step
         │
         ├── wait_for_approval ──▶ waiting_approval
         │                        ├── approved ──▶ next step
         │                        └── rejected ──▶ step skipped / campaign failed
         │
         └── multi_party step ──▶ multi_party_waiting
                                  ├── all approved ──▶ next step
                                  ├── any rejected ──▶ step skipped
                                  └── partial approve ──▶ wait for remaining
```

---

## 17. — Campaign Scheduling

### 17.1 Architecture

**VAPT Engine owns the "what and when." Celery Beat owns the "how."**

- `vapt_schedules` table stores schedule definitions per organization with cron expressions, scope templates, and recurrence rules
- Celery Beat polls a `get_due_schedules()` endpoint every 60 seconds
- Each due schedule fires a Celery task that calls the **existing campaign creation API** — no duplicated creation logic

### 17.2 Schedule Data Model

```sql
CREATE TABLE vapt_schedules (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),

    schedule_name VARCHAR(255) NOT NULL,
    description TEXT,

    procedure_key VARCHAR(100) NOT NULL,
    asset_scope_template JSONB NOT NULL,
    -- Can include dynamic references:
    -- {"asset_types": ["domain", "ip_address"],
    --  "tags": ["critical", "production"],
    --  "asset_ids_from_last_campaign": true}

    campaign_config JSONB DEFAULT '{}',

    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',

    max_concurrent_per_org INTEGER DEFAULT 1,
    allowed_days_of_week INTEGER[],
    blackout_windows JSONB DEFAULT '[]',
    -- [{"start": "00:00", "end": "06:00", "days": ["saturday", "sunday"]}]

    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    last_run_campaign_id INTEGER,
    next_run_at TIMESTAMPTZ,
    total_runs INTEGER DEFAULT 0,
    total_failures INTEGER DEFAULT 0,

    created_by_user_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vapt_schedules_next_run ON vapt_schedules (next_run_at)
    WHERE is_active = true;
```

### 17.3 Scheduler Service

```python
class CampaignScheduler:
    async def get_due_schedules(self, db) -> list[dict]:
        """Find schedules whose next_run_at has passed.
        Called by Celery Beat every 60s."""
        ...

    async def execute_schedule(self, db, schedule_id: int) -> dict:
        """Execute a due schedule by creating a campaign from the template."""
        schedule = await self._get_schedule(db, schedule_id)

        # 1. Check constraints
        if not await self._can_run_now(db, schedule):
            return {"status": "skipped", "reason": "constraints not met"}

        # 2. Resolve dynamic scope template
        scope = await self._resolve_scope(db, schedule)

        # 3. Create campaign (reuses existing creation logic)
        campaign = await self._create_campaign_from_schedule(db, schedule, scope)

        # 4. Update schedule state
        await self._update_schedule_state(db, schedule, campaign)

        # 5. Start the campaign
        await publish("CampaignCreated", {
            "campaign_id": campaign.id,
            "organization_id": schedule.organization_id,
            "source": "scheduled",
            "schedule_id": schedule_id,
        })
        return {"status": "started", "campaign_id": campaign.id}

    async def _can_run_now(self, db, schedule: dict) -> bool:
        """Check concurrency limits, blackout windows, platform maintenance."""
        # Per-org concurrency limit
        if schedule["max_concurrent_per_org"] > 0:
            active = await self._count_active_campaigns(
                db, schedule["organization_id"])
            if active >= schedule["max_concurrent_per_org"]:
                return False

        # Blackout window
        if self._in_blackout_window(schedule):
            return False

        # Platform maintenance
        if await self._platform_in_maintenance():
            return False

        return True
```

### 17.4 Celery Integration

```python
@shared_task(name="phantix.vapt.poll_schedules")
def poll_schedules():
    """Celery Beat — runs every 60 seconds."""
    due = scheduler.get_due_schedules()
    for schedule in due:
        execute_schedule.delay(schedule["id"])


@shared_task(
    name="phantix.vapt.execute_schedule",
    bind=True, max_retries=3, default_retry_delay=300,
)
def execute_schedule(self, schedule_id: int):
    """Execute a single due schedule."""
    result = scheduler.execute_schedule(schedule_id)
    if result.get("status") == "skipped":
        logger.info(f"Schedule {schedule_id} skipped: {result['reason']}")
    return result


# Celery Beat config
celery.conf.beat_schedule = {
    "poll-vapt-schedules": {
        "task": "phantix.vapt.poll_schedules",
        "schedule": 60.0,
    },
}
```

### 17.5 Multi-Org Handling

| Concern | Approach |
|---|---|
| Concurrent campaigns across orgs | No cross-org limit — org A's scan doesn't block org B |
| Concurrent campaigns within an org | `max_concurrent_per_org` (default: 1) |
| Blackout windows | Per-org windows in `vapt_schedules.blackout_windows` |
| Platform maintenance | Global `platform_maintenance` flag pauses all execution |
| Staff override | Admin API: `POST /admin/vapt/schedules/{id}/skip-next`, `pause-until` |
| Org suspension | `execute_schedule` checks org subscription status first |

### 17.6 API Surface

```http
# Admin
GET    /api/v1/admin/vapt/schedules
POST   /api/v1/admin/vapt/schedules
GET    /api/v1/admin/vapt/schedules/{id}
PATCH  /api/v1/admin/vapt/schedules/{id}
DELETE /api/v1/admin/vapt/schedules/{id}
POST   /api/v1/admin/vapt/schedules/{id}/skip-next
POST   /api/v1/admin/vapt/schedules/{id}/pause-until
POST   /api/v1/admin/vapt/schedules/{id}/run-now

# Org-facing
GET    /api/v1/vapt/schedules
POST   /api/v1/vapt/schedules
POST   /api/v1/vapt/schedules/{id}/blackout
```

---

## 18. — Implementation Plan (Updated)

The four features above change the phase plan. Here's the revised sequence:

### Phase 1: Foundation (No change)

Campaign creation, scan step execution, pause/resume, one built-in procedure. Ship first.

### Phase 2: Dual Control + Burp Inline

| Step | What |
|---|---|
| `vapt_approval_requests` table + model | Alembic migration |
| Campaign-level approval state machine | `services/campaign_manager.py` — `pending_approval` state |
| Step-level approval (`wait_for_approval`) | `services/step_executor.py` — new step type handler |
| Multi-party approval | `services/multi_party_approval.py` — role resolution + state machine |
| Burp inline adapter | `adapters/burp_adapter.py` — `inline_scan()` method |
| Burp Docker setup | docker-compose addition, license management |

### Phase 3: Burp Agent + Correlation Mining

| Step | What |
|---|---|
| Burp agent mode | `adapters/burp_adapter.py` — `agent_scan()` + MCP event streaming |
| Burp AI bridge to Phantix AI Engine | Event forwarding, `phantix_ai_enhance` flag |
| Per-org real-time mining | `correlation/miner.py` — anomaly detection |
| Cross-org batch mining | `vapt_mining_patterns` table, consent flow |
| Rule candidate proposal | `correlation/miner.py` — `propose_rule_candidates()` |
| Consent API + settings integration | Org settings endpoints |

### Phase 4: Campaign Scheduling

| Step | What |
|---|---|
| `vapt_schedules` table + model | Alembic migration, SQLAlchemy model |
| Scheduler service | `services/scheduler_service.py` — full lifecycle |
| Celery Beat integration | `tasks/scheduled_campaigns.py` — poll + execute |
| Dynamic scope resolution | Template resolution for scheduled campaigns |
| Blackout window support | Per-org + platform-wide maintenance checks |
| Admin + org schedule APIs | CRUD + override endpoints |

### Phase 5: Advanced (Post-MVP)

- Full VAPT procedure (infra + web + API + mobile)
- Data-driven correlation (pattern mining maturity)
- Campaign templates with parameterized scope

---

**End of VAPT Engine Implementation Guide**

*Architectural decisions made July 14, 2026. Sections 14–18 (Burp MCP, Correlation Mining, Richer Dual Control, Campaign Scheduling) were added July 14, 2026 following deliberation. Update as phases complete and as downstream engines become available.*
