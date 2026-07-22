# Application Implementation Guide (`app.phantix.site`)

**Surface**: Operator / analyst **application** product  
**Audience**: FE for `app.phantix.site` (not platform onboarding; not staff)  
**Auth**: Dual tokens — `app_session` + `device_token` (from **login link**, not company login)  
**API prefix**: `/api/v1`  
**Related**: [TWO_PLATFORM_AUTH.md](../TWO_PLATFORM_AUTH.md) · [PLATFORM_APP_FE_CHECKLIST.md](../PLATFORM_APP_FE_CHECKLIST.md) · [DUAL_CONTROL_SETUP_FE.md](../DUAL_CONTROL_SETUP_FE.md)

---

## 1. Two products — do not mix logins

| Product | Host | Who | How they sign in |
|---------|------|-----|------------------|
| **Platform** | `platform.phantix.site` | Company admin / setup | `POST /organizations/login` (+ MFA) → company JWT |
| **Application** | `app.phantix.site` | Invited org users | **Login link only** → OTP (or password+OTP) → `app_session` + `device_token` |

**App users must never be sent through organization company login.**  
Organization login is **only** for the platform management portal.

---

## 2. Login link URL (issued on platform)

Platform: `POST /api/v1/organizations/me/users/{user_id}/login-link`  
Returns `login_url` once, e.g.:

```text
https://app.phantix.site/login?org=phantom-security-64tx9yiz24&u=86&t=ll_….secret
```

| Query | Meaning | API body field |
|-------|---------|----------------|
| `org` | Organization slug | `organization_slug` (optional soft check) |
| `u` | Org user id | `organization_user_id` (optional soft check) |
| `t` | `public_id.secret` | **`login_token`** (required) |

Tenant + user are bound by the **hashed** `t` on the server — never trust `u`/`org` alone.

---

## 3. Service key required for app access

| Concern | Backend truth |
|---------|----------------|
| Human redeems login link | **Requires active `pk_live_*` service key** for the company |
| No key / revoked / expired | **403** on challenge / otp / password / mfa |
| Service key rotation | **Does not** invalidate existing login links (new key keeps access open) |
| Integrations / BFF | Still use `X-Org-Api-Key` via `POST /app/auth/resolve-key` |
| Platform create key | `POST /api/v1/organizations/me/service-key` (company JWT / dual-control) |

**403 body when blocked:**

```json
{
  "detail": {
    "error": "service_key_required",
    "message": "Application access is not enabled for this company yet. …",
    "organization_id": 24,
    "service_key_required": true,
    "create_service_key_path": "POST /api/v1/organizations/me/service-key",
    "platform_hint": "platform.phantix.site → company settings → Service key"
  }
}
```

**FE:** show admin message: “Company must create a service key on platform before operators can open app login links.”

---

## 4. App login journey (correct FE)

### Step A — Open invite link (no org JWT)

Parse `org`, `u`, `t` from the URL. Stay on `app.phantix.site`.

### Step B — Challenge (validate link)

```http
POST /api/v1/app/auth/challenge
Content-Type: application/json

{
  "login_token": "<t from URL>",
  "organization_slug": "<org from URL>",
  "organization_user_id": 86
}
```

**Response (important fields):**

```json
{
  "organization_id": 24,
  "organization_slug": "phantom-security-…",
  "organization_name": "…",
  "organization_user_id": 86,
  "user_email_masked": "p***@gmail.com",
  "otp_only": true,
  "password_required": false,
  "next_step": "otp",
  "service_key_required": false,
  "company_login_required": false,
  "message": "Request email OTP with POST /app/auth/otp…"
}
```

| `next_step` | FE |
|-------------|-----|
| `otp` | Skip password; call **Request OTP** |
| `password` | Show password field; then OTP |

### Step C1 — OTP-only (most directory users)

```http
POST /api/v1/app/auth/otp
Content-Type: application/json

{
  "login_token": "<t>",
  "organization_slug": "<org>",
  "organization_user_id": 86
}
```

**Success:**

```json
{
  "mfa_required": true,
  "mfa_token": "…",
  "destination_masked": "p***@gmail.com",
  "expires_in": 600
}
```

### Step C2 — Password users only

```http
POST /api/v1/app/auth/password
{
  "login_token": "<t>",
  "password": "<user password>",
  "organization_slug": "<org>",
  "organization_user_id": 86
}
```

OTP-only users get: *“Call POST /app/auth/otp …”* if password is attempted.

### Step D — Complete MFA + device bind

```http
POST /api/v1/app/auth/mfa
Content-Type: application/json
X-Device-Id: <stable-browser-uuid>

{
  "mfa_token": "…",
  "code": "123456",
  "device_id": "<stable-browser-uuid>"
}
```

**Success:**

```json
{
  "access_token": "<app_session JWT>",
  "token_type": "app_session",
  "device_token": "<device JWT>",
  "device_token_header": "X-Device-Token",
  "organization_id": 24,
  "organization_user_id": 86,
  "role": "org_admin"
}
```

Store:

```ts
app_session_token   // Authorization: Bearer
app_device_token    // X-Device-Token
app_device_id       // UUID per browser
```

### Step E — Session check

```http
GET /api/v1/app/auth/me
Authorization: Bearer <app_session>
X-Device-Token: <device_token>
```

### Optional — service key (integrations only)

```http
POST /api/v1/app/auth/resolve-key
X-Org-Api-Key: pk_live_…
```

Not part of human invite login.

---

## 5. Calling product APIs after app login

```http
Authorization: Bearer <app_session>
X-Device-Token: <device_token>
X-Device-Id: <uuid>
```

Mutations that need dual-control **also** need (same user as app session):

```http
X-Dual-Control-Session: <session from org-users dual_control login>
```

Dual-control operate login is **separate** from app login link (see [DUAL_CONTROL_SETUP_FE.md](../DUAL_CONTROL_SETUP_FE.md)). App session proves identity on `app.*`; dual-control session unlocks initiate/authorize.

---

## 6. Platform vs app checklist

| Task | Where | Auth |
|------|--------|------|
| Register company | Platform | Public |
| Org setup wizard | Platform | Company JWT |
| Create org users / dual-control | Platform | Company JWT (+ operate later) |
| Create **service key** | Platform | Company / dual-control |
| Issue **login link** | Platform | Company / dual-control |
| User opens link, OTP, works | **App** | Link token only (public app auth APIs) |
| Run scans / assets day-to-day | App | `app_session` + device token |

---

## 7. FE bugs to avoid

1. **Do not** redirect app invite users to `platform` company login.  
2. **Do not** require service key on app login screen.  
3. Parse query as `t` → `login_token` (not `token`).  
4. If challenge says `otp_only: true` / `next_step: "otp"`, **skip password**.  
5. Users created without password (dual-control directory, `otp_only: true`) **must** use `/app/auth/otp`.

---

## 8. Curl smoke (link from platform)

```bash
API=https://staging.phantix.site/api/v1
T='ll_….secret'   # full t= value
ORG=phantom-security-64tx9yiz24
U=86

curl -sS -X POST "$API/app/auth/challenge" -H 'Content-Type: application/json' \
  -d "{\"login_token\":\"$T\",\"organization_slug\":\"$ORG\",\"organization_user_id\":$U}"

curl -sS -X POST "$API/app/auth/otp" -H 'Content-Type: application/json' \
  -d "{\"login_token\":\"$T\",\"organization_slug\":\"$ORG\",\"organization_user_id\":$U}"

# then mfa with mfa_token + code from email
```

---

## 9. Related product modules after login

Same product routes as platform (`/assets`, `/vapt`, `/scans`, …) with **app dual-token** headers.  
Asset intelligence: [ASSET_INTELLIGENCE_AND_MONITORING_FE.md](./ASSET_INTELLIGENCE_AND_MONITORING_FE.md).
