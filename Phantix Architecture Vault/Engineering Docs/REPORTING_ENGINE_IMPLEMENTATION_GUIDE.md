# Phantix Reporting Engine — Implementation Guide

**Version**: 1.1
**Date**: July 14, 2026
**Status**: Design Document — **Phases 1–4 implemented** under `app/engines/reporting_engine/` (consolidation, CVSS/tracker, AI narratives + PDF/DOCX/charts, compliance + ad hoc exports). See `docs/REPORTING.md`.
**Audience**: Phantix Backend Engineers, Security Engineering Team
**Prerequisite Reading**: `ARCHITECTURE_MIGRATION_GUIDE.md`, `VAPT_ENGINE_IMPLEMENTATION_GUIDE.md`, `Phantix Architecture Vault/10 - Reporting Engine.md`

---

## Table of Contents

1.  [What This Document Is](#1--what-this-document-is)
2.  [Architecture: The Reporting Engine's Three Responsibilities](#2--architecture-the-reporting-engines-three-responsibilities)
3.  [Reporting Engine in the Engine Flow](#3--reporting-engine-in-the-engine-flow)
4.  [Section Contract: How Engines Contribute Report Data](#4--section-contract-how-engines-contribute-report-data)
5.  [CVSS Enrichment System](#5--cvss-enrichment-system)
6.  [AI Engine Integration for Narrative Generation](#6--ai-engine-integration-for-narrative-generation)
7.  [Finding Tracker (Persistent, Cross-Campaign)](#7--finding-tracker-persistent-cross-campaign)
8.  [Report Lifecycle, Versioning & Retention](#8--report-lifecycle-versioning--retention)
9.  [Output Format Architecture](#9--output-format-architecture)
10. [Report Types (Campaign, Ad Hoc, Compliance, Tracker)](#10--report-types-campaign-ad-hoc-compliance-tracker)
11. [Data Model](#11--data-model)
12. [Engine Folder Structure](#12--engine-folder-structure)
13. [Event Contracts](#13--event-contracts)
14. [Implementation Phases](#14--implementation-phases)
15. [Edge Cases & Constraints](#15--edge-cases--constraints)

---

## 1. — What This Document Is

This is the implementation guide for the **Reporting Engine** — the final consumer in the Phantix engine pipeline. It consolidates sections from every other engine, enriches findings with CVSS scoring, delegates narrative generation to the AI Engine, and assembles comprehensive deliverables across multiple output formats.

The decisions here were deliberated against the existing codebase, Architecture Vault, VAPT Engine Implementation Guide, and the sample reports in `Report Examples/`.

| Question | Decision |
|---|---|
| Engine role | **Consolidator + Enricher + Producer** — never modifies source data, only enriches and formats |
| How it gets data | Sections from other engines via typed contracts + bus events |
| CVSS scoring | **Hybrid**: local cache refreshed periodically + real-time NVD API fallback |
| Finding tracker | **Hybrid snapshot + updates**: persists across campaigns, tracks remediation lifecycle |
| Report lifecycle | **Persisted with async generation**, max 3 versions stored, alert before removal |
| Output formats | Markdown, DOCX, XLSX, PDF, charts |
| AI integration | Narrative generation (executive summaries, attack path prose, remediation guidance) |
| Assembly trigger | **Both**: event-driven for automated (campaign complete) + on-demand for ad hoc |
| Report retention | 3 reports per type per org; alert before removing oldest to make room for new |

---

## 2. — Architecture: The Reporting Engine's Three Responsibilities

### 2.1 Consolidate

Reporting Engine collects report sections from every other engine. It never modifies the content — it places sections into the report structure.

```
VAPT Engine ──▶ campaign_findings, attack_paths, severity_stats
Risk Engine ──▶ risk_register, scoring_breakdown, treatment_status
Compliance ───▶ framework_mappings, control_status, evidence_summary
Scanner ──────▶ technical_findings, tool_output_summary
Asset ────────▶ inventory_scope, asset_classification
Audit ────────▶ audit_trail_summary, dual_control_records
        │
        ▼
┌─────────────────────────────────────┐
│      Reporting Engine               │
│                                     │
│  Collects sections. Links them by   │
│  finding_id, asset_id, campaign_id. │
│  Preserves original data unchanged. │
└─────────────────────────────────────┘
```

### 2.2 Enrich

Before assembly, the Reporting Engine enriches the data:

| Enrichment | Source | What it adds |
|---|---|---|
| **CVSS scoring** | NVD/NIST CVE database | CVSS v3.1 base score, vector string, severity for each CVE-referenced finding |
| **AI narratives** | AI Engine (via bus) | Executive summary, plain-language attack path descriptions, remediation guidance |
| **Cross-campaign context** | Local finding tracker | Remediation progress over time, retest results, regressions |

### 2.3 Produce

The enriched data is assembled into the final output in the requested formats.

### 2.4 Boundary Rule

> Reporting Engine never performs scanning, never calculates risk, never executes compliance checks, and never sends alerts. It takes content from every other engine, enriches it with CVSS data and AI-generated narratives, and formats the result.

### 2.5 MUST NOT List

```
Reporting Engine MUST NOT:
- Interpret or modify engine section content (preserve as-provided)
- Execute scans or discovery (Scanner/VAPT Engine's job)
- Calculate risk scores (Risk Engine's job)
- Perform compliance mapping (Compliance Engine's job)
- Send notifications (Alert Engine's job)
- Store raw scan results (Scanner Engine already owns scan_results)
- Hold more than 3 reports per type per org (retention rule)
```

---

## 3. — Reporting Engine in the Engine Flow

The Reporting Engine is the **last consumer** in the pipeline. Every other engine produces data that eventually flows here.

```
                    Asset Engine
                         │
                         ▼
  VAPT Engine ──▶ Scanner Engine ──▶ Risk Engine ──▶ Compliance Engine
       │               │               │                  │
       │               │               │                  │
       └───────────────┴───────────────┴──────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   AI Engine          │◄──── Executive summary requests
              │   (narratives)       │
              └─────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Reporting Engine    │──── CVSS NVD cache ────
              │                      │
              │  ┌─────────────────┐ │
              │  │ Section         │ │
              │  │ Collector       │ │
              │  └────────┬────────┘ │
              │           │          │
              │  ┌────────▼────────┐ │
              │  │ Enricher        │ │── CVSS lookup + AI call
              │  │ (CVSS + AI)     │ │
              │  └────────┬────────┘ │
              │           │          │
              │  ┌────────▼────────┐ │
              │  │ Report          │ │
              │  │ Assembler       │ │
              │  └────────┬────────┘ │
              │           │          │
              │  ┌────────▼────────┐ │
              │  │ Format          │ │── md, docx, xlsx, pdf
              │  │ Renderer        │ │
              │  └─────────────────┘ │
              └─────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Alert Engine        │──── ReportGenerated event
              │  (notify customer)   │
              └─────────────────────┘
```

### 3.1 Data Flow for an Automated Campaign Report

```
1. VAPT Campaign completes → CampaignCompleted event
2. Reporting Engine receives CampaignCompleted
3. Collects sections:
   - VAPT Engine: campaign findings, attack paths, correlation results
   - Scanner Engine: raw technical findings (if needed)
   - Risk Engine: risk register for findings from this campaign
   - Compliance Engine: framework mappings for covered controls
   - Asset Engine: asset scope, tags, criticality
   - Audit Engine: campaign audit trail
4. Enrichment:
   - Scan findings for CVE references → NVD cache query → attach CVSS scores
   - Submit section summaries to AI Engine → receive narratives
5. Assembly:
   - Merge sections into report structure
   - Generate finding tracker snapshot
   - Render to requested output formats
6. Persist report (up to 3 versions)
7. Publish ReportGenerated event → Alert Engine notifies customer
```

---

## 4. — Section Contract: How Engines Contribute Report Data

### 4.1 Section Data Contract

Every engine that contributes to a report publishes or exposes data following this standard structure:

```python
# app/engines/reporting_engine/schemas/section.py

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any


class SectionType(str, Enum):
    """Identifies which part of the report this section fills."""
    EXECUTIVE_SUMMARY = "executive_summary"          # AI Engine or derived
    CAMPAIGN_OVERVIEW = "campaign_overview"           # VAPT Engine
    FINDINGS_REGISTER = "findings_register"           # VAPT Engine + Enriched
    ATTACK_PATHS = "attack_paths"                     # VAPT Engine (correlation)
    RISK_REGISTER = "risk_register"                   # Risk Engine
    TECHNICAL_FINDINGS = "technical_findings"          # Scanner Engine
    COMPLIANCE_MAPPING = "compliance_mapping"          # Compliance Engine
    ASSET_SCOPE = "asset_scope"                        # Asset Engine
    AUDIT_TRAIL = "audit_trail"                        # Audit Engine
    CVSS_SCORECARD = "cvss_scorecard"                  # Reporting Engine (enriched)
    TRACKER_SNAPSHOT = "tracker_snapshot"              # Reporting Engine
    RETEST_RESULTS = "retest_results"                  # VAPT Engine (retest)
    REMEDIATION_STATUS = "remediation_status"          # Reporting Engine (tracker)
    METHODOLOGY = "methodology"                        # Reporting Engine (generated)
    SCOPE_DEFINITION = "scope_definition"              # VAPT / Asset Engine


@dataclass
class ReportSection:
    """A single section from any engine, ready for assembly.

    The Reporting Engine never modifies section.content — it places
    sections into the report template verbatim (except AI-generated
    narrative sections which replace the raw section).
    """
    section_id: str
    section_type: SectionType
    source_engine: str                                # e.g. "vapt_engine", "risk_engine"
    title: str
    content_type: str                                 # "markdown", "json", "csv", "html"
    content: Any                                      # The actual data
    metadata: dict[str, Any]                          # version, generated_at, campaign_id, etc.
    generated_at: datetime
```

### 4.2 How Engines Provide Sections

Each engine exposes a method on its manifest or events:

```python
# Each engine implements this in its events/catalog.py or services/

async def get_report_sections(
    engine_id: str,
    context: ReportContext,
) -> list[ReportSection]:
    """Return all sections this engine can contribute for the given context.

    Called by Reporting Engine during assembly.
    context contains: organization_id, campaign_id, report_type, date_range
    """
    ...
```

For example, VAPT Engine provides:

| Section Type | Content | When Available |
|---|---|---|
| `campaign_overview` | Campaign metadata, scope, dates, procedure used | After campaign completes |
| `findings_register` | All correlated findings with severity, asset, evidence | After correlation |
| `attack_paths` | Attack path chains from correlation engine | After correlation |
| `retest_results` | Retest outcomes per finding | After retest campaign completes |

### 4.3 Assembly Logic

```python
# app/engines/reporting_engine/services/report_assembler.py

class ReportAssembler:
    """Collects sections from all engines and assembles them into a report structure."""

    # Ordered list of section types that defines the report structure
    REPORT_STRUCTURE: dict[str, list[SectionType]] = {
        "vapt": [
            SectionType.SCOPE_DEFINITION,
            SectionType.EXECUTIVE_SUMMARY,        # AI Engine
            SectionType.CAMPAIGN_OVERVIEW,
            SectionType.CVSS_SCORECARD,            # Enriched
            SectionType.FINDINGS_REGISTER,
            SectionType.ATTACK_PATHS,
            SectionType.RISK_REGISTER,
            SectionType.COMPLIANCE_MAPPING,
            SectionType.TECHNICAL_FINDINGS,
            SectionType.ASSET_SCOPE,
            SectionType.REMEDIATION_STATUS,
            SectionType.TRACKER_SNAPSHOT,
            SectionType.AUDIT_TRAIL,
            SectionType.METHODOLOGY,
        ],
        "compliance": [
            SectionType.EXECUTIVE_SUMMARY,
            SectionType.COMPLIANCE_MAPPING,
            SectionType.RISK_REGISTER,
            SectionType.FINDINGS_REGISTER,
            SectionType.REMEDIATION_STATUS,
            SectionType.AUDIT_TRAIL,
        ],
        "executive": [
            SectionType.EXECUTIVE_SUMMARY,
            SectionType.CVSS_SCORECARD,
            SectionType.ATTACK_PATHS,
            SectionType.RISK_REGISTER,
            SectionType.COMPLIANCE_MAPPING,
        ],
    }

    async def assemble(
        self,
        report_type: str,
        sections: list[ReportSection],
        report_metadata: dict,
    ) -> dict:
        """Organize collected sections into report structure.

        Returns a structured dict ready for format rendering.
        Never modifies section content — only organizes and enriches.
        """
        structure = self.REPORT_STRUCTURE.get(report_type, [])

        organized = {
            "metadata": report_metadata,
            "sections": {},
        }

        for section_type in structure:
            matching = [s for s in sections if s.section_type == section_type]
            if matching:
                # Take the most recent section of this type
                organized["sections"][section_type.value] = matching[-1]

        # Include any extra sections not in the structure
        extra = [s for s in sections if s.section_type not in structure]
        if extra:
            organized["sections"]["extra"] = extra

        return organized
```

---

## 5. — CVSS Enrichment System

### 5.1 Purpose

Findings from scanner and VAPT engines may reference CVE IDs. The Reporting Engine looks up these CVEs against the NVD (National Vulnerability Database) to attach CVSS v3.1 base scores, vector strings, and severity ratings.

This is not risk scoring — it's attaching an industry-standard severity reference to findings. Risk Engine still owns the actual risk calculation for the org's context.

### 5.2 Architecture: Hybrid Cache + Real-Time Fallback

```
┌─────────────────────────────────────────────────────────────────┐
│                    CVSS Enricher                                  │
│                                                                  │
│  ┌─────────────────────┐       ┌──────────────────────────────┐ │
│  │  Local NVD Cache     │       │  NVD API (real-time)         │ │
│  │  (platform DB)       │       │  https://services.nvd.nist.  │ │
│  │                      │       │      gov/rest/json/cves/2.0  │ │
│  │  cve_cache table     │       │                              │ │
│  │  - CVE ID (PK)       │       │  Fallback when:              │ │
│  │  - CVSS v3.1 score   │       │  - CVE not in cache          │ │
│  │  - vector string     │       │  - Cache entry is >30 days   │ │
│  │  - severity          │       │  - Explicit force-refresh    │ │
│  │  - last_refreshed    │       │                              │ │
│  │  - raw JSONB         │       │  On success: store in cache  │ │
│  └──────────┬──────────┘       └──────────────────────────────┘ │
│             │                           │                        │
│             └───────────┬───────────────┘                        │
│                         ▼                                       │
│              ┌─────────────────────┐                            │
│              │ Background          │                            │
│              │ refresher job       │                            │
│              │ (weekly Celery)     │                            │
│              └─────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Cache Table

```sql
CREATE TABLE report_cve_cache (
    cve_id VARCHAR(20) PRIMARY KEY,              -- CVE-2026-12345
    cvss_score DECIMAL(3,1),                     -- 9.8
    cvss_vector VARCHAR(100),                    -- CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
    cvss_severity VARCHAR(20),                   -- CRITICAL
    cvss_version VARCHAR(10) DEFAULT '3.1',
    attack_vector VARCHAR(30),
    attack_complexity VARCHAR(20),
    privileges_required VARCHAR(20),
    user_interaction VARCHAR(20),
    scope VARCHAR(10),
    confidentiality VARCHAR(20),
    integrity VARCHAR(20),
    availability VARCHAR(20),
    description TEXT,
    published_date DATE,
    last_modified DATE,
    raw_json JSONB,                              -- full NVD response for flexibility
    last_refreshed TIMESTAMPTZ DEFAULT NOW(),
    refresh_count INTEGER DEFAULT 1
);

CREATE INDEX idx_report_cve_cache_severity ON report_cve_cache (cvss_severity);
CREATE INDEX idx_report_cve_cache_refreshed ON report_cve_cache (last_refreshed);
```

### 5.4 Enricher Implementation

```python
# app/engines/reporting_engine/services/cvss_enricher.py

class CVSSEnricher:
    """Enriches findings with CVSS scores from NVD."""

    CACHE_TTL_DAYS = 30
    NVD_API_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    async def enrich_findings(
        self,
        db,
        findings: list[dict],
    ) -> list[dict]:
        """Scan findings for CVE references and attach CVSS data.

        Returns findings with CVSS data attached. Never modifies original finding.
        """
        enriched = []
        cve_ids = self._extract_cve_ids(findings)

        # Batch lookup — all CVEs in one pass
        cvss_data = await self._batch_lookup(db, cve_ids)

        for finding in findings:
            finding_cves = self._extract_cve_ids([finding])
            finding["cvss"] = []
            for cve_id in finding_cves:
                if cve_id in cvss_data:
                    finding["cvss"].append(cvss_data[cve_id])
            enriched.append(finding)

        return enriched

    async def _batch_lookup(
        self,
        db,
        cve_ids: set[str],
    ) -> dict[str, dict]:
        """Look up multiple CVEs at once.

        Checks cache first. Falls back to NVD API for uncached/expired CVEs.
        """
        result = {}

        # Step 1: Check cache
        cached = await self._query_cache(db, cve_ids)
        result.update(cached)

        # Step 2: Find uncached or expired
        missing = set()
        for cve_id in cve_ids:
            if cve_id not in result:
                missing.add(cve_id)

        if not missing:
            return result

        # Step 3: NVD API lookup
        from_nvd = await self._query_nvd_api(missing)
        result.update(from_nvd)

        # Step 4: Store in cache
        await self._update_cache(db, from_nvd)

        return result

    async def _query_nvd_api(
        self,
        cve_ids: set[str],
    ) -> dict[str, dict]:
        """Query NVD API for CVE details.

        NVD API 2.0 supports batch lookup via cveId parameter (comma-separated).
        Rate limit: ~5 requests per 30 seconds without API key.
        With API key (free): ~50 requests per 30 seconds.
        """
        if not cve_ids:
            return {}

        cve_list = ",".join(cve_ids)
        url = f"{self.NVD_API_BASE}?cveId={cve_list}"

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    logger.warning(f"NVD API returned {resp.status}")
                    return {}
                data = await resp.json()

        return self._parse_nvd_response(data)
```

### 5.5 Background Refresher

```python
@shared_task(name="phantix.reporting.refresh_cve_cache")
def refresh_cve_cache():
    """Weekly task: refresh stale CVE entries from NVD.

    Runs every Sunday at 2 AM via Celery Beat.
    Refreshes entries older than CACHE_TTL_DAYS.
    """
    stale = get_stale_entries()  # last_refreshed > 30 days ago
    for cve in stale:
        cve_data = query_nvd_api({cve["cve_id"]})
        update_cache(cve_data)
```

### 5.6 What CVSS Enrichment Looks Like in a Report

```json
{
    "finding_id": "API-001",
    "title": "OTP disclosed in password reset responses",
    "severity": "critical",
    "cvss": [
        {
            "cve_id": "CVE-2026-12345",
            "score": 9.1,
            "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
            "severity": "CRITICAL",
            "attack_vector": "Network",
            "confidentiality": "High",
            "integrity": "High",
            "source": "nvd_cache",
            "last_refreshed": "2026-07-10T00:00:00Z"
        }
    ]
}
```

---

## 6. — AI Engine Integration for Narrative Generation

### 6.1 What AI Engine Generates For Reporting

The Reporting Engine sends structured data to the AI Engine and receives human-readable narrative sections:

| Narrative | Input Data | Output |
|---|---|---|
| **Executive Summary** | All findings, attack paths, risk register, CVSS scorecard | 1–2 page plain-language overview for C-suite |
| **Attack Path Description** | Attack path JSON (chain of findings) | Prose describing the attack chain, impact, and remediation priority |
| **Technical Narrative** | Raw scan + correlation findings | Detailed technical write-up per finding |
| **Remediation Guidance** | Finding + asset context + CVSS | Actionable remediation steps ranked by effort/impact |
| **Board Summary** | Executive summary + compliance status | One-page board-ready brief |

### 6.2 Integration via Engine Bus

```python
# In Reporting Engine's report_generator.py

async def generate_narratives(
    self,
    campaign_data: dict,
    org_context: dict,
) -> dict[str, str]:
    """Request AI Engine to generate narrative sections.

    Sends structured data, receives narrative text.
    Falls back to template-based narratives if AI Engine is unavailable.
    """
    narrative_request = {
        "organization_id": org_context["organization_id"],
        "narratives_needed": [
            "executive_summary",
            "attack_path_descriptions",
            "remediation_guidance",
        ],
        "context": {
            "finding_count": len(campaign_data.get("findings", [])),
            "critical_count": sum(1 for f in campaign_data.get("findings", [])
                                  if f.get("severity") == "critical"),
            "high_count": sum(1 for f in campaign_data.get("findings", [])
                              if f.get("severity") == "high"),
            "attack_paths": campaign_data.get("attack_paths", []),
            "risk_register": campaign_data.get("risk_sections", []),
            "compliance_mapping": campaign_data.get("compliance_sections", []),
            "asset_scope": campaign_data.get("asset_scope", []),
            "cvss_scorecard": campaign_data.get("cvss_sections", []),
        },
    }

    # Publish to bus — AI Engine processes asynchronously
    await publish("AIReportNarrativesRequested", narrative_request)
```

### 6.3 Fallback: Template-Based Narratives

When AI Engine is unavailable, the Reporting Engine generates narratives from templates:

```python
# app/engines/reporting_engine/templates/narratives/

EXECUTIVE_SUMMARY_TEMPLATE = """
## Executive Summary

This report summarizes the findings of a {campaign_type} assessment conducted
on {assessment_date} for {organization_name}.

### Overall Risk Posture: {overall_risk_level}

A total of {total_findings} findings were identified:
- **Critical**: {critical_count}
- **High**: {high_count}
- **Medium**: {medium_count}
- **Low**: {low_count}

### Key Attack Paths

{attack_path_summary}

### Recommended Actions

- **Immediate (0-7 days)**: {immediate_actions}
- **Short-term (8-30 days)**: {short_term_actions}
- **Long-term (31-90 days)**: {long_term_actions}
"""
```

---

## 7. — Finding Tracker (Persistent, Cross-Campaign)

### 7.1 Purpose

A finding tracker is a living document that follows findings from discovery through remediation across multiple VAPT campaign cycles. It answers:

- What was found in campaign 1? What's the status now after campaign 3?
- Which findings were fixed? Which regressed?
- Who owns each finding? What's the target fix date?
- What retest results exist per finding?

### 7.2 Data Model

```sql
CREATE TABLE report_finding_tracker (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,

    -- Identity (stable across campaigns)
    finding_key VARCHAR(100) NOT NULL,
    -- VAPT Engine generates stable keys: "API-001", "INFRA-003", etc.
    -- These persist across campaign cycles

    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Current state
    severity VARCHAR(20) NOT NULL,
    surface VARCHAR(50) NOT NULL,            -- API, Infrastructure, Mobile, Web
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    -- open, in_progress, fixed, accepted, false_positive, retest_failed, regressed

    priority VARCHAR(5) NOT NULL,            -- P0, P1, P2, P3, P4

    -- Ownership
    assigned_owner VARCHAR(255),
    assigned_owner_email VARCHAR(255),
    target_fix_date DATE,

    -- Campaign tracking
    first_campaign_id BIGINT,                 -- campaign where first discovered
    first_detected_at TIMESTAMPTZ,
    last_campaign_id BIGINT,                  -- most recent campaign that saw it
    last_detected_at TIMESTAMPTZ,
    detection_count INTEGER DEFAULT 1,

    -- Retest results (latest)
    retest_status VARCHAR(30),                -- not_tested, passed, failed, partially_fixed
    retest_date DATE,
    retest_campaign_id BIGINT,
    retest_evidence TEXT,

    -- Compliance cross-ref
    compliance_mappings JSONB,                -- [{"framework": "NDPR", "control": "§34"}, ...]

    cvss_data JSONB,                          -- latest CVSS enrichment

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (organization_id, finding_key)
);

CREATE INDEX idx_tracker_org_status ON report_finding_tracker (organization_id, status);
CREATE INDEX idx_tracker_org_severity ON report_finding_tracker (organization_id, severity);
CREATE INDEX idx_tracker_org_priority ON report_finding_tracker (organization_id, priority);
```

### 7.3 Tracker History

```sql
CREATE TABLE report_tracker_history (
    id BIGSERIAL PRIMARY KEY,
    finding_key VARCHAR(100) NOT NULL,
    organization_id INTEGER NOT NULL,

    campaign_id BIGINT,
    change_type VARCHAR(50) NOT NULL,          -- status_change, reassignment, retest_result
    previous_value VARCHAR(255),
    new_value VARCHAR(255),
    changed_by VARCHAR(255),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracker_history_key ON report_tracker_history (finding_key, organization_id);
```

### 7.4 How It Works

```
CAMPAIGN 1 (Initial)
    │
    ├── 10 findings discovered
    ├── Tracker: 10 rows created (status=open)
    └── Report v1 generated

    ▼
    Client remediates 4 findings

CAMPAIGN 2 (Retest, 2 weeks later)
    │
    ├── 6 open findings retested
    │   ├── 4 → retest_status=passed, status=fixed
    │   └── 2 → retest_status=failed, status=retest_failed
    ├── 3 new findings discovered
    │   └── Tracker: 3 new rows (status=open)
    ├── 1 previously-fixed finding now seen again
    │   └── status=regressed (auto-detected by VAPT Engine)
    └── Report v2 generated (9 open + history)
```

### 7.5 Tracker Snapshot in Reports

```python
async def generate_tracker_snapshot(
    self,
    db,
    organization_id: int,
    campaign_id: int,
) -> ReportSection:
    """Generate a snapshot of the finding tracker for the current report.

    Included as TRACKER_SNAPSHOT section in every report.
    The XLSX output format renders this as the interactive tracker spreadsheet.
    """
    tracker_entries = await self._get_tracker_for_org(db, organization_id)

    snapshot = {
        "generated_at": datetime.utcnow().isoformat(),
        "campaign_id": campaign_id,
        "summary": {
            "total": len(tracker_entries),
            "open": sum(1 for t in tracker_entries if t["status"] == "open"),
            "in_progress": sum(1 for t in tracker_entries if t["status"] == "in_progress"),
            "fixed": sum(1 for t in tracker_entries if t["status"] == "fixed"),
            "retest_failed": sum(1 for t in tracker_entries if t["status"] == "retest_failed"),
            "regressed": sum(1 for t in tracker_entries if t["status"] == "regressed"),
            "accepted": sum(1 for t in tracker_entries if t["status"] == "accepted"),
        },
        "entries": tracker_entries,
    }

    return ReportSection(
        section_id=f"tracker-{campaign_id}",
        section_type=SectionType.TRACKER_SNAPSHOT,
        source_engine="reporting_engine",
        title="Findings & Remediation Tracker",
        content_type="json",
        content=snapshot,
        metadata={"campaign_id": campaign_id},
        generated_at=datetime.utcnow(),
    )
```

---

## 8. — Report Lifecycle, Versioning & Retention

### 8.1 Report Lifecycle

```
DRAFT (generating)
    │
    ▼
COMPLETE (generated, ready to download)
    │
    ├── available for 3 report cycles
    │
    ▼
ARCHIVED (oldest removed when 4th report generated)
    │
    ▼ (alert sent before removal)
REMOVED
```

### 8.2 Report Data Model

```sql
CREATE TABLE reports (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,

    -- Identity
    report_type VARCHAR(50) NOT NULL,
    -- vapt_campaign, compliance, executive, ad_hoc

    campaign_id BIGINT,                        -- for campaign reports
    report_version INTEGER NOT NULL,            -- 1, 2, 3 (per org + type)

    -- State
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    -- draft, generating, complete, archived, failed

    -- Sections stored
    sections JSONB NOT NULL DEFAULT '{}',
    -- Map of section_type → section data (as assembled, pre-rendering)

    -- Metadata
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    generated_by_user_id INTEGER,
    generated_at TIMESTAMPTZ,

    -- Output files (file paths or object store keys)
    output_files JSONB DEFAULT '{}',
    -- {
    --   "markdown": "/reports/org_42/v1/report.md",
    --   "pdf": "/reports/org_42/v1/report.pdf",
    --   "docx": "/reports/org_42/v1/report.docx",
    --   "xlsx": "/reports/org_42/v1/tracker.xlsx"
    -- }

    -- AI enrichment
    ai_narratives JSONB DEFAULT '{}',
    -- {"executive_summary": "...", "attack_paths": {...}}

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (organization_id, report_type, report_version)
);

CREATE INDEX idx_reports_org ON reports (organization_id, report_type, report_version);
```

### 8.3 Retention Policy

```python
async def enforce_retention(
    self,
    db,
    organization_id: int,
    report_type: str,
) -> None:
    """Enforce max 3 reports per type per org.

    Before creating a new report, check if 3 already exist.
    If so, mark the oldest as 'archived' and send alert.
    """
    max_versions = 3

    existing = await self._count_reports(db, organization_id, report_type)

    if existing >= max_versions:
        # Find the oldest report
        oldest = await self._get_oldest_report(db, organization_id, report_type)

        # Send alert BEFORE removal
        await publish("AlertQueued", {
            "event_type": "ReportArchived",
            "organization_id": organization_id,
            "severity": "info",
            "title": f"Oldest {report_type} report will be removed",
            "body": (
                f"The oldest {report_type} report (v{oldest.report_version}, "
                f"{oldest.generated_at}) is being archived to make room for "
                f"the new report. Download it before it's removed."
            ),
        })

        # Archive it
        oldest.status = "archived"
        await db.commit()

        # Schedule physical removal (7 days from now, giving time to download)
        await self._schedule_removal(oldest.id, days=7)
```

### 8.4 Report Storage

```text
# Local filesystem (dev) or object store (production)

/storage/reports/
    {organization_id}/
        {report_type}/
            v{version}/
                report.md
                report.pdf
                report.docx
                tracker.xlsx
                evidence/
                    attack_path_1.png
                    ...
```

---

## 9. — Output Format Architecture

### 9.1 Format Adapter Pattern

```python
# app/engines/reporting_engine/adapters/

class ReportRenderer(ABC):
    """Base class for all output format renderers."""

    @abstractmethod
    def render(
        self,
        report_data: dict,       # assembled sections + metadata
        output_path: str,
    ) -> str:                    # returns path to generated file
        ...

class MarkdownRenderer(ReportRenderer):
    """Renders report as Markdown using Jinja2 templates."""
    ...

class DocxRenderer(ReportRenderer):
    """Renders report as DOCX using python-docx."""
    ...

class XlsxRenderer(ReportRenderer):
    """Renders finding tracker as XLSX with charts using openpyxl."""
    ...

class PdfRenderer(ReportRenderer):
    """Renders report as PDF using WeasyPrint (HTML+CSS → PDF)."""
    ...


class ReportRendererFactory:
    """Returns the appropriate renderer for the requested format."""

    RENDERERS = {
        "markdown": MarkdownRenderer,
        "docx": DocxRenderer,
        "xlsx": XlsxRenderer,
        "pdf": PdfRenderer,
    }

    @classmethod
    def get_renderer(cls, fmt: str) -> ReportRenderer:
        renderer = cls.RENDERERS.get(fmt)
        if not renderer:
            raise ValueError(f"Unsupported format: {fmt}")
        return renderer()
```

### 9.2 Markdown (via Jinja2)

The **canonical format** — all others render from the same template:

```jinja2
{# templates/reports/vapt_report.md.j2 #}

# {{ title }}

**Client**: {{ organization_name }}
**Assessment Type**: {{ campaign_type }}
**Report Date**: {{ report_date }}
**Report Version**: {{ version }}

---

{% for section in sections %}
## {{ section.title }}

{{ section.content }}

{% endfor %}
```

### 9.3 DOCX (via python-docx)

```python
class DocxRenderer(ReportRenderer):
    """Converts assembled report to DOCX.

    Uses python-docx for precise formatting control:
    - Headers/footers with org branding
    - Table of contents (auto-generated)
    - Styled headings (Heading 1, 2, 3)
    - Tables with borders and shading
    - Images embedded in document
    - Page numbers in footer
    """

    def render(self, report_data: dict, output_path: str) -> str:
        doc = Document()

        # Cover page
        doc.add_heading(report_data["metadata"]["title"], 0)
        doc.add_paragraph(f"Version: {report_data['metadata']['version']}")

        # Table of Contents
        doc.add_heading("Table of Contents", 1)
        # python-docx can add TOC field codes for Word to auto-generate

        # Sections
        for section_type, section in report_data["sections"].items():
            doc.add_heading(section.title, 1)

            if section.content_type == "markdown":
                # Convert markdown to docx elements
                self._render_markdown_to_docx(doc, section.content)
            elif section.content_type == "json":
                # Render as table
                self._render_json_as_table(doc, section.content)

        # Header/footer
        section = doc.sections[0]
        header = section.header
        header.paragraphs[0].text = report_data["metadata"]["organization_name"]

        doc.save(output_path)
        return output_path
```

### 9.4 XLSX — Findings Tracker (via openpyxl)

The tracker mirrors the `EverTry_VAPT_Findings_Tracker_2026-06-26.xlsx` sample:

```python
class XlsxRenderer(ReportRenderer):
    """Renders the finding tracker as a formatted spreadsheet.

    Features (matching the example):
    - Executive Summary sheet with severity distribution
    - Findings Tracker sheet with all columns
    - Data validation dropdowns for Status, Severity, Priority
    - Conditional formatting (red=P0, orange=P1, etc.)
    - Severity distribution chart
    - Filterable columns
    """

    SEVERITY_COLORS = {
        "critical": "FF0000",
        "high": "FF6600",
        "medium": "FFD700",
        "low": "90EE90",
        "info": "87CEEB",
    }

    def render(self, report_data: dict, output_path: str) -> str:
        wb = Workbook()

        # Sheet 1: Executive Summary
        ws_summary = wb.active
        ws_summary.title = "Executive Summary"
        self._build_summary_sheet(ws_summary, report_data)

        # Sheet 2: Findings Tracker
        ws_tracker = wb.create_sheet("Findings Tracker")
        self._build_tracker_sheet(ws_tracker, report_data)

        # Sheet 3: Attack Paths
        ws_paths = wb.create_sheet("Attack Paths")
        self._build_attack_paths_sheet(ws_paths, report_data)

        # Chart: Severity Distribution
        chart = self._build_severity_chart(report_data)
        ws_summary.add_chart(chart, "E2")

        wb.save(output_path)
        return output_path

    def _build_tracker_sheet(self, ws, report_data):
        """Build the main findings tracker with all columns matching the example."""
        headers = [
            "Finding ID", "Title", "Severity", "Surface",
            "OWASP / Regulatory", "Status", "Retest Status",
            "Priority", "Assigned Owner", "Target Fix Date",
            "Remediation Notes", "Retest Date",
            "Retest Result", "CVSS Score", "Evidence Location",
        ]

        # Header styling
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="2F5496", end_color="2F5496", fill_type="solid")

        # Data
        for row_idx, finding in enumerate(report_data["findings"], 2):
            ws.cell(row=row_idx, column=1, value=finding.get("finding_id"))
            ws.cell(row=row_idx, column=2, value=finding.get("title"))
            ws.cell(row=row_idx, column=3, value=finding.get("severity", "").upper())
            # ... etc

        # Data validation dropdowns for Status column
        status_values = '"open,in_progress,fixed,accepted,false_positive,retest_failed,regressed"'
        dv = DataValidation(type="list", formula1=status_values, allow_blank=True)
        dv.error = "Please select a valid status"
        dv.errorTitle = "Invalid Status"
        ws.add_data_validation(dv)
        dv.add(f"D2:D{len(report_data['findings']) + 1}")
```

### 9.5 PDF (via WeasyPrint)

```python
class PdfRenderer(ReportRenderer):
    """Renders report as PDF using HTML+CSS → WeasyPrint.

    Why WeasyPrint over ReportLab/FPDF:
    - Write reports in HTML + CSS (frontend skills, not PDF coordinate math)
    - CSS @page for headers, footers, page numbers
    - CSS multi-column, page breaks, running elements
    - Same template design as web UI
    - Supported: inline SVG, embedded fonts, background images
    """

    def render(self, report_data: dict, output_path: str) -> str:
        # Render HTML from Jinja2 template
        html_string = self._render_html_template(report_data)

        # Convert to PDF
        doc = Document()
        doc = doc.from_string(html_string)
        doc.write_pdf(output_path)

        return output_path

    def _render_html_template(self, report_data: dict) -> str:
        """Render the report_data into an HTML string using Jinja2.

        The HTML template includes embedded CSS for:
        - @page with margins, headers, footers
        - Cover page with no header/footer
        - Table of contents
        - Alternating row colors for tables
        - Severity-colored badges
        - Page breaks before major sections
        """
        env = Environment(loader=FileSystemLoader("app/engines/reporting_engine/templates/pdfs"))
        template = env.get_template("vapt_report.html")
        return template.render(report=report_data)
```

### 9.6 Charts

```python
# app/engines/reporting_engine/adapters/chart_renderer.py

class ChartRenderer:
    """Generates charts for embedding in reports.

    - matplotlib for static charts (PDF, DOCX embedding)
    - plotly data for interactive charts (web dashboards, frontend)
    """

    def severity_distribution(
        self,
        findings: list[dict],
        output_path: str | None = None,
    ) -> str:
        """Generate a severity distribution bar chart.

        Returns base64-encoded PNG or saves to output_path.
        """
        counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Info": 0}
        colors = {"Critical": "#FF0000", "High": "#FF6600",
                   "Medium": "#FFD700", "Low": "#90EE90", "Info": "#87CEEB"}

        for f in findings:
            sev = f.get("severity", "info").capitalize()
            if sev in counts:
                counts[sev] += 1

        fig, ax = plt.subplots(figsize=(8, 4))
        bars = ax.bar(counts.keys(), counts.values(),
                      color=[colors[k] for k in counts.keys()])

        ax.set_title("Findings by Severity")
        ax.set_ylabel("Count")

        for bar, count in zip(bars, counts.values()):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                    str(count), ha='center', va='bottom')

        if output_path:
            fig.savefig(output_path, bbox_inches='tight', dpi=150)
            plt.close(fig)
            return output_path

        # Return base64 for inline embedding
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
        plt.close(fig)
        return base64.b64encode(buf.getvalue()).decode()
```

---

## 10. — Report Types (Campaign, Ad Hoc, Compliance, Tracker)

| Report Type | Trigger | Sections Included | Output Formats | Persisted |
|---|---|---|---|---|
| **VAPT Campaign** | `CampaignCompleted` event | All engine sections + CVSS + AI narratives + tracker | MD, PDF, DOCX, XLSX | ✅ (max 3) |
| **Compliance** | Compliance Engine publishes `ComplianceReportReady` | Compliance mapping, risk register, evidence summary | MD, PDF, DOCX | ✅ (max 3) |
| **Executive Summary** | On-demand (via API or generated from campaign) | Executive summary, CVSS scorecard, attack paths, risk register | MD, PDF | ✅ (max 3) |
| **Ad Hoc Export** | User requests via API | User-specified sections | CSV, JSON, MD | ❌ (generated on demand) |
| **Tracker Only** | On-demand | Finding tracker snapshot | XLSX | ❌ (fresh each time) |

---

## 11. — Data Model (Summary)

### Platform DB Tables

All tables created in the platform database:

| Table | Purpose |
|---|---|
| `reports` | Persisted report records with sections, metadata, output file paths |
| `report_cve_cache` | Cached CVSS data from NVD API lookups |
| `report_finding_tracker` | Cross-campaign finding lifecycle tracking |
| `report_tracker_history` | Change history for finding tracker entries |

### Security DB — No Changes

All source data is already in the security DB (`scan_results`, `vapt_correlated_findings`, `risks`, etc.). Reporting Engine reads from it, never writes to it.

---

## 12. — Engine Folder Structure

```text
app/engines/reporting_engine/
    __init__.py
    manifest.py                          # EngineDescriptor for registry
    api/
        __init__.py
        routes.py                        # Main router: mount at /api/v1/reports
        reports.py                       # Report CRUD, generate, download
        tracker.py                       # Finding tracker CRUD, status updates
        exports.py                       # Ad hoc export endpoints
    services/
        __init__.py
        report_generator.py              # Orchestrates the full generation pipeline
        report_assembler.py              # Collects and organizes sections
        section_collector.py             # Queries engines for their sections
        tracker_service.py               # Finding tracker CRUD + snapshot logic
        retention_service.py             # Report lifecycle, versioning, cleanup
    repositories/
        __init__.py
        report_repo.py                   # reports table queries
        cve_cache_repo.py                # report_cve_cache queries
        tracker_repo.py                  # report_finding_tracker queries
    models/
        __init__.py
        report.py                        # SQLAlchemy: reports table
        cve_cache.py                     # SQLAlchemy: report_cve_cache table
        tracker.py                       # SQLAlchemy: report_finding_tracker + history
    schemas/
        __init__.py
        report.py                        # Pydantic: report create/response
        section.py                       # Pydantic: ReportSection, SectionType
        tracker.py                       # Pydantic: tracker entries, updates
        export.py                        # Pydantic: export request/response
    adapters/
        __init__.py
        renderer.py                      # ReportRenderer (ABC)
        markdown_renderer.py             # Jinja2 → Markdown
        docx_renderer.py                 # python-docx → DOCX
        xlsx_renderer.py                 # openpyxl → XLSX
        pdf_renderer.py                  # WeasyPrint → PDF
        chart_renderer.py                # matplotlib charts
    enrichment/
        __init__.py
        cvss_enricher.py                 # NVD cache + API lookup
        ai_narrative.py                  # AI Engine integration
    workers/
        __init__.py
        report_worker.py                 # Celery: async report generation
        cve_refresh_worker.py            # Celery: weekly NVD cache refresh
        retention_worker.py              # Celery: periodic retention check
    tasks/
        __init__.py
        generate_report.py               # phantix.reporting.generate_report
        refresh_cve_cache.py             # phantix.reporting.refresh_cve_cache
        enforce_retention.py             # phantix.reporting.enforce_retention
    events/
        __init__.py
        catalog.py                       # PUBLISHES / SUBSCRIBES
        publishers.py                    # Event publish helpers
        subscribers.py                   # Event subscription handlers
    templates/
        reports/
            vapt_report.md.j2            # Campaign report (Markdown)
            compliance_report.md.j2      # Compliance report
            executive_summary.md.j2      # Executive brief
        pdfs/
            vapt_report.html             # CSS-styled HTML for WeasyPrint
            base.css                     # Shared PDF styles
        narratives/
            executive_summary.j2         # Fallback narrative template
            attack_path.j2
    validators/
        __init__.py
        report_validator.py              # Validates section completeness
    tests/
        __init__.py
        test_report_assembler.py
        test_cvss_enricher.py
        test_tracker_service.py
        test_renderers.py
        test_api_routes.py
    docs/
        __init__.py
```

---

## 13. — Event Contracts

### Publishes

| Event | Payload | When |
|---|---|---|
| `ReportGenerated` | organization_id, report_id, report_type, version, format_list | Report generation completes |
| `ReportFailed` | organization_id, report_type, campaign_id, error | Report generation fails |
| `ReportArchived` | organization_id, report_type, version, archived_at | Report archived for retention |

### Subscribes To

| Event | From | Handler Action |
|---|---|---|
| `CampaignCompleted` | VAPT Engine | Start campaign report generation |
| `ComplianceReportReady` | Compliance Engine | Start compliance report generation (or collect section) |
| `AIReportNarrativesCompleted` | AI Engine | Receive generated narratives, attach to report |
| `ScanCompleted` | Scanner Engine | Update pending CVEs in NVD cache if new CVEs found |

---

## 14. — Implementation Phases

### Phase 1: Foundation — Consolidation Pipeline (Ship in one sprint)

**Goal**: Reporting Engine can collect sections from VAPT and Risk Engines, assemble them, and produce a Markdown report.

| Step | Files |
|---|---|
| Platform DB tables + Alembic migration | `alembic/versions/xxxx_add_reporting_tables.py` |
| Report + section schemas | `schemas/report.py`, `schemas/section.py` |
| Report model + repo | `models/report.py`, `repositories/report_repo.py` |
| Section collector (queries VAPT + Risk Engines) | `services/section_collector.py` |
| Report assembler | `services/report_assembler.py` |
| Markdown renderer | `adapters/markdown_renderer.py` |
| VAPT campaign report template | `templates/reports/vapt_report.md.j2` |
| Report API (CRUD + generate + download) | `api/reports.py` |
| Async Celery worker | `workers/report_worker.py`, `tasks/generate_report.py` |
| Subscribe to `CampaignCompleted` | `events/subscribers.py` |
| API routes mount | `api/routes.py` |

**Milestone**: VAPT campaign completes → `CampaignCompleted` event → Reporting Engine auto-generates a Markdown report with all sections → report is downloadable.

### Phase 2: Finding Tracker + CVSS Enrichment

**Goal**: Persistent finding tracker across campaigns. CVSS enrichment from NVD.

| Step | Files |
|---|---|
| Finding tracker model + repo | `models/tracker.py`, `repositories/tracker_repo.py` |
| Tracker service (snapshot + updates) | `services/tracker_service.py` |
| CVE cache model + repo | `models/cve_cache.py`, `repositories/cve_cache_repo.py` |
| CVSS enricher | `enrichment/cvss_enricher.py` |
| XLSX renderer (tracker spreadsheet) | `adapters/xlsx_renderer.py` |
| Tracker API (CRUD + status updates) | `api/tracker.py` |
| NVD background refresher | `workers/cve_refresh_worker.py`, `tasks/refresh_cve_cache.py` |
| Retention service | `services/retention_service.py` |

**Milestone**: Campaign report includes CVSS-enriched findings and a downloadable XLSX tracker. Retest campaigns update existing tracker entries.

### Phase 3: AI Narratives + DOCX + PDF

**Goal**: AI-generated executive summaries. Professional DOCX and PDF output.

| Step | Files |
|---|---|
| AI narrative integration | `enrichment/ai_narrative.py`, `events/subscribers.py` (handle `AIReportNarrativesCompleted`) |
| DOCX renderer | `adapters/docx_renderer.py` |
| PDF renderer (HTML → WeasyPrint) | `adapters/pdf_renderer.py` |
| PDF CSS templates | `templates/pdfs/vapt_report.html`, `templates/pdfs/base.css` |
| AI narrative fallback templates | `templates/narratives/executive_summary.j2`, `attack_path.j2` |
| Executive summary report type | Structure in `services/report_assembler.py` |
| Chart renderer | `adapters/chart_renderer.py` |

**Milestone**: Reports include AI-generated executive summary. Available as DOCX and PDF with professional formatting and embedded charts.

### Phase 4: Compliance Reports + Ad Hoc Exports

**Goal**: Compliance Engine sections integrated. On-demand ad hoc exports.

| Step | Files |
|---|---|
| Compliance section collection | `services/section_collector.py` (add Compliance Engine queries) |
| Compliance report template | `templates/reports/compliance_report.md.j2` |
| Executive summary template | `templates/reports/executive_summary.md.j2` |
| Ad hoc export API | `api/exports.py`, `schemas/export.py` |
| CSV/JSON on-demand export | `adapters/csv_exporter.py` (lightweight, no template needed) |

**Milestone**: Reports incorporate Compliance Engine sections. Users can request ad hoc exports of specific sections in CSV or JSON.

---

## 15. — Edge Cases & Constraints

| Scenario | Behavior |
|---|---|
| **Engine section unavailable** (e.g., Compliance not built yet) | Section collector returns empty for that engine. Report assembler includes a "Not assessed" placeholder. No pipeline failure. |
| **AI Engine unavailable** | Falls back to template-based narrative generation. Report notes "AI narratives unavailable — generated from templates." |
| **NVD API rate limited** | CVSS enricher uses cached data only. Reports show `source: nvd_cache (stale)` for entries older than CACHE_TTL_DAYS. |
| **Report generation fails mid-way** | Celery task retries with backoff (3 retries, 5 min interval). After all retries exhausted, `ReportFailed` event published. Partial data discarded. |
| **4th report requested** | Oldest report archived. Alert sent to org. New report generated. Oldest physically removed after 7 days. |
| **Finding fixed then regressed** | Tracker status changes to `regressed`. History records both transitions. Report highlights regressions prominently. |
| **Finding seen in multiple campaigns** | Tracker updates `last_detected_at`, increments `detection_count`. If same finding appears in new campaign with different severity, tracker uses highest. |
| **Empty campaign (0 findings)** | Report still generated — shows "No findings identified during this assessment." Useful compliance artifact. |
| **Very large report (500+ findings)** | Report generation runs as async Celery task. PDF/HTML uses CSS page breaks per section. XLSX uses auto-filter for large datasets. |

---

**End of Reporting Engine Implementation Guide**

*Design decisions made July 14, 2026 following deliberation with the development team. The Reporting Engine is a pure consolidator and enricher — it never modifies source engine content. It enriches with CVSS scoring and AI narratives, assembles across multiple formats, and maintains a persistent finding tracker across campaign cycles with a 3-report retention policy. Implementation should begin with Phase 1 (consolidation pipeline + Markdown output) and proceed through CVSS enrichment, AI narratives, professional formatting, and compliance integration.*
