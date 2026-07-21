# Security Engineer Guide — AI Training, VAPT Procedures & Correlation Rules

**Version**: 1.0
**Date**: July 14, 2026
**Status**: Living Document
**Audience**: Phantix Security Engineers (not software developers)
**Prerequisite Reading**: `VAPT_ENGINE_IMPLEMENTATION_GUIDE.md`, `COMPLIANCE_ENGINE_IMPLEMENTATION_GUIDE.md`, `AI_ENGINE_IMPLEMENTATION_GUIDE.md`

---

## Table of Contents

1. [Your Role in the Platform](#1--your-role-in-the-platform)
2. [VAPT Procedures — Defining Scan Campaigns](#2--vapt-procedures--defining-scan-campaigns)
3. [Correlation Rules — Finding Attack Paths](#3--correlation-rules--finding-attack-paths)
4. [Compliance Framework Rules](#4--compliance-framework-rules)
5. [AI Training — Prompts & Evidence Patterns](#5--ai-training--prompts--evidence-patterns)
6. [AI Consensus Thresholds](#6--ai-consensus-thresholds)
7. [Compliance Knowledge Base — Frameworks & Controls](#7--compliance-knowledge-base--frameworks--controls)
8. [Testing Your Changes](#8--testing-your-changes)
9. [Glossary](#9--glossary)

---

## 1. — Your Role in the Platform

### 1.1 What You Control Without Writing Code

As a security engineer, you can modify the following without deploying new code:

| What | Where | How |
|---|---|---|
| Scan procedures | `POST /api/v1/admin/vapt/procedures` | JSON payload — define which tools run in what order |
| Correlation rules | `POST /api/v1/admin/vapt/correlation-rules` | JSON payload — define attack path detection logic |
| Compliance framework rules | JSON seed files → DB at bootstrap | Edit JSON in `seed/frameworks/` |
| AI prompts | `POST /api/v1/admin/ai/prompts` | Define how the AI explains findings |
| AI consensus thresholds | `PUT /api/v1/admin/ai/settings` | Adjust confidence thresholds per org |
| Business profiling triggers | `PUT /api/v1/compliance/profile` | Define jurisdiction rules for framework detection |

### 1.2 What Requires a Developer

| What | Why |
|---|---|
| New scanner tool integration | Requires implementing `ScannerInterface` in Python |
| New Docker image for scanning | Requires adding to Docker Compose + CI pipeline |
| Custom Python rule evaluators | For compliance rules too complex for JSON operators |
| RAG / vector search infrastructure | Requires developer setup of pgvector |

---

## 2. — VAPT Procedures — Defining Scan Campaigns

### 2.1 What Is a Procedure?

A procedure is a **sequence of steps** that a VAPT campaign executes. Each step is a phase of the assessment: scan types, correlation, analysis, approval gates.

### 2.2 Procedure Anatomy

```json
{
  "procedure_key": "web_app_pentest",
  "display_name": "Web Application Penetration Test",
  "description": "Full web app assessment with OWASP Top 10 + SQLi + crawler",
  "steps": [
    {
      "step_type": "scan",
      "step_name": "Subdomain Discovery",
      "config": {
        "tools": ["web"],
        "include_subdomains": true,
        "run_discovery": true,
        "nuclei_templates": ["owasp-top-10", "cves", "exposures"]
      }
    },
    {
      "step_type": "correlate",
      "step_name": "Cross-Scan Analysis",
      "config": {
        "rule_ids": ["default_attack_path", "api_auth_bypass", "pivot_risk"]
      }
    },
    {
      "step_type": "wait_for_approval",
      "step_name": "Authorize Exploitation",
      "config": {
        "requires_authorizer": true,
        "timeout_hours": 48
      }
    },
    {
      "step_type": "analyze",
      "step_name": "AI Complexity Analysis",
      "config": {
        "ai_threshold": "high"
      }
    }
  ]
}
```

### 2.3 Step Types

| Step Type | What It Does | When To Use |
|---|---|---|
| `scan` | Runs one or more tools against targets | Infrastructure discovery, web scanning, API testing |
| `web_scan` | Runs the full web scanner pipeline (subfinder → httpx → katana → nuclei → sqlmap → gowitness) | Web application assessments |
| `correlate` | Runs correlation rules across findings from previous steps | After scans complete, to find attack paths |
| `analyze` | Runs the complexity classifier (optionally triggers AI) | After correlation, to decide if AI analysis is needed |
| `wait_for_approval` | Pauses campaign until an authorizer approves | Before destructive testing, exploitation, or production-impacting scans |

### 2.4 Step Configuration Reference

#### Scan Step — General Tool Execution

```json
{
  "step_type": "scan",
  "step_name": "Port Scan",
  "config": {
    "tools": ["nmap"],
    "target_types": ["ip_address", "domain"],
    "ports": "top-1000",
    "nmap_flags": ["-sT", "-sV", "-T4", "--open"]
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `tools` | string[] | — | Tool(s) to run: `nmap`, `nuclei`, `web`, or combination |
| `target_types` | string[] | `["domain"]` | Asset types to scan: `domain`, `ip_address`, `api`, `port_service`, `subdomain` |
| `ports` | string | `"top-1000"` | Port specification for nmap |
| `nmap_flags` | string[] | `["-sT","-sV","-T4","--open"]` | Admin-allowed nmap flags |
| `nuclei_templates` | string[] | `["cves","exposures"]` | Nuclei template categories |

#### Web Scan Step — Full Web Application Assessment

```json
{
  "step_type": "web_scan",
  "step_name": "Web Application Scan",
  "config": {
    "tools": ["web"],
    "include_subdomains": true,
    "run_discovery": true,
    "run_sqli": true,
    "run_screenshots": true,
    "nuclei_templates": ["owasp-top-10", "cves", "exposures", "misconfigurations"],
    "severity_filter": "critical,high,medium",
    "max_pages_to_crawl": 200,
    "ai_auth_enabled": false,
    "flowmapper_enabled": false,
    "ml_classifier_enabled": false
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `run_discovery` | bool | `true` | Run subfinder + httpx to discover subdomains and live hosts |
| `run_sqli` | bool | `true` | Run sqlmap against parameterized endpoints |
| `run_screenshots` | bool | `false` | Capture screenshots of discovered web apps |
| `ai_auth_enabled` | bool | `false` | Use AI-assisted login detection (extra cost) |
| `flowmapper_enabled` | bool | `false` | Use AI-guided crawling instead of standard spider (extra cost) |
| `ml_classifier_enabled` | bool | `false` | Filter soft-404s via ML (extra cost) |

#### Correlate Step

```json
{
  "step_type": "correlate",
  "step_name": "Attack Path Analysis",
  "config": {
    "rule_ids": ["default_attack_path", "api_auth_bypass", "pivot_risk", "ssh_brute_force_path"]
  }
}
```

#### Wait for Approval Step

```json
{
  "step_type": "wait_for_approval",
  "step_name": "Authorize Exploitation Phase",
  "config": {
    "requires_authorizer": true,
    "timeout_hours": 72,
    "message": "This step will run exploitation tools against production systems."
  }
}
```

### 2.5 How to Add a Procedure via Admin API

```http
POST /api/v1/admin/vapt/procedures
Authorization: Bearer <staff_jwt>
Content-Type: application/json

{
  "procedure_key": "quick_web_check",
  "display_name": "Quick Web Check",
  "description": "Fast web assessment — no SQLi, no screenshots.",
  "steps": [
    {
      "step_type": "web_scan",
      "step_name": "Quick Web Scan",
      "config": {
        "tools": ["web"],
        "run_discovery": true,
        "run_sqli": false,
        "run_screenshots": false,
        "nuclei_templates": ["owasp-top-10", "cves"]
      }
    },
    {
      "step_type": "correlate",
      "step_name": "Quick Correlation",
      "config": {
        "rule_ids": ["default_attack_path", "api_auth_bypass"]
      }
    }
  ],
  "source": "override"
}
```

### 2.6 Built-in Procedures Reference

These ship with the platform and cannot be deleted (but can be overridden):

| Procedure Key | Description | Steps |
|---|---|---|
| `infra_scan` | Port/service discovery + vulnerability detection + network attack paths | 3 steps |
| `api_scan` | API-focused assessment using Nuclei + Burp | 3 steps |
| `full_vapt` | Complete VAPT: infra + web + correlation + analysis + human review | 5 steps |
| `web_app_scan_only` | Web application focused scan with discovery, SQLi, screenshots | 3 steps |

---

## 3. — Correlation Rules — Finding Attack Paths

### 3.1 What Is a Correlation Rule?

A correlation rule defines a **pattern of findings** that, when combined, indicate an attack path or security concern that no single finding would reveal.

### 3.2 Rule Anatomy

```json
{
  "rule_key": "ssh_brute_force_path",
  "display_name": "SSH Brute-Force Attack Path",
  "description": "Open SSH port without rate-limiting or MFA",
  "category": "attack_path",
  "conditions": {
    "requires": [
      {"finding_type": "open_port", "port": 22},
      {"finding_type": "exposed_service", "service": "ssh"},
      {"finding_type": "missing_brute_force_protection"}
    ],
    "relationship": "AND",
    "scope": "same_asset"
  },
  "conclusion_type": "attack_path",
  "conclusion_template": "Asset has open SSH (port 22) exposed without brute-force protection. Attackers can attempt credential stuffing or dictionary attacks against this service.",
  "severity_override": "high",
  "source": "builtin"
}
```

### 3.3 Conditions Reference

#### Finding Conditions

| Field | Type | Description | Example |
|---|---|---|---|
| `finding_type` | string (required) | Type of finding to match | `"open_port"`, `"exposed_service"`, `"missing_authentication"` |
| `port` | integer (optional) | Match specific port | `22`, `443`, `3306` |
| `port_not_in` | integer[] (optional) | Exclude specific ports | `[22, 80, 443]` |
| `service` | string (optional) | Match specific service | `"ssh"`, `"http"`, `"mysql"` |
| `service_is_not` | string (optional) | Exclude specific service | `"http"`, `"https"` |
| `severity` | string (optional) | Match finding severity | `"critical"`, `"high"` |

#### Rule Conditions

| Field | Type | Default | Description |
|---|---|---|---|
| `relationship` | string | `"AND"` | How conditions are combined: `AND` (all must match) or `OR` (any must match) |
| `scope` | string | `"same_asset"` | Where conditions must match: `same_asset` or `cross_asset` |

### 3.4 Writing Effective Correlation Rules

#### Rule 1: Simple Attack Path (same asset, two conditions)

```json
{
  "rule_key": "exposed_database",
  "display_name": "Database Directly Exposed to Internet",
  "category": "attack_path",
  "conditions": {
    "requires": [
      {"finding_type": "open_port", "port_not_in": [22, 80, 443, 8080, 8443]},
      {"finding_type": "exposed_service", "service_is_not": ["http", "https", "ssh"]}
    ],
    "relationship": "AND",
    "scope": "same_asset"
  },
  "conclusion_template": "Asset exposes a non-standard service ({service_name}) on port {port}. This may be a database, admin panel, or internal service inadvertently exposed.",
  "severity_override": "high"
}
```

#### Rule 2: Cross-Asset Attack Path (pivot risk)

```json
{
  "rule_key": "pivot_to_internal",
  "display_name": "Pivot Risk — Compromised Host to Internal Network",
  "category": "attack_path",
  "conditions": {
    "requires": [
      {"finding_type": "critical_vulnerability", "severity": "critical"},
      {"finding_type": "dual_homed_host"}
    ],
    "relationship": "AND",
    "scope": "same_asset"
  },
  "conclusion_template": "Asset has a critical vulnerability AND is dual-homed (connected to external and internal networks). Compromise gives attacker a bridgehead to internal resources.",
  "severity_override": "critical"
}
```

#### Rule 3: Evidence Correlation (no attack path, data correlation)

```json
{
  "rule_key": "multiple_ports_common_service",
  "display_name": "Multiple Instances of Same Service",
  "category": "evidence_correlation",
  "conditions": {
    "requires": [
      {"finding_type": "open_port", "service": "http"},
      {"finding_type": "open_port", "service": "https"}
    ],
    "relationship": "AND",
    "scope": "same_asset"
  },
  "conclusion_template": "Asset is running both HTTP (80) and HTTPS (443). Verify HTTPS configuration covers all sensitive endpoints.",
  "severity_override": "medium"
}
```

### 3.5 Adding a Correlation Rule via Admin API

```http
POST /api/v1/admin/vapt/correlation-rules
Authorization: Bearer <staff_jwt>
Content-Type: application/json

{
  "rule_key": "exposed_admin_panel",
  "display_name": "Exposed Admin Panel",
  "category": "attack_path",
  "conditions": {
    "requires": [
      {"finding_type": "open_port", "port_in": [8080, 8443, 9090, 9443]},
      {"finding_type": "exposed_service", "service_is_not": ["http", "https"]}
    ],
    "relationship": "OR",
    "scope": "same_asset"
  },
  "conclusion_template": "Non-standard admin port ({port}) exposed. Common admin panels run on these ports and may lack proper authentication.",
  "severity_override": "critical",
  "source": "custom"
}
```

---

## 4. — Compliance Framework Rules

### 4.1 How Framework Rules Work

Compliance rules are stored as JSON in the `compliance_rules` table. Each rule:
1. References a **control** in a **framework**
2. Declares what **evidence type** it needs
3. Uses an **operator** to evaluate the evidence
4. Has a **severity** and **recommendation**

### 4.2 Rule Operators

| Operator | What It Checks | Example |
|---|---|---|
| `equals` | Evidence value equals expected | `"mfa_enabled": true` |
| `not_equals` | Evidence does not equal expected | `"firewall_state": false` |
| `gte` | Value is >= threshold | `"tls_version": "1.2"` |
| `lte` | Value is <= threshold | `"password_max_age": 90` |
| `gt` | Value is > threshold | `"password_min_length": 12` |
| `lt` | Value is < threshold | `"session_timeout": 30` |
| `contains` | Value contains string | `"encryption_method": "AES"` |
| `in` | Value in a list | `"cloud_provider": ["AWS", "Azure"]` |
| `between` | Value between two numbers | `"password_min_length": [8, 64]` |
| `exists` | Any evidence of this type exists | `"security_policy": true` |
| `not_exists` | No evidence of this type | `"incident_response_plan": true` |
| `custom` | Delegates to a Python evaluator | Complex password policy checks |

### 4.3 Adding a Compliance Rule (via Seed JSON)

```json
// seed/frameworks/ndpr.json — add to the "rules" array
{
  "rule_id": "ndpr_mfa_check",
  "control_id": "NDPR-2.2",
  "framework_id": "ndpr",
  "evidence_type": "mfa_enabled",
  "operator": "equals",
  "value": true,
  "severity": "high",
  "recommendation": "Enable Multi-Factor Authentication (MFA) for all administrative accounts handling personal data."
}
```

### 4.4 Cross-Framework Control Mappings

One piece of evidence can satisfy multiple controls across different frameworks. Mappings are stored in the `compliance_mappings` table:

```json
// MFA evidence maps to controls in 3 different frameworks
{
  "source_framework": "iso27001",
  "source_control_id": "A.8.2",
  "target_framework": "soc2",
  "target_control_id": "CC6.1",
  "source": "expert_reviewed",
  "confidence": 1.0
}
```

---

## 5. — AI Training — Prompts & Evidence Patterns

### 5.1 How the AI Engine Uses Your Input

The AI Engine uses **prompts** (instructions for the LLM) and **evidence patterns** (what data to send) to produce explanations, summaries, and recommendations. As a security engineer, you define both.

### 5.2 System Prompts

A system prompt defines the AI's role and behaviour. It is stored in the `ai_prompts` table and versioned.

#### Example: Finding Explanation Prompt

```
You are a senior application security engineer explaining findings to
technical teams. Given a finding, provide:

1. What this finding means in plain language
2. Why it is a security concern
3. How an attacker could exploit it (MITRE ATT&CK mapping if applicable)
4. What remediation looks like (specific, actionable steps)
5. Business impact (data exposure, regulatory, financial)

CRITICAL RULES:
- Be concise. Maximum 3 sentences per section.
- Never speculate beyond the evidence provided.
- If you don't know something, say "insufficient evidence to determine".
- Always cite the specific evidence you are basing your analysis on.
- Consider the OWASP Top 10 and CWE classifications.
```

#### Example: Executive Summary Prompt

```
You are a CISO writing a board-level security summary.
Given VAPT campaign findings, produce:

1. Overall risk posture (1-2 sentences)
2. Most critical attack paths discovered
3. Business impact in financial/regulatory terms
4. Top 3 prioritized remediation actions
5. Compliance implications (GDPR, NDPA, PCI DSS, etc.)

TONE: Direct, business-focused, no technical jargon.
Use metrics (counts, percentages) where possible.
```

### 5.3 Evidence Patterns

Each prompt has a corresponding **evidence pattern** — a template that extracts and shapes data from findings before sending it to the AI.

```json
// Evidence pattern for finding_explanation
{
  "prompt_key": "finding_explanation",
  "evidence_fields": [
    {"source": "finding.title", "type": "string"},
    {"source": "finding.severity", "type": "string"},
    {"source": "finding.description", "type": "string", "max_length": 2000},
    {"source": "finding.evidence_type", "type": "string"},
    {"source": "finding.evidence.value", "type": "json", "max_depth": 2},
    {"source": "campaign.name", "type": "string"}
  ],
  "pii_redaction": {
    "strip": ["ip_addresses", "email_addresses", "hostnames", "api_keys"],
    "replace_with": "[REDACTED]"
  }
}
```

### 5.4 Adding a Custom Prompt via Admin API

```http
POST /api/v1/admin/ai/prompts
Authorization: Bearer <staff_jwt>
Content-Type: application/json

{
  "prompt_key": "remediation_guidance",
  "version": 1,
  "system_prompt": "You are a security remediation specialist...",
  "user_template": "Finding: {title}\nSeverity: {severity}\nDescription: {description}\n\nProvide specific remediation steps.",
  "output_schema": {
    "type": "object",
    "properties": {
      "remediation_steps": {"type": "array"},
      "estimated_effort": {"type": "string"},
      "priority": {"type": "string"}
    }
  },
  "is_active": true,
  "changelog": "Initial version for remediation guidance"
}
```

### 5.5 Prompt Versioning Rules

- Prompts are **immutable once used** — you cannot edit a prompt that has been referenced in an `ai_audit_logs` entry
- To update a prompt, create a new version with `version + 1` and set it as `is_active`
- Old versions remain available for audit traceability
- The `changelog` field should describe what changed and why

---

## 6. — AI Consensus Thresholds

### 6.1 When Consensus Is Triggered

| Mode | Trigger | Models Used |
|---|---|---|
| Economy | Never — single model always | 1 (cheapest available) |
| Balanced | Only when confidence < 0.7 OR finding is critical OR executive report | 2 (primary + secondary) |
| Enterprise | Every AI request | 3 (all configured providers) |

### 6.2 Consensus Decision Matrix

| Agreement Level | What It Means | Action |
|---|---|---|
| Full agreement | All models return identical values for all structured fields | Accept result automatically |
| Minor wording differences | Categorical fields match, text fields differ only in phrasing | Accept result, log wording variants |
| Moderate disagreement | One categorical field differs (e.g., 2 models say "high", 1 says "medium") | Accept majority, flag for review |
| Major disagreement | Multiple categorical fields differ, or text fields contradict each other | Require human review |

### 6.3 Configuring Thresholds

```http
PUT /api/v1/admin/ai/settings
Authorization: Bearer <staff_jwt>
Content-Type: application/json

{
  "default_mode": "balanced",
  "consensus_threshold": 0.7,
  "human_review_threshold": 0.6,
  "hallucination_check": true,
  "default_monthly_budget_usd": 100.00,
  "enabled_providers": ["anthropic", "openai"]
}
```

### 6.4 Per-Org Overrides

```http
GET /api/v1/ai/settings
Authorization: Bearer <org_jwt>

PUT /api/v1/ai/settings
Authorization: Bearer <org_jwt>
Content-Type: application/json

{
  "mode": "enterprise",
  "monthly_token_budget": 2000000,
  "monthly_spend_limit_usd": 200.00,
  "human_review_threshold": 0.8
}
```

### 6.5 Consensus Audit Example

When the AI Engine runs multi-model consensus, the audit log records:

```json
{
  "consensus_level": "minor_differences",
  "discrepancies": [
    "severity: {'high': 2, 'medium': 1}",
    "explanation: 2 different versions"
  ],
  "models_used": ["claude-3.5-sonnet", "gpt-4o", "gemini-2.0-pro"],
  "avg_confidence": 0.87,
  "requires_human_review": false
}
```

---

## 7. — Compliance Knowledge Base — Frameworks & Controls

### 7.1 Adding a New Framework

To add a new compliance framework (e.g., HIPAA, NIST CSF):

**Preferred (no deploy):** staff admin upload (admin / superadmin JWT):

```http
POST /api/v1/admin/compliance/frameworks
Authorization: Bearer <staff_token>
Content-Type: application/json
```

Or multipart: `POST /api/v1/admin/compliance/frameworks/upload` with a `.json` file.  
List / deactivate: `GET|PATCH /api/v1/admin/compliance/frameworks/{id}`.  
Reload built-in seeds only: `POST /api/v1/admin/compliance/seed`.

**Alternative (code/deploy):** create a seed file under  
`app/engines/compliance_engine/seed/frameworks/` and reload seeds.

In either case:

1. Stable `framework_id` (snake_case, e.g. `nist_csf`)
2. Jurisdiction triggers in `jurisdiction_triggers` (optional)
3. Controls + mapping rules (`finding_signal` / operators)
4. Optional cross-framework `mappings` (target framework must already exist)

Full schema: `docs/COMPLIANCE.md` · `schemas/admin_framework.py`.

#### Example: staff upload payload

```json
{
  "framework_id": "pci_dss",
  "name": "PCI Data Security Standard",
  "version": "4.0",
  "jurisdiction_triggers": {
    "handles_payment_cards": true,
    "industry": ["finance", "ecommerce", "retail"]
  },
  "controls": [
    {
      "id": "PCI-3.1",
      "title": "Protect stored cardholder data",
      "category": "data_security",
      "risk": "critical",
      "description": "PAN must be rendered unreadable anywhere it is stored"
    },
    {
      "id": "PCI-4.1",
      "title": "Encrypt cardholder data over open networks",
      "category": "encryption",
      "risk": "critical"
    }
  ],
  "rules": [
    {
      "rule_id": "pci_pan_encryption",
      "control_id": "PCI-3.1",
      "evidence_type": "encryption_at_rest",
      "operator": "equals",
      "value": true,
      "severity": "critical",
      "recommendation": "Ensure all stored PAN is encrypted using strong cryptography"
    },
    {
      "rule_id": "pci_tls_check",
      "control_id": "PCI-4.1",
      "evidence_type": "tls_version",
      "operator": "gte",
      "value": "1.2",
      "severity": "critical",
      "recommendation": "Disable TLS 1.0 and 1.1. Use TLS 1.2 or higher"
    }
  ],
  "mappings": [
    {"control_id": "PCI-3.1", "target_framework": "iso27001", "target_control_id": "A.8.24"},
    {"control_id": "PCI-4.1", "target_framework": "soc2", "target_control_id": "CC6.6"}
  ]
}
```

### 7.2 Evidence Types You Can Reference

| Evidence Type | Source | Description |
|---|---|---|
| `tls_version` | httpx / nuclei / agent | TLS protocol version in use |
| `mfa_enabled` | Cloud API / manual | MFA enforcement status |
| `encryption_at_rest` | Cloud API / manual | Encryption at rest enabled |
| `password_min_length` | Agent / manual | Minimum password length |
| `disk_encryption` | Agent | Full disk encryption status |
| `authentication_failure` | Wazuh | Auth failure events |
| `privileged_access` | Wazuh | Privileged access events |
| `wazuh_agent_status` | Wazuh | Agent connectivity status |
| `security_policy` | Manual upload | Policy document available |
| `incident_response_plan` | Manual upload | IR plan available |

---

## 8. — Testing Your Changes

### 8.1 Test a New Procedure

```bash
# 1. Create the procedure
curl -s -X POST "$API/admin/vapt/procedures" $STAFF $JSON \
  -d '{"procedure_key":"test_web","display_name":"Test Web Scan","steps":[...],"source":"override"}' | jq .

# 2. Create a campaign using it
curl -s -X POST "$API/vapt/campaigns" $ORG $JSON \
  -d '{"campaign_name":"Test Campaign","procedure_key":"test_web","asset_scope":{"asset_types":["domain"]}}' | jq .

# 3. Start the campaign
curl -s -X POST "$API/vapt/campaigns/1/start" $ORG | jq .
```

### 8.2 Test a New Correlation Rule

```bash
# 1. Create the rule
curl -s -X POST "$API/admin/vapt/correlation-rules" $STAFF $JSON \
  -d '{"rule_key":"test_rule","conditions":{...},"conclusion_template":"Test"}' | jq .

# 2. List rules to confirm it appears
curl -s "$API/admin/vapt/correlation-rules/builtin" $STAFF | jq '.[] | select(.rule_key=="test_rule")'
```

### 8.3 Test a Prompt

```bash
# 1. Create the prompt
curl -s -X POST "$API/admin/ai/prompts" $STAFF $JSON \
  -d '{"prompt_key":"test_explain","version":1,"system_prompt":"You are a test...","user_template":"Test: {title}"}' | jq .

# 2. Run a campaign that uses the prompt
# 3. Check audit logs for the AI response
curl -s "$API/admin/ai/audit-logs?prompt_key=test_explain" $STAFF | jq .
```

### 8.4 Test a Compliance Rule

```bash
# 1. Map a finding to see if the rule catches it
curl -s -X POST "$API/compliance/map" $ORG $JSON \
  -d '{"findings":[{"title":"Test","severity":"high"}],"frameworks":["pci_dss"]}' | jq .

# 2. Check gap analysis
curl -s "$API/compliance/gaps" $ORG | jq '.summary'
```

---

## 9. — Glossary

| Term | Definition |
|---|---|
| **Procedure** | A sequence of scan, correlate, analyze, and approval steps that define a VAPT campaign |
| **Correlation Rule** | A pattern of findings that, when combined, indicates an attack path or security concern |
| **Compliance Rule** | A deterministic check: given evidence type X, evaluate operator Y against expected value Z |
| **Control Mapping** | A link between controls across frameworks (e.g., ISO 27001 A.8.24 == NDPR 2.3 == SOC 2 CC6.6) |
| **Prompt** | Instructions and context sent to an LLM to produce a specific output |
| **Evidence Pattern** | Defines what data to extract from findings and send to the AI (with PII redaction rules) |
| **Consensus** | Running the same request against multiple LLMs and comparing structured outputs |
| **Operating Mode** | Economy (single model), Balanced (single + escalate), Enterprise (multi-model consensus) |
| **Evidence Type** | A category of security evidence (e.g., `tls_version`, `mfa_enabled`, `encryption_at_rest`) |
| **Jurisdiction Trigger** | A condition in the business profile that causes a framework to be recommended (e.g., `country: Nigeria` → NDPR) |

---

**End of Security Engineer Guide**

*This document is the operational handbook for security engineers working with the Phantix platform. It covers the full lifecycle: defining scan procedures, writing correlation rules, configuring compliance frameworks, training AI prompts, and tuning consensus thresholds. Compliance frameworks can be added via staff admin upload (`POST /api/v1/admin/compliance/frameworks`) or seed JSON + reload; other catalog changes use admin APIs without a full app redeploy where supported.*
