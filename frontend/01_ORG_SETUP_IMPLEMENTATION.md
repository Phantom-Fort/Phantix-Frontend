# Org Setup — Frontend Implementation Guide

**Surface**: Organization onboarding on **platform** (`platform.phantix.site`)  
**Auth during setup**: Company JWT (`type=access`) after login (register does **not** return a token)  
**API prefix**: `/api/v1`  
**Backend source of truth**: `app/engines/control_plane/api/organizations.py` · schemas `organization.py` + `org_setup.py`  
**Related**: [ORG_SETUP.md](../ORG_SETUP.md) · [TWO_PLATFORM_AUTH.md](../TWO_PLATFORM_AUTH.md) · [RBAC_MFA.md](../RBAC_MFA.md) · [DUAL_CONTROL_SETUP_FE.md](../DUAL_CONTROL_SETUP_FE.md) · [CONNECTIONS.md](../CONNECTIONS.md)

This guide is the **source of truth for FE engineers** implementing registration + the post-registration setup wizard.

---

## 1. Goals & success criteria

| Goal | Backend truth | FE must |
|------|---------------|---------|
| Register company | `POST /organizations/register` → `201` + org profile (no JWT) | Then send user to login |
| Login | Form login + optional email MFA | Store company JWT only after full success |
| Accept privacy | `privacy_notice_accepted` | Block OTP until accepted |
| Prove email control | Email OTP only (phone OTP removed) | Send + verify OTP UI |
| Optional company proof | Domain DNS / HTTP / CAC / manual | Mode cards; none required to complete |
| Complete setup | `POST …/setup/complete` | Enable only when `can_complete_setup` is true |
| Enter platform shell | `setup_completed` | Redirect to platform home; then dual-control + security DB |

**Complete requirements (backend):**

- Privacy notice accepted (`privacy_notice_accepted`)
- Email OTP verified (`email_verified` / `identity_verified`)
- Company modes are **optional** (`company_verified` is soft)

---

## 2. Screens & navigation

Recommended wizard (stepper). Always rehydrate from **`GET /organizations/me/setup`**.

```
[Register] → [Login (+ MFA)] → [1 Privacy] → [2 Profile extras (optional)]
  → [3 Email OTP] → [4 Company verification (optional)] → [5 Complete]
  → Platform home → dual-control users → security DB
```

| Suggested route | Purpose |
|-----------------|---------|
| `/register` | Company registration form |
| `/login` | Company password + MFA |
| `/setup` | Resume from `GET …/me/setup` (`next_step`) |
| `/setup/privacy` | Privacy step |
| `/setup/identity` | Website / legal name / phone |
| `/setup/otp` | Email OTP |
| `/setup/verify` | Domain / CAC / manual |
| `/setup/done` | Complete + redirect |

**Step routing helper** (prefer server fields):

```ts
type SetupStatus = {
  setup_completed: boolean;
  can_complete_setup: boolean;
  privacy_notice_accepted: boolean;
  email_verified: boolean;
  identity_verified: boolean;
  next_step: string | null; // privacy | email_otp | complete | …
  progress_percent: number;
  steps: Array<{ id: string; required: boolean; completed: boolean; title: string; description: string }>;
  // …
};

function routeFromSetup(s: SetupStatus): string {
  if (s.setup_completed) return "/dashboard";
  switch (s.next_step) {
    case "privacy": return "/setup/privacy";
    case "email_otp": return "/setup/otp";
    case "complete": return "/setup/done"; // optional modes allowed before this
    default: return "/setup"; // company_verification / domain / cac_rc / manual_review
  }
}
```

---

## 3. Auth bootstrap

### 3.1 Register (public) — no JWT returned

```http
POST /api/v1/organizations/register
Content-Type: application/json
```

**Required fields** (validation will 422 without these):

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Trading / brand name |
| `slug` | string | `^[a-z0-9-]+$`, unique |
| `email` | email | **Primary sign-in** only |
| `secondary_email` | email | Recovery/comms; must **differ** from primary; cannot log in |
| `password` | string | min 8 (on `RegisterRequest`) |
| `industry` | enum | e.g. `fintech`, `technology`, … |
| `country` | string | HQ country (e.g. `NG`) |
| `primary_contact` | object | At least `name`; optional title/email/phone/WhatsApp/Telegram |

**Recommended full body example**:

```json
{
  "name": "Acme Fintech",
  "slug": "acme-fintech",
  "legal_name": "Acme Fintech Limited",
  "email": "admin@acme.ng",
  "secondary_email": "ops@acme.ng",
  "password": "supersecret123",
  "industry": "fintech",
  "company_type": "private_limited",
  "employee_count_range": "51-200",
  "website": "https://acme.ng",
  "phone": "+2348000000000",
  "address_line1": "12 Admiralty Way",
  "city": "Lagos",
  "state_province": "Lagos",
  "country": "NG",
  "primary_contact": {
    "title": "ms",
    "name": "Ada Okonkwo",
    "email": "ada@acme.ng",
    "phone": "+2348011112222",
    "whatsapp_username": "ada.security",
    "telegram_username": "ada_okonkwo"
  },
  "secondary_contact": {
    "title": "mr",
    "name": "Chidi Eze",
    "email": "chidi@acme.ng",
    "phone": "+2348033334444"
  },
  "security_mailbox": "security@acme.ng",
  "compliance_frameworks": ["iso_27001", "ndpr", "pci_dss"],
  "data_types_handled": ["pii", "pci", "financial"],
  "infrastructure_types": ["cloud", "hybrid"],
  "cloud_providers": ["aws", "azure"],
  "preferred_services": ["penetration_testing", "compliance_audit"],
  "security_maturity": "developing",
  "timezone": "Africa/Lagos"
}
```

| Response | FE |
|----------|-----|
| `201` + `OrganizationRead` | Show “Account created — sign in” → `/login` (prefill primary email) |
| `400` “Primary email already registered” | Inline error on email |
| `400` “Slug already taken” | Suggest alternate slug |
| `422` | Map `detail[].loc` to form fields |

**Industry enum** (select options):  
`financial_services`, `fintech`, `banking`, `insurance`, `healthcare`, `pharma`, `technology`, `telecommunications`, `energy`, `oil_and_gas`, `manufacturing`, `retail`, `ecommerce`, `education`, `government`, `defense`, `legal`, `real_estate`, `logistics`, `media`, `hospitality`, `agriculture`, `other`.

**Company type** (optional):  
`private_limited`, `public_limited`, `llc`, `partnership`, `sole_proprietorship`, `ngo`, `government`, `startup`, `other`.

**Contact title** (optional):  
`mr`, `mrs`, `ms`, `miss`, `dr`, `prof`, `eng`, `chief`, `other`.

**Employee range** (optional): `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1001-5000`, `5000+`.

### 3.2 Login (public) + MFA

```http
POST /api/v1/organizations/login
Content-Type: application/x-www-form-urlencoded

username=<primary_email>&password=<password>
```

- `username` = **primary** `email` only (not `secondary_email`).
- Do **not** send JSON for this route.

| Response shape | FE |
|----------------|-----|
| `mfa_required: true`, `mfa_token`, `destination_masked`, `access_token: ""` | Show MFA step; **do not** treat as logged in |
| `access_token` string, `mfa_required: false` | Store JWT; go to setup or platform |

**MFA complete** (JSON):

```http
POST /api/v1/organizations/login/mfa
Content-Type: application/json

{ "mfa_token": "<from password step>", "code": "123456" }
```

**TokenResponse fields (use these):**

```ts
type TokenResponse = {
  access_token: string;
  token_type: string;      // "bearer" | "mfa_pending"
  expires_in: number;
  organization_id: number;
  organization_slug: string;
  experience?: unknown;
  mfa_required?: boolean;
  mfa_token?: string | null;
  destination_masked?: string | null;
  challenge_id?: number | null;
  delivery?: string | null;
  dev_otp?: string | null; // only when OTP_DEV_EXPOSE=true
  message?: string | null;
  mfa_verified?: boolean;
};
```

Store:

```ts
// platform only — never staff / app tokens
localStorage.setItem("platform_access_token", token.access_token);
// Authorization: Bearer ${platform_access_token}
```

JWT claim type is company **`access`** (not `org_user`, not `staff`).

### 3.3 Public privacy text (no auth)

```http
GET /api/v1/organizations/privacy
```

Returns structured notice (`version`, `title`, `summary`, `highlights`, `phantix_stores`, …).  
Also embedded under `privacy` on `GET …/me/setup` after auth.

---

## 4. Setup status (poll / rehydrate)

```http
GET /api/v1/organizations/me/setup
Authorization: Bearer <company JWT>
```

**Primary FE type** (`OrganizationSetupStatus`):

```ts
type SetupStep = {
  id: string;           // privacy | email_otp | company_verification | domain | cac_rc | manual_review | complete
  title: string;
  required: boolean;
  completed: boolean;
  description: string;
};

type OrganizationSetupStatus = {
  organization_id: number;
  organization_name: string;
  slug: string;
  setup_completed: boolean;
  setup_completed_at: string | null;
  can_complete_setup: boolean;   // privacy + email OTP done, not yet completed
  identity_verified: boolean;    // same as email OTP for setup
  company_verified: boolean;
  email_verified: boolean;
  email_verified_at: string | null;
  primary_email_masked: string;
  privacy_notice_accepted: boolean;
  privacy_notice_accepted_at: string | null;
  privacy_notice_version: string;
  privacy: Record<string, unknown>;     // full notice payload
  verification: Record<string, unknown>; // modes block
  cac: Record<string, unknown>;
  steps: SetupStep[];
  next_step: string | null;
  progress_percent: number;             // required steps only
  ui_hints: {
    page_title?: string;
    page_subtitle?: string;
    show_privacy_panel?: boolean;
    show_cac_panel?: boolean;
    show_domain_panel?: boolean;
    show_manual_review_panel?: boolean;
    require_privacy_before_otp?: boolean;
    otp_channel?: "email";
    phone_otp_removed?: boolean;
    company_modes?: string[];
    required_modes?: string[];
    [k: string]: unknown;
  };
};
```

| Field | FE behavior |
|-------|-------------|
| `privacy_notice_accepted === false` | Force privacy step |
| `email_verified === false` | Force OTP (after privacy) |
| `can_complete_setup === true` | Enable **Complete** (optional modes may still be open) |
| `setup_completed === true` | Redirect out of wizard |
| `next_step` | Preferred stepper target |
| `progress_percent` | Progress bar |
| `ui_hints.phone_otp_removed` | Never show phone OTP UI |

---

## 5. Endpoint catalog — Org setup

All paths under `/api/v1`. Auth = company Bearer unless **Public**.  
Setup mutations use **company JWT only** (no dual-control session, no staff token).

### 5.1 Privacy

| Method | Path | Auth | Body |
|--------|------|------|------|
| `GET` | `/organizations/privacy` | Public | — |
| `POST` | `/organizations/me/setup/privacy/accept` | Company | below |

```json
{
  "accepted": true,
  "notice_version": "2026-07-10"
}
```

- `accepted` must be `true` (false → 400).
- `notice_version` optional; if sent, must match server version or 400 “version mismatch”.
- Prefer sending `notice_version` from `GET …/setup` → `privacy_notice_version` or `privacy.version`.

**Response**: full `OrganizationSetupStatus` (not a bare OK).

### 5.2 Identity / company profile (optional)

| Method | Path | Body fields |
|--------|------|-------------|
| `POST` | `/organizations/me/setup/identity` | `company_phone`, `legal_name`, `registration_number`, `website` |

```json
{
  "website": "https://acme.ng",
  "legal_name": "Acme Fintech Limited",
  "registration_number": "RC1234567",
  "company_phone": "+2348000000000"
}
```

- All fields optional; send only what the form collected.
- `website` is used later for domain verification defaults.
- **Response**: full `OrganizationSetupStatus`.

### 5.3 Email OTP (required)

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/organizations/me/setup/otp/send` | Requires privacy accepted first |
| `POST` | `/organizations/me/setup/otp/verify` | |

**Send**

```json
{ "channel": "email" }
```

Only `email` is valid. Phone → **400**.

**Send response** (`OtpSendResponse`):

```ts
{
  channel: "email";
  destination_masked: string;
  expires_in_seconds: number;
  resend_after_seconds: number;
  challenge_id: number;
  delivery: string;
  message: string;
  dev_otp?: string; // OTP_DEV_EXPOSE only
}
```

**Verify**

```json
{ "channel": "email", "code": "123456" }
```

`code`: numeric string, 4–10 digits.

**Verify response** (`OtpVerifyResponse`):

```ts
{
  channel: string;
  verified: boolean;
  email_verified: boolean;
  identity_verified: boolean;
  company_verified: boolean;
  message: string;
}
```

| FE requirement | Detail |
|----------------|--------|
| Privacy first | If send returns 400 about privacy → jump to privacy step |
| Cooldown | Use `resend_after_seconds`; handle 429 |
| Masked destination | Show `destination_masked` |
| Dev | Never log `dev_otp` in production builds |

### 5.4 Domain verification (optional)

| Method | Path |
|--------|------|
| `POST` | `/organizations/me/setup/verify/domain/start` |
| `POST` | `/organizations/me/setup/verify/domain/check` |

**Start**

```json
{ "domain": "acme.ng", "website": "https://acme.ng" }
```

Both optional if website already on org; otherwise provide one.

**Start response** (`DomainVerifyStartResponse`):

```ts
{
  mode: "domain";
  verification_domain: string;
  token: string;
  instructions: Record<string, unknown>; // DNS TXT + HTTP file copy
  message: string;
}
```

Typical instruction content (render from `instructions`, don’t hard-code only):

- DNS TXT: `phantix-verify=<token>`
- HTTP: `https://<domain>/.well-known/phantix-verify.txt` (body = token)

**Check**

```json
{ "method": "auto" }
```

`method`: `auto` | `dns` | `http` (default `auto`). Body may be omitted (defaults to auto).

**Check response**: `verified`, `verified_via`, `domain`, `company_verified`, `message`, `details`.

| FE UX | Detail |
|-------|--------|
| Instructions card | Copy buttons from start response |
| Check button | User-initiated; min 5–10s between attempts |
| Partial | Show DNS vs HTTP results from `details` if present |

### 5.5 CAC / RC (optional)

```http
POST /api/v1/organizations/me/setup/cac
```

```json
{
  "rc_number": "RC1234567",
  "company_type": "Private Company Limited by Shares",
  "registration_date": "2020-05-12",
  "status": "Active",
  "registered_address": "12 Admiralty Way, Lagos",
  "tin": "12345678-0001"
}
```

or skip:

```json
{ "skip": true }
```

**Response** (`CacDetailsResponse`): `details_provided`, `skipped`, echo fields, `message`.

### 5.6 Manual review (optional)

```http
POST /api/v1/organizations/me/setup/verify/manual-review
```

```json
{ "notes": "DNS not available on CDN; please review CAC docs we emailed." }
```

**Response**: `status`, `requested_at`, `notes`, `company_verified`, `message`.

Staff resolves (staff JWT only — **not** this app):

```http
POST /api/v1/admin/clients/{organization_id}/verification/manual-review?approve=true&notes=…
```

FE: poll `GET …/me/setup` → `verification` / step `manual_review` until approved/rejected.

### 5.7 Complete

```http
POST /api/v1/organizations/me/setup/complete
Authorization: Bearer <company JWT>
```

No body.

**Success** (`SetupCompleteResponse`):

```ts
{
  setup_completed: true;
  setup_completed_at: string | null;
  identity_verified: boolean;
  company_verified: boolean;
  message: string;
  setup: OrganizationSetupStatus; // full status after complete
}
```

**400** if privacy or email OTP missing — re-fetch setup and jump to first incomplete **required** step.

**Success navigation**: platform home (not still on wizard).  
Next product onboarding (separate screens): dual-control users → security DB.

---

## 6. State machine

```
REGISTER (public)
  → LOGIN (+ MFA)  → company JWT
  → PRIVACY_REQUIRED          (required)
  → EMAIL_OTP_REQUIRED        (required; after privacy)
  → COMPANY_MODES_OPTIONAL    (domain / cac / manual)
  → COMPLETE                  (can_complete_setup)
  → SETUP_COMPLETE            (setup_completed)
  → PLATFORM: dual-control + security DB + assets…
```

```ts
async function resolveSetupScreen(api: Api) {
  const s = await api.get<OrganizationSetupStatus>("/organizations/me/setup");
  if (s.setup_completed) return "done";
  if (!s.privacy_notice_accepted) return "privacy";
  if (!s.email_verified) return "otp";
  if (s.can_complete_setup) return "complete_or_optional_modes";
  return "blocked"; // should be rare
}
```

---

## 7. Right after setup (first-run platform)

These are **not** part of the setup wizard but must be linked from “done” / empty states.

| Priority | Method | Path | Purpose |
|----------|--------|------|---------|
| P0 | `GET` | `/organizations/me` | Profile shell |
| P0 | `GET` | `/organizations/me/identity` | Org id / slug chips |
| P0 | `POST` | `/org-users` ×2 | Initiator + authorizer (bootstrap, **no** dual session yet) |
| P0 | `PUT` | `/org-users/dual-control` | Assign slots |
| P0 | `POST` | `/org-users/auth/login` | `purpose: dual_control` → session |
| P0 | `POST` | `/db-connections` | Postgres `security_data_storage` |
| P0 | `POST` | `/db-connections/{id}/test?auto_bootstrap=true` | Connectivity + schema |
| P1 | `POST` | `/assets` | First assets |
| P1 | `POST` | `/assets/integrations/github` | Optional PAT |
| P1 | `GET` | `/assets/intelligence/dashboard` | Posture after data exists |

### 7.1 Security DB payload (lab / production)

```http
POST /api/v1/db-connections
Authorization: Bearer <jwt>
X-Dual-Control-Session: <session>   # after dual-control is configured
Content-Type: application/json
```

```json
{
  "name": "Phantix Security Storage",
  "connection_purpose": "security_data_storage",
  "db_type": "postgresql",
  "host": "127.0.0.1",
  "port": 5432,
  "database_name": "phantix_security",
  "username": "phantix",
  "password": "…",
  "ssl_mode": "disable",
  "target_schema": "phantix",
  "is_primary": true,
  "environment": "development"
}
```

Then:

```http
POST /api/v1/db-connections/{id}/test?auto_bootstrap=true
```

or explicit:

```http
POST /api/v1/db-connections/{id}/bootstrap
```

**Gate product modules** until security storage is healthy/bootstrapped.  
Full guide: [CONNECTIONS.md](../CONNECTIONS.md). Dual-control UX: [DUAL_CONTROL_SETUP_FE.md](../DUAL_CONTROL_SETUP_FE.md).

#### Bootstrap failure: password authentication failed

Example (staging):

```json
{
  "detail": {
    "error": "bootstrap_failed",
    "message": "Security DB bootstrap failed: password authentication failed for user '…' …",
    "connection_id": 13,
    "hint": "Update connection password with PUT … then retry"
  }
}
```

| Cause | FE action |
|-------|-----------|
| Wrong password / username stored on connection | Show `detail.message` or `detail.hint`; open **Edit connection** form; `PUT /db-connections/{id}` with correct Postgres credentials; re-run test/bootstrap |
| Database or role does not exist on server | Ops must create DB/role, or change fields to an existing one |
| Invented username (e.g. `phantix_security_mailinator` without matching role password) | Do not invent credentials — use real Postgres login |

Also surface `GET /db-connections/{id}` → `bootstrap_error`, `bootstrap_status=failed`, `last_error`.

### 7.2 Optional MSSQL (config inspection only)

Not for security inventory. See CONNECTIONS §5 / Postman **Add MSSQL config_inspection**.

---

## 8. Error & edge cases

| Situation | HTTP | FE |
|-----------|------|-----|
| JWT expired mid-wizard | 401 | Re-login; setup state is server-side |
| Privacy not accepted before OTP | 400 | Jump to privacy |
| OTP rate limit | 429 | Cooldown from `resend_after_seconds` / message |
| OTP wrong / expired | 400/401 | Clear code; allow resend |
| Domain check fails | 400 | Keep instructions; show `detail` |
| User skips company modes | — | Complete when `can_complete_setup` |
| Staff rejects manual review | — | Show notes from setup status; allow re-request |
| Secondary email used on login | 401 | Message: use primary email |
| Validation | 422 | Map `detail[].loc` → fields |

**Error body**:

```json
{ "detail": "Human-readable message" }
```

or

```json
{ "detail": [{ "loc": ["body", "email"], "msg": "…", "type": "…" }] }
```

---

## 9. TypeScript client sketch

```ts
const orgSetupApi = {
  register: (body: RegisterBody) =>
    api.post("/organizations/register", body), // no auth

  login: (email: string, password: string) =>
    api.postForm("/organizations/login", { username: email, password }),

  loginMfa: (mfa_token: string, code: string) =>
    api.post("/organizations/login/mfa", { mfa_token, code }),

  privacyPublic: () => api.get("/organizations/privacy"),

  setup: () => api.get<OrganizationSetupStatus>("/organizations/me/setup"),

  acceptPrivacy: (notice_version?: string) =>
    api.post("/organizations/me/setup/privacy/accept", {
      accepted: true,
      notice_version,
    }),

  identity: (body: {
    website?: string;
    legal_name?: string;
    registration_number?: string;
    company_phone?: string;
  }) => api.post("/organizations/me/setup/identity", body),

  otpSend: () =>
    api.post("/organizations/me/setup/otp/send", { channel: "email" }),

  otpVerify: (code: string) =>
    api.post("/organizations/me/setup/otp/verify", { channel: "email", code }),

  domainStart: (body: { domain?: string; website?: string }) =>
    api.post("/organizations/me/setup/verify/domain/start", body),

  domainCheck: (method: "auto" | "dns" | "http" = "auto") =>
    api.post("/organizations/me/setup/verify/domain/check", { method }),

  cac: (body: Record<string, unknown>) =>
    api.post("/organizations/me/setup/cac", body),

  manualReview: (notes?: string) =>
    api.post("/organizations/me/setup/verify/manual-review", { notes }),

  complete: () => api.post("/organizations/me/setup/complete"),
};
```

---

## 10. Acceptance checklist

### Registration & login
- [ ] Register sends full company payload (slug, secondary_email, industry, country, primary_contact, password)
- [ ] Register success does **not** assume JWT — redirects to login
- [ ] Login uses **form-urlencoded** `username` + `password` (primary email)
- [ ] MFA path handles `mfa_required` + `mfa_token` before storing access token
- [ ] Secondary email cannot sign in (show guidance)

### Wizard
- [ ] Every load rehydrates from `GET …/me/setup`
- [ ] Privacy cannot be skipped; OTP blocked until privacy accepted
- [ ] Email OTP send/verify + resend cooldown; no phone OTP UI
- [ ] Domain start shows copyable instructions from API
- [ ] Complete disabled until `can_complete_setup` (or required steps complete)
- [ ] Complete success leaves wizard for platform home
- [ ] Company JWT only on setup routes (no staff / dual-control header)

### First-run after setup
- [ ] Dual-control bootstrap path documented in UI (two users → assign)
- [ ] Security DB connect + test/bootstrap gated before scans/VAPT
- [ ] 409/empty security DB banner when inventory APIs fail

---

## 11. Quick curl smoke (local)

```bash
API=http://localhost:8000/api/v1

# Register (edit unique slug/email)
curl -sS -X POST "$API/organizations/register" -H 'Content-Type: application/json' -d '{…}'

# Login
curl -sS -X POST "$API/organizations/login" \
  -d 'username=admin@acme.ng&password=supersecret123'

# After MFA if needed → TOKEN=
curl -sS -H "Authorization: Bearer $TOKEN" "$API/organizations/me/setup" | jq .

curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$API/organizations/me/setup/privacy/accept" \
  -d '{"accepted":true,"notice_version":"2026-07-10"}'

curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$API/organizations/me/setup/otp/send" -d '{"channel":"email"}'

curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$API/organizations/me/setup/otp/verify" -d '{"channel":"email","code":"123456"}'

curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/organizations/me/setup/complete"
```

Postman: **`00b – Dummy client happy path`** in [`API Testing/phantix_postman_collection.json`](../../API%20Testing/phantix_postman_collection.json).

---

## 12. Related docs

| Doc | When |
|-----|------|
| [02_PLATFORM_IMPLEMENTATION.md](./02_PLATFORM_IMPLEMENTATION.md) | After setup: shell, DB, assets, intelligence |
| [DUAL_CONTROL_SETUP_FE.md](../DUAL_CONTROL_SETUP_FE.md) | Initiator/authorizer |
| [CONNECTIONS.md](../CONNECTIONS.md) | Security Postgres + MSSQL + GitHub PAT |
| [ASSET_INTELLIGENCE_AND_MONITORING_FE.md](./ASSET_INTELLIGENCE_AND_MONITORING_FE.md) | Dashboards after inventory exists |
| [ORG_SETUP.md](../ORG_SETUP.md) | Short backend summary |
