# VAPT Engine

**Frontend guides**: [frontend/02_PLATFORM_IMPLEMENTATION.md](./frontend/02_PLATFORM_IMPLEMENTATION.md) §8 · [frontend/03_APPLICATION_IMPLEMENTATION.md](./frontend/03_APPLICATION_IMPLEMENTATION.md) §4.4 · [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)  
**Engineering**: [VAPT_ENGINE_IMPLEMENTATION_GUIDE.md](../Phantix%20Architecture%20Vault/Engineering%20Docs/VAPT_ENGINE_IMPLEMENTATION_GUIDE.md)  
**Web scanner**: [WEB_SCANNER_IMPLEMENTATION_GUIDE.md](../Phantix%20Architecture%20Vault/Engineering%20Docs/WEB_SCANNER_IMPLEMENTATION_GUIDE.md)  
**Package**: `app/engines/vapt_engine/`  
**Status**: Campaign lifecycle, dual control, mining, scheduling, and **web application scanner**. Burp MCP is advanced/AI path (stub until configured).

**Reporting note**: Campaign findings are collated into client reports only after the **verification gate** (`app/shared/findings/verification.py`). Attack-path correlations auto-verify; heuristic probes do not.

---

## Capabilities

| Area | Status |
|------|--------|
| Campaign lifecycle (pause/resume/cancel) | ✅ |
| Builtin + DB procedures | ✅ |
| Rule-based correlation | ✅ |
| Complexity → AIAnalysisRequested | ✅ (only when `DEEPSEEK_API_KEY` is set — AI pentest gate) |
| Dual control (campaign / step / multi-party) | ✅ |
| Burp MCP adapter | ✅ **stub** until live MCP; **advanced AI path** (not primary scanner) — configure `BURP_MCP_ENDPOINT` for agent/inline complex analysis |
| Correlation mining (per-org + opt-in cross-org) | ✅ |
| Campaign schedules + Celery Beat | ✅ |
| Web Application Scanner (`web_scanner/`) | ✅ pipeline + step_type `web_scan` |

**MUST NOT**: expose web scanner as a standalone engine; score risk; send alerts; call LLMs; write dual-control into customer security DB.

**Dependency audit** ([ENGINE_DEPENDENCY_AUDIT.md](../Phantix%20Architecture%20Vault/Engineering%20Docs/ENGINE_DEPENDENCY_AUDIT.md)): missing security DB → clear `CampaignStepError` / `CampaignError`; optional steps skip; start requires matching assets.

---

## Intelligent Orchestrator

Autonomous campaign planning from org profile + asset inventory.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/vapt/plan` | Generate plan (no execute) |
| GET | `/api/v1/vapt/plan/{plan_id}` | Retrieve stored plan |
| POST | `/api/v1/vapt/plan/execute` | Create campaign from plan (+ optional start) |

```json
POST /api/v1/vapt/plan
{}

POST /api/v1/vapt/plan/execute
{
  "plan_id": "plan_abc123",
  "modifications": { "exclude_scan_types": ["brute_scan"] },
  "start": true
}
```

Package: `app/engines/vapt_engine/orchestrator/` · Guide: [INTELLIGENT_ORCHESTRATOR.md](../Phantix%20Architecture%20Vault/Engineering%20Docs/INTELLIGENT_ORCHESTRATOR.md)

Plans are Redis-backed (1h TTL, in-memory fallback). Execute creates a campaign with `procedure_override` (`campaign_type=intelligent_assessment`) and **starts by default** (`start=true`).

**Why a campaign stays `draft`:** auto-start is blocked when the org has **no matching assets** in the security DB (`inventory_snapshot.total: 0` in your plan), or security storage is not bootstrapped. The API returns **400** with `start_error` + `campaign_id` so you can fix inventory and call:

```http
POST /api/v1/vapt/campaigns/{id}/start
```

**Async by default (avoids Cloudflare 504):** start / plan execute / resume use **`run_inline=false`**. The API responds **202 Accepted** with `status: active` (or running) and:

```json
{
  "async": {
    "execution": "async",
    "message": "Campaign is running in the background…",
    "poll_url": "/api/v1/vapt/campaigns/1",
    "alert_on_completion": true
  }
}
```

Poll `GET /vapt/campaigns/{id}`. On finish, `CampaignCompleted` / `CampaignFailed` queues a client **alert** (email/channels via Alert Engine — requires **org alert SMTP**, not platform OTP SMTP).  
Keep a Celery worker on the `vapt` queue (`./start.sh` or `celery … -Q vapt,scans,...`).

**One active/paused campaign per org.** Cancel blockers:

```http
POST /api/v1/vapt/campaigns/{id}/cancel
{ "reason": "Clear slot" }
```

**Findings vs raw results (important for UI):**

| API | Content |
|-----|---------|
| `GET /vapt/campaigns/{id}/findings` | **Correlated** attack paths only |
| `GET /scans/results` | **All** tool findings (nmap JSON, nuclei, dns, …) |
| Campaign step `output_summary` | Per-step metrics (web crawl counts, `proxy_summary`, job ids) |

**Lab-only:** `"run_inline": true` blocks until done (local only). `"skip_asset_validation": true` starts without assets.

## Web Application Scanner

Subsidiary of VAPT (not a registry engine). Invoked only via campaign steps:

- **`step_type: "web_scan"`** — full multi-tool pipeline
- **`step_type: "scan"`** with `"tools": ["web"]` or `"scan_type": "web"` — same pipeline alias

### Pipeline tools (Docker via Scanner `tool_executor`)

| Phase | Tools |
|-------|--------|
| Discovery | subfinder, httpx (+ Asset Engine inventory) |
| Recon | katana |
| Vuln | nuclei (OWASP/CVE tags) |
| SQLi | sqlmap (parameterized URLs only) |
| Evidence | gowitness |

### Builtin procedures

| Key | Notes |
|-----|--------|
| `web_scan` | Full web pipeline → correlate → analyze |
| `web_app_scan_only` | Focused web assessment (no infra) |
| `full_vapt` | Infra nmap + **web_scan** + Burp + mobile + gates |

```json
{
  "campaign_type": "web_scan",
  "procedure_key": "web_scan",
  "asset_scope": { "domains": ["example.com"] }
}
```

AI toggles on step config (`ai_auth`, `flowmapper`, `ml_soft404`) default **off** and currently report `not_implemented` in scan metadata.

---

## Platform tables

`vapt_campaigns`, `vapt_campaign_steps`, `vapt_procedures`, `vapt_correlation_rules`,
`vapt_correlated_findings`, `vapt_approval_requests`, `vapt_mining_patterns`,
`vapt_org_settings`, `vapt_schedules`

```bash
alembic upgrade head   # through j0e1f2a3b4c5
```

---

## API (org JWT)

| Method | Path |
|--------|------|
| Campaign CRUD + start/pause/resume/cancel | `/api/v1/vapt/campaigns…` |
| Findings | `/api/v1/vapt/campaigns/{id}/findings` |
| Procedures / correlation rules | `/api/v1/vapt/procedures`, `…/correlation-rules` |
| Approvals | `GET …/campaigns/{id}/approvals`, `POST …/approvals/{id}/decide` |
| Settings (mining consent, AI threshold) | `GET/PUT /api/v1/vapt/settings` |
| Schedules | `/api/v1/vapt/schedules` |
| Mining candidates | `GET /api/v1/vapt/mining/candidates` |

### Staff

`/api/v1/admin/vapt/procedures`, `correlation-rules`, `schedules` (+ skip-next, pause-until, run-now)

---

## State machine (extended)

```text
draft ──(requires_approval)──▶ pending_approval ──approved──▶ active
  │                              └── rejected ──▶ cancelled
  └──▶ active ⇄ paused ──▶ completed | failed | cancelled
```

`full_vapt` sets `requires_approval` + multi-party roles.

---

## Burp (later)

```env
BURP_MCP_ENDPOINT=
BURP_API_URL=
BURP_LICENSE_KEY=
```

Until set, steps with `"tools": ["burp"]` emit **stub** findings (`provider=stub`) so procedures run without Pro license.

---

## Schedules

Celery Beat polls every 60s: `phantix.vapt.poll_schedules` → `phantix.vapt.execute_schedule`.

```json
POST /api/v1/vapt/schedules
{
  "schedule_name": "Weekly infra",
  "procedure_key": "infra_scan",
  "cron_expression": "7d",
  "asset_scope_template": { "tags": ["external"] }
}
```
