# Phantix Risk Assessment & Management Module Specification

**Version**: 0.1
**Date**: July 10, 2026
**Status**: Design Specification
**Module Owner**: Phantix Engineering

---

## 1. Overview

The **Risk Assessment and Management Module** is a core component of Phantix. It automatically identifies, scores, and manages cybersecurity risks based on discovered assets and scan findings.

This module follows a **NIST-inspired Risk Management Framework** while remaining practical for Nigerian SMEs.

### Key Objectives

- Automatically create and update risk records from scan results.
- Provide transparent, defensible risk scoring.
- Enable structured risk treatment with approval workflows.
- Support residual risk tracking from day one.
- Allow clients to request paid expert review when needed.
- Maintain clear ownership — **risks always belong to the client**.

---

## 2. Core Principles

| Principle                        | Implementation |
|----------------------------------|----------------|
| **Data Residency**               | All risk data lives in the customer’s Dedicated Security Database |
| **Risk Ownership**               | Risks are owned by **client departments** only. Phantix never owns risks |
| **Automation First**             | Automatic risk creation + scoring + treatment suggestion |
| **Human Oversight**              | Phantix Security Team can review via exported reports (billable) |
| **Approval Workflows**           | Risk treatments require approval by designated authorizers |
| **Transparency**                 | Both Likelihood × Impact and rules-based scoring are visible |
| **Residual Risk**                | Calculated and tracked from the beginning |

---

## 3. Data Models

All tables below exist in the **customer’s Dedicated Security Database**.

### 3.1 `risk` Table

```sql
CREATE TABLE risk (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    asset_id BIGINT REFERENCES asset(id),
    asset_tags TEXT[],

    -- Scoring
    likelihood VARCHAR(20),                    -- Low, Medium, High, Critical
    impact VARCHAR(20),                        -- Low, Medium, High, Critical
    risk_score INTEGER,                        -- 1–100
    risk_level VARCHAR(20),                    -- Low, Medium, High, Critical

    -- NIST-aligned fields
    threat_event TEXT,
    vulnerability TEXT,
    asset_criticality VARCHAR(20),

    status VARCHAR(30) DEFAULT 'identified',
    -- identified, assessed, treatment_proposed, under_review, approved, in_progress, mitigated, accepted, monitoring, closed

    owner_department VARCHAR(100),             -- e.g. IT, Finance, Operations, Legal
    owner_user_id INTEGER,                     -- Optional: specific person in the department

    treatment_plan TEXT,
    residual_risk_score INTEGER,
    residual_risk_level VARCHAR(20),

    treatment_status VARCHAR(30) DEFAULT 'not_started',
    -- not_started, proposed, under_approval, approved, rejected, in_progress, completed

    approved_by_user_id INTEGER,
    approved_at TIMESTAMPTZ,

    source VARCHAR(50) DEFAULT 'auto_from_scan',
    -- auto_from_scan, manual, ai_suggested, expert_review

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
```

### 3.2 `risk_assessment` Table

```sql
CREATE TABLE risk_assessment (
    id BIGSERIAL PRIMARY KEY,
    risk_id BIGINT NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL,

    assessment_type VARCHAR(30) NOT NULL,
    -- automatic, manual_override, expert_review

    performed_by VARCHAR(100),                 -- system or user_id

    likelihood_score INTEGER,
    impact_score INTEGER,
    calculated_risk_score INTEGER,
    risk_level VARCHAR(20),

    scoring_method VARCHAR(50),
    -- likelihood_impact, rules_engine, hybrid

    findings_count INTEGER,
    critical_findings INTEGER,
    high_findings INTEGER,
    medium_findings INTEGER,
    low_findings INTEGER,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 `risk_treatment` Table

```sql
CREATE TABLE risk_treatment (
    id BIGSERIAL PRIMARY KEY,
    risk_id BIGINT NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL,

    treatment_type VARCHAR(30) NOT NULL,
    -- mitigate, accept, transfer, avoid

    treatment_plan TEXT NOT NULL,
    estimated_cost DECIMAL(12,2),
    estimated_effort_days INTEGER,
    target_completion_date DATE,

    status VARCHAR(30) DEFAULT 'proposed',
    -- proposed, under_approval, approved, rejected, in_progress, completed, verified

    approved_by_user_id INTEGER,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,

    residual_likelihood VARCHAR(20),
    residual_impact VARCHAR(20),
    residual_risk_score INTEGER,
    residual_risk_level VARCHAR(20),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
```

### 3.4 `risk_history` Table

```sql
CREATE TABLE risk_history (
    id BIGSERIAL PRIMARY KEY,
    risk_id BIGINT NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL,
    changed_by VARCHAR(100),
    change_type VARCHAR(50),
    previous_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Risk Scoring Approach (Hybrid)

Risk scores are calculated using **two complementary methods**:

### 4.1 Likelihood × Impact (Base Score)

- **Likelihood** and **Impact** are rated as: Low (1), Medium (2), High (3), Critical (4)
- Base Score = Likelihood × Impact (range 1–16)
- Normalized to 1–100 scale.

### 4.2 Rules Engine (Contextual Adjustment)

Additional points are added based on:

- Asset tags (e.g., `critical`, `production`, `external`, `customer_data`)
- Number and severity of linked findings
- Exposure level (internet-facing, authenticated, etc.)
- Asset type sensitivity (e.g., `api` or `database_connection` may carry higher weight)

**Final Risk Score** = Base Score + Rules Engine Adjustment

Complex calculations beyond this will be passed to the **AGI/ML model** in later phases.

---

## 5. Automatic Risk Creation Flow

1. A new `scan_result` is created.
2. The system checks if a risk already exists for the same `asset_id` + similar vulnerability type.
3. If risk exists:
   - Risk score is **recalculated** (especially if new Critical/High findings appear).
   - `risk_assessment` record is created.
4. If risk does **not** exist:
   - New risk record is **automatically created**.
   - Initial treatment is **auto-suggested**.
5. Risk is linked to relevant `asset_tags` at the time of creation.

---

## 6. Risk Treatment & Approval Workflow

1. System **auto-suggests** treatment type and basic plan.
2. Risk owner (department) reviews and can modify the treatment plan.
3. Treatment is submitted for **approval** by the designated authorizer(s).
4. Authorizer can **Approve** or **Reject**.
5. If approved → Treatment moves to `in_progress`.
6. After remediation → Risk owner marks treatment as `completed`.
7. Residual risk is calculated and recorded.

**Phantix Review Path (Billable)**:
- Client can request expert review.
- Phantix requests an **export** of the risk data.
- Phantix returns a reviewed report with recommendations.
- Client can then update the risk record manually.

---

## 7. Risk Ownership

- Every risk **must** have an `owner_department`.
- Optional: `owner_user_id` (specific person within the department).
- **Phantix cannot own risks**. Risks only emanate from the client’s environment.
- In expert review cases, Phantix acts only as an advisor via exported reports.

---

## 8. Integration Points

| Module              | Integration with Risk Module                              |
|---------------------|-----------------------------------------------------------|
| **Asset**           | Risk is primarily linked to one asset. Tags influence scoring |
| **Scan Result**     | Every scan result triggers risk creation or update        |
| **Report Solution** | Consumes risk data for dashboards and compliance reports  |
| **AI Module**       | Future: Complex scoring and treatment recommendations     |

---

## 9. Key Statuses

**Risk Status**:
- `identified` → `assessed` → `treatment_proposed` → `under_approval` → `approved` → `in_progress` → `mitigated` / `accepted`

**Treatment Status**:
- `proposed` → `under_approval` → `approved` / `rejected` → `in_progress` → `completed`

---

## 10. Non-Functional Requirements

- All risk data lives in the customer’s database.
- Risk scoring must be **explainable** (show which factors contributed to the score).
- Changes to risk score, status, or treatment must be recorded in `risk_history`.
- The system must support **bulk risk updates** when new scan results arrive.

---

## 11. MVP Scope

**In Scope**:
- Automatic risk creation from scan results
- Hybrid risk scoring (Likelihood × Impact + Rules Engine)
- Risk ownership (department + optional user)
- Treatment planning + approval workflow
- Residual risk calculation
- Risk history tracking
- Basic export for Phantix expert review (billable)

**Out of Scope (MVP)**:
- Full AI-powered risk scoring (planned for later)
- Automated remediation actions
- Advanced quantitative models (FAIR)

---

## 12. Recommended Implementation Order

1. Create `risk`, `risk_assessment`, `risk_treatment`, and `risk_history` tables + migrations.
2. Build automatic risk creation logic triggered by `scan_result`.
3. Implement hybrid risk scoring engine.
4. Build Risk CRUD + Treatment workflow with approval states.
5. Add residual risk calculation.
6. Implement risk history tracking.
7. Connect risk scoring to asset tags.
8. Build export functionality for expert review.

---

**Document Status**: Ready for team review and implementation planning.

**Maintained by**: Phantix Engineering Team

---

*This specification reflects all decisions made on July 10, 2026.*
