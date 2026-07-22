# Frontend process: dual-control user setup

**Audience**: Customer portal (organization) frontend  
**Related**: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) · [RBAC_MFA.md](./RBAC_MFA.md) · [AUDIT.md](./AUDIT.md)

This is the **end-to-end UX + API flow** to stand up initiator and authorizer so the org can mutate data safely.

---

## Mental model

| Concept | What it is | Who has it |
|---------|------------|------------|
| **Company JWT** | `type=access` — company portal login | Account owner (primary email + password + MFA) |
| **Org user** | Named person under the org (directory row) | Anyone you invite (IT Admin, CISO, viewer, …) |
| **Initiator** | Dual-control **slot** — may propose / mutate with session | Exactly **one** org user |
| **Authorizer** | Dual-control **slot** — may authorize pending actions | Exactly **one different** org user |
| **Org-user identity JWT** | `type=org_user` — who is logged in (audit) | Any org user after domain-email OTP |
| **Dual-control session** | Header `X-Dual-Control-Session` — 3‑min idle operate token | Initiator or authorizer after `purpose=dual_control` login |

**Important**

- Stored `role` (`viewer`, `operator`, …) does **not** grant writes by itself.
- Writes require: dual-control **assigned** + valid **session** as initiator **or** authorizer.
- Initiator and authorizer must be **two different** people.

---

## When dual-control is “configured”

```text
GET /api/v1/org-users/dual-control
Authorization: Bearer <company_or_org_user_jwt>
```

Configured when response has both users filled, e.g.:

```json
{
  "configured": true,
  "require_dual_control": true,
  "initiator": { "id": 1, "email": "it@acme.com", ... },
  "authorizer": { "id": 2, "email": "ciso@acme.com", ... }
}
```

| State | Mutations (POST/PUT/PATCH/DELETE) |
|-------|-------------------------------------|
| **Not configured** | **Bootstrap only:** `POST /org-users`, `PUT /org-users/dual-control` with company JWT **or** org-user JWT (**no** dual-control session). All other mutations → **403** “configure dual-control first”. |
| **Configured** | Need `X-Dual-Control-Session` as initiator or authorizer for user create / assignment / other writes. Company JWT alone is **read-only** (+ reports). |

**Important for FE:** First-time creation of initiator/authorizer does **not** use a dual-control token. Use `Authorization: Bearer <company_jwt>` (or org-user JWT after primary-email OTP). Dual session is only after Phase 2.

---

## Process flow (happy path)

```text
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0 — Company account ready                                │
│  Register → company login (+ MFA) → org setup (privacy / OTP)   │
│  Store: company_jwt (type=access)                               │
│  FE detail: docs/frontend/01_ORG_SETUP_IMPLEMENTATION.md        │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1 — Create two org users (bootstrap)                     │
│  Auth: Bearer <company_jwt>  OR  org-user JWT                   │
│        (NO X-Dual-Control-Session required yet)                 │
│  Screen: “Security contacts” / “Team & dual control”            │
│                                                                 │
│  POST /org-users  →  User A (e.g. IT Admin / Initiator)         │
│  POST /org-users  →  User B (e.g. CISO / Authorizer)            │
│  Optional: more users (viewers) later                           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2 — Assign dual-control slots                            │
│  Auth: Bearer only  (still bootstrap — no dual session)         │
│                                                                 │
│  PUT /org-users/dual-control                                    │
│  { initiator_user_id: A.id, authorizer_user_id: B.id,           │
│    require_dual_control: true }                                 │
│                                                                 │
│  Confirm: GET /org-users/dual-control  → configured: true       │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3 — First operate session (as Initiator)                 │
│  Use the **initiator’s email** (must be domain-allowed)         │
│                                                                 │
│  device_id = localStorage UUID (stable per browser)             │
│  POST /org-users/auth/login                                     │
│    { email: A.email, purpose: "dual_control", device_id }       │
│  → OTP emailed                                                  │
│  POST /org-users/auth/login/mfa  { mfa_token, code, device_id } │
│  if device_verification_required → /login/device                │
│                                                                 │
│  Store BOTH:                                                    │
│    platform_org_user_token  = access_token (type=org_user)      │
│    platform_dual_control    = session_token                     │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4 — Mutations work                                       │
│  Authorization: Bearer <org_user_jwt OR company_jwt>            │
│  X-Dual-Control-Session: <session_token>   ← REQUIRED           │
│                                                                 │
│  Company JWT alone after dual-control is configured → 403       │
│  (dual_control_configured may be true; missing session header)  │
│                                                                 │
│  e.g. POST /db-connections, POST /assets, …                     │
│  Session dies after ~3 min idle → re-run Phase 3                │
└─────────────────────────────────────────────────────────────────┘
```

### Common 403 mistakes

| API `detail` | Meaning | Fix |
|--------------|---------|-----|
| `dual_control_configured: false` | Token’s `organization_id` has no initiator/authorizer user ids (or wrong org token) | Confirm `GET /org-users/dual-control` with **same** Bearer; re-assign if needed. Check `detail.organization_id` matches. |
| `dual_control_configured: true` + `required_header` | Dual-control **is** set; missing operate session | Complete Phase 3; send `X-Dual-Control-Session` |
| Email not organizational / login fails | Initiator is free-mail (gmail) but org domain is mailinator/company | Re-assign dual-control to users on **allowed_domains** or registration_emails_exempt (e.g. `phantom@mailinator.com`) |

---

## Phase details for the UI

### Phase 0 — Prerequisites

| Step | API | FE notes |
|------|-----|----------|
| Register company | `POST /organizations/register` | Collect primary + secondary + contact emails |
| Company login | `POST /organizations/login` → `/login/mfa` | Store company JWT |
| Setup | `GET/POST /organizations/me/setup…` | Privacy + email OTP as required |

Show a **setup checklist** after login:

1. ☐ Organization verified / setup complete  
2. ☐ Two dual-control people created  
3. ☐ Initiator + authorizer assigned  
4. ☐ First operate unlock completed  

Gate heavy features (connections, assets, scans) until (2)+(3) are done.

---

### Phase 1 — Create dual-control candidates **or select existing users**

**Yes — you can (and should) select existing org users for dual control.**  
You do **not** have to create new users every time.

**Auth:** `Authorization: Bearer <company_jwt>` **or** org-user JWT.  
**Do not send** `X-Dual-Control-Session` yet (dual-control is not assigned).

#### Recommended UX: pick from directory

1. `GET /api/v1/org-users` → list active users  
2. `GET /api/v1/org-users/dual-control` → read `email_policy` (allowed domains, exempt registration emails)  
3. User picks **two different** people from a dropdown (or create new if missing)  
4. `PUT /api/v1/org-users/dual-control` with their **ids**

```http
GET /api/v1/org-users
GET /api/v1/org-users/dual-control
# response includes:
# email_policy.can_select_existing_users = true
# email_policy.allowed_domains = ["acme.ng"]
# email_policy.registration_emails_exempt = ["admin@acme.ng", "ops@acme.ng", …]
# email_policy.assign_body = { initiator_user_id, authorizer_user_id, … }
```

#### Optional: create new users (strict email rules)

```http
POST /api/v1/org-users
Authorization: Bearer <company_jwt>
Content-Type: application/json

{
  "full_name": "Ada Okonkwo",
  "email": "ada@acme.ng",
  "title": "IT Admin",
  "role": "org_admin",
  "mfa_enabled": true
}
```

```http
POST /api/v1/org-users
{
  "full_name": "Chidi Eze",
  "email": "chidi@acme.ng",
  "title": "CISO",
  "role": "security_admin",
  "mfa_enabled": true
}
```

| Field | Guidance |
|-------|----------|
| `email` | **Must** be on org domain (`email_policy.allowed_domains`) **or** exact match of a registration contact (`registration_emails_exempt`). Free-mail (gmail, mailinator, …) **fails create** unless it is exactly a registration contact. API returns a clear **400** explaining allowed domains. |
| `password` | **Optional.** Omit for OTP-only users (recommended). Day-to-day login is domain-email OTP via `/org-users/auth/login`. Response includes `otp_only: true` when no password was set. |
| `role` | Labels view/report scope only — **does not** make them initiator/authorizer. |
| `title` | Shown on audit trail (e.g. “IT Admin”, “CISO”). |

**FE error handling (email)**

| API `detail` contains | Show to user |
|----------------------|--------------|
| `not an organizational address` | “Use a company email ending in @yourcompany.com. Personal mailboxes only work if they were used at company registration.” |
| `already exists` | Offer to select that existing user for dual control instead of creating again |

**UX**

- Prefer: **Select initiator** / **Select authorizer** from existing users.  
- Secondary: “Create new user” form with live domain hint from `email_policy.allowed_domains`.  
- Enforce different user ids in the form.  
- After `PUT /org-users/dual-control`, prompt both people to **re-login** with `purpose=dual_control` (old operate sessions are revoked).

**Optional later:** add viewers with `role: "viewer"` — they never get dual-control slots unless reassigned.

---

### Phase 2 — Assign initiator & authorizer (existing user ids)

**Auth:** company JWT (bootstrap). After this succeeds, bootstrap is over for mutations.

```http
PUT /api/v1/org-users/dual-control
Authorization: Bearer <company_jwt>
Content-Type: application/json

{
  "initiator_user_id": 1,
  "authorizer_user_id": 2,
  "require_dual_control": true
}
```

| Rule | FE validation |
|------|----------------|
| Two **different** user ids | Client-side + show API 400 if same |
| Ids from **this org** | From `GET /org-users` only |
| Existing users allowed | **Yes** — this is the preferred path |
| Both must exist and be **active** | Pick from org-user list only |
| Cannot skip assignment | Block “Connect security DB / add assets” until `configured: true` |

**Confirm**

```http
GET /api/v1/org-users/dual-control
```

Display:

```text
Initiator: Ada Okonkwo (IT Admin) — ada@acme.com
Authorizer: Chidi Eze (CISO) — chidi@acme.com
Status: Dual-control active
```

**After this call**

- Creating more users / changing dual-control generally requires an **initiator or authorizer session** (not company JWT alone).
- Changing assignment: use the same PUT with dual-control session when required by policy (if 403, prompt operate unlock).

---

### Phase 3 — Operate unlock (dual-control session)

Used every time the user needs to **mutate** after setup (and when the 3‑min session expires).

#### 3.1 Stable device id

```ts
// Once per browser
let deviceId = localStorage.getItem("phantix_device_id");
if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem("phantix_device_id", deviceId);
}
```

Send as `device_id` in body and/or header `X-Device-Id` on every login step.

#### 3.2 Login as initiator (or authorizer)

```http
POST /api/v1/org-users/auth/login
Content-Type: application/json
X-Device-Id: <device_id>

{
  "email": "ada@acme.com",
  "purpose": "dual_control",
  "device_id": "<device_id>"
}
```

→ `{ mfa_required: true, mfa_token, destination_masked }`  
Show OTP input: “Code sent to a\*\*\*@acme.com”.

```http
POST /api/v1/org-users/auth/login/mfa
X-Device-Id: <device_id>

{
  "mfa_token": "...",
  "code": "123456",
  "device_id": "<device_id>"
}
```

#### 3.3 New device gate (if returned)

```json
{
  "device_verification_required": true,
  "device_token": "...",
  "active_session": { "ip_address_masked": "...", "user_agent_preview": "..." }
}
```

UI: “Confirm new browser — a second code was emailed.”  
No tokens yet until:

```http
POST /api/v1/org-users/auth/login/device
{ "device_token": "...", "code": "...", "device_id": "<device_id>" }
```

#### 3.4 Persist tokens

On success store:

| Key | Source | Use |
|-----|--------|-----|
| `org_user_access_token` | `access_token` | `Authorization: Bearer` (identity + audit) |
| `dual_control_session` | `session_token` | `X-Dual-Control-Session` |
| `session_expires_hint` | `inactivity_expires_at` | Warn user before idle expiry |
| `acting_user` | `user` | “Acting as Ada (Initiator)” banner |

Optional: keep company JWT for read-only company settings; prefer org-user JWT for named audit.

#### 3.5 Session health

```http
GET /api/v1/org-users/auth/me
Authorization: Bearer <jwt>
X-Dual-Control-Session: <session>
```

Touches the 3‑minute activity clock. Call periodically while “operate mode” is open, or on each mutation.

```http
POST /api/v1/org-users/auth/logout
X-Dual-Control-Session: <session>
```

Clear session from storage on logout or 401 on dual-control.

---

### Phase 4 — Calling APIs after setup

```http
Authorization: Bearer <org_user_jwt>
X-Dual-Control-Session: <session_token>
```

| Call type | Bearer | Dual-control session |
|-----------|--------|----------------------|
| `GET` / `HEAD` | Yes | No |
| `POST` reports | Yes | No |
| Other mutations | Yes | **Yes** (initiator or authorizer) |
| Bootstrap (pre-config only) | Company JWT | No |

**403 handling**

| `detail` signal | FE action |
|-----------------|-----------|
| Dual-control not configured | Redirect to setup wizard (Phase 1–2) |
| `required_header` / authenticator session | Open **Operate unlock** modal (Phase 3) |
| User not initiator/authorizer | “Only Ada or Chidi can perform this action” |

---

## Recommended wizard screens

```text
1. Welcome — explain two-person control (who signs, who approves)
2. Create Initiator — name, title, work email
3. Create Authorizer — name, title, work email (≠ initiator)
4. Review assignment — confirm slots → PUT dual-control
5. Unlock as Initiator — domain OTP (purpose=dual_control)
6. Next task — e.g. “Connect security database”
```

Progress indicator tied to `GET /org-users/dual-control` + whether a valid session exists in memory.

---

## State machine (for FE store)

```text
                    company login
                          │
                          ▼
              ┌─ dual_control.configured? ─┐
              │ no                         │ yes
              ▼                            ▼
     BOOTSTRAP_MODE                 OPERATE_MODE
     - create users                 - reads with Bearer
     - PUT dual-control             - writes need session
              │                            │
              └──── after assign ──────────┘
                          │
                          ▼
                 session active?
                    │         │
                   yes        no
                    │         └── mutation → show Unlock modal
                    ▼
              send both headers
```

Suggested flags:

```ts
type DualControlState = {
  configured: boolean;
  initiator: { id: number; full_name: string; email: string } | null;
  authorizer: { id: number; full_name: string; email: string } | null;
  sessionToken: string | null;
  orgUserToken: string | null;
  actingUserId: number | null;
  isInitiator: boolean;
  isAuthorizer: boolean;
  inactivityExpiresAt: string | null;
};
```

Hydrate `configured` / names from `GET /org-users/dual-control` on app load.  
Hydrate session only from memory/sessionStorage (short-lived; do not treat as long-lived auth).

---

## Sequence diagram (setup + first mutation)

```text
FE                    API                     Email
│                     │                        │
│── company login ───►│                        │
│◄── company_jwt ─────│                        │
│                     │                        │
│── POST /org-users (A) ──────────────────────►│
│── POST /org-users (B) ──────────────────────►│
│── PUT /dual-control {A,B} ─────────────────►│
│◄── configured ──────────────────────────────│
│                     │                        │
│── POST /auth/login purpose=dual_control ───►│── OTP ──►│
│── POST /auth/login/mfa ────────────────────►│          │
│◄── access_token + session_token ────────────│          │
│                     │                        │
│── POST /db-connections                      │
│   Bearer + X-Dual-Control-Session ─────────►│
│◄── 201 ─────────────────────────────────────│
```

---

## Error / edge cases

| Situation | FE behavior |
|-----------|-------------|
| Only one user created | Disable “Assign dual-control” until two distinct users |
| Same person selected twice | Client validation; API returns 400 |
| Initiator OTP wrong | Stay on OTP screen; allow resend via new login |
| Session idle &gt; 3 min | 401/403 on mutation → re-unlock modal |
| Authorizer needed for pending action | Screen: “Waiting for Chidi” + link to unlock as authorizer |
| Viewer tries operate login | Session may issue, but mutations 403 if not in a dual-control slot |
| New laptop while session open elsewhere | `device_verification_required` step |
| Company JWT after dual-control | Allow reads/reports; for writes always unlock |

---

## Checklist for FE implementation

- [ ] Setup wizard gated after company login  
- [ ] Create **two** org users with clear Initiator / Authorizer labels  
- [ ] `PUT /org-users/dual-control` only when ids differ  
- [ ] Poll or refresh `GET /org-users/dual-control` after assign  
- [ ] Stable `device_id` in localStorage  
- [ ] Operate unlock uses `purpose: "dual_control"` + OTP (+ device step)  
- [ ] Attach `X-Dual-Control-Session` on all non-report mutations once configured  
- [ ] Idle banner / auto prompt when session near expiry  
- [ ] Map 403 messages to wizard vs unlock vs wrong person  
- [ ] Never use staff JWT in this flow  

---

## API quick reference

| Step | Method | Path | Auth |
|------|--------|------|------|
| List users | `GET` | `/api/v1/org-users` | Company or org-user Bearer |
| Create user | `POST` | `/api/v1/org-users` | Company JWT **before** dual-control; else dual session |
| Dual-control status | `GET` | `/api/v1/org-users/dual-control` | Bearer |
| Assign slots | `PUT` | `/api/v1/org-users/dual-control` | Company JWT bootstrap; else dual session |
| Start OTP | `POST` | `/api/v1/org-users/auth/login` | Public |
| Complete OTP | `POST` | `/api/v1/org-users/auth/login/mfa` | Public |
| New device | `POST` | `/api/v1/org-users/auth/login/device` | Public |
| Session me | `GET` | `/api/v1/org-users/auth/me` | Bearer + dual session |
| Logout session | `POST` | `/api/v1/org-users/auth/logout` | Dual session header |

OpenAPI: `GET /docs` for full request/response schemas.
