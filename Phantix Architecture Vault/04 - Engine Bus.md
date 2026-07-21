Tags: #architecture #engine-bus #events

# Engine Bus

Status: 🔴 Not started as a formal component. 🟡 An informal version already exists inside Alert Engine.

## The target

Once engines are physically separated, nothing should call another engine's code directly. Instead, every engine publishes events, and interested engines subscribe:

```text
Scanner Engine
    ↓ publishes ScanCompleted
Engine Bus
    ↓
Risk Engine (subscribes)  →  Alert Engine (subscribes)  →  Reporting Engine (subscribes)
```

This buys independent deployability and lets new engines (Compliance, AI) subscribe to existing events without touching Scanner or Risk code at all.

## The approved event chain (v1.0)

This is the reference flow the Refactoring Plan uses to describe how engines should communicate — read it as an illustration of the pattern, not a literal sequence every request follows:

```text
AssetCreated
    ↓
ScanRequested
    ↓
ScanCompleted
    ↓
FindingCreated
    ↓
RiskCalculated
    ↓
ComplianceUpdated
    ↓
AIAnalysisRequested
    ↓
ReportGenerated
    ↓
AlertQueued
    ↓
AuditRecorded
```

Each arrow is a subscription, not a function call — Risk Engine doesn't call Scanner Engine to ask if a scan finished, it subscribes to `ScanCompleted`. See [[15 - Event Contracts]] for the full approved catalog.

## What we actually have today

There is no message bus. What exists:

1. **Direct calls** — most cross-domain interaction today (e.g. a scan result creating/updating a risk) happens as a direct function call or shared transaction, not an event.
2. **Celery + Redis** — already deployed for async work (`phantix.scan.run_job`, alert processing). This is the natural substrate for a real bus later — **don't introduce a second broker** (e.g. Kafka) until Celery/Redis genuinely can't keep up. Celery tasks + Redis pub/sub can carry named events with a `type` and `payload` field well past MVP scale.
3. **`alert_service.enqueue_alert`** — this is the closest thing we have to a publish call today. Any module can already do:

```python
from app.services import alert_service

await alert_service.enqueue_alert(
    db, organization_id,
    event_type="custom.module_event",
    severity="critical",
    title="Something happened",
    body="Details…",
    payload={"ref": 123},
)
```

...without knowing anything about how Alert Engine delivers it. That's already the correct shape for a bus publish call — see [[11 - Alert Engine]] for the full picture. Use this as the reference pattern when the bus is formalized, rather than designing the bus interface from scratch.

## Naming convention — now formally decided, migration still pending

This vault previously recommended keeping the dot.case convention already live in Alert Engine (`scan.completed`, `risk.critical`) rather than adopting the PascalCase style from the original brainstorm. **v1.0 makes the opposite call explicitly** — its entire event chain and event contract catalog are PascalCase, strongly typed (`ScanCompleted`, `RiskCreated`, `AssetCreated`). That's now the approved standard; treat it as the target, not a suggestion to weigh against the earlier recommendation.

What this means practically, and what's still an open action item rather than a done deal:

- **New events** (Asset, Compliance, AI — none of which exist in code yet) should be named PascalCase from day one. No migration cost, no conflict.
- **Existing shipped events** — `scan.completed`, `scan.failed`, `risk.created`, `risk.critical`, `custom.test`, all currently consumed by [[11 - Alert Engine]] — are not yet renamed. Someone needs to decide, and record the decision here: rename the constants in `alert_service.py` / `tasks.py` to match (`ScanCompleted`, etc.), or add a translation shim at the bus boundary that maps legacy dot.case names to the approved PascalCase ones so Alert Engine's working code doesn't need to change on day one. Either is fine; leaving it undecided is the only wrong answer, since it means two conventions will keep coexisting by accident instead of on purpose.
- Full inventory of what's shipped vs. approved-but-unbuilt lives in [[15 - Event Contracts]].

## When to actually build this

Not now. Build it the first time two engines outside of Alert Engine need the same event and direct calling starts getting awkward — likely when Scanner Engine and Risk Engine need to both react to the same discovery event without Scanner knowing Risk exists. See the phased plan in [[16 - Deployment Roadmap]].

## Related notes

[[02 - Engine Registry]] · [[11 - Alert Engine]] · [[15 - Event Contracts]] · [[16 - Deployment Roadmap]]
