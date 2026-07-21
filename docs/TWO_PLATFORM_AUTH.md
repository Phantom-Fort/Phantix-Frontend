# Two-platform auth: management + application access

**Status**: Implemented July 2026

Phantix splits **organization management** from **application access**.

| Surface | Host (product) | Audience | Auth |
|--------|----------------|----------|------|
| **Management** | `platform.phantix.site` | Org admins / creators | Company JWT or org-user JWT (+ dual-control for operate) |
| **Application** | `app.phantix.site` | Operators / analysts | Sign-in link → password → email OTP → **app_session + device_token** |

## Company service key rule

- **Exactly one active service key (`pk_live_…`) per company** (organization tenant).
- A **group** with multiple startups = multiple child companies = **one key each**.
- Payment, plan access, and rate limits bind to **`organization_id`** (the company).
- Rotating a key does **not** invalidate per-user sign-in links.
- Full secret is returned **once** on create/rotate; stored as SHA-256 only.

## Multi-company groups

- Top-level org may create **child companies** (`parent_organization_id`).
- Platform shows for each company: **id**, **slug**, **creator_user_id**.
- Keys and data stay isolated per company (no shared cross-tenant key).

## Management APIs (`/api/v1/organizations/…`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/me/identity` | id, slug, creator for platform UI |
| GET/POST | `/me/companies` | List / create child companies |
| GET | `/me/service-key` | Active key metadata (prefix only) |
| POST | `/me/service-key` | Create or rotate this company's key |
| DELETE | `/me/service-key/{id}` | Revoke |
| GET/POST | `/companies/{id}/service-key` | Key for self or child company |
| POST | `/me/users/{user_id}/login-link` | Issue app sign-in URL (once) |
| GET | `/me/login-links` | List links (no secrets) |
| DELETE | `/me/users/{user_id}/device` | Clear device bind |

Requires org Bearer. Mutating routes use bootstrap-or-operator (dual-control when configured).

## Application APIs (`/api/v1/app/…`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/challenge` | Validate sign-in link → public metadata |
| POST | `/auth/password` | Password → email OTP (`mfa_token`) |
| POST | `/auth/mfa` | OTP + device → **session + device tokens** |
| GET | `/auth/me` | Dual-token identity check |
| POST | `/auth/resolve-key` | Resolve `X-Org-Api-Key` → company id/slug |

### Dual tokens (application security)

```http
Authorization: Bearer <app_session JWT>
X-Device-Token: <device_token JWT>
```

- **app_session** — short-lived; carries `organization_id`, `user_id`, role, device fingerprint.
- **device_token** — longer-lived; must match same org + user (+ fingerprint).
- Dual-control operate (`X-Dual-Control-Session`) must be the **same user** as the app session (IDOR guard).

### Env

```env
APP_LOGIN_BASE_URL=https://app.phantix.site
PLATFORM_BASE_URL=https://platform.phantix.site
APP_SESSION_EXPIRE_MINUTES=60
DEVICE_TOKEN_EXPIRE_DAYS=30
APP_REQUIRE_DEVICE_TOKEN=true
ORG_API_KEY_GRACE_HOURS=24
```

## IDOR rules

1. Tenant always from verified JWT / hashed service key / hashed login link — never client body alone.
2. Cross-tenant ids → **404**.
3. Login link redeem binds org + user + email from token hash.
4. Dual-control user must match app/org-user principal.

## Rate limiting (organization-scoped)

| Request identity | Bucket key | Config |
|------------------|------------|--------|
| Company JWT (`type=access`) | `org:{org_id}` | `RATE_LIMIT_DEFAULT` / `RATE_LIMIT_ORG` |
| Org-user / app_session | `org:{organization_id}` claim (not user id) | same |
| `X-Org-Api-Key: pk_live_…` | `orgkey:{sha256}` (1 active key per company) | `RATE_LIMIT_SERVICE_KEY` on resolve |
| App login (pre-token) | `ip:…` | `RATE_LIMIT_APP_AUTH` (default 30/min) |
| Staff | `staff:{id}` | default |

Payment, access, and rate limits bind to the **company** (`organization_id`). All users under that company share the org JWT bucket.

## FE flow (summary)

1. **Platform**: register org → create users → create child companies → mint service key per company → mint login links.
2. **App**: open login_url → password → OTP → store session + device tokens → call product APIs.
3. Integrations: send `X-Org-Api-Key: pk_live_…` (billing/rate-limit scope = that company).

**Detailed FE checklist**: [PLATFORM_APP_FE_CHECKLIST.md](./PLATFORM_APP_FE_CHECKLIST.md)
