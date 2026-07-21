# Client Alerting Daemon

**Status**: Implemented July 2026  
**Frontend guide**: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) (§ Alerts)

Delivers **security alerts** to clients via email / WhatsApp / Telegram with **severity-based routing**.

---

## Severity → channels

| Severity | Email | WhatsApp | Telegram |
|----------|-------|----------|----------|
| **critical** | ✅ | ✅ | ✅ |
| high / medium / low / info | ✅ | ❌ | ❌ |

Non-critical alerts are **never** sent to WhatsApp or Telegram, even if misconfigured in `channel_policy`.

---

## Two SMTP systems (do not confuse)

| System | Config | Purpose |
|--------|--------|---------|
| **Phantix OTP SMTP** | Env `SMTP_*` | Registration / identity email OTP only (**not** shown in org UI) |
| **Client alert SMTP** | `PUT /api/v1/alerts/settings` → `smtp` | Security alerts + **VAPT completion mail** for that organization |

**VAPT completion**: campaign finish queues `custom.vapt_campaign_completed`. Email is sent only if `alerts_enabled` and client `smtp.enabled` with recipients (or org primary email fallback).

Client SMTP passwords are **Fernet-encrypted** on the platform DB.

---

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

---

## API (org JWT)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/alerts/settings` | Read config (no secrets) |
| `PUT` | `/api/v1/alerts/settings` | Client SMTP + WA/TG + notify toggles |
| `GET` | `/api/v1/alerts/events` | Alert queue/history |
| `POST` | `/api/v1/alerts/test` | Enqueue + process test alert |
| `POST` | `/api/v1/alerts/events/{id}/process` | Force process one event |

### Example settings

```json
{
  "alerts_enabled": true,
  "smtp": {
    "enabled": true,
    "host": "smtp.client.com",
    "port": 587,
    "username": "alerts@client.com",
    "password": "secret",
    "from_email": "alerts@client.com",
    "from_name": "Acme Security Alerts",
    "use_tls": true
  },
  "email_recipients": ["security@client.com", "ciso@client.com"],
  "whatsapp": {
    "enabled": true,
    "recipients": ["ada.security", "+2348012345678"],
    "provider": "log"
  },
  "telegram": {
    "enabled": true,
    "recipients": ["ada_okonkwo"],
    "provider": "log",
    "bot_token": "optional-for-later"
  },
  "notify": {
    "scan_completed": true,
    "scan_failed": true,
    "risk_created": true,
    "risk_critical": true,
    "treatment_events": true
  }
}
```

---

## Built-in event types

| event_type | Typical severity | Source |
|------------|------------------|--------|
| `scan.completed` | medium | Scan job finished OK |
| `scan.failed` | high | Scan job failed |
| `risk.created` | medium/high | New auto risk |
| `risk.critical` | **critical** | Critical risk score → WA+TG+email |
| `custom.test` | caller choice | Test endpoint |
| (future) | … | Extensible via `enqueue_alert` |

---

## Running the daemon

```bash
# Long-running poller
python -m app.workers.alert_daemon --interval 5 --batch-size 50

# One-shot
python -m app.workers.alert_daemon --once

# Celery worker (also runs scan tasks)
celery -A app.workers.celery_app.celery worker -l info

# Celery beat (schedules process_pending every 30s)
celery -A app.workers.celery_app.celery beat -l info
```

---

## Integration for new modules

```python
from app.services import alert_service

await alert_service.enqueue_alert(
    db,
    organization_id,
    event_type="custom.module_event",
    severity="critical",  # or medium → email only
    title="Something happened",
    body="Details…",
    payload={"ref": 123},
)
```
