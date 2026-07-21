# Risk Assessment & Management Module

**Version**: 0.1 (implemented)
**Storage**: Customer **Dedicated Security Database** only
**Ownership**: Client departments — Phantix never owns risks

---

## Principles

| Principle | Implementation |
|-----------|----------------|
| Data residency | `risks`, `risk_assessments`, `risk_treatments`, `risk_history` in security schema |
| Client ownership | `owner_department` required; Phantix is advisor via export only |
| Automation | Each `scan_result` triggers create/update + assessment |
| Explainable scoring | Hybrid Likelihood×Impact + rules engine; `scoring_breakdown` stored |
| Approval | Treatment approve/reject requires dual-control **authorizer** session |
| Residual risk | Calculated on propose/approve/complete |

Security schema version: **1.3.1** — re-bootstrap after deploy.

---

## Hybrid scoring

1. **Base**: Likelihood (1–4) × Impact (1–4) → normalize to 1–100
2. **Rules**: asset tags, asset type, finding severity counts, exposure
3. **Final**: `min(100, base + rules)` with capped rules contribution

Levels: Low 1–24, Medium 25–49, High 50–74, Critical 75–100.

---

## Prioritization (remediation queue)

Scoring answers “how bad is this?”. **Prioritization** answers “what should we fix first?”.

### Algorithm `phantix.risk_priority.v1`

```text
priority = 0.35 * effective_severity
         + 0.25 * treatment_urgency
         + 0.15 * status_urgency
         + 0.15 * asset_context
         + 0.10 * age
```

| Component | Inputs |
|-----------|--------|
| **effective_severity** | Inherent score, or residual / blend when treatment is underway |
| **treatment_urgency** | not_started / proposed / rejected rank higher than completed |
| **status_urgency** | identified/assessed > approved/in_progress > mitigated/closed |
| **asset_context** | asset criticality + tags (production, external, customer_data, …) |
| **age** | Days open without progress (ramps over ~30 days) |

**Bands**: P1 Immediate (80–100) · P2 This week (60–79) · P3 This month (40–59) · P4 Planned (20–39) · P5 Backlog (0–19)

Each item includes `priority_factors` for explainability.

### Endpoints

```http
GET /api/v1/risks/prioritized
GET /api/v1/risks/prioritized?band=P1&exclude_closed=true
GET /api/v1/risks?sort=priority
```

---

## Automatic flow

1. Scan writes `scan_result`
2. System finds risk by `(asset_id, vulnerability_key)` or creates new
3. Recalculates score + writes `risk_assessment`
4. On create: auto-suggests treatment (`proposed`)

---

## API (`/api/v1/risks`)

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/risks` | Org JWT |
| `GET` | `/risks/export?format=json\|csv` | Org JWT (expert review export) |
| `GET` | `/risks/{id}` | Org JWT |
| `PATCH` | `/risks/{id}` | Org JWT (ownership, plan) |
| `GET` | `/risks/{id}/assessments` | Org JWT |
| `GET` | `/risks/{id}/history` | Org JWT |
| `GET` | `/risks/{id}/treatments` | Org JWT |
| `POST` | `/risks/{id}/treatments` | Org JWT |
| `POST` | `/risks/treatments/{id}/submit` | Org JWT |
| `POST` | `/risks/treatments/{id}/approve` | Org JWT + **authorizer** dual-control session |
| `POST` | `/risks/treatments/{id}/reject` | Org JWT + **authorizer** dual-control session |
| `POST` | `/risks/treatments/{id}/complete` | Org JWT |

### Treatment workflow

```text
propose → submit (under_approval) → approve|reject
  → (if approved) complete → residual risk on risk record
```

---

## Statuses

**Risk**: identified → assessed → treatment_proposed → under_approval → approved → in_progress → mitigated / accepted → monitoring / closed

**Treatment**: proposed → under_approval → approved / rejected → in_progress → completed

---

## Expert review (billable)

```http
GET /api/v1/risks/export?format=json
```

Export meta includes `purpose: expert_review_billable` and ownership note that risks remain client-owned.
