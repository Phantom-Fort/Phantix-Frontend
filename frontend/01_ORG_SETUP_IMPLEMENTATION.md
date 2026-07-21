# Org Setup — Frontend Implementation Guide

**Surface**: Organization onboarding on **platform** (`platform.phantix.site`)  
**Auth during setup**: Company JWT (`type=access`) after `POST /organizations/login` or register  
**API prefix**: `/api/v1`  
**Related**: [ORG_SETUP.md](../ORG_SETUP.md) · [TWO_PLATFORM_AUTH.md](../TWO_PLATFORM_AUTH.md) · [RBAC_MFA.md](../RBAC_MFA.md)

This guide is the **source of truth for FE engineers** implementing the post-registration setup wizard.

---

## 1. Goals & success criteria

| Goal | Backend truth | FE must |
|------|---------------|---------|
| Accept privacy | Stored on org | Block progress until accepted |
| Prove email control | Email OTP only (phone OTP removed) | Send + verify OTP UI |
| Optional company proof | Domain DNS / HTTP / CAC / manual | Mode cards; none required to complete |
| Complete setup | `POST …/setup/complete` | Only enable when privacy + email OTP done |
| Enter platform shell | Setup flags clear | Redirect to platform home |

**Complete requirements (backend):**

- Privacy notice accepted  
- Email OTP verified (`identity_verified`)  
- Company modes are **optional** (`company_verified` is soft)

---

## 2. Screens & navigation

Recommended wizard steps (single-page stepper or multi-route):

```
[1 Privacy] → [2 Company profile] → [3 Email OTP] → [4 Company verification (optional)] → [5 Complete]
```

Deep links:

| Route (suggested) | Purpose |
|-------------------|---------|
| `/setup` | Resume from `GET …/me/setup` |
| `/setup/privacy` | Privacy step |
| `/setup/identity` | Website / legal name |
| `/setup/otp` | Email OTP |
| `/setup/verify` | Domain / CAC / manual |
| `/setup/done` | Complete + redirect |

On every load: **`GET /api/v1/organizations/me/setup`** and rebuild step state (source of truth).

---

## 3. Auth bootstrap for setup

### 3.1 Register (public)

```http
POST /api/v1/organizations/register
Content-Type: application/json
```

Typical body fields (see OpenAPI `OrganizationRegister`):

| Field | Required | Notes |
|-------|----------|-------|
| `email` | Yes | Company login email |
| `password` | Yes | Company password |
| `name` / company name | Yes | Display name |
| `country` | Often | Used later for compliance profiling |
| Contact emails | Optional | May auto-provision as org users later |

**Use case**: New tenant signup → store JWT if returned → go to setup.

### 3.2 Login (public) + MFA

```http
POST /api/v1/organizations/login
Content-Type: application/x-www-form-urlencoded

username=<email>&password=<password>
```

| Response | FE |
|----------|-----|
| `{ access_token }` | Store as `platform_access_token` |
| `{ mfa_required, mfa_token }` | Show OTP → `POST /organizations/login/mfa` |

```http
POST /api/v1/organizations/login/mfa
{ "mfa_token": "...", "code": "123456" }
```

**Use case**: Returning user unfinished setup → login → resume `/setup`.

### 3.3 Public privacy text (no auth)

```http
GET /api/v1/organizations/privacy
```

**Use case**: Marketing/legal page and setup step 1 content.

---

## 4. Setup status (poll this often)

```http
GET /api/v1/organizations/me/setup
Authorization: Bearer <company JWT>
```

**Use case**: Drive wizard progress, badges, and Complete button.

Interpret (field names may nest under `privacy`, `identity`, `verifications` — always bind UI to API response, not hard-coded assumptions):

| Concept | FE behavior |
|---------|-------------|
| Privacy not accepted | Force step 1 |
| Email OTP not done | Force step 3 |
| Domain pending | Show “Check again” |
| Manual review pending | Show “Awaiting staff” |
| `setup_complete` / ready | Redirect to platform home |

---

## 5. Endpoint catalog — Org setup

All paths relative to `/api/v1`. Auth = company Bearer unless **Public**.

### 5.1 Privacy

| Method | Path | Auth | Use case | FE notes |
|--------|------|------|----------|----------|
| `GET` | `/organizations/privacy` | Public | Load legal copy | Cache; version if provided |
| `POST` | `/organizations/me/setup/privacy/accept` | Company | User ticks “I accept” | Disable until scrolled/checkbox; then call |

**Success**: privacy accepted timestamp on next `GET …/setup`.

### 5.2 Identity / company profile

| Method | Path | Auth | Use case | Body (typical) |
|--------|------|------|----------|----------------|
| `POST` | `/organizations/me/setup/identity` | Company | Save website, legal name, phones | `{ "website", "legal_name", "company_phone", … }` |

**Use case**: Optional branding/legal fields before verification modes.

### 5.3 Email OTP

| Method | Path | Auth | Use case |
|--------|------|------|----------|
| `POST` | `/organizations/me/setup/otp/send` | Company | Send code to company email |
| `POST` | `/organizations/me/setup/otp/verify` | Company | Submit 6-digit code |

**Send body** (defaults to email):

```json
{ "channel": "email" }
```

**Verify body**:

```json
{ "channel": "email", "code": "123456" }
```

| FE requirement | Detail |
|----------------|--------|
| Cooldown | Disable resend 30–60s; handle 429 |
| Masked destination | Show API `destination_masked` if present |
| Dev | If `OTP_DEV_EXPOSE=true`, code may appear in response — **never in production UI logs** |

### 5.4 Domain verification (optional)

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/organizations/me/setup/verify/domain/start` | Issue token + instructions |
| `POST` | `/organizations/me/setup/verify/domain/check` | Re-check DNS/HTTP |

**Start**:

```json
{ "domain": "acme.example" }
```

**Response (use for UI copy)**:

- DNS TXT: `phantix-verify=<token>`  
- HTTP file: `https://acme.example/.well-known/phantix-verify.txt` (body = token)

**Check**:

```json
{ "method": "auto" }
```

`method`: `auto` | `dns` | `http`

| FE UX | Detail |
|-------|--------|
| Instructions card | Copy buttons for TXT value and HTTP URL |
| Polling | User clicks “I’ve added it — Check” (don’t hammer; 5–10s min) |
| Partial success | Show which of DNS/HTTP passed |

### 5.5 CAC / RC (optional)

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/organizations/me/setup/cac` | Submit CAC/RC numbers **or** skip |

```json
{ "cac_number": "...", "rc_number": "..." }
```

or

```json
{ "skip": true }
```

### 5.6 Manual review (optional)

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/organizations/me/setup/verify/manual-review` | Request staff approval |

**FE**: Show ticket-like status from `GET …/setup` until staff resolves  
Staff resolves via:  
`POST /api/v1/admin/clients/{id}/verification/manual-review?approve=true&notes=…`  
(staff JWT — not this app).

### 5.7 Complete

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/organizations/me/setup/complete` | Finish onboarding |

**400** if privacy or email OTP missing — re-fetch setup and jump to first incomplete step.

**Success**: navigate to platform home (`/dashboard` or `/identity`).

---

## 6. State machine (FE)

```
REGISTERED
  → PRIVACY_REQUIRED
  → EMAIL_OTP_REQUIRED
  → (optional) COMPANY_VERIFY_IN_PROGRESS
  → SETUP_COMPLETE
```

```ts
// Pseudocode
const s = await api.get('/organizations/me/setup');
if (!s.privacy?.accepted) return 'privacy';
if (!s.identity_verified && !s.email_otp?.verified) return 'otp';
if (!s.setup_complete) return 'optional_verify_or_complete';
return 'done';
```

---

## 7. Related platform endpoints used right after setup

Not part of setup wizard, but first-run platform:

| Method | Path | First-run use |
|--------|------|----------------|
| `GET` | `/organizations/me` | Profile shell |
| `GET` | `/organizations/me/identity` | Tenant id/slug chips |
| `GET` | `/organizations/services-catalog` | What services exist |
| `POST` | `/db-connections` | Connect security DB (required for scans/VAPT) |
| `POST` | `/db-connections/{id}/bootstrap` | Create security schema |
| `POST` | `/org-users` | Invite first operators |

See [02_PLATFORM_IMPLEMENTATION.md](./02_PLATFORM_IMPLEMENTATION.md).

---

## 8. Error & edge cases

| Situation | FE |
|-----------|-----|
| JWT expired mid-wizard | Re-login; setup state is server-side |
| OTP expired | Resend; clear code field |
| Domain check fails | Keep instructions; show last error `detail` |
| User skips company modes | Allow Complete when privacy+OTP ok |
| Staff rejects manual review | Show reject notes; allow re-request |

---

## 9. Acceptance checklist

- [ ] Privacy cannot be skipped  
- [ ] Email OTP send/verify works; resend cooldown  
- [ ] Setup page always rehydrates from `GET …/me/setup`  
- [ ] Domain start shows copyable DNS + HTTP instructions  
- [ ] Complete disabled until required steps done  
- [ ] Complete success → platform app, not stuck on wizard  
- [ ] No phone OTP UI remains (removed from product)  
- [ ] Company JWT only (no staff token on these routes)  
