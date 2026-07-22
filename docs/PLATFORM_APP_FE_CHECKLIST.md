# Frontend checklist — Platform vs Application

**Audience**: FE for `platform.phantix.site` (management) and `app.phantix.site` (product)  
**API**: `/api/v1` · Full auth model: [TWO_PLATFORM_AUTH.md](./TWO_PLATFORM_AUTH.md)  
**Deep implementation guides**: [frontend/02_PLATFORM_IMPLEMENTATION.md](./frontend/02_PLATFORM_IMPLEMENTATION.md) · [frontend/03_APPLICATION_IMPLEMENTATION.md](./frontend/03_APPLICATION_IMPLEMENTATION.md) · [frontend/README.md](./frontend/README.md)

Use **two separate apps** (or two route trees with different auth stores). Do not reuse one JWT blob for both UIs without checking `type`.

---

## 0. Shared setup

| Item | Detail |
|------|--------|
| API base | Staging / local backend; prefix `/api/v1` |
| CORS | Allow both platform and app origins |
| Device id | UUID in `localStorage` → body `device_id` or `X-Device-Id` on every app login step |
| Never log | Full `pk_live_…` secrets, login-link secrets, OTP codes, dual-control session tokens |
| Errors | 401 → re-auth; 403 dual-control → show operate unlock; 404 → “not found” (IDOR-safe); 429 → rate limited |

---

## 1. Platform (`platform.phantix.site`) — organization management

### 1.1 Auth store (management)

- [ ] Login: `POST /organizations/login` (+ `/login/mfa` if required)
- [ ] Store company JWT (`type=access`) in platform-only storage (e.g. `platform_access_token`)
- [ ] Optional: org-user JWT for named admin (`type=org_user`) after `/org-users/auth/login`
- [ ] Dual-control operate: separate `X-Dual-Control-Session` (3‑min idle) — see [DUAL_CONTROL_SETUP_FE.md](./DUAL_CONTROL_SETUP_FE.md)
- [ ] Do **not** put `app_session` / `device_token` in the platform store

### 1.2 Identity panel (always visible)

- [ ] `GET /organizations/me/identity` → show copy chips:
  - Organization **ID**
  - **Slug**
  - **Creator user ID** (if set)
- [ ] Label clearly: “Company tenant IDs — needed for support and app invites”

### 1.3 Multi-company / startups

- [ ] `GET /organizations/me/companies` → list child companies
- [ ] `POST /organizations/me/companies` → onboard startup (`name`, optional `slug`, `industry`, `country`)
- [ ] After create, deep-link to that company’s service-key screen
- [ ] UI copy: **one service key per company** (not one for the whole group)

### 1.4 Service key management

- [ ] `GET /organizations/me/service-key` → show prefix, created_at, last_used, active badge
- [ ] `POST /organizations/me/service-key` → create/rotate
  - Show full `api_key` **once** in a modal with “Copy” + “I stored it”
  - Never re-fetch secret (backend won’t return it again)
- [ ] For child: `POST /organizations/companies/{id}/service-key`
- [ ] `DELETE /organizations/me/service-key/{id}` with confirm
- [ ] Explain grace period after rotate (old key works briefly)

### 1.5 Users + application sign-in links

- [ ] User directory: existing `GET/POST /org-users` (+ dual-control assign)
- [ ] Per user: `POST /organizations/me/users/{user_id}/login-link`
  - Show `login_url` once; copy + optional “email invite” UX
  - Note: rotating service key **does not** break this link
- [ ] `GET /organizations/me/login-links` → status list (no secrets)
- [ ] `DELETE /organizations/me/users/{user_id}/device` → “Clear device bind” admin action

### 1.6 Billing / plan (org-scoped)

- [ ] Existing billing routes stay on **company** `organization_id`
- [ ] UI: plan and rate limits apply to **this company** and all of its keys/users
- [ ] Group view: show each child’s plan summary if multi-company

### 1.7 Platform route map (suggested)

```
/register                 # company registration (no JWT until login)
/login                    # company password + MFA → company JWT
/setup                    # privacy → email OTP → optional domain/CAC → complete
/dashboard
/identity                 # id, slug, creator  (GET /organizations/me/identity)
/connections              # security Postgres + optional MSSQL inspection
/companies                # list + create startups
/companies/:id/key        # service key for company
/users
/users/:id/login-link
/billing
/dual-control
/assets                   # inventory + intelligence drawer
/monitoring               # SOC scaffold + live intel stream (optional)
```

Setup contract: [frontend/01_ORG_SETUP_IMPLEMENTATION.md](./frontend/01_ORG_SETUP_IMPLEMENTATION.md)

---

## 2. Application (`app.phantix.site`) — product access

### 2.1 Auth store (application)

- [ ] Separate keys: `app_session_token`, `device_token`, `device_id`
- [ ] Every product API call:
  ```http
  Authorization: Bearer <app_session>
  X-Device-Token: <device_token>
  X-Device-Id: <stable-uuid>   # optional after login; useful for support
  ```
- [ ] Optional BFF: `X-Org-Api-Key: pk_live_…` only on server side — **never** embed live key in SPA if avoidable
- [ ] Dual-control for mutations: also send `X-Dual-Control-Session` after operate login; **same user** as app session

### 2.2 Sign-in from platform link

URL shape (from backend):

```text
https://app.phantix.site/login?org=<slug>&u=<userId>&t=<publicId.secret>
```

Flow:

1. [ ] Parse query → `organization_slug`, `organization_user_id`, `login_token` (`t`)
2. [ ] `POST /app/auth/challenge`  
   `{ login_token, organization_slug, organization_user_id }`  
   → show org name, masked email, `device_bound`
3. [ ] Password form → `POST /app/auth/password`  
   → `mfa_token`, masked destination (show `dev_otp` only in local)
4. [ ] OTP form → `POST /app/auth/mfa`  
   `{ mfa_token, code, device_id, replace_primary? }`  
   → store `access_token` as app_session + `device_token`
5. [ ] If error about other device → UI “Replace primary device?” → resubmit with `replace_primary: true` after OTP (or admin clears bind)
6. [ ] `GET /app/auth/me` to hydrate shell (org id/slug, user, role)

### 2.3 Integration / automation path

- [ ] Server-side only: `POST /app/auth/resolve-key` with `X-Org-Api-Key`
- [ ] Response gives `organization_id`, slug, `rate_limit_scope: organization`
- [ ] Do not use resolve-key as interactive human login

### 2.4 Product shell after login

- [ ] Show company name + slug in header (from `/app/auth/me`)
- [ ] Assets / scans / reports use existing engine routes with **app_session** Bearer
- [ ] On 401: clear app tokens → `/login` (do not bounce to platform automatically)
- [ ] On 429: toast “Organization rate limit — try again shortly”

### 2.5 App route map (suggested)

```
/login                    # link + password + OTP
/app                      # shell
/app/assets
/app/scans
/app/reports
/app/settings/device      # show bound device; request admin clear
```

---

## 3. Token type cheat sheet

| Token | `type` claim | Where stored | Header |
|-------|--------------|--------------|--------|
| Company portal | `access` | Platform | `Authorization` |
| Org user identity | `org_user` | Platform (optional) | `Authorization` |
| App session | `app_session` | App | `Authorization` |
| Device | `device_token` | App | `X-Device-Token` |
| Dual-control | opaque | Either (operate) | `X-Dual-Control-Session` |
| Service key | n/a (secret) | Server / secrets vault | `X-Org-Api-Key` |

Reject wrong type on wrong app (e.g. platform must not send only `device_token`).

---

## 4. Rate limiting (FE behaviour)

| Context | Backend keying | FE handling |
|---------|----------------|-------------|
| App login steps | IP (`RATE_LIMIT_APP_AUTH`) | Disable submit + countdown on 429 |
| App session APIs | `org:{organization_id}` | Shared company budget for all users |
| Service key APIs | `orgkey:{hash}` (1 key ≈ 1 company) | Same product limits as company |
| Staff | `staff:{id}` | Admin app only |

Plan upgrades later can raise `RATE_LIMIT_ORG` without FE token changes.

---

## 5. Security / QA checklist

- [ ] Two browsers: user A cannot open user B’s login link with wrong `u=`
- [ ] Rotate service key → integrations break after grace; login links still work
- [ ] Suspend / inactive org → app `/auth/me` 401
- [ ] Stolen app_session without device_token → 401 when `APP_REQUIRE_DEVICE_TOKEN=true`
- [ ] Dual-control session for user A + app_session for user B → 403
- [ ] Child company key never returns sibling company data
- [ ] Platform never displays full key after first reveal
- [ ] OTP not logged to analytics

---

## 6. Env (FE)

```env
# Platform app
VITE_API_BASE=https://staging.phantix.site/api/v1
VITE_APP_REALM=platform

# Product app
VITE_API_BASE=https://staging.phantix.site/api/v1
VITE_APP_REALM=application
VITE_DEVICE_TOKEN_HEADER=X-Device-Token
```

Backend env (ops): see `.env.example` (`APP_LOGIN_BASE_URL`, `RATE_LIMIT_*`, `APP_REQUIRE_DEVICE_TOKEN`).

---

## 7. Implementation order (recommended)

1. Platform identity + service key create/rotate (single company)
2. Users + login-link issue
3. App login page (challenge → password → MFA → dual tokens)
4. App shell `/auth/me` + one product page (e.g. assets list)
5. Multi-company list/create + per-company keys
6. Dual-control operate on mutating product actions
7. Billing display bound to company

When in doubt: **platform manages keys and people; app uses session + device.**
