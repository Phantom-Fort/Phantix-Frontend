# Platform Implementation Guide (Customer Management Portal)

**Surface**: `platform.phantix.site` — organization **management** + product modules  
**Audience**: FE engineers for the customer portal  
**Auth**: Company JWT (`type=access`) and/or org-user JWT (`type=org_user`) + optional dual-control session  
**API prefix**: `/api/v1`  
**Related**: [PLATFORM_APP_FE_CHECKLIST.md](../PLATFORM_APP_FE_CHECKLIST.md) · [FRONTEND_INTEGRATION.md](../FRONTEND_INTEGRATION.md) · [DUAL_CONTROL_SETUP_FE.md](../DUAL_CONTROL_SETUP_FE.md) · [API_ENDPOINT_CATALOG.md](./API_ENDPOINT_CATALOG.md)

---

## 1. What the Platform app is

| Responsibility | Examples |
|----------------|----------|
| Tenant identity | Company profile, child companies, service keys, login links |
| Security storage | Customer security DB connections + bootstrap |
| People | Org users, roles, dual-control pairs |
| Product | Assets, scans, VAPT, risks, reports, compliance, alerts, audit, AI settings, tools, billing, support |

**Not this app**: Staff console (`type=staff`). Application operate shell is often **app.phantix.site** (dual tokens) — see [03_APPLICATION_IMPLEMENTATION.md](./03_APPLICATION_IMPLEMENTATION.md). Many product APIs accept **either** org/company JWT **or** app dual tokens depending on backend dependencies; always send the correct realm token for the surface.

---

## 2. Auth model for Platform FE

### 2.1 Token stores (recommended)

```ts
// Separate keys — never mix with staff or app_session
platform_access_token     // company type=access
platform_org_user_token   // type=org_user (named user)
platform_dual_control     // session string for X-Dual-Control-Session
device_id                 // stable UUID for org-user login
```

### 2.2 Company login

| Step | Endpoint | Notes |
|------|----------|-------|
| Password | `POST /organizations/login` | form-urlencoded `username` + `password` |
| MFA | `POST /organizations/login/mfa` | `{ mfa_token, code }` |
| Me | `GET /organizations/me` | Profile shell |

### 2.3 Org-user login (named identity)

| Step | Endpoint | Notes |
|------|----------|-------|
| Start | `POST /org-users/auth/login` | `{ email, purpose: "access"\|"dual_control", device_id }` |
| MFA | `POST /org-users/auth/login/mfa` | OTP |
| Device challenge | `POST /org-users/auth/login/device` | When another session exists |
| Logout | `POST /org-users/auth/logout` | Invalidate |

**Use cases**

| Purpose | When |
|---------|------|
| `access` | Read UI as named user (audit attribution) |
| `dual_control` | Unlock operate mutations (see dual-control doc) |

### 2.4 Dual-control session header

```http
Authorization: Bearer <org_user or company JWT>
X-Dual-Control-Session: <session_token>
```

- Idle timeout ~**3 minutes** — refresh activity on successful mutate  
- 403 → show “Operate unlock” modal  
- Full UX: [DUAL_CONTROL_SETUP_FE.md](../DUAL_CONTROL_SETUP_FE.md)

---

## 3. Platform shell — tenant management

### 3.1 Identity panel (always visible)

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/organizations/me/identity` | Show org **id**, **slug**, **creator_user_id** |

**FE**: Copy chips for support tickets.

### 3.2 Multi-company (group of startups)

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/organizations/me/companies` | List child companies |
| `POST` | `/organizations/me/companies` | Create child (`name`, `slug?`, `industry?`, `country?`) |

**Rule**: **One service key per company**, not per group.

### 3.3 Service keys

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/organizations/me/service-key` | Metadata only (prefix) |
| `POST` | `/organizations/me/service-key` | Create/rotate — **full key once** |
| `DELETE` | `/organizations/me/service-key/{id}` | Revoke |
| `GET/POST` | `/organizations/companies/{id}/service-key` | Child company key |

**UX**: Modal “Copy secret now — it will not be shown again.”

### 3.4 Application login links

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/organizations/me/users/{user_id}/login-link` | Issue one-time app URL |
| `GET` | `/organizations/me/login-links` | List (no secrets) |
| `DELETE` | `/organizations/me/users/{user_id}/device` | Clear device bind |

**Use case**: Platform admin invites operator to `app.phantix.site`.

### 3.5 Profile & logo (branding for reports)

| Method | Path | Use case |
|--------|------|----------|
| `GET/PATCH` | `/organizations/me` | Company profile |
| Logo upload | org branding endpoint if enabled | Report cover logo |

Reports use org name + logo in PDF/DOCX templates.

---

## 4. Security database connections (blocking for scans/VAPT)

**Without a ready security DB, scans/VAPT/findings will fail.**

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/db-connections` | List connections |
| `POST` | `/db-connections` | Add Postgres security storage |
| `GET` | `/db-connections/{id}` | Detail |
| `POST` | `/db-connections/{id}/test` | Connectivity test |
| `POST` | `/db-connections/{id}/bootstrap` | Create schema tables |
| `GET` | `/db-connections/drivers` | Driver availability |
| Status fields | `bootstrap_status=ready` | Gate product modules |

**FE gates**

```
if bootstrap_status !== 'ready':
  show banner → Connect security database
  disable Scans / VAPT start
```

Full detail: [CONNECTIONS.md](../CONNECTIONS.md).

---

## 5. People — org users & roles

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/org-users` | Directory |
| `POST` | `/org-users` | Create user |
| `GET/PATCH/DELETE` | `/org-users/{id}` | Manage |
| Dual-control assign | see dual-control endpoints | Initiator/authorizer pairs |

**Roles** (typical): viewer, operator, initiator, authorizer, admin — enforce UI by role; backend is authoritative.

---

## 6. Product module — Assets

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/assets` | Inventory table (filter/paginate) |
| `POST` | `/assets` | Manual add |
| `GET/PATCH/DELETE` | `/assets/{id}` | Detail |
| Discovery jobs | under assets discovery routes | Subdomain/DNS/Nmap discovery |
| APK / GitHub / API import | asset import routes | Specialized ingest |
| `GET/POST` | `/asset-tags` | Tag taxonomy |
| Assign tags | asset-tag assignment routes | Criticality / scope for compliance |

**Use cases**

1. Onboard in-scope hosts before VAPT  
2. Mark crown jewels (`criticality=high`)  
3. Trigger discovery → review proposed assets → verify  

Doc: [ASSET_DISCOVERY.md](../ASSET_DISCOVERY.md).

---

## 7. Product module — Scans

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/scans/jobs` | History |
| `POST` | `/scans/jobs` | Create job (tools, targets/assets) |
| `GET` | `/scans/jobs/active` | One-active-job lock UI |
| `GET` | `/scans/jobs/{id}` | Status poll |
| `POST` | `/scans/jobs/{id}/run` | Enqueue execution |
| `POST` | `/scans/jobs/{id}/cancel` | Cancel active |
| `GET` | `/scans/results` | Result rows (include `evidence.verification`) |
| `GET` | `/scans/yaml/catalog` | Available YAML checks |

**FE rules**

- Only **one active scan** per org — show conflict from 409  
- Poll job until `completed` / `failed` / `cancelled`  
- Display verification badge from `evidence.verification.verification_status` when present  
- Unverified heuristics will **not** enter client reports (see Reporting)

---

## 8. Product module — VAPT

| Method | Path | Use case |
|--------|------|----------|
| `GET/POST` | `/vapt/campaigns` | List / create |
| `GET` | `/vapt/campaigns/{id}` | Detail + phase |
| `POST` | `/vapt/campaigns/{id}/start` | Start (needs security DB) |
| `POST` | `…/pause` · `…/resume` · `…/cancel` | Lifecycle |
| `GET` | `…/findings` | Correlated findings |
| `GET` | `…/approvals` | Multi-party approval |
| `POST` | `/vapt/approvals/{id}/decide` | Approve/reject step |
| `GET` | `/vapt/procedures` | Procedure catalog |
| `GET` | `/vapt/correlation-rules` | Rules browser |
| `GET/POST` | `/vapt/schedules` | Scheduling |
| `POST` | `/vapt/schedules/{id}/blackout` | Blackout windows |
| `GET/PUT` | `/vapt/settings` | Org VAPT settings |
| `POST` | `/vapt/plan` | Intelligent plan from inventory |
| `POST` | `/vapt/plan/execute` | Execute plan |
| `GET` | `/vapt/plan/{id}` | Plan status |
| `GET` | `/vapt/mining/candidates` | Mined rule candidates |

**Campaign create body (typical)**

```json
{
  "name": "Q3 external assessment",
  "campaign_type": "external",
  "procedure_key": "...",
  "asset_scope": { "asset_ids": [1, 2] }
}
```

**Use case flow**

```
Assets ready → Create campaign → Start → Poll status → Review findings
→ Generate report (verified-only) → Tracker remediation
```

Doc: [VAPT.md](../VAPT.md).

---

## 9. Product module — Risks

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/risks` | Register (filters: status, level, q) |
| `GET` | `/risks/prioritized` | Priority queue |
| `GET` | `/risks/{id}` | Detail + breakdown |
| `PATCH` | `/risks/{id}` | Owner / treatment plan |
| `GET` | `/risks/{id}/history` | Audit of score changes |
| `GET/POST` | `/risks/{id}/treatments` | Treatment workflow |
| `POST` | `/risks/treatments/{id}/submit` | Dual-control submit |
| `POST` | `…/approve` · `…/reject` · `…/complete` | Lifecycle |
| `GET` | `/risks/export` | CSV/export |
| `GET` | `/risks/{id}/assessments` | Assessment history |

**FE notes**

- Reachability FPs should **not** appear as High after severity floor + verification gate  
- Show `scoring_breakdown` expanders for explainability  
- Dual-control on treatment approve paths  

Doc: [RISK.md](../RISK.md).

---

## 10. Product module — Reports (critical for FE)

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/reports` | Generate |
| `GET` | `/reports` | List versions |
| `GET` | `/reports/{id}` | Metadata + sections |
| `GET` | `/reports/{id}/download?format=pdf` | Download artifact |
| `POST` | `/reports/export` | Ad hoc export |
| `GET` | `/reports/tracker` | Finding tracker |
| `PATCH` | `/reports/tracker/{finding_key}` | Status/owner update |

### Generate body

```json
{
  "report_type": "vapt_campaign",
  "campaign_id": 13,
  "title": "Q3 VAPT",
  "formats": ["markdown", "json", "pdf", "docx"],
  "run_inline": true
}
```

| `report_type` | UI label |
|---------------|----------|
| `vapt_campaign` | Full campaign package (default) |
| `executive` | Board summary |
| `compliance` | Compliance-first |
| `tracker` | Tracker snapshot |

| Format | Client use |
|--------|------------|
| `pdf` / `docx` | Customer deliverable (VAPT template) |
| `markdown` | Preview / audit |
| `json` | FE deep dive / debug |
| `xlsx` / `csv` | Spreadsheet export |

### Verification gate (must surface in UI)

Backend default: **`REPORT_REQUIRE_VERIFIED_FINDINGS=true`**.

| Finding state | In executive report? |
|---------------|----------------------|
| `auto_verified` / `manually_verified` | Yes |
| `unverified` / heuristic probes | No (appendix only) |
| `rejected` / `false_positive` / reachability | No |

**FE should show on report detail:**

- Counts: after_dedupe vs after_verification vs excluded  
- Confidence column on findings tables  
- Link to “Unverified candidates” section if present  

### Tracker patch

```json
PATCH /reports/tracker/VAPT-12
{ "status": "in_progress", "owner": "appsec@acme.com" }
```

Statuses (typical): `open`, `in_progress`, `resolved`, `accepted`, `false_positive`, `verified`

Marking `verified` / `false_positive` affects future verification classification.

Doc: [REPORTING.md](../REPORTING.md).

---

## 11. Product module — Compliance

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/compliance/status` | Engine maturity + connectors |
| `GET` | `/compliance/frameworks` | Catalog |
| `POST` | `/compliance/map` | Map findings → controls |
| `GET/PUT` | `/compliance/profile` | Business profile |
| `GET` | `/compliance/recommendations` | Framework suggestions |
| Questionnaire | `/compliance/questionnaire/*` | Multi-user GRC answers |
| `POST` | `/compliance/assessments` | Run assessment |
| `GET` | `/compliance/assessments` | History |
| `GET` | `/compliance/assessments/{id}/results` | Per-control results |
| **Evidence** | | |
| `GET` | `/compliance/connectors` | Connector readiness |
| `PUT` | `/compliance/connectors/{id}/config` | Store Wazuh/etc config |
| `POST` | `/compliance/evidence/collect` | Run connectors |
| `POST` | `/compliance/evidence` | Manual evidence |
| `GET` | `/compliance/evidence` | List evidence |
| `GET` | `/compliance/evidence/summary` | Dashboard metrics |
| `DELETE` | `/compliance/evidence/{id}` | Remove row |

### Assessment create

```json
{
  "framework_id": "soc2",
  "campaign_id": 13,
  "include_questionnaire": true,
  "include_posture": true
}
```

### Evidence collect (demo)

```json
{
  "connectors": ["wazuh", "manual"],
  "configs": {
    "wazuh": { "sample_alerts": [/* optional demo */] }
  }
}
```

**FE copy**: Keyword mapping is **triage**, not a certified audit. Show human review status on gaps.

Doc: [COMPLIANCE.md](../COMPLIANCE.md).

---

## 12. Product module — Alerts, Audit, AI, Tools, Billing, Support

### Alerts

| Method | Path | Use case |
|--------|------|----------|
| `GET/PUT` | `/alerts/settings` | SMTP + channels |
| `GET` | `/alerts/events` | Delivery log |
| `POST` | `/alerts/test` | Send test |

Email = real; WhatsApp/Telegram may be stub — show capability flags from API.

### Audit

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/audit/events` | Immutable trail |
| `GET` | `/audit/pending-actions` | Dual-control queue |
| Export | audit export routes | CSV/JSON |

### AI (org)

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/ai/status` or `/engines/ai/status` | Providers / pentest ready |
| Settings | `/ai/settings` | Org enablement |
| Usage | usage routes | Cost visibility |

Narratives enhance reports when providers configured; without keys → templates.

### Tools & billing & support

| Area | Base path | Use case |
|------|-----------|----------|
| Tools | `/tools/*` | Catalog, request, subscribe |
| Billing | `/billing/*` | Plan, payments |
| Support | `/support/tickets` | Customer tickets |

---

## 13. Search

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/search?q=` | Tenant-scoped ES search |
| `GET` | `/search/status` | ES availability |

If ES down, degrade gracefully.

---

## 14. Recommended Platform IA (information architecture)

```
/login
/setup/*                          → 01_ORG_SETUP
/dashboard                        → stats, active scan, open risks
/identity                         → id, slug, companies, keys
/users                            → org users + login links
/connections                      → security DB
/assets · /tags · /discovery
/scans
/vapt/campaigns · /vapt/plan · /vapt/schedules
/risks
/compliance · /compliance/evidence · /questionnaire
/reports · /reports/tracker
/alerts · /audit · /ai
/tools · /billing · /support
```

---

## 15. Platform acceptance checklist

- [ ] Company + org-user + dual-control flows work without token mixing  
- [ ] Service key shown once on create/rotate  
- [ ] Security DB bootstrap gate blocks scans/VAPT with clear CTA  
- [ ] Active scan conflict UX  
- [ ] VAPT campaign lifecycle + findings  
- [ ] Report generate/download PDF+DOCX; verification stats visible  
- [ ] Tracker patch updates status including verified/false_positive  
- [ ] Compliance assessment + evidence collect  
- [ ] Alerts test email  
- [ ] Support ticket create/reply  
