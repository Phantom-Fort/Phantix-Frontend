# Application Implementation Guide (`app.phantix.site`)

**Surface**: Operator / analyst **application** product  
**Audience**: FE engineers for the app portal (not staff; not onboarding wizard)  
**Auth**: Dual tokens — `app_session` + `device_token`  
**API prefix**: `/api/v1`  
**Related**: [TWO_PLATFORM_AUTH.md](../TWO_PLATFORM_AUTH.md) · [PLATFORM_APP_FE_CHECKLIST.md](../PLATFORM_APP_FE_CHECKLIST.md) · [DUAL_CONTROL_SETUP_FE.md](../DUAL_CONTROL_SETUP_FE.md)

---

## 1. Product purpose

| Platform (`platform.*`) | Application (`app.*`) |
|-------------------------|------------------------|
| Company admin, keys, billing, invites | Day-to-day operate: campaigns, findings, risks, reports |
| Company JWT / org-user JWT | **App session + device token** from login link |
| Issues login links | Redeems login links |

Many **product APIs** (`/vapt`, `/scans`, `/risks`, `/reports`, …) are shared; the **difference is how the user authenticates** and which headers are required.

---

## 2. Auth architecture (mandatory)

### 2.1 Tokens

| Token | Header | Lifetime (typical) | Purpose |
|-------|--------|--------------------|---------|
| `app_session` | `Authorization: Bearer …` | ~60 min (`APP_SESSION_EXPIRE_MINUTES`) | Identity + org + role |
| `device_token` | `X-Device-Token: …` | ~30 days | Device bind; anti-session-theft |

```http
Authorization: Bearer <app_session>
X-Device-Token: <device_token>
X-Device-Id: <stable-browser-uuid>
```

When dual-control operate is required:

```http
X-Dual-Control-Session: <session>
```

**IDOR rule**: Dual-control user must be the **same** user as app session.

### 2.2 Storage

```ts
app_session_token
app_device_token
app_device_id        // UUID generated once per browser
// Do NOT store platform staff JWT or company password here
```

### 2.3 Env the FE should know

| Env (backend) | FE impact |
|---------------|-----------|
| `APP_LOGIN_BASE_URL` | Links open on app host |
| `APP_REQUIRE_DEVICE_TOKEN` | If true, missing device token → 401/403 |
| `APP_SESSION_EXPIRE_MINUTES` | Refresh / re-login UX |
| `DEVICE_TOKEN_EXPIRE_DAYS` | “Trusted device” messaging |

---

## 3. Login journey (all endpoints)

### Step A — Open invite link

User hits:

```
https://app.phantix.site/login?token=<login_link_secret>
```

### Step B — Challenge (validate link)

```http
POST /api/v1/app/auth/challenge
Content-Type: application/json

{ "token": "<login_link_secret>" }
```

**Use case**: Show company name, user email mask, expire time; reject invalid/expired links with clear error.

### Step C — Password

```http
POST /api/v1/app/auth/password
{
  "token": "<login_link_secret>",
  "password": "<user password>"
}
```

**Success**: `{ mfa_required: true, mfa_token, destination_masked }`  
**Use case**: Move to OTP screen; do not store password.

### Step D — MFA + device bind

```http
POST /api/v1/app/auth/mfa
X-Device-Id: <uuid>

{
  "mfa_token": "...",
  "code": "123456",
  "device_id": "<uuid>"
}
```

**Success**:

```json
{
  "access_token": "<app_session JWT>",
  "device_token": "<device JWT>",
  "token_type": "app_session",
  "user": { "id": 1, "email": "...", "role": "..." },
  "organization_id": 11
}
```

Store both tokens; set axios/fetch interceptor for dual headers.

### Step E — Session check

```http
GET /api/v1/app/auth/me
Authorization: Bearer <app_session>
X-Device-Token: <device_token>
```

**Use case**: App bootstrap; 401 → login.

### Optional — Resolve service key

```http
POST /api/v1/app/auth/resolve-key
X-Org-Api-Key: pk_live_...
```

**Use case**: Integrations / embedded clients resolving tenant metadata (not primary interactive UX).

---

## 4. Application shell pages & endpoints

After login, product navigation mirrors Platform product modules but with **app dual-token** auth.

### 4.1 Dashboard

| Data | Endpoint ideas |
|------|----------------|
| Active scan | `GET /scans/jobs/active` |
| Open campaigns | `GET /vapt/campaigns?status=running` |
| Top risks | `GET /risks/prioritized` |
| Tracker summary | `GET /reports/tracker` |

### 4.2 Assets (read-heavy for operators)

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/assets` | Scope for campaigns |
| `GET` | `/assets/{id}` | Asset detail + tags |
| `GET` | `/asset-tags` | Filters |

Mutations may require dual-control depending on RBAC.

### 4.3 Scans

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/scans/jobs` | Operator launches scan |
| `GET` | `/scans/jobs/{id}` | Progress |
| `POST` | `/scans/jobs/{id}/cancel` | Abort |
| `GET` | `/scans/results` | Review raw results + verification badges |

**FE**: Show `evidence.verification`:

| verification_status | Badge |
|---------------------|-------|
| `auto_verified` | Green “Verified (auto)” |
| `manually_verified` | Green “Verified (human)” |
| `unverified` | Amber “Needs verification” |
| `rejected` / `false_positive` | Grey/red “Excluded” |

Only verified results feed risks/reports.

### 4.4 VAPT campaigns (core app UX)

| Method | Path | Use case |
|--------|------|----------|
| `GET/POST` | `/vapt/campaigns` | List / create |
| `POST` | `/vapt/campaigns/{id}/start` | Start assessment |
| `POST` | `…/pause` · `…/resume` · `…/cancel` | Control plane for operators |
| `GET` | `…/findings` | Correlated findings table |
| `GET` | `…/approvals` | Pending human gates |
| `POST` | `/vapt/approvals/{id}/decide` | Approve/reject (assigned user only) |
| `POST` | `/vapt/plan` · `/vapt/plan/execute` | Guided planning |
| `GET/PUT` | `/vapt/settings` | Org operational settings |
| Schedules | `/vapt/schedules*` | Calendar / blackouts |

**Use case — full campaign**

1. Select assets → create campaign  
2. Start (requires security DB ready — if 400, deep-link to platform connections)  
3. Poll campaign status / phase  
4. Review findings (prefer verified)  
5. Generate report from campaign id  
6. Drive remediation via tracker  

### 4.5 Risks

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/risks` · `/risks/prioritized` | Work queue |
| `GET` | `/risks/{id}` | Explain score breakdown |
| `PATCH` | `/risks/{id}` | Assign owner |
| Treatments | `/risks/{id}/treatments*` | Propose → submit → approve → complete |

### 4.6 Reports

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/reports` | Generate client package |
| `GET` | `/reports/{id}/download?format=pdf` | Customer download |
| `GET` | `/reports/{id}/download?format=docx` | Editable deliverable |
| `GET` | `/reports/tracker` | Remediation board |
| `PATCH` | `/reports/tracker/{finding_key}` | Update status / verify / mark FP |

**Generate (application)**

```json
POST /api/v1/reports
{
  "report_type": "vapt_campaign",
  "campaign_id": 13,
  "formats": ["pdf", "docx", "markdown", "json"],
  "run_inline": false
}
```

If `run_inline: false`, poll `GET /reports/{id}` until `status=complete`.

**Critical UX copy**

> Reports include only **verified** findings. Heuristic scanner noise is excluded by default (`REPORT_REQUIRE_VERIFIED_FINDINGS`).

Show stats from report intelligence:

- `after_dedupe`  
- `after_verification`  
- `excluded_from_report`  

### 4.7 Compliance (operator GRC lite)

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/compliance/frameworks` | Browse |
| `POST` | `/compliance/assessments` | Run assessment |
| `GET` | `/compliance/assessments/{id}/results` | Control results |
| Questionnaire | `/compliance/questionnaire/*` | Answer as named user |
| Evidence | `/compliance/evidence*` | Upload / collect |

Questionnaire requires **org user** attribution — company-only JWT may be rejected for answers.

### 4.8 Alerts & audit (visibility)

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/alerts/events` | What was notified |
| `GET` | `/audit/events` | Who did what |

### 4.9 AI assist (optional)

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/ai/status` | Show if live AI vs templates |
| Org settings | `/ai/*` | If role allows |

AI never scores findings; FE must not present AI prose as definitive risk score.

---

## 5. Dual-control from the Application

Operators often need initiate/authorize for:

- Starting destructive campaigns  
- Approving risk treatments  
- Some user/role changes (platform)

**Flow**

1. User has `app_session` + `device_token`  
2. Open dual-control unlock (org-user login `purpose=dual_control` **or** dual-control session mint path your backend exposes)  
3. Attach `X-Dual-Control-Session` on mutate  
4. On idle expiry, re-prompt  

See [DUAL_CONTROL_SETUP_FE.md](../DUAL_CONTROL_SETUP_FE.md).

---

## 6. Error handling specific to App

| Code | Meaning | FE |
|------|---------|-----|
| 401 | Session or device token invalid | Clear both tokens → login |
| 403 device | Device mismatch | Force re-MFA / contact admin to clear device |
| 403 dual-control | Missing/expired operate session | Unlock modal |
| 409 | Active scan / campaign conflict | Show who/what is running |
| 400 security DB | Bootstrap not ready | CTA: “Ask admin to connect security DB on Platform” |

---

## 7. Recommended Application IA

```
/login?token=
/mfa
/dashboard
/assets
/scans
/vapt/campaigns
/vapt/campaigns/:id
/vapt/campaigns/:id/findings
/risks
/risks/:id
/reports
/reports/:id
/tracker
/compliance
/audit
/settings (vapt/alerts as allowed)
```

---

## 8. Acceptance checklist

- [ ] Login link → password → OTP → dual tokens stored  
- [ ] All API calls send `Authorization` + `X-Device-Token` (+ device id on auth)  
- [ ] `/app/auth/me` on bootstrap  
- [ ] Scan/VAPT/report happy path  
- [ ] Verification badges on findings/results  
- [ ] Report download PDF/DOCX  
- [ ] Tracker status updates including false_positive / verified  
- [ ] Dual-control mutations guarded  
- [ ] No staff JWT or company password form on app except invite redeem  
- [ ] Token refresh / re-login UX on 401  
