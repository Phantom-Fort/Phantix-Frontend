# Intelligent Orchestrator — Autonomous Campaign Planning

**Version**: 1.0
**Date**: July 14, 2026
**Status**: Implemented — planner, asset/profile analyzers, plan store, execute → campaign
**Audience**: Phantix Backend Engineers
**Package**: `app/engines/vapt_engine/orchestrator/` · API: `POST /api/v1/vapt/plan`, `POST /api/v1/vapt/plan/execute`

---

## 1. The Problem

Today, running a security assessment requires a user to:

1. Know which procedure to pick (`infra_scan` vs `full_vapt` vs `web_app_scan_only`)
2. Know which tools to configure (`nmap`, `nuclei`, `web`, `brute_scan`, `cloud_scan`)
3. Know which steps to include and in what order
4. Know which compliance frameworks apply to their org
5. Manually configure asset scope, tags, target types

**User says**: "I want a security assessment."

**Current system says**: "Pick a procedure, configure tools, select assets, choose frameworks..."

**Target system says**: "I've analyzed your organization. Based on your industry (fintech), cloud providers (AWS), and asset inventory (3 domains, 2 APIs, 1 GitHub repo), I've designed a 6-step assessment covering infrastructure, web application, cloud security, and PCI DSS compliance. It will take approximately 45 minutes. Shall I start?"

---

## 2. Architecture

The Intelligent Orchestrator is a **service within the VAPT Engine** that reads the org's profile, asset inventory, and compliance posture to autonomously generate a campaign plan.

```
User clicks: "Run Security Assessment"
    │
    ▼
┌──────────────────────────────────────────────────────┐
│              Intelligent Orchestrator                  │
│                                                       │
│  1. READ Org Profile                                   │
│     - Industry, country, company size                  │
│     - Cloud providers, data types handled              │
│     - Compliance frameworks (NDPR, PCI, SOC2)          │
│                                                       │
│  2. READ Asset Inventory                               │
│     - Domains, subdomains, IPs → need network scan     │
│     - APIs, web apps → need web scan                   │
│     - GitHub repos → need secrets + SCA scan           │
│     - Cloud accounts → need cloud scan                 │
│     - Servers → need CIS benchmark scan                │
│                                                       │
│  3. GENERATE Campaign Plan                              │
│     - Which scan types (derived from assets)            │
│     - Which tools (derived from asset types)            │
│     - Which compliance frameworks (from profile)        │
│     - Execution order (passive first, active second)    │
│     - Estimated duration (from asset count)             │
│                                                       │
│  4. PRESENT Plan → User confirms or modifies            │
│                                                       │
│  5. EXECUTE Campaign                                    │
│     - Create campaign with generated procedure          │
│     - Start execution                                   │
│     - Feed results to compliance engine                 │
│     - Generate report on completion                     │
└──────────────────────────────────────────────────────┘
```

---

## 3. Plan Generation Logic

### 3.1 Asset → Scan Type Mapping

```python
# app/engines/vapt_engine/orchestrator/planner.py

ASSET_TYPE_TO_SCANS = {
    # If org has these asset types...       # Include these scan types
    frozenset({"domain", "subdomain", "ip_address"}): ["network_scan", "dns_scan"],
    frozenset({"domain", "api", "subdomain"}):        ["web_scan"],
    frozenset({"github_repo"}):                       ["secrets_scan", "sca_scan", "sast_scan"],
    frozenset({"cloud_resource"}):                    ["cloud_scan"],
    frozenset({"port_service"}):                      ["vuln_scan", "brute_scan"],
}

# Container detection (via discovery or cloud integration)
CONTAINER_INDICATORS = ["docker", "kubernetes", "k8s", "ecs", "aks", "gke"]
if has_container_orchestration:
    scan_types.append("container_scan")

# Active Directory detection
AD_INDICATORS = ["domain_controller", "ldap", "kerberos", "active_directory"]
if has_active_directory:
    scan_types.append("ad_scan")
```

### 3.2 Profile → Compliance Framework Mapping

```python
INDUSTRY_TO_FRAMEWORKS = {
    "fintech":    {"required": ["ndpr", "pci_dss"], "recommended": ["iso27001", "soc2"]},
    "healthcare": {"required": ["hipaa", "ndpr"],   "recommended": ["iso27001", "iso27701"]},
    "technology": {"required": ["ndpr"],             "recommended": ["iso27001", "soc2", "nist_csf"]},
    "ecommerce":  {"required": ["pci_dss", "ndpr"],  "recommended": ["iso27001"]},
    "government": {"required": ["nist_800_53"],      "recommended": ["iso27001"]},
}
```

### 3.3 Procedure Generation

The orchestrator doesn't pick from existing procedures — it **builds a custom procedure** based on the detected scan types:

```python
class CampaignPlanner:
    async def generate_plan(self, db, org) -> CampaignPlan:
        profile = await self._get_profile(db, org)
        assets = await self._get_asset_summary(db, org)

        # Step 1: Determine scan types from assets
        scan_types = self._scan_types_from_assets(assets)

        # Step 2: Determine compliance frameworks from profile
        frameworks = self._frameworks_from_profile(profile)

        # Step 3: Build step sequence
        steps = []
        step_order = ["discovery", "network", "dns", "web", "cloud", "secrets", "sca", "sast", "vuln", "brute", "ad", "container", "compliance"]

        for scan_type in scan_types:
            step = self._create_scan_step(scan_type, assets)
            steps.append(step)

        # Step 4: Generate report with compliance context
        steps.append({
            "step_type": "correlate",
            "step_name": "Cross-Scan Analysis",
            "config": {"auto": True},
        })
        steps.append({
            "step_type": "analyze",
            "step_name": "Intelligence Analysis",
            "config": {"frameworks": frameworks},
        })

        return CampaignPlan(
            scan_types=list(scan_types),
            frameworks=frameworks,
            steps=steps,
            estimated_duration=self._estimate_duration(scan_types, assets),
            asset_count=len(assets),
        )

    def _estimate_duration(self, scan_types, assets):
        """Rough estimate based on scan types and asset volume."""
        duration_map = {
            "network_scan":  5,    # minutes
            "web_scan":     30,
            "cloud_scan":   10,
            "secrets_scan":  5,
            "sca_scan":     10,
            "vuln_scan":    20,
            "brute_scan":   15,
            "dns_scan":      5,
            "ad_scan":      10,
            "container_scan": 15,
            "sast_scan":    15,
        }
        total = sum(duration_map.get(s, 10) for s in scan_types)
        asset_multiplier = max(1, len(assets) / 10)
        return f"~{round(total * asset_multiplier)} minutes"
```

---

## 4. API

### 4.1 Plan Endpoint

```http
POST /api/v1/vapt/plan
Authorization: Bearer <org_jwt>
```

Returns a generated campaign plan without executing it:

```json
{
    "plan_id": "plan_abc123",
    "based_on": {
        "organization_profile": {
            "industry": "fintech",
            "country": "Nigeria",
            "cloud_providers": ["AWS"],
            "handles_payment_cards": true
        },
        "asset_inventory": {
            "domains": 3,
            "subdomains": 12,
            "apis": 2,
            "github_repos": 1,
            "cloud_accounts": 2
        },
        "detected_frameworks": {
            "required": ["ndpr", "pci_dss"],
            "recommended": ["iso27001", "soc2"]
        }
    },
    "recommended_plan": {
        "name": "Full Security Assessment",
        "estimated_duration": "~45 minutes",
        "scan_types": ["network_scan", "dns_scan", "web_scan", "cloud_scan", "secrets_scan", "sca_scan"],
        "steps": [
            {"step_type": "scan", "tool": "network_scan", "target": "all IPs + domains"},
            {"step_type": "scan", "tool": "dns_scan", "target": "all domains"},
            {"step_type": "scan", "tool": "web_scan", "target": "all web assets + APIs"},
            {"step_type": "scan", "tool": "cloud_scan", "target": "AWS accounts"},
            {"step_type": "scan", "tool": "secrets_scan", "target": "GitHub repos"},
            {"step_type": "scan", "tool": "sca_scan", "target": "GitHub repos"},
            {"step_type": "correlate", "auto": true},
            {"step_type": "analyze", "frameworks": ["ndpr", "pci_dss"]}
        ],
        "compliance_report": "PCI DSS + NDPR gap analysis included"
    }
}
```

### 4.2 Execute Plan Endpoint

```http
POST /api/v1/vapt/plan/execute
Authorization: Bearer <org_jwt>

{
    "plan_id": "plan_abc123",
    "modifications": {
        "exclude_scan_types": ["brute_scan"],
        "include_frameworks": ["iso27001"]
    }
}
```

Creates a VAPT campaign with the generated procedure and starts execution.

---

## 5. User Experience Flow

```
User opens dashboard
    │
    ▼
"Run Security Assessment" button
    │
    ▼
Orchestrator analyzes org profile + assets + compliance
    │
    ▼
Shows plan:
  "Based on your profile, we'll run:
   ─ Infra scan (3 domains, 12 subdomains)
   ─ Web app scan (2 APIs detected)
   ─ Cloud scan (AWS: 2 accounts)
   ─ Secrets scan (1 GitHub repo with 150 commits)
   ─ PCI DSS + NDPR compliance assessment
   Estimated time: ~45 minutes"
    │
    ├── [Accept & Run]
    ├── [Modify Plan]
    └── [Cancel]
```

---

## 6. Implementation

The orchestrator lives inside the VAPT Engine following the same subsidiary pattern as the Web Scanner:

```text
app/engines/vapt_engine/
    orchestrator/                   # NEW
        __init__.py
        planner.py                  # Campaign plan generation
        asset_analyzer.py           # Asset inventory → scan type mapping
        profile_analyzer.py         # Business profile → framework mapping
        duration_estimator.py       # Estimated execution time
        plan_executor.py            # Plan → VAPT campaign creation + start
    api/
        plans.py                    # POST /vapt/plan, POST /vapt/plan/execute
    services/
        campaign_manager.py         # existing — reused
        step_executor.py            # existing — reused
    procedures/
        builtin.py                  # existing — generated procedures are dynamic
```

**Effort**: 1 week for foundation, 2 weeks for full integration with all scan types.
