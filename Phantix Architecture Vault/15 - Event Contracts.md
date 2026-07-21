Tags: #events #contracts

# Event Contracts

Status: 🟡 Partial — a real set of events already ships inside [[11 - Alert Engine]] using dot.case naming. v1.0 approves a broader, **strongly-typed PascalCase catalog** as the standard going forward. The two need reconciling — see the migration note below, this isn't cosmetic.

## The approved catalog (v1.0, PascalCase — the target)

```text
AssetCreated
AssetUpdated
ScanRequested
ScanQueued
ScanStarted
ScanCompleted
FindingCreated
RiskCreated
RiskUpdated
TreatmentApproved
ComplianceUpdated
AIRequested
AICompleted
ReportGenerated
AlertQueued
AlertDelivered
AuditRecorded
```

All events should be strongly typed. Future integrations should subscribe to events instead of modifying existing engines — that's the entire point of naming and typing these precisely now, before [[04 - Engine Bus]] exists to enforce it.

The approved reference flow, for context on typical ordering:

```text
AssetCreated → ScanRequested → ScanCompleted → FindingCreated →
RiskCalculated → ComplianceUpdated → AIAnalysisRequested →
ReportGenerated → AlertQueued → AuditRecorded
```

(Note `RiskCalculated` and `AIAnalysisRequested` appear in the reference flow but not the formal catalog list above — that's a real gap in v1.0 itself, not a transcription error in this vault. Worth flagging back to whoever owns the plan: either add them to the catalog, or the flow diagram should use `RiskCreated`/`AIRequested` for consistency.)

## What's actually implemented today (dot.case)

| event_type | Typical severity | Source | Consumed by | Approved-catalog equivalent |
|---|---|---|---|---|
| `scan.completed` | medium | [[06 - Scanner Engine]] job finished OK | Alert Engine | `ScanCompleted` |
| `scan.failed` | high | Scanner Engine job failed | Alert Engine | *(not in catalog — add `ScanFailed`)* |
| `risk.created` | medium/high | [[07 - Risk Engine]] new auto risk | Alert Engine | `RiskCreated` |
| `risk.critical` | critical | Risk Engine critical score → email+WA+TG | Alert Engine | *(not in catalog — add `RiskCritical`, or fold into `RiskCreated`'s payload as a severity field)* |
| `custom.test` | caller choice | `POST /alerts/test` | Alert Engine | test/dev only — no catalog equivalent needed |

Extensible today via `alert_service.enqueue_alert(event_type=..., severity=..., ...)` — any module can add a new dot.case event without touching Alert Engine's internals. That mechanism is sound; only the naming needs to change.

**Not yet events at all, still direct calls/writes**: `AssetCreated`/`AssetUpdated` (Asset Engine writes directly, no publish step), the scan → risk auto-creation flow, `AuditRecorded` (audit trail is currently a direct DB write inside Control Plane/Audit Engine's code — see [[12 - Audit Engine]]).

## Migration decision — needs an owner, not just a note

This vault cannot make this call unilaterally; it can only make sure it doesn't get lost. Two real options once someone builds [[04 - Engine Bus]] for real:

1. **Rename in place.** Change the constants Alert Engine already uses (`scan.completed` → `ScanCompleted`, etc.) as part of that work. Touches working, shipped code, but leaves exactly one naming convention in the codebase afterward.
2. **Translation shim.** Bus accepts both; legacy dot.case events get mapped to their PascalCase equivalent at the boundary. Zero risk to Alert Engine's current behavior, but means two conventions coexist indefinitely unless someone later removes the shim.

Either is defensible. Pick one when Engine Bus work actually starts (see [[16 - Deployment Roadmap]]), and update this note with the decision — don't leave both options open past that point.

## Rule for all new events going forward

Every new cross-domain interaction added from today onward should use the approved PascalCase catalog above (or a clearly-named extension of it, e.g. `ScanFailed` alongside `ScanCompleted`) — even before the formal Engine Bus exists, and even though it means new events won't match Alert Engine's current dot.case ones until the migration above happens. Publish through `enqueue_alert`'s pattern (or its eventual bus-native successor) rather than a new direct function call between service modules.

## Related notes

[[04 - Engine Bus]] · [[11 - Alert Engine]] · [[02 - Engine Registry]] · [[12 - Audit Engine]]
