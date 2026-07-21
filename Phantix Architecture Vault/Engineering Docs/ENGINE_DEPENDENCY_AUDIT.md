# Engine Dependency Audit — Blockers & Graceful Degradation

**Date**: July 14, 2026
**Status**: Implemented — scanner adapter errors, optional steps, start-time asset validation
**Audience**: Phantix Backend Engineers

---

## 1. Dependency Map

```
Control Plane   ─── Auth (used by ALL engines)
      │
      ▼
Asset Engine    ─── Asset inventory
      │
      ▼
Scanner Engine  ─── Scan results
      │
      ├──▶ Risk Engine    ─── Risk register
      ├──▶ VAPT Engine    ─── Campaign findings
      │       │
      │       ├──▶ Correlation Engine  ─── Attack paths
      │       └──▶ Compliance Engine   ─── Framework mapping
      │
      ├──▶ Reporting Engine  ─── Reports (collects from ALL)
      │
      └──▶ AI Engine  ─── Enrichments (template fallback if missing)
```

---

## 2. Critical Path — Campaign Execution

**Rule**: Campaigns fail with a clear message if the security DB is missing (critical path). Individual steps that are optional gracefully degrade.

### 2.1 Scanner Engine → Security DB (Currently Hard Fails)

| Location | Problem |
|---|---|
| `create_scan_job()` in `scan_service.py` | Raises `SecurityDBNotConfigured` uncaught → 500 error |
| `execute_scan_job()` in `scan_service.py` | Same uncaught exception |
| `list_scan_results()` in `scan_service.py` | Same pattern |

**Fix 1 — Scanner Adapter (VAPT Engine):**

```python
# app/engines/vapt_engine/adapters/scanner_adapter.py

from app.shared.database.security_db import SecurityDBNotConfigured, SecurityDBNotReady

async def create_scan_for_step(db, org, step):
    try:
        return await scan_service.create_scan_job(db, org, ...)
    except SecurityDBNotConfigured as exc:
        raise CampaignStepError(
            "No security database configured for this organization. "
            "Create a connection at POST /api/v1/db-connections first."
        ) from exc
    except SecurityDBNotReady as exc:
        raise CampaignStepError(
            "Security database connection exists but schema is not bootstrapped. "
            "Run POST /api/v1/db-connections/{id}/bootstrap first."
        ) from exc
```

**Fix 2 — Step Executor (Catch + Continue Optional Steps):**

```python
# app/engines/vapt_engine/services/step_executor.py

async def _run_scan_step(db, org, campaign, step, ...):
    try:
        # existing scan logic
        ...
    except CampaignStepError as exc:
        step.status = "failed"
        step.error_message = str(exc)
        await db.commit()
        # If step is optional, continue the campaign
        if not step.config.get("required", True):
            return step  # campaign continues with this step skipped
        raise  # re-raise — campaign manager will fail the campaign
```

**Fix 3 — Campaign Manager (Asset Validation):**

```python
# app/engines/vapt_engine/services/campaign_manager.py

async def start_campaign(db, org, campaign_id):
    campaign = await get_campaign(db, campaign_id)
    asset_count = await _count_assets_in_scope(db, org.id, campaign.asset_scope)
    if asset_count == 0:
        raise CampaignError(
            f"No assets match the campaign scope {campaign.asset_scope}. "
            f"Add assets first or expand the scope."
        )
    # existing start logic...
```

---

## 3. Non-Critical Paths — Already Graceful

These already handle missing data without crashing.

| Consumer | Behavior | Status |
|---|---|---|
| Reporting Engine → any engine | Catches exceptions per section, returns empty | ✅ |
| AI Engine → any engine | Falls back to template narratives | ✅ |
| Compliance Engine → no evidence | Returns `findings_in: 0` with empty gaps | ✅ |
| Risk Engine → no scan results | Returns empty risk list | ✅ |

No changes needed here.

---

## 4. Summary of Required Changes

| # | File | Change |
|---|---|---|
| 1 | `scanner_adapter.py` | Wrap `create_scan_for_step()` in try/except → `CampaignStepError` |
| 2 | `step_executor.py` | Catch `CampaignStepError`, set step to `failed`, continue if optional |
| 3 | `campaign_manager.py` | Validate asset count > 0 before starting campaign |

Effort: 1 day
