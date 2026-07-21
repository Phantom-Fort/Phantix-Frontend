# Compliance Engine

**Package**: `app/engines/compliance_engine/`  
**Status**: Implemented **v1.1** (Phases 1–3 core + Phase 4 evidence collection)  
**Guide**: [COMPLIANCE_ENGINE_IMPLEMENTATION_GUIDE.md](../Phantix%20Architecture%20Vault/Engineering%20Docs/COMPLIANCE_ENGINE_IMPLEMENTATION_GUIDE.md)  
**Vault**: [09 - Compliance Engine.md](../Phantix%20Architecture%20Vault/09%20-%20Compliance%20Engine.md)  
**Frontend**: [frontend/02_PLATFORM_IMPLEMENTATION.md](./frontend/02_PLATFORM_IMPLEMENTATION.md) §11

---

## Architecture

```
seed/frameworks/*.json  ──┐
                          ├──► seed_loader  →  platform DB tables
staff POST /admin/compliance/frameworks ──┘         │
                                                    │
findings (Risk/VAPT, verified-only) ──► mapping_service ◄── compliance_rules (DB)
                                                    │
connectors (Wazuh/manual/azure/aws) ──► evidence_service ──► security DB compliance_evidence
                                                    │
business_profiles ──► jurisdiction + recommender
                                                    │
assessments ──► questionnaire + posture + stored evidence
                                                    │
report_sections ──► Reporting Engine (COMPLIANCE_MAPPING)
```

**MUST NOT**: own remediation execution, scan infrastructure, send alerts, modify assets, generate final PDFs.

---

## Knowledge base (platform DB)

| Table | Purpose |
|-------|---------|
| `compliance_frameworks` | Framework catalog (global — all orgs) |
| `compliance_controls` | Controls per framework |
| `compliance_rules` | JSON rules (operators + evidence types) |
| `compliance_mappings` | Cross-framework M:N control links (+ Wazuh-mined / admin) |
| `business_profiles` | Org profiling for recommendations |
| `compliance_assessments` / `_results` | Stored assessment runs |

Migration: `alembic upgrade head` → revision `n4b5c6d7e8f9` (+ later heads).

### How frameworks enter the catalog

| Path | Who | How |
|------|-----|-----|
| **Built-in seeds** | Engineering / deploy | JSON under `app/engines/compliance_engine/seed/frameworks/` |
| **Auto-load** | Runtime | `ensure_seeds_loaded` when catalog empty |
| **Reload seeds** | Staff admin | `POST /api/v1/admin/compliance/seed` (`force` optional) |
| **Admin upload** | Staff admin | `POST /api/v1/admin/compliance/frameworks` (JSON body) or `.../upload` (file) |
| **Client select** | Org users | Choose active ids via org profile / assessments / map |

Built-in seeds today: `ndpr`, `iso27001`, `soc2`, `pci_dss`, `gdpr`.  
Admin upload **adds or updates** frameworks; it does not delete seeds.  
Wazuh cross-mappings: `seed/wazuh_mappings/mined_mappings.json`.

---

## API (org JWT)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/compliance/status` | Engine status |
| `GET` | `/api/v1/compliance/frameworks` | DB catalog + controls (active only) |
| `POST` | `/api/v1/compliance/map` | Map findings via DB rules |
| `GET` | `/api/v1/compliance/gaps` | Gap analysis from org risks |
| `PUT/GET` | `/api/v1/compliance/profile` | Business profile |
| `GET` | `/api/v1/compliance/recommendations` | Recommended frameworks |
| `POST/GET` | `/api/v1/compliance/assessments` | Run / list **merged** assessments (questionnaire + posture) |
| `GET` | `/api/v1/compliance/assessments/{id}/results` | Per-control status + evidence breakdown |
| `POST` | `/api/v1/compliance/admin/seed` | Reload seeds (org JWT; prefer staff endpoint) |
| `POST` | `/api/v1/compliance/questionnaire/session` | **Declare role** before answering (audit) |
| `GET` | `/api/v1/compliance/questionnaire/questions` | Merged GRC questions for this org |
| `GET` | `/api/v1/compliance/questionnaire/progress` | Completion % |
| `PUT` | `/api/v1/compliance/questionnaire/answers` | Submit/update **your** answer (session required) |
| `GET` | `/api/v1/compliance/questionnaire/answers` | Audit: who answered, role, when |
| `POST` | `/api/v1/compliance/questionnaire/rebuild` | Rebuild questions from framework controls |

Also under `/api/v1/engines/compliance/*`.

### Merged GRC questionnaire

1. Questions are built from **all framework controls**, **merged** when titles/themes overlap (one question can map to ISO + NDPR + SOC2 controls).
2. Applicable set for an org comes from **business profile recommendations** (or all active frameworks).
3. Any **org user** may answer; they must first `POST …/questionnaire/session` with `stated_role` (e.g. CISO, IT Admin).
4. Each answer stores **user id, name, email, stated role, session id** for audit. Multiple users can answer the same question (per-user upsert).

### Merged assessment (questionnaire + asset posture)

`POST /api/v1/compliance/assessments` evaluates each control from:

| Channel | Source |
|---------|--------|
| **Questionnaire** | Self-attestation answers (worst multi-user answer wins) |
| **Technical posture** | Risk/VAPT findings mapped by rules + asset inventory signals |

Merge examples: questionnaire **yes** + technical **gap** → **gap** (contradiction); **no** → **gap**; neither → **unknown**.

```json
{
  "framework_id": "iso27001",
  "include_questionnaire": true,
  "include_posture": true
}
```

---

## Staff admin API (staff JWT — admin / superadmin)

Auth: `POST /api/v1/staff/login` → `Authorization: Bearer <staff_token>`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/admin/compliance/frameworks` | List catalog (include inactive) |
| `GET` | `/api/v1/admin/compliance/frameworks/{id}` | Framework summary |
| `POST` | `/api/v1/admin/compliance/frameworks` | **Upload / upsert** framework (JSON body) |
| `POST` | `/api/v1/admin/compliance/frameworks/upload` | **Upload** framework JSON **file** |
| `PATCH` | `/api/v1/admin/compliance/frameworks/{id}` | Activate / deactivate for clients |
| `POST` | `/api/v1/admin/compliance/seed` | Reload built-in `seed/frameworks/*.json` |
| `GET` | `/api/v1/admin/compliance/questionnaire/questions` | List questions (`framework_id`, `expert_only`) |
| `GET` | `/api/v1/admin/compliance/frameworks/{id}/questions` | Questions for one framework |
| `POST` | `/api/v1/admin/compliance/questionnaire/questions` | **Create** expert-managed question |
| `PATCH` | `/api/v1/admin/compliance/questionnaire/questions/{id}` | **Update** question (becomes expert-managed) |
| `DELETE` | `/api/v1/admin/compliance/questionnaire/questions/{id}` | Soft-deactivate question |
| `POST` | `/api/v1/admin/compliance/questionnaire/rebuild` | Rebuild auto questions (**preserves expert edits**) |

### GRC expert curation

Staff (admin/superadmin) act as **GRC experts** for questionnaire content:

- Auto-generated questions come from framework controls (merged by theme).
- Any **create** or **PATCH** marks `is_expert_managed=true` and records `updated_by` (staff email).
- Rebuild / seed reload **never overwrites** expert-managed prompts.
- Link questions to one or more `framework_ids` so they appear for orgs where those standards apply.

```http
POST /api/v1/admin/compliance/questionnaire/questions
Authorization: Bearer <staff_jwt>
{
  "prompt": "Do you maintain a documented information security policy reviewed at least annually?",
  "framework_ids": ["iso27001", "soc2"],
  "category": "organizational",
  "risk": "high",
  "answer_type": "yes_no_partial",
  "source_controls": [
    {"framework_id": "iso27001", "control_id": "A.5.1", "title": "Policies for information security"}
  ],
  "expert_notes": "Aligned to ISO A.5.1 + SOC2 CC1"
}
```

### Upload payload (same as seed JSON)

```json
{
  "framework_id": "nist_csf",
  "name": "NIST Cybersecurity Framework",
  "version": "2.0",
  "description": "…",
  "jurisdiction_triggers": {},
  "controls": [
    { "id": "ID.AM-1", "title": "Asset inventory", "category": "identify", "risk": "high" }
  ],
  "rules": [
    {
      "rule_id": "nist_csf_asset_inventory",
      "control_id": "ID.AM-1",
      "evidence_type": "finding_signal",
      "operator": "any_keyword",
      "value": ["inventory", "asset discovery"],
      "severity": "medium",
      "recommendation": "Maintain an accurate asset inventory"
    }
  ],
  "mappings": [],
  "is_active": true,
  "force": true
}
```

- **Adds** new frameworks to the global catalog (does not remove seed frameworks).
- **Updates** existing ids when `force=true` (default); `seed_version` auto-increments if omitted.
- Clients then see active frameworks on `GET /api/v1/compliance/frameworks`.

---

## Rule language (subset)

Operators: `equals`, `not_equals`, `gte`, `lte`, `gt`, `lt`, `contains`, `in`, `between`, `exists`, `not_exists`, `any_keyword`, `custom`.

Finding mapping uses `evidence_type=finding_signal` + `any_keyword` against title/description.

---

## Code map

| Piece | Path |
|-------|------|
| Models | `models/*.py` |
| Seed loader | `services/seed_loader.py` |
| Knowledge base | `services/knowledge_base.py` |
| Mapping | `services/mapping_service.py` |
| Rule engine | `services/rule_evaluator.py` + `evaluators/` |
| Profiling | `services/business_profiler.py`, `jurisdiction.py`, `recommender.py` |
| Assessments | `services/assessment_service.py`, `risk_scorer.py`, `remediation.py` |
| Report sections | `services/report_sections.py` |
| Wazuh adapter stub | `adapters/wazuh/connector.py` |

---

## Phase status (guide §14)

| Phase | Status |
|-------|--------|
| 1 Knowledge base + seeds + DB mapping | **Done** |
| 2 Profiling + jurisdiction + recommender | **Done** (MVP) |
| 3 Rule engine + assessments + scoring | **Done** (findings-as-evidence MVP) |
| 4 Live evidence connectors (Wazuh/cloud) | **Wazuh + manual implemented** (security-DB `compliance_evidence`); Azure/AWS sample/scaffold |
