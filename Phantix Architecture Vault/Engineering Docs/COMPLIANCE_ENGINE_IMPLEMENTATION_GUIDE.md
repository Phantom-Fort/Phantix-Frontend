# Compliance Engine — Implementation Guide

**Version**: 1.0
**Date**: July 14, 2026
**Status**: Phase 1–3 core implemented (July 2026) — DB knowledge base live; Phase 4 connectors stubbed
**Audience**: Phantix Backend Engineers, Compliance Engineering Team
**Prerequisite Reading**: `Phantix Architecture Vault/09 - Compliance Engine.md`, `REPORTING_ENGINE_IMPLEMENTATION_GUIDE.md`

---

## Table of Contents

1. [Vision — Full Compliance Audit Platform](#1--vision--full-compliance-audit-platform)
2. [Architecture Overview](#2--architecture-overview)
3. [Migration: Python → Database-Driven Knowledge Base](#3--migration-python--database-driven-knowledge-base)
4. [Data Model](#4--data-model)
5. [Wazuh Integration (Dual Use)](#5--wazuh-integration-dual-use)
6. [Business Profiling Engine](#6--business-profiling-engine)
7. [Jurisdiction Engine](#7--jurisdiction-engine)
8. [Framework Recommendation Engine](#8--framework-recommendation-engine)
9. [Rule Engine & Rule Language](#9--rule-engine--rule-language)
10. [Evidence Collection](#10--evidence-collection)
11. [Control Mapping](#11--control-mapping)
12. [Compliance Risk Scoring](#12--compliance-risk-scoring)
13. [Remediation Engine](#13--remediation-engine)
14. [Engine Folder Structure](#14--engine-folder-structure)
15. [Implementation Phases](#15--implementation-phases)
16. [What Gets Deleted](#16--what-gets-deleted)

---

## 1. — Vision — Full Compliance Audit Platform

### What It Does Today

The current Compliance Engine takes findings from Risk and VAPT engines, runs them through three hardcoded Python mappers (NDPR, ISO 27001, SOC 2), and produces a mapping report. It is a **tagging layer**, not an audit platform.

### What It Should Do

```
                    Client Onboarding
                           │
                           ▼
             Business Profiling Engine
     (Industry, Country, Size, Regulations, Data Types)
                           │
                           ▼
              Jurisdiction Engine
     (Country + Industry + Data Types + Customer Regions)
                           │
                           ▼
           Framework Recommendation Engine
        "Based on your profile, these frameworks apply"
                           │
                           ▼
        ┌──────────────────────────────────────────────┐
        │           Evidence Collection                 │
        │                                              │
        │  ┌──────────┐ ┌────────┐ ┌────────────────┐ │
        │  │ Cloud    │ │ Agents │ │ Wazuh Connector │ │
        │  │ APIs     │ │ (endpt)│ │ (reads alerts   │ │
        │  │(AWS/GCP) │ │        │ │  with compliance│ │
        │  │          │ │        │ │  tags)          │ │
        │  └──────────┘ └────────┘ └────────────────┘ │
        │                                              │
        │  ┌──────────────────────────────────────┐    │
        │  │ Manual Upload (policies, screenshots) │    │
        │  └──────────────────────────────────────┘    │
        └──────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────────┐
        │      Compliance Rule Engine                   │
        │  (JSON rules evaluated against evidence)       │
        │  + Complex evaluators (Python callables)       │
        └──────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────────┐
        │        Control Mapping Engine                 │
        │   (M:N evidence → controls across             │
        │    frameworks via shared mappings)            │
        │   + Wazuh rule-to-control mappings as seed    │
        └──────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────────┐
        │      Compliance Risk Scoring                  │
        │  (Weighted by asset criticality,              │
        │   exposure, data sensitivity, exploitability) │
        └──────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────────┐
        │   Gap Analysis + Remediation                  │
        │   (What's missing + how to fix it)           │
        └──────────────────────────────────────────────┘
                           │
                           ▼
                 Reports + Dashboards
              (→ Reporting Engine)
```

### Key Architectural Shift

**Everything moves from Python code to database-driven seed data.** Frameworks, controls, rules, and mappings are stored as structured JSON in the platform DB. The Compliance Engine reads them at runtime. Adding a framework means inserting rows — not writing Python classes, not deploying code.

---

## 2. — Architecture Overview

### 2.1 Internal Sub-Engines

The Compliance Engine is organized into internal sub-modules, following the same pattern as VAPT Engine's `web_scanner/`, `correlation/`, and `analysis/` directories:

```
app/engines/compliance_engine/
    ├── api/                    # REST API routes
    ├── services/               # Business logic (profiling, jurisdiction, rules, scoring)
    ├── models/                 # SQLAlchemy models (NEW — currently empty stubs)
    ├── schemas/                # Pydantic schemas
    ├── adapters/               # Evidence collection connectors (Azure, AWS, GCP, Wazuh, agents)
    ├── evaluators/             # Custom Python callables for complex rules
    ├── seed/                   # Framework seed data (JSON files, loaded at bootstrap)
    │   └── wazuh_mappings/     # Mined mappings from Wazuh rule set
    ├── events/                 # Bus subscriptions (NEEDS implementation)
    ├── frameworks/             # ← DELETE (migrate to seed/)
    └── interfaces/             # ← DELETE (no longer needed)
```

### 2.2 Boundary Rule

> Compliance Engine maps evidence to controls; it does not own remediation execution. It recommends fixes, but actual remediation happens in the Risk Engine's treatment workflow or on the client's side.

### 2.3 MUST NOT List

```
Compliance Engine MUST NOT:
- Modify risk records or treatment statuses (Risk Engine)
- Execute scans against infrastructure (Scanner Engine)
- Send alerts directly (Alert Engine)
- Modify asset records (Asset Engine)
- Generate final reports (→ Reporting Engine)
- Store raw Wazuh alerts (Wazuh storage is its own; we only store normalized evidence)
```

---

## 3. — Migration: Python → Database-Driven Knowledge Base

### 3.1 The Problem

Currently, every framework is a Python class:

```python
class NdprFramework(FrameworkInterface):
    def map_finding(self, finding) -> list[dict]:
        if "encrypt" in blob:
            add("NDPR-2.3", "gap", "...")
```

To add a new framework, a developer must write a Python class, write keyword if-statements, submit a PR, and deploy. This is the opposite of a compliance knowledge base.

### 3.2 The Target

Frameworks, controls, and rules live in the platform DB. The Python classes are replaced with JSON seed data:

```json
// seed/frameworks/ndpr.json
{
  "framework_id": "ndpr",
  "name": "Nigeria Data Protection Regulation (NDPR)",
  "version": "1.0",
  "jurisdiction_triggers": {
    "country": "Nigeria"
  },
  "controls": [
    {
      "id": "NDPR-2.3",
      "title": "Encryption and confidentiality",
      "category": "security",
      "risk": "high"
    }
  ],
  "rules": [
    {
      "rule_id": "ndpr_tls_check",
      "control_id": "NDPR-2.3",
      "evidence_type": "tls_version",
      "operator": "gte",
      "value": "1.2",
      "severity": "high",
      "recommendation": "Upgrade TLS to 1.2 or higher"
    }
  ],
  "mappings": [
    {"control_id": "NDPR-2.3", "framework": "iso27001", "mapped_to": "A.8.24"},
    {"control_id": "NDPR-2.3", "framework": "soc2", "mapped_to": "CC6.6"}
  ]
}
```

### 3.3 Migration Steps

| Step | What |
|---|---|
| 1 | Create `compliance_frameworks`, `compliance_controls`, `compliance_rules`, `compliance_mappings` tables |
| 2 | Create `seed/frameworks/` directory with JSON files for NDPR, ISO 27001, SOC 2, PCI DSS, GDPR |
| 3 | Write a `seed_loader.py` that reads JSON files and inserts into DB (idempotent, version-tracked) |
| 4 | Write a `FrameworkRegistry` service that reads from DB instead of Python module imports |
| 5 | Delete Python framework classes and interface |
| 6 | Verify all existing API endpoints work against DB |
| 7 | **Staff admin upload** (implemented): `POST /api/v1/admin/compliance/frameworks` (+ file upload, list, activate/deactivate, seed reload) so ops can add frameworks without a deploy — see `docs/COMPLIANCE.md` |

---

## 4. — Data Model

### 4.1 Platform DB Tables

#### `compliance_frameworks`

```sql
CREATE TABLE compliance_frameworks (
    framework_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    description TEXT,
    jurisdiction_triggers JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    seed_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `compliance_controls`

```sql
CREATE TABLE compliance_controls (
    id BIGSERIAL PRIMARY KEY,
    framework_id VARCHAR(50) NOT NULL REFERENCES compliance_frameworks(framework_id),
    control_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    risk VARCHAR(20),
    sort_order INTEGER DEFAULT 0,
    UNIQUE (framework_id, control_id)
);
```

#### `compliance_rules`

```sql
CREATE TABLE compliance_rules (
    id BIGSERIAL PRIMARY KEY,
    rule_id VARCHAR(100) UNIQUE NOT NULL,
    control_id VARCHAR(50) NOT NULL,
    framework_id VARCHAR(50) NOT NULL REFERENCES compliance_frameworks(framework_id),
    evidence_type VARCHAR(100) NOT NULL,
    operator VARCHAR(20) NOT NULL,
    value JSONB NOT NULL,
    evaluator_key VARCHAR(100),
    severity VARCHAR(20) NOT NULL,
    recommendation TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (framework_id, control_id) REFERENCES compliance_controls(framework_id, control_id)
);

CREATE INDEX idx_rules_evidence_type ON compliance_rules (evidence_type);
```

#### `compliance_mappings`

```sql
CREATE TABLE compliance_mappings (
    id BIGSERIAL PRIMARY KEY,
    source_framework VARCHAR(50) NOT NULL REFERENCES compliance_frameworks(framework_id),
    source_control_id VARCHAR(50) NOT NULL,
    target_framework VARCHAR(50) NOT NULL REFERENCES compliance_frameworks(framework_id),
    target_control_id VARCHAR(50) NOT NULL,
    source VARCHAR(20) DEFAULT 'manual',
    -- 'manual', 'wazuh_mined', 'expert_reviewed'
    confidence DECIMAL(3,2) DEFAULT 1.0,
    UNIQUE (source_framework, source_control_id, target_framework, target_control_id)
);
```

#### `compliance_evidence`

Exists in the security schema DDL. Stores collected evidence per org.

```sql
-- Already exists. Columns: id, organization_id, evidence_type, value (JSONB),
-- source, source_ref, collected_at, expires_at, metadata (JSONB)
```

#### `compliance_assessments`

```sql
CREATE TABLE compliance_assessments (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    framework_id VARCHAR(50) NOT NULL REFERENCES compliance_frameworks(framework_id),
    status VARCHAR(30) NOT NULL DEFAULT 'in_progress',
    overall_score DECIMAL(5,2),
    gap_count INTEGER DEFAULT 0,
    pass_count INTEGER DEFAULT 0,
    total_controls INTEGER DEFAULT 0,
    assessment_start DATE,
    assessment_end DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `compliance_assessment_results`

```sql
CREATE TABLE compliance_assessment_results (
    id BIGSERIAL PRIMARY KEY,
    assessment_id BIGINT NOT NULL REFERENCES compliance_assessments(id),
    control_id VARCHAR(50) NOT NULL,
    framework_id VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    evidence_value JSONB,
    evidence_source VARCHAR(100),
    matched_rule_id VARCHAR(100),
    score_contribution DECIMAL(5,2),
    notes TEXT,
    evaluated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `business_profiles`

```sql
CREATE TABLE business_profiles (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id),
    country VARCHAR(100) NOT NULL,
    customer_countries TEXT[] DEFAULT '{}',
    industry VARCHAR(100),
    company_size VARCHAR(30),
    handles_personal_data BOOLEAN DEFAULT false,
    handles_health_records BOOLEAN DEFAULT false,
    handles_payment_cards BOOLEAN DEFAULT false,
    handles_government_contracts BOOLEAN DEFAULT false,
    handles_financial_transactions BOOLEAN DEFAULT false,
    cloud_providers TEXT[] DEFAULT '{}',
    has_public_apis BOOLEAN DEFAULT false,
    uses_ai BOOLEAN DEFAULT false,
    data_retention_period_days INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. — Wazuh Integration (Dual Use)

Wazuh serves two distinct purposes in the Compliance Engine. Both are implemented.

### 5.1 Use 1: Wazuh as an Evidence Connector

Wazuh agents deployed on client endpoints produce compliance-tagged alerts. The Phantix Wazuh connector pulls these alerts via the Wazuh REST API and normalizes them into the `compliance_evidence` table.

#### How Wazuh Compliance Tagging Works

Wazuh ships with 3,000+ rules. Each rule XML carries compliance `group` tags:

```xml
<!-- Wazuh rule example — simplified -->
<rule id="5710" level="5">
  <if_sid>5700</if_sid>
  <match>sudo: pam_unix</match>
  <description>sudo authentication failure</description>
  <group>authentication_failures,pci_dss_10.2.4,pci_dss_10.2.5,
         hipaa_164.312.b,gdpr_IV_35.7.d,nist_800_53_AU.6,
         tsc_CC7.1,iso27001_A.8.15</group>
</rule>
```

When this rule fires, the alert automatically carries all compliance tags. **One event simultaneously maps to 7 controls across 5 frameworks.** This is Wazuh's core compliance value.

#### Connector Implementation

```python
# app/engines/compliance_engine/adapters/wazuh/connector.py

class WazuhConnector(EvidenceConnector):
    """
    Pulls compliance-tagged alerts from Wazuh and normalizes to Phantix evidence.

    Connects to Wazuh REST API (or directly to Wazuh Indexer via OpenSearch API).
    Maps Wazuh rule group tags to our evidence_type format.
    """

    connector_id = "wazuh"

    # Mapping: Wazuh group tag prefix → our evidence_type
    WA_EVIDENCE_MAP = {
        "pci_dss_10.2.4": "authentication_failure",
        "pci_dss_10.2.5": "privileged_access",
        "hipaa_164.312.b": "audit_controls",
        "gdpr_IV_35.7.d": "security_breach_detection",
        "nist_800_53_AU.6": "audit_review",
        "tsc_CC7.1": "security_event_detection",
        "iso27001_A.8.15": "logging",
    }

    async def connect(self, config: dict):
        """Initialize Wazuh API client."""
        self.base_url = config["wazuh_url"]
        self.api_user = config["wazuh_user"]
        self.api_password = config["wazuh_password"]
        self.session = aiohttp.ClientSession()

    async def collect(
        self, org_id: int, config: dict
    ) -> list[dict]:
        """Pull recent Wazuh alerts with compliance tags and normalize to evidence."""
        alerts = await self._fetch_alerts(config.get("since_minutes", 60))
        evidence = []

        for alert in alerts:
            groups = alert.get("rule", {}).get("groups", [])
            compliance_tags = [g for g in groups if "_" in g and not g.startswith("[" )]

            # Map each compliance tag to our evidence_type
            for tag in compliance_tags:
                evidence_type = self._map_tag(tag)
                if not evidence_type:
                    continue

                evidence.append({
                    "evidence_type": evidence_type,
                    "value": {
                        "wazuh_rule_id": alert.get("rule", {}).get("id"),
                        "wazuh_rule_description": alert.get("rule", {}).get("description"),
                        "agent_name": alert.get("agent", {}).get("name"),
                        "agent_ip": alert.get("agent", {}).get("ip"),
                        "timestamp": alert.get("timestamp"),
                        "compliance_tags": compliance_tags,
                        "decoded": {
                            "data": alert.get("data", {}),
                            "full_log": alert.get("full_log", ""),
                        },
                    },
                    "source": "wazuh",
                    "source_ref": alert.get("id") or alert.get("_id"),
                    "collected_at": datetime.utcnow(),
                    "metadata": {
                        "wazuh_rule_id": alert.get("rule", {}).get("id"),
                        "wazuh_rule_level": alert.get("rule", {}).get("level"),
                        "agent_id": alert.get("agent", {}).get("id"),
                        "compliance_tags": compliance_tags,
                    },
                })

        return evidence

    async def test_connection(self, config: dict) -> bool:
        """Test Wazuh API availability."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{config['wazuh_url']}/security/user/authenticate",
                    auth=aiohttp.BasicAuth(config["wazuh_user"], config["wazuh_password"]),
                    timeout=10,
                ) as resp:
                    return resp.status == 200
        except Exception:
            return False

    def _map_tag(self, tag: str) -> str | None:
        """Map Wazuh compliance group tag to our evidence_type."""
        return self.WA_EVIDENCE_MAP.get(tag)

    async def _fetch_alerts(self, since_minutes: int) -> list[dict]:
        """Fetch alerts from Wazuh indexer (OpenSearch API)."""
        # Wazuh stores alerts in OpenSearch index wazuh-alerts-*
        index = f"wazuh-alerts-{datetime.utcnow().strftime('%Y.%m.%d')}"
        query = {
            "query": {
                "bool": {
                    "filter": [
                        {"range": {"@timestamp": {"gte": f"now-{since_minutes}m"}}},
                    ]
                }
            },
            "size": 1000,
        }
        async with self.session.post(
            f"{self.base_url}/elastic/{index}/_search",
            json=query,
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                hits = data.get("hits", {}).get("hits", [])
                return [h["_source"] for h in hits]
        return []

    async def close(self):
        await self.session.close()


class WazuhAgentDiscoveryConnector(EvidenceConnector):
    """
    Discovers Wazuh agents as compliance assets and maps them to Phantix assets.

    Every monitored Wazuh agent = an asset with:
      - OS type (Windows/Linux/macOS)
      - FIM status
      - CIS benchmark applied
      - Last report time
    """

    connector_id = "wazuh_agents"

    async def collect(
        self, org_id: int, config: dict
    ) -> list[dict]:
        """List all Wazuh agents and return as asset discovery evidence."""
        agents = await self._fetch_agents()
        evidence = []
        for agent in agents:
            evidence.append({
                "evidence_type": "wazuh_agent_status",
                "value": {
                    "agent_id": agent.get("id"),
                    "agent_name": agent.get("name"),
                    "os_name": agent.get("os", {}).get("name"),
                    "os_version": agent.get("os", {}).get("version"),
                    "status": agent.get("status"),
                    "last_keepalive": agent.get("lastKeepAlive"),
                    "ip": agent.get("ip"),
                    "fim_enabled": agent.get("fim_enabled", False),
                    "cis_applied": agent.get("cis_applied", []),
                },
                "source": "wazuh_agents",
                "collected_at": datetime.utcnow(),
            })
        return evidence
```

### 5.2 Use 2: Wazuh Rule Set as Seed Data for Mappings

Wazuh's rule set is an open-source goldmine of compliance mappings. Over 3,000 rules each reference the specific framework controls they satisfy. Mining these mappings populates our `compliance_mappings` and `compliance_rules` tables.

#### The Mining Script

```python
# scripts/mine_wazuh_mappings.py
#
# Run once: parses Wazuh rule XML, extracts compliance group tags,
# and produces seed JSON files for the Compliance Engine.
#
# Usage: python scripts/mine_wazuh_mappings.py --wazuh-ruleset /path/to/ruleset
#
# Output: seed/wazuh_mappings/mined_mappings.json

import os
import json
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

# Frameworks we care about
KNOWN_FRAMEWORKS = {
    "pci_dss": "PCI DSS", "hipaa": "HIPAA", "gdpr": "GDPR",
    "nist_800_53": "NIST SP 800-53", "tsc": "SOC 2 TSC",
    "iso27001": "ISO/IEC 27001", "gpg13": "GPG 13",
}

def mine_ruleset(ruleset_path: str) -> dict:
    """Walk Wazuh rule XML files and extract compliance mappings."""
    mappings = defaultdict(set)
    rule_count = 0

    for xml_file in Path(ruleset_path).rglob("*.xml"):
        tree = ET.parse(xml_file)
        root = tree.getroot()

        for rule in root.findall(".//rule"):
            groups = (rule.get("groups") or "").split(",")
            groups = [g.strip() for g in groups]

            # Extract compliance tags
            for group in groups:
                for fw_prefix, fw_name in KNOWN_FRAMEWORKS.items():
                    if group.startswith(fw_prefix):
                        # Extract control ID: "pci_dss_10.2.4" → "10.2.4"
                        control_id = group[len(fw_prefix) + 1:]
                        mappings[(fw_prefix, control_id)].add(group)
                        rule_count += 1

    # Convert to seed format
    seed = []
    for (fw_id, control_id), tags in sorted(mappings.items()):
        seed.append({
            "framework": fw_id,
            "control_id": control_id,
            "wazuh_group_tags": sorted(tags),
            "wazuh_rule_count": len(tags),
        })

    return {"mined_mappings": seed, "total_mappings": len(seed), "total_rules": rule_count}


def produce_seed_json(wazuh_ruleset: str, output_file: str):
    """Mine Wazuh rules and produce seed JSON for compliance_mappings table."""
    result = mine_ruleset(wazuh_ruleset)
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)
    print(f"Mined {result['total_mappings']} unique control mappings from {result['total_rules']} rule references")
    print(f"Written to {output_file}")
```

#### Sample Output

```json
// seed/wazuh_mappings/mined_mappings.json
{
  "mined_mappings": [
    {
      "framework": "pci_dss",
      "control_id": "10.2.4",
      "wazuh_group_tags": [
        "pci_dss_10.2.4"
      ],
      "wazuh_rule_count": 87
    },
    {
      "framework": "hipaa",
      "control_id": "164.312.b",
      "wazuh_group_tags": [
        "hipaa_164.312.b"
      ],
      "wazuh_rule_count": 145
    },
    {
      "framework": "iso27001",
      "control_id": "A.8.15",
      "wazuh_group_tags": [
        "iso27001_A.8.15"
      ],
      "wazuh_rule_count": 203
    }
  ],
  "total_mappings": 312,
  "total_rules": 14582
}
```

#### Loading Into Compliance Engine

```python
# app/engines/compliance_engine/seed/loaders/wazuh_mappings_loader.py

async def load_wazuh_mappings(db: AsyncSession, mappings_file: str):
    """Load mined Wazuh mappings into the compliance_mappings table.

    Idempotent — skips already-loaded mappings.
    Uses source='wazuh_mined' and confidence based on rule count.
    """
    with open(mappings_file) as f:
        data = json.load(f)

    loaded = 0
    for item in data["mined_mappings"]:
        fw_id = item["framework"]
        control_id = item["control_id"]
        rule_count = item["wazuh_rule_count"]

        # For each Wazuh mapping, cross-reference against our known frameworks
        # Wazuh's "pci_dss_10.2.4" → control "10.2.4" in our PCI DSS framework
        exists = await db.execute(
            select(compliance_controls).where(
                compliance_controls.framework_id == fw_id,
                compliance_controls.control_id == control_id,
            )
        )
        if not exists.scalar_one_or_none():
            continue  # skip if we don't have this control yet

        # Check if mapping already exists
        existing = await db.execute(
            select(compliance_mappings).where(
                compliance_mappings.source_framework == fw_id,
                compliance_mappings.source_control_id == control_id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        # Store with metadata about Wazuh coverage
        mapping = compliance_mappings(
            source_framework=fw_id,
            source_control_id=control_id,
            target_framework=fw_id,
            target_control_id=control_id,
            source="wazuh_mined",
            confidence=min(1.0, rule_count / 100),  # more rules = higher confidence
        )
        db.add(mapping)
        loaded += 1

    await db.commit()
    return loaded
```

### 5.3 Wazuth Seed Data Flow

```
1. Run: python scripts/mine_wazuh_mappings.py
   └── Parses Wazuh rule XML (3,000+ rules)
   └── Extracts compliance group tags per rule
   └── Groups by (framework, control_id)
   └── Outputs: seed/wazuh_mappings/mined_mappings.json

2. Compliance Engine startup:
   └── seed_loader.py runs load_wazuh_mappings()
   └── Cross-references Wazuh mappings against our framework controls
   └── Inserts new mappings with source='wazuh_mined'
   └── Skips duplicates (idempotent)

3. At assessment time:
   └── control_mapper.py queries compliance_mappings
   └── Finds controls that share evidence via Wazuh mappings
   └── One piece of evidence satisfies multiple controls
```

---

## 6. — Business Profiling Engine

Collect structured information about each organization that determines which compliance frameworks apply.

```python
# app/engines/compliance_engine/services/business_profiler.py

class BusinessProfiler:
    async def get_or_create_profile(self, db, org_id: int) -> dict:
        ...

    async def update_profile(self, db, org_id: int, data: dict) -> dict:
        profile = await self._upsert(db, org_id, data)
        from app.engines.compliance_engine.services.jurisdiction import JurisdictionEngine
        engine = JurisdictionEngine()
        recommended = engine.determine_frameworks(profile)
        return {"profile": profile, "recommended_frameworks": recommended}

    def onboarding_questions(self) -> list[dict]:
        return [
            {
                "section": "Jurisdiction",
                "questions": [
                    {"id": "country", "type": "select", "label": "Country of operation",
                     "options": ["Nigeria", "Germany", "United States", ...]},
                    {"id": "customer_countries", "type": "multi_select",
                     "label": "Countries where customers reside"},
                ],
            },
            {
                "section": "Business Profile",
                "questions": [
                    {"id": "industry", "type": "select",
                     "options": ["Healthcare", "Finance", "Technology", ...]},
                    {"id": "company_size", "type": "select",
                     "options": ["startup", "sme", "mid_market", "enterprise"]},
                ],
            },
            {
                "section": "Data Handling",
                "questions": [
                    {"id": "handles_personal_data", "type": "boolean"},
                    {"id": "handles_health_records", "type": "boolean"},
                    {"id": "handles_payment_cards", "type": "boolean"},
                ],
            },
            {
                "section": "Infrastructure",
                "questions": [
                    {"id": "cloud_providers", "type": "multi_select",
                     "options": ["AWS", "Azure", "GCP", "On-premise"]},
                    {"id": "has_public_apis", "type": "boolean"},
                    {"id": "uses_wazuh", "type": "boolean",
                     "label": "Do you use Wazuh for endpoint monitoring?"},
                ],
            },
        ]
```

---

## 7. — Jurisdiction Engine

Determine applicable frameworks via multi-factor matrix: country + industry + data types + customer regions + infrastructure.

```python
# app/engines/compliance_engine/services/jurisdiction.py

JURISDICTION_MATRIX = [
    # County-based
    {"country": "Nigeria", "frameworks": ["ndpr"]},
    {"country": "Nigeria", "industry": "Finance", "frameworks": ["pci_dss"]},
    {"country": "Nigeria", "customer_regions": ["EU", "Europe"], "frameworks": ["gdpr"]},
    {"country": "Germany", "frameworks": ["gdpr"]},
    {"country": "Germany", "frameworks": ["iso27001"], "recommended": True},
    {"country": "United States", "handles_health_records": True, "frameworks": ["hipaa"]},
    {"country": "United States", "handles_payment_cards": True, "frameworks": ["pci_dss"]},
    {"country": "United States", "state": "California", "frameworks": ["ccpa"]},
    {"country": "United States", "industry": "Finance", "frameworks": ["sox", "glba"]},

    # Data-type-based (any country)
    {"handles_payment_cards": True, "frameworks": ["pci_dss"]},
    {"uses_ai": True, "frameworks": ["iso42001"], "recommended": True},
    {"has_public_apis": True, "frameworks": ["owasp_api_security"], "recommended": True},
    {"uses_wazuh": True, "frameworks": [], "recommended_note": "Wazuh evidence connector available"},
]


class JurisdictionEngine:
    async def determine_frameworks(self, profile: dict) -> dict:
        required = set()
        recommended = set()
        for rule in JURISDICTION_MATRIX:
            if self._matches(rule, profile):
                fws = rule.get("frameworks", [])
                if rule.get("recommended"):
                    recommended.update(fws)
                else:
                    required.update(fws)
        return {
            "required": sorted(required),
            "recommended": sorted(recommended | {"nist_csf", "cis_controls"}),
            "all": sorted(required | recommended | {"nist_csf", "cis_controls"}),
        }

    def _matches(self, rule: dict, profile: dict) -> bool:
        for key, expected in rule.items():
            if key in ("frameworks", "recommended", "recommended_note"):
                continue
            actual = profile.get(key)
            if isinstance(expected, list):
                if isinstance(actual, list):
                    if not any(a in expected for a in actual):
                        return False
                elif actual not in expected:
                    return False
            elif isinstance(expected, bool):
                if not actual:
                    return False
            elif isinstance(expected, str):
                if str(actual or "").lower() != expected.lower():
                    return False
        return True
```

---

## 8. — Rule Engine & Rule Language

### 8.1 Rule Language

Rules stored as JSON in `compliance_rules` table:

```json
{
  "rule_id": "pci_tls_check",
  "control_id": "PCI-4.1",
  "framework_id": "pci_dss",
  "evidence_type": "tls_version",
  "operator": "gte",
  "value": "1.2",
  "severity": "critical",
  "recommendation": "Upgrade TLS to 1.2 or higher"
}
```

| Operator | Meaning | Example Value |
|---|---|---|
| `equals` | Exact match | `true`, `"AES-256"` |
| `not_equals` | Not match | `false` |
| `gte` | >= (numeric or version) | `1.2`, `12` |
| `lte` | <= | `90` |
| `gt` | > | `8` |
| `contains` | String contains | `"AES"` |
| `in` | Value in list | `["AES-256", "AES-128"]` |
| `between` | Range inclusive | `[8, 64]` |
| `exists` | Evidence exists | `true` |
| `not_exists` | No evidence | `true` |
| `custom` | Python callable | (evaluator_key) |

### 8.2 Rule Evaluator

```python
# app/engines/compliance_engine/services/rule_evaluator.py

class RuleEvaluator:
    OPERATORS = {
        "equals": lambda v, e: v == e,
        "not_equals": lambda v, e: v != e,
        "gte": lambda v, e: self._compare(v, e) >= 0,
        "lte": lambda v, e: self._compare(v, e) <= 0,
        "contains": lambda v, e: e in str(v) if isinstance(e, str) else str(e) in str(v),
        "in": lambda v, e: v in e,
        "between": lambda v, e: e[0] <= v <= e[1],
        "exists": lambda v, e: v is not None,
        "not_exists": lambda v, e: v is None,
    }

    def __init__(self):
        self._custom_evaluators: dict[str, Callable] = {}

    def register_custom(self, key: str, func: Callable):
        self._custom_evaluators[key] = func

    async def evaluate(self, rule: dict, evidence_value: Any) -> dict:
        operator = rule["operator"]
        expected = rule["value"]

        if operator == "custom":
            func = self._custom_evaluators.get(rule.get("evaluator_key", ""))
            if not func:
                return {"status": "error", "detail": f"No evaluator: {rule.get('evaluator_key')}"}
            return await func(evidence_value, rule)

        op_func = self.OPERATORS.get(operator)
        if not op_func:
            return {"status": "error", "detail": f"Unknown operator: {operator}"}

        try:
            passed = op_func(evidence_value, expected)
            return {"status": "pass" if passed else "fail",
                    "detail": f"{evidence_value} {operator} {expected}"}
        except Exception as exc:
            return {"status": "error", "detail": str(exc)}

    def _compare(self, a, b):
        """Compare with version-aware string comparison."""
        if isinstance(a, str) and isinstance(b, str):
            # Try version comparison
            a_parts = a.replace("v", "").split(".")
            b_parts = b.replace("v", "").split(".")
            try:
                for ap, bp in zip(a_parts, b_parts):
                    if int(ap) != int(bp):
                        return int(ap) - int(bp)
                return len(a_parts) - len(b_parts)
            except ValueError:
                return (a > b) - (a < b)
        return (a > b) - (a < b)
```

### 8.3 Custom Evaluators

For complex rules: e.g., password policy must meet multiple criteria simultaneously.

```python
# app/engines/compliance_engine/evaluators/password_policy.py

async def evaluate_password_policy(evidence: dict, rule: dict) -> dict:
    min_length = evidence.get("min_length", 0)
    requires_mfa = evidence.get("mfa_enabled", False)
    requires_special = evidence.get("requires_special_char", False)
    failures = []
    if min_length < 12:
        failures.append(f"Min length {min_length} < 12")
    if not requires_mfa:
        failures.append("MFA not required")
    if not requires_special:
        failures.append("No special character requirement")
    return {
        "status": "pass" if not failures else "fail",
        "detail": "; ".join(failures) if failures else "All requirements met",
    }
```

---

## 9. — Evidence Collection

### 9.1 Evidence Types

```python
EVIDENCE_TYPES = {
    "tls_version": {"source": "cloud/agent/wazuh"},
    "mfa_enabled": {"source": "cloud/api"},
    "password_min_length": {"source": "agent/wazuh"},
    "antivirus_status": {"source": "agent/wazuh"},
    "disk_encryption": {"source": "agent/wazuh"},
    "authentication_failure": {"source": "wazuh"},
    "privileged_access": {"source": "wazuh"},
    "audit_controls": {"source": "wazuh"},
    "security_event_detection": {"source": "wazuh"},
    "wazuh_agent_status": {"source": "wazuh_agents"},
    "iam_mfa_enforced": {"source": "cloud"},
    "s3_public_access": {"source": "cloud"},
    "security_policy_uploaded": {"source": "manual"},
}
```

### 9.2 Connector Architecture

```
app/engines/compliance_engine/adapters/
    __init__.py
    connector_base.py            # EvidenceConnector ABC
    wazuh/
        __init__.py
        connector.py             # Pull Wazuh alerts + agent discovery
    azure/
        __init__.py
        graph_client.py          # Microsoft Graph API
    aws/
        __init__.py
        iam_client.py            # AWS IAM evidence
        s3_client.py             # S3 bucket audit
    manual/
        __init__.py
        upload_handler.py        # Manual policy/procedure upload
```

### 9.3 Evidence Storage

All written to `compliance_evidence` table in org's security DB via `store_evidence()`.

---

## 10. — Control Mapping

Evidence is expensive to collect. One piece of evidence satisfies multiple controls. The `compliance_mappings` table makes this possible, seeded both by expert curation and by Wazuh rule mining.

```python
# app/engines/compliance_engine/services/control_mapper.py

class ControlMapper:
    async def evaluate_all(
        self, db, org_id: int, framework_id: str | None = None
    ) -> list[dict]:
        evidence = await self._get_evidence(db, org_id)
        rules = await self._get_rules(db, framework_id)
        results = []
        for rule in rules:
            val = evidence.get(rule["evidence_type"])
            result = await rule_evaluator.evaluate(rule, val)
            results.append({
                "rule_id": rule["rule_id"],
                "control_id": rule["control_id"],
                "framework_id": rule["framework_id"],
                "status": result["status"],
                "evidence_value": val,
            })
        return results

    async def get_shared_evidence_summary(self, db, org_id: int) -> dict:
        """Show which evidence types satisfy the most controls.
        Useful for prioritizing which connectors to deploy."""
        ...
```

---

## 11. — Compliance Risk Scoring

Each failed control contributes to the overall compliance score based on weighted factors:

| Factor | Weight |
|---|---|
| Control risk level | 40% |
| Asset criticality | 25% |
| Internet exposure | 15% |
| Data sensitivity | 20% |
| Exploitability | Bonus (-20 for known CVE) |

```python
# app/engines/compliance_engine/services/risk_scorer.py

class ComplianceRiskScorer:
    CONTROL_RISK = {"critical": 4, "high": 3, "medium": 2, "low": 1}

    async def score_assessment(self, assessment_id: int) -> dict:
        results = await self._get_results(assessment_id)
        total_weight = 0
        weighted_score = 0
        for result in results:
            if result["status"] == "pass":
                score = 100
            elif result["status"] == "fail":
                score = 0
            elif result["status"] == "not_applicable":
                continue
            else:
                score = 50
            weight = self.CONTROL_RISK.get(result.get("risk", "medium"), 2) * 5
            total_weight += weight
            weighted_score += score * weight
        overall = round(weighted_score / total_weight, 2) if total_weight > 0 else 0
        return {
            "score": overall,
            "level": "compliant" if overall >= 90 else "partial" if overall >= 70
                     else "at_risk" if overall >= 40 else "non_compliant",
            "passed": sum(1 for r in results if r["status"] == "pass"),
            "failed": sum(1 for r in results if r["status"] == "fail"),
        }
```

---

## 12. — Remediation Engine

Generate actionable remediation guidance for failed controls.

```python
# app/engines/compliance_engine/services/remediation.py

class RemediationEngine:
    REMEDIATION_LIBRARY = {
        "tls_version": "Upgrade TLS to 1.2+. Disable TLS 1.0 and 1.1.",
        "mfa_enabled": "Enable MFA for all users. Prioritize admin accounts.",
        "encryption_at_rest": "Enable AES-256 encryption at rest.",
        "authentication_failure": "Review auth logs in Wazuh. Configure alerting for brute force patterns.",
        "wazuh_agent_status": "Agent not reporting. Check agent connectivity or reinstall.",
    }

    async def get_recommendations(self, failed_controls: list[dict]) -> list[dict]:
        recommendations = []
        for fc in failed_controls:
            rule = fc.get("matched_rule", {})
            evidence_type = rule.get("evidence_type", "")
            rec = self.REMEDIATION_LIBRARY.get(
                evidence_type,
                f"Review control {fc['control_id']} manually.",
            )
            recommendations.append({
                "control_id": fc["control_id"],
                "framework_id": fc["framework_id"],
                "evidence_type": evidence_type,
                "recommendation": rec,
                "severity": rule.get("severity", "medium"),
            })
        return recommendations
```

---

## 13. — Engine Folder Structure

```
app/engines/compliance_engine/
    __init__.py
    manifest.py

    api/
        __init__.py
        routes.py                     # Route mounting
        compliance.py                 # Existing mapping/gap endpoints
        profile.py                    # NEW: business profile CRUD
        assessments.py                # NEW: assessment CRUD
        evidence.py                   # NEW: evidence collection endpoints

    services/
        __init__.py
        mapping_service.py            # REWRITE: DB-driven framework registry
        report_sections.py            # KEEP: feeds Reporting Engine
        business_profiler.py          # NEW
        jurisdiction.py               # NEW
        recommender.py                # NEW
        rule_evaluator.py             # NEW
        control_mapper.py             # NEW
        risk_scorer.py                # NEW
        remediation.py                # NEW
        seed_loader.py                # NEW: loads JSON seed data
        knowledge_base.py             # NEW: framework/control/rule CRUD

    models/
        __init__.py
        framework.py, control.py, rule.py, evidence.py,
        mapping.py, profile.py, assessment.py, result.py

    schemas/
        __init__.py
        compliance.py                 # KEEP
        profile.py, assessment.py

    adapters/
        __init__.py
        connector_base.py             # NEW: EvidenceConnector ABC
        wazuh/
            __init__.py
            connector.py              # NEW: Wazuh evidence + agent discovery
        azure/
        aws/
        manual/

    evaluators/
        __init__.py
        password_policy.py
        tls_version.py

    seed/
        frameworks/
            ndpr.json                 # Migrated from Python
            iso27001.json
            soc2.json
            pci_dss.json              # NEW
            gdpr.json                 # NEW
        wazuh_mappings/
            mined_mappings.json       # NEW: from Wazuh rule mining

    events/
        __init__.py
        catalog.py                    # KEEP
        subscribers.py                # IMPLEMENT: process events

    workers/, tasks/                  # IMPLEMENT: Celery integration
```

### Files to Delete

```
DELETE frameworks/ndpr.py, iso27001.py, soc2.py, __init__.py
DELETE interfaces/framework.py, interfaces/__init__.py
```

### Files to Keep (with updates)

| File | Update |
|---|---|
| `services/mapping_service.py` | Rewrite to read from DB |
| `services/report_sections.py` | Minor: use DB registry |
| `schemas/compliance.py` | Keep + add new schemas |
| `api/compliance.py` | Keep + add new routes |
| `events/catalog.py` | Keep |

---

## 14. — Implementation Phases

### Phase 1: Knowledge Base Migration + Wazuh Mappings

| Step | Effort |
|---|---|
| Create compliance_* DB tables (Alembic) | 1 day |
| Write `seed_loader.py` + FrameworkRegistry | 1 day |
| Create `seed/frameworks/` JSON files (NDPR, ISO, SOC2, PCI DSS, GDPR) | 3 days |
| Run Wazuh mining script against Wazuh rule set | 1 day |
| Write `load_wazuh_mappings()` | 0.5 day |
| Rewrite `mapping_service.py` to read from DB | 1 day |
| Delete old Python framework classes | 0.5 day |
| Verify existing API endpoints work against DB | 0.5 day |

**Milestone**: `GET /frameworks`, `POST /map`, `GET /gaps` work against DB-driven framework data. Wazuh mappings are loaded as seed data.

### Phase 2: Business Profiling + Jurisdiction

| Step | Effort |
|---|---|
| `business_profiles` table + model | 1 day |
| `business_profiler.py` + onboarding questions | 2 days |
| `jurisdiction.py` + multi-factor matrix | 2 days |
| `recommender.py` + accept/reject workflows | 1 day |
| Profile API routes | 1 day |

**Milestone**: New org completes onboarding → platform recommends applicable frameworks.

### Phase 3: Rule Engine + Assessments

| Step | Effort |
|---|---|
| `compliance_rules` table + seed rules | 2 days |
| `rule_evaluator.py` + all operators | 3 days |
| Custom evaluators (password, TLS) | 1 day |
| `compliance_assessments` + `_results` tables | 1 day |
| `control_mapper.py` + cross-framework mapping | 2 days |
| `risk_scorer.py` + weighted scoring | 2 days |
| Event subscribers (process FindingCreated, RiskUpdated) | 1 day |
| Assessment API routes | 2 days |

**Milestone**: Automated compliance assessment runs against collected evidence.

### Phase 4: Evidence Collection + Remediation

| Step | Effort |
|---|---|
| `EvidenceConnector` ABC + Wazuh connector | 2 days |
| Wazuh agent discovery connector | 2 days |
| Azure AD connector | 3 days |
| AWS IAM + S3 connectors | 3 days |
| Manual upload handler | 1 day |
| `remediation.py` | 1 day |
| Celery workers/tasks for scheduled collection | 2 days |

**Milestone**: Evidence is collected automatically via Wazuh + cloud connectors → rules evaluated → compliance score produced → recommendations generated.

---

## 15. — What Gets Deleted

### Removed

```
app/engines/compliance_engine/frameworks/ndpr.py
app/engines/compliance_engine/frameworks/iso27001.py
app/engines/compliance_engine/frameworks/soc2.py
app/engines/compliance_engine/frameworks/__init__.py
app/engines/compliance_engine/interfaces/framework.py
app/engines/compliance_engine/interfaces/__init__.py
```

### Rewritten

```
REWRITE app/engines/compliance_engine/services/mapping_service.py  → DB-driven
```

### Added (~25 new files)

```
NEW models/ (8 files), services/ (7 files), schemas/ (2 files)
NEW adapters/wazuh/connector.py
NEW evaluators/ (3+ files)
NEW seed/frameworks/ (5 JSON files)
NEW seed/wazuh_mappings/mined_mappings.json
NEW events/subscribers.py
NEW workers/, tasks/ files
```

---

**End of Compliance Engine Implementation Guide**

*This document reorganizes the Compliance Engine from a Python-class-driven finding mapper to a full database-driven compliance audit platform. Wazuh serves dual purposes: as an evidence connector (pulling compliance-tagged alerts from client endpoints) and as a seed data source (mining Wazuh's 3,000+ rules for compliance control mappings). Phase 1 (Knowledge Base Migration + Wazuh Mappings) is the critical foundation.*

---

## Implementation status (July 2026)

Phase 1–3 foundation is in the codebase:

- Platform tables + Alembic `n4b5c6d7e8f9`
- Seed JSON under `app/engines/compliance_engine/seed/`
- DB-driven `mapping_service` / `knowledge_base` / `seed_loader`
- Python framework classes **deleted**
- Profiling, jurisdiction, recommender, assessments, rule evaluator
- Reporting Engine consumes DB-backed compliance sections
- Wazuh: seed mappings loaded; live connector stubbed (Phase 4)
