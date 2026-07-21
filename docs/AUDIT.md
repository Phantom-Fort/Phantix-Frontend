# Audit Trail (Dual Control) + Organization Users

**Status**: Updated July 2026 — **Audit / Control Plane ownership split**

Each organization maintains a **user directory**, then assigns:

- **One user as Initiator** (e.g. IT Admin)
- **A different user as Authorizer** (e.g. CTO / CISO)

Completed actions are logged with both people’s names/titles (snapshots) for compliance export.

### Ownership (engine split)

| Concern | Owner | Module |
|---------|--------|--------|
| Dual-control sessions (login / headers) | Control Plane | `org_user_auth_service` |
| Control roles + pending queue | Control Plane | `dual_control_service` |
| Immutable trail write / list / export | **Audit Engine** | `audit_engine.services.audit_service` |
| HTTP routes (stable URLs) | Shared prefix | `/api/v1/audit/*` (handlers call the right service) |

Authorizing a pending action writes the trail via Audit Engine and publishes `AuditRecorded` on the bus.

## Storage residency (platform DB)

| Data | Database | Why |
|------|----------|-----|
| `organization_users` | **Phantix platform DB** | Dual controllers are platform tenancy data |
| `organization_control_roles` | **Phantix platform DB** | Initiator/authorizer assignment |
| `organization_user_sessions` | **Phantix platform DB** | Layered dual-control sessions |
| `audit_pending_actions` | **Phantix platform DB** | Dual-control queue |
| `audit_events` | **Phantix platform DB** | Immutable completed trail (per `organization_id`) |
| VAPT `vapt_approval_requests` | **Phantix platform DB** | Campaign dual-control (same residency rule) |

**Not** stored in the customer dedicated security DB. Security inventory changes use `asset_history` there; that is **not** the dual-control compliance audit trail.

---

## 1. Create users

```http
POST /api/v1/org-users
{
  "full_name": "Ada Okonkwo",
  "email": "ada@acme.ng",
  "title": "IT Admin"
}

POST /api/v1/org-users
{
  "full_name": "Chidi Eze",
  "email": "chidi@acme.ng",
  "title": "CISO"
}
```

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/org-users` | List users (`is_initiator` / `is_authorizer` flags) |
| `POST` | `/api/v1/org-users` | Create user |
| `GET` | `/api/v1/org-users/{id}` | Get user |
| `PATCH` | `/api/v1/org-users/{id}` | Update user (syncs dual-control name snapshots) |
| `DELETE` | `/api/v1/org-users/{id}` | Soft-deactivate (blocked if currently assigned) |

The **company** still authenticates with the organization JWT.
Initiators/authorizers have an **additional** password + session (see §3).

---

## 2. Assign initiator + authorizer

```http
PUT /api/v1/org-users/dual-control
{
  "initiator_user_id": 1,
  "authorizer_user_id": 2,
  "require_dual_control": true
}
```

Or equivalently:

```http
PUT /api/v1/audit/control-roles
{
  "initiator_user_id": 1,
  "authorizer_user_id": 2,
  "require_dual_control": true
}
```

Rules:

- Both users must belong to the organization and be **active**
- Initiator and authorizer must be **different** users
- Names/titles/emails are **snapshotted** onto control roles for stable audit display

```http
GET /api/v1/org-users/dual-control
GET /api/v1/audit/control-roles
```

---

## 3. Layered dual-control auth (required for initiate / authorize)

Anyone with only the company JWT **cannot** impersonate the initiator or authorizer.
Full FE guide: [RBAC_MFA.md](./RBAC_MFA.md) · [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md).

### Login as org user (domain email + OTP)

Public endpoints (no company JWT). Email must match a registered organization user.
Domain check applies to most addresses; **org primary / secondary / registration contact
emails are domain-exempt**. Send a stable `device_id` / `X-Device-Id`.

```http
POST /api/v1/org-users/auth/login
{
  "email": "ada@acme.ng",
  "purpose": "access",
  "device_id": "<stable-browser-uuid>"
}
```

OTP is emailed → complete with:

```http
POST /api/v1/org-users/auth/login/mfa
{ "mfa_token": "...", "code": "123456", "device_id": "<stable-browser-uuid>" }
```

→ `access_token` (`type=org_user`) for identity + data-access audit.

**New browser/device while another session is active:** after email OTP, the API
returns `device_verification_required` + `device_token` (no session tokens yet).
A second code is emailed; complete `POST /org-users/auth/login/device` before
any identity or dual-control token is issued. Prior sessions are revoked on success.

**Audit keys:** `auth.org_user.login`, `auth.org_user.new_device_challenge`,
`auth.org_user.new_device_verified`; successful GETs with org-user JWT may log
`data.access` via operate middleware.

For operate mutations, use `"purpose": "dual_control"` — response also includes
`session_token`. Send it as:

```http
X-Dual-Control-Session: <session_token>
```

### Session rules

| Rule | Value |
|------|--------|
| Inactivity timeout | **3 minutes** (no activity → session ends) |
| Absolute max lifetime | 30 minutes (configurable) |
| Activity touch | Every dual-control API call / `GET /auth/me` |
| Single session | New login revokes previous sessions for that user |
| Logout | `POST /org-users/auth/logout` with session header |

```http
GET /api/v1/org-users/auth/me
Authorization: Bearer <company_jwt>
X-Dual-Control-Session: <session_token>
```

### Initiate / authorize (session required)

**Initiate** — must be logged in as the **assigned initiator**:

```http
POST /api/v1/audit/pending
Authorization: Bearer <company_jwt>
X-Dual-Control-Session: <initiator_session>
{
  "action_key": "asset.bulk_delete",
  "action_label": "Delete stale assets",
  "category": "assets"
}
```

**Authorize** — must be logged in as the **assigned authorizer** (identity from session, not body):

```http
POST /api/v1/audit/pending/1/authorize
Authorization: Bearer <company_jwt>
X-Dual-Control-Session: <authorizer_session>
{ "notes": "Approved after change window" }
```

**Reject**:

```http
POST /api/v1/audit/pending/1/reject
Authorization: Bearer <company_jwt>
X-Dual-Control-Session: <authorizer_session>
{ "reason": "Insufficient evidence" }
```

If the session is missing or idle &gt; 3 minutes → **401** with message to re-login.

---

## 4. Audit events & export

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/audit/events` | List trail |
| `GET` | `/api/v1/audit/export?format=csv\|json` | Download |

Each event includes initiator + authorizer **name and title** (from assignment snapshots at write time).

---

## Data model (all on Phantix platform DB)

| Table | Purpose |
|-------|---------|
| `organization_users` | Per-org user directory |
| `organization_control_roles` | `initiator_user_id` + `authorizer_user_id` (+ name snapshots) |
| `organization_user_sessions` | Dual-control layered sessions |
| `audit_events` | Immutable completed trail (per org) |
| `audit_pending_actions` | Dual-control queue |

These tables are Alembic-managed platform tables (`DATABASE_URL`). They are **not**
created by security-schema bootstrap into the customer DB.

---

## Typical UI flow

1. Org admin adds two (or more) users
2. Assigns one as initiator, one as authorizer
3. Sensitive work uses pending → authorize
4. Compliance exports CSV/JSON with both names on every completed action
