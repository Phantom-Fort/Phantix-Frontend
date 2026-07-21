Tags: #engine #risk

# Risk Engine

Status: 🟢 Implemented (v0.1). Security schema version 1.3.1.

Owns risk scoring, prioritization, and treatment — but never risk *ownership*. Every risk record requires `owner_department`; Phantix is advisor-via-export only, never the accountable party.

**Boundary rule (v1.0):** Risk Engine consumes scan findings; it never invokes scanners directly. Even the "automatic flow" below, which is currently a direct function call, should read as Risk Engine reacting to a `ScanCompleted`/`FindingCreated` event once the bus exists — not Risk Engine reaching into Scanner Engine to check on a job.

## Hybrid scoring

1. Base: Likelihood (1–4) × Impact (1–4), normalized to 1–100.
2. Rules engine: asset tags, asset type, finding severity counts, exposure — reads directly from [[05 - Asset Engine]].
3. Final: `min(100, base + rules)`, rules contribution capped. `scoring_breakdown` stored for explainability.

Levels: Low 1–24 · Medium 25–49 · High 50–74 · Critical 75–100.

## Prioritization — a distinct concern from scoring

Scoring answers "how bad is this?" Prioritization answers "what should we fix first?" — algorithm `phantix.risk_priority.v1`:

```text
priority = 0.35 × effective_severity
         + 0.25 × treatment_urgency
         + 0.15 × status_urgency
         + 0.15 × asset_context
         + 0.10 × age
```

Bands: P1 Immediate (80–100) · P2 This week (60–79) · P3 This month (40–59) · P4 Planned (20–39) · P5 Backlog (0–19). Every item carries `priority_factors` for explainability — this is worth protecting as a design principle if [[08 - AI Engine]] ever touches risk scoring: black-box scores are a regression here.

## Automatic flow (today's cross-engine call, informally)

1. [[06 - Scanner Engine]] writes a `scan_result`.
2. Risk Engine finds an existing risk by `(asset_id, vulnerability_key)` or creates one.
3. Recalculates score, writes a `risk_assessment`.
4. On create, auto-suggests a treatment (`proposed`).

This is a direct call today, not an event — the natural first candidate to move onto [[04 - Engine Bus]] once it exists (`scan.completed` → Risk Engine subscribes, rather than Scanner Engine knowing Risk Engine exists).

## Treatment workflow (depends on Control Plane)

```text
propose → submit (under_approval) → approve | reject
  → (if approved) complete → residual risk written to risk record
```

Approve/reject requires an **authorizer** dual-control session — this is a hard dependency on [[03 - Control Plane]]'s session system, not duplicated logic. Residual risk is recalculated at propose, approve, and complete.

## Statuses

**Risk**: identified → assessed → treatment_proposed → under_approval → approved → in_progress → mitigated / accepted → monitoring / closed
**Treatment**: proposed → under_approval → approved / rejected → in_progress → completed

## Expert review export

`GET /api/v1/risks/export?format=json|csv` — meta includes `purpose: expert_review_billable` and an explicit ownership note that risks remain client-owned. This export is one of two ad hoc "reporting" surfaces that exist today outside any Reporting Engine — see [[10 - Reporting Engine]].

## Related notes

[[02 - Engine Registry]] · [[05 - Asset Engine]] · [[06 - Scanner Engine]] · [[03 - Control Plane]] · [[10 - Reporting Engine]]
