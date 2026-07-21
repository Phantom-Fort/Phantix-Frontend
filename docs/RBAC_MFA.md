# Organization access control + Email MFA

**Status**: dual-control operate policy + domain-email org-user identity (July 2026)  
**Frontend guide**: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) (§ Auth model, org-user login)  
**Dual-control setup process (FE wizard):** [DUAL_CONTROL_SETUP_FE.md](./DUAL_CONTROL_SETUP_FE.md)  
**Package**: Control Plane — `rbac.py`, `login_mfa_service.py`, `org_user_auth_service.py`, `org_rbac_dependencies.py`, `org_operate_middleware.py`  
**Related**: [AUDIT.md](./AUDIT.md) · [COMPLIANCE.md](./COMPLIANCE.md) (staff framework upload)

---

## Product policy

| Actor | Can do |
|-------|--------|
| **Initiator** (assigned) + authenticator session | All mutating operations |
| **Authorizer** (assigned) + authenticator session | All mutating operations + dual-control authorize |
| **Every other org user** | View pages + generate reports (by role) |
| **Company JWT alone** (after dual-control configured) | Passive-only + report generation |
| **Bootstrap** (dual-control not yet configured) | Company JWT may create users and assign initiator/authorizer once |

### Org-user identity (any role)

Passwordless **domain-email login** (no company JWT):

1. `POST /api/v1/org-users/auth/login` with an email that is an **active org user**, and either:
   - ends with the **organization domain**, or
   - is the org **primary / secondary / registration contact** email  
     (domain check **exempt** — e.g. `ops@gmail.com` if that was registered on the org)
   (+ stable `device_id` / `X-Device-Id` per browser)
2. OTP emailed → `POST /api/v1/org-users/auth/login/mfa`
3. **New browser/device while another session is active** →  
   `device_verification_required` + second emailed code →  
   `POST /api/v1/org-users/auth/login/device`  
   **No session token is issued until this step completes.**
4. Response: `access_token` with `token_type=org_user` (identity JWT — who accessed data)

**Email rules (summary)**

| Address | Domain check | Org user |
|---------|--------------|----------|
| Org primary / secondary / contact emails from registration | **Exempt** | **Auto-provisioned** on first OTP login (and at company registration) |
| All other emails | Must match org domain | Must already exist as an org user |

Registration-email users are OTP-only (`password_hash` not set for password login).

**Create user (`POST /org-users`)**: `password` is **optional**. Omit it for OTP-only
directory users (recommended). Response includes `otp_only: true`. They sign in via
domain-email OTP only.

`purpose=access` (default) → identity only.  
`purpose=dual_control` → also issues operate session (initiator/authorizer).

**Dual-control reassignment** (`PUT /org-users/dual-control`): revokes all operate
sessions (`purpose=dual_control`) for previous **and** newly assigned initiator/
authorizer users. They must log in again with `purpose=dual_control`.

### Authenticator / dual-control session

```http
X-Dual-Control-Session: <session_token>
```

Issued only when login uses `purpose=dual_control` (after email OTP).  
**3-minute inactivity** timeout; distinct from the identity JWT.

Company portal login also uses email MFA:

1. `POST /api/v1/organizations/login` → password → `mfa_required` + code emailed
2. `POST /api/v1/organizations/login/mfa` → company access JWT (`type=access`)

---

## Middleware enforcement

`OrgOperateAndAuditMiddleware` applies to org APIs:

| Method | Behaviour |
|--------|-----------|
| `GET` / `HEAD` / `OPTIONS` | Passive — allowed with company or org-user JWT; **data-access audited** when actor is a named org user |
| `POST` reports | Allowed with org JWT (view + reports); audited |
| Other `POST`/`PUT`/`PATCH`/`DELETE` | Require initiator or authorizer **authenticator session** (or bootstrap paths) |
| Successful mutations | **Audit trail** written (best-effort) |
| Successful org-user login | `auth.org_user.login` event |

Exempt from operate gate: domain-email login/mfa, register, setup OTP, staff/admin, health/docs.

---

## Dual-control slots vs stored `role`

| Field | Purpose |
|-------|---------|
| Dual-control **initiator** / **authorizer** | Who may **mutate** (with session) |
| `organization_users.role` | View/report labelling (`viewer` default) |

A user must be **assigned** as initiator or authorizer to operate. Their stored role alone never grants write access.

---

## Audit trail

- **Login**: `auth.org_user.login` when domain-email OTP completes
- **Data access** (GET with org-user identity JWT): `data.access` via middleware
- **Active** (mutations + report generation): `audit_events` via middleware (`source=api_middleware`)
- Dual-control initiate/authorize: existing pending + immutable trail
- `log_action_safe` remains available for engine-specific events

---

## Client flow (operate)

```text
1. Bootstrap once: company JWT → create users → assign dual-control
2. POST /org-users/auth/login
     { email: initiator@company.com, purpose: dual_control, device_id: <uuid> }
3. POST /org-users/auth/login/mfa { mfa_token, code, device_id }
4. If device_verification_required:
     POST /org-users/auth/login/device { device_token, code, device_id }
5. Send Authorization: Bearer <org_user access_token>
   and X-Dual-Control-Session: <session_token>
6. Call mutating APIs
```

Viewers / other org users:

```text
1. POST /org-users/auth/login { email: you@company.com, purpose: access, device_id }
2. POST /org-users/auth/login/mfa → org_user identity JWT
   (or /login/device if new browser while another session is active)
3. GET any read API; POST /reports to generate
```

**Audit events:** `auth.org_user.login`, `auth.org_user.new_device_challenge`,
`auth.org_user.new_device_verified`, middleware `data.access` on GETs with org-user JWT.

---

## HTTP 204 is success — not “waiting for authorizer”

Many delete/assign endpoints return **`204 No Content`** when the action **already completed** (empty body is intentional).

| Status | Meaning |
|--------|---------|
| **204** | Done. No body. e.g. assign/remove tag, delete asset, delete connection. |
| **200 / 201** | Done, with JSON body. |
| **403** | Blocked: need dual-control session, wrong user, or bootstrap not finished. |
| **201** on `POST /audit/pending` | **Not done** — waiting for authorizer (see below). |
| **202** / pending on VAPT | Campaign/step waiting on dual-control approval list. |

**Tag assign** (`POST /asset-tags/assets/{id}/assign` → 204) does **not** require a second person to approve. Either the **initiator or the authorizer** may call it with their authenticator session; when you get 204, the tag is already assigned.

There is **no** “authorizer must also hit the same endpoint” step for ordinary mutations.

---

## Two different “dual-control” concepts

### A) Operate gate (most product APIs)

Middleware checks that the caller is the assigned **initiator or authorizer** and has a valid `X-Dual-Control-Session`.

- **One** session is enough.
- Action runs immediately → **200/201/204**.
- Authorizer does **not** re-call the same route.

### B) Pending dual-control queue (sensitive actions only)

Explicit two-step flow via Audit API:

| Step | Who | Endpoint |
|------|-----|----------|
| 1. Initiate | **Initiator** session | `POST /api/v1/audit/pending` → **201** + pending id |
| 2. Approve / reject | **Authorizer** session only | `POST /api/v1/audit/pending/{id}/authorize` or `…/reject` |
| List waiting | Company JWT | `GET /api/v1/audit/pending?status=pending` |

How you know approval is required:

1. You called **`POST /audit/pending`** (not a normal asset/tag route).
2. Response is **201** with `status: "pending"` (not 204).
3. `GET /audit/pending` still lists the item until authorize/reject.
4. After authorize, an **audit event** is written (`GET /audit/events`).

Suggested sensitive keys (when product uses the pending queue):  
`asset.delete`, `connection.delete`, `connection.bootstrap`, `discovery.nmap`, `github.import`, billing cancel, setup complete, etc.  
(Ordinary tag assign / asset create are **not** on this list.)

### C) VAPT campaign / step approvals

Separate from tags. When a campaign/procedure has `requires_approval` or a `wait_for_approval` step:

| Check | Endpoint |
|-------|----------|
| List open gates | `GET /api/v1/vapt/campaigns/{id}/approvals` |
| Decide | `POST /api/v1/vapt/approvals/{request_id}/decide` |
| Campaign fields | `approval_required`, `approval_status` (`pending` / `approved` / …) |

If `approval_status` is `pending` or a step is `waiting_approval`, the **authorizer** (or assigned role) must decide before the campaign continues — not a silent 204 on another endpoint.

---

## Client checklist

```text
Got 204 / 200 / 201 on normal route?
  → Action finished. Log it; no second person required for that call.

Got 403 dual_control_configured / required_header?
  → Login as initiator/authorizer; send X-Dual-Control-Session.

Called POST /audit/pending and got 201 status=pending?
  → Authorizer must POST …/authorize or …/reject.
  → Poll GET /audit/pending.

VAPT campaign approval_status=pending or step waiting_approval?
  → GET …/approvals then POST …/decide.
```

---

## Config

```env
ORG_LOGIN_MFA_ENABLED=true
ORG_USER_LOGIN_MFA_ENABLED=true
MFA_PENDING_TOKEN_MINUTES=10
SMTP_HOST=...   # email delivery for MFA codes
OTP_DEV_EXPOSE=false  # production
```

Migration: `p6d7e8f9a0b1` (roles, MFA flags, OTP subject binding).

---

## Errors (not “Not Found”)

Operate failures return **401/403** with clear `detail` (or `detail.message`). A bare **`{"detail":"Not Found"}`** is almost always a **wrong URL** (missing `/api/v1`) or wrong method — not dual-control. See [LOCAL_DEV.md — API errors](./LOCAL_DEV.md#api-errors-not-found-vs-real-authpolicy-messages).
