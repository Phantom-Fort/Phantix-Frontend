# AI Engine — Implementation Guide

**Version**: 1.0
**Date**: July 14, 2026
**Status**: Phases 1–2 implemented (governance + finding_explanation + executive_summary + providers). Phase 3–4 partial/pending. Phase 5 RAG deferred.
**Audience**: Phantix Backend Engineers, AI Engineering Team
**Prerequisite Reading**: `Phantix Architecture Vault/08 - AI Engine.md`, `Phantix Architecture Vault/15 - Event Contracts.md`
**Package**: `app/engines/ai_engine/` · **User docs**: `docs/AI.md`

---

## Table of Contents

1. [Non-Negotiable Principles](#1--non-negotiable-principles)
2. [Architecture Overview](#2--architecture-overview)
3. [AI Coordinator](#3--ai-coordinator)
4. [Model Registry & Provider Routing](#4--model-registry--provider-routing)
5. [Prompt Registry](#5--prompt-registry)
6. [Consensus Review System](#6--consensus-review-system)
7. [AI Governance Engine](#7--ai-governance-engine)
8. [Specialized Agents: Engine Integration Points](#8--specialized-agents-engine-integration-points)
9. [RAG Engine & Vector Search](#9--rag-engine--vector-search)
10. [Data Residency Design](#10--data-residency-design)
11. [Admin Controls](#11--admin-controls)
12. [Engine Folder Structure](#12--engine-folder-structure)
13. [Implementation Phases](#13--implementation-phases)

---

## 1. — Non-Negotiable Principles

```
1. AI never replaces deterministic engines.
2. AI explains, correlates, predicts, and summarizes — it never determines pass/fail.
3. Compliance decisions remain rule-based (Compliance Rule Engine).
4. Security decisions remain deterministic (Scanner/Risk Engines).
5. Every AI response must be traceable (prompt version, model, confidence, sources).
6. Every AI response must cite supporting evidence.
7. AI processing must be asynchronous — never block API requests.
8. Customer security data never leaves the customer's database (metadata-only for multi-model).
9. Consensus is configurable by budget and assurance needs (Economy / Balanced / Enterprise).
10. Architecture must remain provider-agnostic (no hardcoded provider logic).
```

---

## 2. — Architecture Overview

### 2.1 Position in the Engine Ecosystem

The AI Engine is a **consumer and producer** — it subscribes to events from other engines, processes them asynchronously, and publishes enriched results back.

```
Scanner Engine ──▶ ScanCompleted ──┐
Risk Engine    ──▶ RiskCreated  ───┤
VAPT Engine    ──▶ CampaignDone ──┼──▶ AI Engine (background workers)
Compliance     ──▶ ComplianceReq ──┘
Reporting      ──▶ NarrativesReq ──┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │           AI Coordinator              │
                    │  (routes to agents, manages lifecycle)│
                    │                                      │
                    │  ┌────────┐ ┌────────┐ ┌──────────┐ │
                    │  │Prompt  │ │ Model  │ │Consensus │ │
                    │  │Registry│ │Registry│ │Engine    │ │
                    │  └────────┘ └────────┘ └──────────┘ │
                    │  ┌───────────────────────────────┐  │
                    │  │   Governance Layer             │  │
                    │  │ (audit, PII redact, cost)      │  │
                    │  └───────────────────────────────┘  │
                    └─────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌────────────┐  ┌────────────┐  ┌────────────┐
            │ VAPT       │  │ Compliance │  │ Reporting  │
            │ Engine     │  │ Engine     │  │ Engine     │
            └────────────┘  └────────────┘  └────────────┘
```

### 2.2 Async-Only Rule

```
Engine publishes event (e.g., AIAnalysisRequested)
    │
    ▼
AI Engine worker picks up event asynchronously
    │
    ▼
Processing happens (seconds to minutes)
    │
    ▼
AI Engine publishes AICompleted
    │
    ▼
Original engine updates its data with AI enrichment
```

No API request ever waits for an LLM call.

---

## 3. — AI Coordinator

Single entry point for all AI processing. Routes events to the right agent, manages prompt selection, model routing, and consensus.

```python
# app/engines/ai_engine/coordinator.py

class AICoordinator:
    def __init__(self):
        self.agents: dict[str, AIAgent] = {}
        self.governance = AIGovernance()

    def register_agent(self, agent: AIAgent):
        self.agents[agent.name] = agent

    async def handle_request(self, event: EngineEvent) -> dict:
        """Route event to agent, select model, run governance, execute.
        Returns enriched result or consensus result."""
        agent = self._resolve_agent(event)
        prompt = await self._load_prompt(agent, event)
        tier = await self._get_org_tier(event.organization_id)
        evidence = self._prepare_evidence(event)

        # Governance: PII redaction
        redacted = self.governance.redact_pii(evidence)

        if tier == "enterprise":
            return await self._run_with_consensus(redacted)
        elif tier == "balanced":
            return await self._run_balanced(redacted)
        else:
            return await self._run_economy(redacted)
```

---

## 4. — Model Registry & Provider Routing

```python
# app/engines/ai_engine/services/model_registry.py

class Provider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    LOCAL = "local"
    MOCK = "mock"

@dataclass
class ModelConfig:
    provider: Provider
    model_name: str
    max_tokens: int = 2048
    temperature: float = 0.0       # deterministic for auditability
    timeout_seconds: int = 120
    data_residency: str = "metadata_only"  # per the principles

class ModelRegistry:
    DEFAULT_MODELS = {
        "economy": [ModelConfig(provider=Provider.ANTHROPIC, model_name="claude-3-haiku")],
        "balanced": [ModelConfig(provider=Provider.ANTHROPIC, model_name="claude-3.5-sonnet")],
        "enterprise": [
            ModelConfig(provider=Provider.ANTHROPIC, model_name="claude-3.5-sonnet"),
            ModelConfig(provider=Provider.OPENAI, model_name="gpt-4o"),
            ModelConfig(provider=Provider.GEMINI, model_name="gemini-2.0-pro"),
        ],
    }

    async def call(self, config: ModelConfig, prompt: str, evidence: dict) -> dict:
        """Call a model. Always expects JSON response. Provider-agnostic."""
        client = self._get_client(config.provider)
        response = await client.chat.completions.create(
            model=config.model_name,
            messages=[{"role": "system", "content": prompt}, {"role": "user", "content": json.dumps(evidence)}],
            response_format={"type": "json_object"},
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            timeout=config.timeout_seconds,
        )
        return json.loads(response.choices[0].message.content)
```

---

## 5. — Prompt Registry

Every prompt is versioned, immutable once used, and stored in the platform DB.

```sql
CREATE TABLE ai_prompts (
    id BIGSERIAL PRIMARY KEY,
    prompt_key VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL,
    system_prompt TEXT NOT NULL,
    user_template TEXT NOT NULL,
    output_schema JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(255),
    changelog TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (prompt_key, version)
);
```

```python
class PromptRegistry:
    def get_system_prompt(self, key: str) -> str:
        return {
            "finding_explanation": """You are a senior security engineer.
Given a finding, explain in plain language: what it means, why it matters,
how an attacker exploits it, and what to do. Return JSON with:
severity, confidence, explanation, impact, remediation, evidence_used.""",

            "executive_summary": """You are a CISO writing a board summary.
Given campaign findings, describe: overall posture, critical risks,
business impact, regulatory concerns, and prioritized actions.
Return JSON with: overall_posture, critical_findings, top_risks,
business_impact, recommendations, compliance_risk.""",

            "compliance_explain": """You are a compliance analyst.
Given a failed compliance control, explain: what the requirement is,
why it failed, what evidence was missing, and how to remediate.
Return JSON with: control, requirement, failure_reason, remediation,
regulatory_impact, estimated_effort.""",
        }.get(key, "")
```

---

## 6. — Consensus Review System

### 6.1 Workflow

```
Coordinator sends same prompt + evidence to multiple models
    │
    ├── GPT-4o     ──▶ {severity: "high", confidence: 0.85, ...}
    ├── Claude 3.5 ──▶ {severity: "high", confidence: 0.90, ...}
    └── Gemini 2.0 ──▶ {severity: "medium", confidence: 0.70, ...}
    │
    ▼
Consensus Engine compares structured fields
    │
    ├── severity:     high (2/3 agreement)
    ├── confidence:   0.82 (average)
    ├── discrepancy:  Gemini scored medium — flagged
    │
    ▼
Final Response + Consensus Report
```

### 6.2 Structured Response Contract

Every model must return this JSON shape:

```json
{
  "severity": "critical|high|medium|low|info",
  "confidence": 0.85,
  "title": "Short finding title",
  "explanation": "Plain language explanation",
  "impact": "Business impact",
  "remediation": "Actionable steps",
  "root_cause": "Likely root cause",
  "evidence_used": ["specific evidence referenced"],
  "regulatory_impact": ["GDPR Article 32", "NDPR 2.1"]
}
```

### 6.3 Consensus Engine

```python
class ConsensusEngine:
    NUMERIC = {"confidence"}
    CATEGORICAL = {"severity"}
    TEXT = {"title", "explanation", "impact", "remediation", "root_cause"}

    async def reach_consensus(self, responses: list[dict]) -> dict:
        """Compare structured outputs. Returns agreed result + discrepancies."""
        if len(responses) == 1:
            return {"final": responses[0], "level": "single", "discrepancies": []}

        discrepancies = []
        final = {}

        # Numeric: average
        for f in self.NUMERIC:
            vals = [r.get(f, 0) for r in responses]
            final[f] = sum(vals) / len(vals)

        # Categorical: majority vote
        for f in self.CATEGORICAL:
            from collections import Counter
            vals = [r.get(f, "") for r in responses]
            counts = Counter(vals)
            final[f] = counts.most_common(1)[0][0]
            if len(counts) > 1:
                discrepancies.append(f"{f}: {dict(counts)}")

        # Determine level
        if not discrepancies:
            level = "full_agreement"
        elif len(discrepancies) <= 2:
            level = "minor_differences"
        elif len(discrepancies) <= 4:
            level = "moderate_disagreement"
        else:
            level = "major_disagreement"

        return {
            "final": final,
            "level": level,
            "discrepancies": discrepancies,
            "individual": responses,
            "avg_confidence": sum(r.get("confidence", 0) for r in responses) / len(responses),
        }
```

### 6.4 Operating Modes

```python
AI_MODES = {
    "economy": {
        "description": "Single model, no consensus. Lowest cost.",
        "consensus": False,
        "escalate_on": [],
    },
    "balanced": {
        "description": "Single model. Escalate on low confidence or critical findings.",
        "consensus": False,
        "escalate_on": ["low_confidence", "critical_severity", "executive_report"],
    },
    "enterprise": {
        "description": "Multiple models, consensus required. Highest assurance.",
        "consensus": True,
        "escalate_on": ["all"],
    },
}
```

---

## 7. — AI Governance Engine

### 7.1 Responsibilities

| Function | Implementation |
|---|---|
| Prompt versioning | Every prompt in `ai_prompts` table. Immutable once used. |
| Model registry | All calls go through `ModelRegistry`. Direct provider calls forbidden. |
| Provider routing | Dynamic selection based on org tier, cost, availability. |
| AI audit logs | Every LLM call logged with prompt version, model, tokens, cost, response hash. |
| Hallucination detection | Cross-check AI claims against evidence. If claim cites evidence that doesn't exist, flag. |
| PII redaction | Strip emails, IPs, names before sending to providers. |
| Human approval | Flag responses with confidence < 0.6 or major disagreement. |
| Cost accounting | Track token usage per org per model per month. Enforce budgets. |

### 7.2 Audit Log Table

```sql
CREATE TABLE ai_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    event_id VARCHAR(100),
    agent_name VARCHAR(100),
    prompt_key VARCHAR(100),
    prompt_version INTEGER,
    model_provider VARCHAR(50),
    model_name VARCHAR(100),
    evidence_types TEXT[],
    evidence_hash VARCHAR(64),
    data_residency_mode VARCHAR(30),
    response_hash VARCHAR(64),
    tokens_used INTEGER,
    cost_usd DECIMAL(10,6),
    consensus_mode VARCHAR(30),
    consensus_level VARCHAR(50),
    pii_redacted BOOLEAN DEFAULT true,
    hallucination_flagged BOOLEAN DEFAULT false,
    requires_human_review BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. — Specialized Agents: Engine Integration Points

### 8.1 Agent Interface

```python
class AIAgent(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...
    @property
    @abstractmethod
    def prompt_key(self) -> str: ...

    @abstractmethod
    async def prepare_evidence(self, event: EngineEvent) -> dict:
        """Extract and de-identify evidence from the triggering event."""

    @abstractmethod
    async def process_result(self, result: dict, event: EngineEvent) -> None:
        """Publish enriched event back to the originating engine."""
```

### 8.2 Agent Inventory

| Agent | Name | Trigger | Feeds Into | What It Produces |
|---|---|---|---|---|
| Finding Explainer | `finding_explanation` | `FindingCreated`, `RiskCreated` | VAPT/Risk Engine | Per-finding plain language explanation |
| Auth Assist | `auth_assist` | `CampaignStepStarted` (web) | VAPT Engine | Login form selectors, session cookies |
| FlowMapper | `flowmapper` | `CampaignStepStarted` (web) | VAPT Engine | Discovered endpoints, API calls |
| ML Classifier | `soft404_classifier` | `ScanCompleted` | VAPT Engine | Soft-404 probability per response |
| Attack Path | `attack_path` | Campaign correlation done | VAPT Engine | Human-readable attack chain narration |
| Root Cause | `root_cause` | `RiskUpdated` | Risk Engine | Root cause analysis per risk |
| Remediation | `remediation` | Any finding | Risk/VAPT Engine | Prioritized remediation steps |
| Compliance Explain | `compliance_explain` | `ComplianceUpdated` | Compliance Engine | Plain-language control failure explanation |
| Policy Draft | `policy_draft` | User API request | Compliance Engine | Draft policy documents |
| Executive Summary | `executive_summary` | `CampaignCompleted` | Reporting Engine | Board-level summary |
| Technical Summary | `technical_summary` | `CampaignCompleted` | Reporting Engine | Technical deep-dive |
| Search | `search` | User query | Any Engine | Natural language search over org data |
| Chat | `chat` | User message | Any Engine | Conversational interface |
| Planner | `planner` | User/staff request | Operations Engine | Optimization planning |
| Threat Intel | `threat_intel` | `ScanCompleted` | VAPT Engine | CVE correlation with known threats |

### 8.3 Integration Flow By Engine

#### VAPT Engine — Attack Path Narratives

```
Campaign correlation completes
    └── VAPT publishes AIAnalysisRequested
    └── AI Engine's finding_explanation agent processes
    └── AI Engine publishes AICompleted with enriched narratives
    └── VAPT Engine stores narratives on correlated findings
```

#### Compliance Engine — Control Explanations

```
Compliance rule evaluation completes
    └── Deterministic pass/fail stored (AI never touches this)
    └── Compliance Engine publishes ComplianceUpdated
    └── AI Engine's compliance_explain agent processes
    └── AI Engine stores explanations alongside deterministic results
    └── AI never changes pass/fail — only adds explanation
```

#### Reporting Engine — Executive Summaries

```
Campaign completes → Reporting Engine starts report generation
    └── Reporting Engine publishes AIRequested (kind: report_narratives)
    └── Returns template fallback immediately (non-blocking)
    └── AI Engine processes and publishes AIReportNarrativesCompleted
    └── Reporting Engine updates report with AI narratives
```

---

## 9. — RAG Engine & Vector Search

**Design Decision: DEFERRED**. RAG and vector search cannot be built until the data residency question is resolved.

The conflict:
- **pgvector in customer's DB**: Keeps data residency intact but requires pgvector extension on customer PostgreSQL.
- **Phantix-managed vector store**: Breaks the "customer data never leaves their DB" model.

For Phase 1-4, the AI Engine operates **without RAG**. Agents receive evidence directly from the triggering event (finding data, campaign summaries) — no vector search needed. RAG is only necessary for:
- Natural language search over org's historical findings
- Chat interface that references past analyses
- Threat intelligence correlation against external feeds

---

## 10. — Data Residency Design

### 10.1 What Leaves The Customer's Infrastructure

| Data Type | Sent To Provider? | Notes |
|---|---|---|
| Finding severity | ✅ Yes | "critical", "high", etc. |
| Finding title | ✅ Yes | "Open SSH port 22" |
| Finding description | ✅ Yes | De-identified: "Port 22 exposed on [REDACTED_IP]" |
| Evidence type | ✅ Yes | "tls_version", "mfa_enabled" |
| Specific IP addresses | ❌ No | Redacted to [REDACTED_IP] |
| Email addresses | ❌ No | Redacted |
| Hostnames | ❌ No | Redacted unless public domain |
| Request/response bodies | ❌ No | Never sent |
| Raw scan output | ❌ No | Never sent |
| Customer business data | ❌ No | Never sent |
| PII / PHI | ❌ No | Strictly redacted |

### 10.2 Enforcement

```python
# app/engines/ai_engine/governance/pii_redactor.py

class PIIRedactor:
    PATTERNS = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "ip": r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
        "phone": r'\b\+?\d{1,3}[-.\s]?\(?\d{1,4}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b',
        "api_key": r'\b(?:sk-|pk-|ghp_)[A-Za-z0-9_-]{20,}\b',
    }

    def redact(self, evidence: dict) -> dict:
        import copy, re
        redacted = copy.deepcopy(evidence)
        for key, value in self._flatten(redacted):
            if isinstance(value, str):
                for name, pattern in self.PATTERNS.items():
                    redacted = self._set_value(redacted, key,
                        re.sub(pattern, f"[REDACTED:{name}]", value))
        return redacted
```

---

## 11. — Admin Controls

```http
# AI Engine admin endpoints (staff JWT required)

GET    /api/v1/admin/ai/settings                   # Global AI config
PUT    /api/v1/admin/ai/settings                   # Update providers, budgets, modes
GET    /api/v1/admin/ai/prompts                    # List all prompts
POST   /api/v1/admin/ai/prompts                    # Create new prompt version
POST   /api/v1/admin/ai/prompts/{key}/activate     # Activate a prompt version
GET    /api/v1/admin/ai/audit-logs                 # Search audit logs
GET    /api/v1/admin/ai/costs                      # Cost summary per org/provider
POST   /api/v1/admin/ai/consensus/test             # Dry-run consensus on evidence

# Per-org AI settings (org JWT required)

GET    /api/v1/ai/settings                         # Org's AI configuration
PUT    /api/v1/ai/settings                         # Update AI tier, token budget, providers
```

Per-org AI settings stored in `ai_settings` table:

```json
{
  "ai_enabled": true,
  "mode": "balanced",
  "consensus_enabled": false,
  "monthly_token_budget": 1000000,
  "monthly_spend_limit_usd": 50.00,
  "human_review_threshold": 0.6,
  "enabled_providers": ["anthropic", "openai"],
  "enabled_agents": ["finding_explanation", "executive_summary"],
  "data_residency_consent": false
}
```

---

## 12. — Engine Folder Structure

```text
app/engines/ai_engine/
    __init__.py
    manifest.py
    coordinator.py

    services/
        model_registry.py
        prompt_registry.py
        cost_manager.py

    agents/
        __init__.py
        base.py                     # AIAgent ABC
        auth_assist.py              # AI-assisted authentication
        flowmapper.py               # AI-guided endpoint discovery
        soft404_classifier.py       # ML soft-404 detection
        finding_explanation.py      # Finding explanation
        root_cause.py               # Root cause analysis
        attack_path.py              # Attack path narration
        remediation.py              # Remediation assistance
        compliance_explain.py       # Compliance control explanation
        policy_draft.py             # Policy document generation
        executive_summary.py        # Executive/summary reports
        technical_summary.py        # Technical deep-dive reports
        search.py                   # Natural language search
        chat.py                     # Conversational interface
        planner.py                  # Optimization planning
        threat_intel.py             # Threat intelligence correlation

    consensus/
        __init__.py
        engine.py                   # ConsensusEngine
        modes.py                    # Economy/Balanced/Enterprise

    governance/
        __init__.py
        pii_redactor.py
        hallucination_detector.py
        audit_logger.py
        human_review.py

    rag/                            # DEFERRED
        __init__.py

    events/
        __init__.py
        catalog.py
        subscribers.py
        publishers.py

    workers/
        __init__.py
        ai_worker.py

    tasks/
        __init__.py
        process_analysis.py
        process_narrative.py
        process_compliance.py
        budget_enforcement.py

    models/
        __init__.py
        prompt.py
        audit.py
        settings.py

    schemas/
        __init__.py
        agent.py
        consensus.py
        governance.py
```

---

## 13. — Implementation Phases

### Phase 1: Governance Foundation

**Goal**: AI Engine is safe to use — audit trails, PII redaction, prompt versioning, cost controls.

| Step | Effort |
|---|---|
| `ai_prompts` + `ai_audit_logs` DB tables | 1 day |
| `AICoordinator` base class | 2 days |
| PII redactor | 1 day |
| Audit logger | 1 day |
| Prompt registry + system prompts | 3 days |
| Cost manager | 1 day |
| Hallucination detector | 2 days |
| Event subscribers (stubs) | 1 day |

### Phase 2: Core Agents + Provider Integration

| Step | Effort |
|---|---|
| Model registry + Anthropic/OpenAI clients | 3 days |
| Finding explanation agent | 2 days |
| Executive summary agent | 2 days |
| Celery worker | 1 day |
| Wire VAPT + Reporting Engine subscribers | 2 days |

### Phase 3: Consensus

| Step | Effort |
|---|---|
| Consensus engine | 3 days |
| Operating modes | 1 day |
| Multi-model routing | 1 day |
| Human review workflow | 2 days |
| Per-org AI tier settings + API | 2 days |

### Phase 4: All Remaining Agents

| Agent | Effort |
|---|---|
| Auth assist | 2 days |
| Flowmapper | 3 days |
| Soft-404 classifier | 2 days |
| Root cause | 2 days |
| Attack path | 2 days |
| Remediation | 2 days |
| Compliance explain | 2 days |
| Policy draft | 2 days |
| Search + Chat | 4 days (requires RAG) |
| Planner | 2 days |
| Threat intel | 3 days |

### Phase 5: RAG + Vector Search (Deferred)

Requires data residency decision. Not started until all other phases are complete.

---

**End of AI Engine Implementation Guide**

*This document integrates the AI Coordinator, specialized Agents, Consensus Review System, and AI Governance into the existing Phantix engine architecture. Core principles: AI never determines security facts, all AI workloads are async, customer data stays in customer's DB, consensus runs on de-identified metadata only. Phase 1-4 can be built without RAG or vector search — agents receive evidence directly from triggering events. Phase 5 (RAG) is deferred until the data residency question is resolved.*
