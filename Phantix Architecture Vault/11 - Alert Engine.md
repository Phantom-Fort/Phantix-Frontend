Tags: #engine #alert

# Alert Engine

Status: 🟢 Implemented (July 2026). The most mature engine in the codebase, and the closest thing we have to a working reference for the future [[04 - Engine Bus]] pattern.

Delivers security alerts to clients via email / WhatsApp / Telegram with severity-based routing. Folds in `ENGINE_NOTIFICATION` from the original brainstorm — see [[02 - Engine Registry]] for why that stays merged for now.

**Approved channel roadmap:** Email, Telegram, WhatsApp implemented today; **Slack and Microsoft Teams** are approved additions, not yet built — same severity-routing rules should extend to them rather than inventing new routing logic per channel.

## Severity → channel routing (enforced, not configurable)

| Severity | Email | WhatsApp | Telegram |
|---|---|---|---|
| critical | ✅ | ✅ | ✅ |
| high / medium / low / info | ✅ | ❌ | ❌ |

Non-critical alerts are never sent to WhatsApp/Telegram, even if `channel_policy` is misconfigured — this is enforced in code, not just documented as a convention.

## Two SMTP systems — do not confuse

| System | Config | Purpose |
|---|---|---|
| Phantix OTP SMTP | env `SMTP_*` | Registration / identity email OTP only — [[03 - Control Plane]] |
| Client alert SMTP | `PUT /alerts/settings → smtp` | Security alerts for that org, Fernet-encrypted per-org |

## Architecture

```text
scan complete / risk critical / …
        │
        ▼
  alert_events (status=pending)
        │
        ├── Celery task process_alert_event
        ├── Celery beat process_pending (30s)
        └── python -m app.workers.alert_daemon
                │
                ├─ email    → client SMTP
                ├─ whatsapp → provider stub (log) until integrated
                └─ telegram → provider stub (log) until integrated
        │
        ▼
  alert_deliveries (per recipient/channel)
```

WhatsApp and Telegram are `provider=log` stubs today — they queue and log correctly but don't hit real provider APIs yet. Wiring those is the top item in [[16 - Deployment Roadmap]].

## Built-in event types today

`scan.completed`, `scan.failed`, `risk.created`, `risk.critical`, `custom.test` — dot.case naming. Note this is the one place in the codebase where the naming convention diverges from the now-approved PascalCase standard (`ScanCompleted`, etc.) — see [[15 - Event Contracts]] for the full picture and the open migration decision.

## The pattern worth copying elsewhere

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

Any module can call this without knowing how delivery works — that's already publish/subscribe in spirit, just without a formal bus underneath it. When [[04 - Engine Bus]] gets built for real, this function's signature is the model to generalize, not a new interface designed from scratch.

## Related notes

[[02 - Engine Registry]] · [[04 - Engine Bus]] · [[15 - Event Contracts]] · [[03 - Control Plane]]
