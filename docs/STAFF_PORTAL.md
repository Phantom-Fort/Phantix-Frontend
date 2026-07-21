# Phantix Staff / Admin / Support Application Guide

**Audience**: Frontend and product engineers building the **staff** application  
(admin console, support desk, operator tooling) — **not** the customer (organization) portal.

**Full FE implementation**: [frontend/04_STAFF_ADMIN_IMPLEMENTATION.md](./frontend/04_STAFF_ADMIN_IMPLEMENTATION.md)  
**Endpoint catalog**: [frontend/API_ENDPOINT_CATALOG.md](./frontend/API_ENDPOINT_CATALOG.md)

**Base URL**: `https://staging.phantix.site` (staging) · `http://localhost:8000` (local)  
**API prefix**: `/api/v1`  
**OpenAPI**: `GET /docs` · `GET /api/v1/openapi.json`  
**Customer portal contract**: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) · [frontend/README.md](./frontend/README.md)  
**Postman**: [API Testing/phantix_postman_collection.json](../API%20Testing/phantix_postman_collection.json) (folder **00 – Staff / Admin**)

---

## 1. What this app is

| Product | Users | Auth | Typical surfaces |
|---------|--------|------|------------------|
| **Customer portal** | Company owners + org users | `type=access` / `type=org_user` | Assets, scans, VAPT, reports |
| **Staff portal** (this doc) | Phantix employees | `type=staff` only | Clients, support tickets, platform config, ops |

**Never mix tokens.**

- Staff JWT is **rejected** on organization routes that require company/org-user auth.
- Company / org-user JWT is **rejected** on `/api/v1/staff/*` and `/api/v1/admin/*`.

Dual-control (`X-Dual-Control-Session`) is a **customer** concept. Staff apps do **not** use it.

---

## 2. Staff roles

| Role | Code | Portal access |
|------|------|----------------|
| **Superadmin** | `superadmin` | Full admin + create other admins/superadmins |
| **Admin** | `admin` | Full admin console (clients, tooling, billing, compliance, server ops, …) |
| **Support** | `support` | Support desk (tickets); **not** most `/admin/*` management APIs |

Enforcement (backend):

| Dependency | Allowed roles |
|------------|----------------|
| `get_current_staff` | Any active staff |
| `require_support_staff` | `superadmin`, `admin`, `support` |
| `require_admin_staff` | `superadmin`, `admin` |
| `require_superadmin` | `superadmin` only |

**Frontend guard recommendation**

```ts
type StaffRole = "superadmin" | "admin" | "support";

function canAccessAdminConsole(role: StaffRole) {
  return role === "superadmin" || role === "admin";
}

function canAccessSupportDesk(role: StaffRole) {
  return role === "superadmin" || role === "admin" || role === "support";
}
```

Hide or disable admin-only nav for `support`. Always handle **403** as “insufficient staff role”.

---

## 3. Authentication

### 3.1 Login

```http
POST /api/v1/staff/login
Content-Type: application/x-www-form-urlencoded

username=<staff_email>&password=<password>
```

(Same OAuth2 password form shape as company login, **different URL and realm**.)

**Success**

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 3600,
  "staff_id": 1,
  "email": "admin@example.com",
  "full_name": "Platform Superadmin",
  "role": "superadmin",
  "realm": "platform_staff"
}
```

Store `access_token` (memory + secure storage as appropriate).  
Send on every staff API call:

```http
Authorization: Bearer <staff_jwt>
```

JWT claims (conceptual): `type=staff`, `sub=<staff_id>`, `role`, `email`, `realm=platform_staff`.

### 3.2 Current user

```http
GET /api/v1/staff/me
Authorization: Bearer <staff_jwt>
```

Use for shell profile, role-based nav, and session restore.

### 3.3 Bootstrap account (local / first deploy)

If `platform_staff` is empty, startup creates one superadmin from env:

| Env | Example |
|-----|---------|
| `STAFF_BOOTSTRAP_EMAIL` | `admin@example.com` |
| `STAFF_BOOTSTRAP_PASSWORD` | `change-me-strong-password` |
| `STAFF_BOOTSTRAP_NAME` | `Platform Superadmin` |

**Change these in production.** Never ship default passwords.

### 3.4 Staff user management (admin)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/staff` | List staff (admin+) |
| `POST` | `/api/v1/staff` | Create staff (admin+; only **superadmin** may create `admin` / `superadmin`) |
| `PATCH` | `/api/v1/staff/{staff_id}` | Update name, role, `is_active`, password |

```http
POST /api/v1/staff
Authorization: Bearer <admin_or_superadmin_jwt>
Content-Type: application/json

{
  "email": "support@phantix.site",
  "password": "StrongPass123!",
  "full_name": "Support Agent",
  "role": "support"
}
```

### 3.5 Session UX

| Concern | Guidance |
|---------|----------|
| Expiry | `expires_in` seconds; refresh by re-login (no staff refresh token today) |
| 401 | Clear staff token → login screen |
| 403 | Role insufficient — show “Admin only” / contact superadmin |
| Logout | Client-side discard token (no staff logout endpoint required) |
| Rate limit | Login limited (~10/min) — show backoff on 429 |

---

## 4. Suggested app structure

```text
/login
/app                          ← authenticated shell
  /dashboard                  ← admin: platform stats
  /clients                    ← admin: list / detail / notes / verification
  /clients/:id
  /support/tickets            ← support + admin
  /support/tickets/:id
  /experience-services        ← admin: customer UX catalog
  /tooling                    ← admin: tools + provisions
  /billing                    ← admin: settings / renewals
  /discovery                  ← admin: nmap / discovery defaults
  /compliance                 ← admin: framework catalog upload
  /vapt                       ← admin: procedures, rules, schedules
  /ai                         ← admin: prompts, costs, audit logs
  /scanner-tools              ← admin: docker images / wordlists health
  /server                     ← admin: ops overview / optimize
  /logs                       ← admin: per-org application logs
  /staff                      ← admin: manage platform users
```

Route by role: `support` → support tickets (+ maybe read-only client search if you add it later).  
`admin` / `superadmin` → full console.

---

## 5. Feature modules → APIs

All paths below require `Authorization: Bearer <staff_jwt>` unless noted.  
**Admin** = `admin` or `superadmin`. **Support+** = support, admin, or superadmin.

### 5.1 Dashboard (admin)

| Method | Path | UI |
|--------|------|-----|
| `GET` | `/admin/dashboard/stats` | KPI cards: orgs, tickets, connections, … |

### 5.2 Clients (admin)

| Method | Path | UI |
|--------|------|-----|
| `GET` | `/admin/clients?q=&is_active=&industry=&country=&limit=&offset=` | Searchable client table |
| `GET` | `/admin/clients/{id}` | Client detail (contacts, tags, notes, compliance prefs) |
| `PATCH` | `/admin/clients/{id}` | Activate/deactivate, `admin_notes`, `admin_tags` |
| `GET` | `/admin/clients/{id}/connections` | Customer DB connections (metadata) |
| `GET` | `/admin/clients/{id}/experience` | Experience profile flags |
| `POST` | `/admin/clients/{id}/verification/manual-review` | Approve/reject company verification |

**Product notes**

- Clients are **organizations**, not org-users.
- You do **not** receive customer security DB passwords in clear form on list views; treat connection payloads carefully.
- Manual review is part of org setup (domain/CAC alternatives) — surface status clearly.

### 5.3 Support tickets (support+)

| Method | Path | UI |
|--------|------|-----|
| `GET` | `/admin/support/tickets` | Queue (filter by status/org) |
| `GET` | `/admin/support/tickets/{id}` | Thread + metadata |
| `PATCH` | `/admin/support/tickets/{id}` | Status / assignment fields (see OpenAPI) |
| `POST` | `/admin/support/tickets/{id}/messages` | Agent reply |

Customer-facing ticket APIs live under `/api/v1/support/*` (org JWT) — staff UI uses **admin** support routes only.

### 5.4 Experience services catalog (admin)

Controls which product modules / services appear in the customer experience.

| Method | Path |
|--------|------|
| `GET` | `/admin/experience-services` |
| `GET` | `/admin/experience-services/{service_key}` |
| `POST` | `/admin/experience-services` |
| `PUT` / `PATCH` | `/admin/experience-services/{service_key}` |
| `DELETE` | `/admin/experience-services/{service_key}` |
| `POST` | `/admin/experience-services/seed` | Load defaults |

### 5.5 Tooling catalog & provisions (admin)

Paid / free tools offered to clients.

| Method | Path |
|--------|------|
| `GET` | `/admin/tooling/stats` |
| `GET` | `/admin/tooling/tools` |
| `POST` | `/admin/tooling/tools` |
| `GET` / `PATCH` / `DELETE` | `/admin/tooling/tools/{tool_id}` |
| `POST` | `/admin/tooling/tools/seed` |
| `GET` | `/admin/tooling/provisions` |
| `POST` | `/admin/tooling/provisions` |
| `PATCH` | `/admin/tooling/provisions/{provision_id}` |

### 5.6 Billing (admin)

| Method | Path |
|--------|------|
| `GET` / `PUT` | `/admin/billing/settings` |
| `GET` | `/admin/billing/pricing-preview` |
| `POST` | `/admin/billing/run-renewals` | Trigger renewal job |

### 5.7 Discovery / Nmap defaults (admin)

Platform-wide scanner discovery settings (affects customer asset discovery).

| Method | Path |
|--------|------|
| `GET` / `PUT` | `/admin/discovery/settings` |
| `POST` | `/admin/discovery/nmap/preview` | Dry-run / preview flags |

### 5.8 Compliance frameworks (admin)

Global catalog used by **all** customers. See also [COMPLIANCE.md](./COMPLIANCE.md).

| Method | Path | UI |
|--------|------|-----|
| `GET` | `/admin/compliance/frameworks` | Catalog (include inactive) |
| `GET` | `/admin/compliance/frameworks/{id}` | Detail summary |
| `POST` | `/admin/compliance/frameworks` | Create/update JSON body |
| `POST` | `/admin/compliance/frameworks/upload` | Upload `.json` file |
| `PATCH` | `/admin/compliance/frameworks/{id}` | Activate / deactivate |
| `POST` | `/admin/compliance/seed` | Reload built-in seed files |

Upload body shape matches seed files under `app/engines/compliance_engine/seed/frameworks/`.

### 5.9 VAPT platform config (admin)

| Method | Path | UI |
|--------|------|-----|
| `POST` | `/admin/vapt/procedures` | Register/update procedures |
| `POST` | `/admin/vapt/correlation-rules` | Custom rules |
| `GET` | `/admin/vapt/correlation-rules/builtin` | Built-in list |
| `GET` / `POST` | `/admin/vapt/schedules` | Platform schedules |
| `GET` / `PATCH` / `DELETE` | `/admin/vapt/schedules/{id}` | Schedule detail |
| `POST` | `/admin/vapt/schedules/{id}/run-now` | Force run |
| `POST` | `/admin/vapt/schedules/{id}/pause-until` | Pause |
| `POST` | `/admin/vapt/schedules/{id}/skip-next` | Skip once |

Customer campaign APIs remain under `/api/v1/vapt/*` (org auth).

### 5.10 AI governance (admin)

See [AI.md](./AI.md).

| Method | Path |
|--------|------|
| `GET` | `/admin/ai/settings` |
| `GET` / `POST` | `/admin/ai/prompts` |
| `POST` | `/admin/ai/prompts/{prompt_key}/activate` |
| `GET` | `/admin/ai/audit-logs` |
| `GET` | `/admin/ai/costs` |
| `POST` | `/admin/ai/consensus/test` |

### 5.11 Scanner tools health (admin)

Docker images / wordlists for recon tools.

| Method | Path |
|--------|------|
| `GET` | `/admin/scanner-tools` |
| `POST` | `/admin/scanner-tools/update` | Pull images / refresh |
| `POST` | `/admin/scanner-tools/wordlists/ensure` | Ensure SecLists, etc. |

### 5.12 Server operations (admin)

See [SERVER_OPS.md](./SERVER_OPS.md).

| Method | Path |
|--------|------|
| `GET` | `/admin/server/overview` | Health score + full picture |
| `GET` | `/admin/server/processes` | API / Celery / daemon PIDs |
| `GET` | `/admin/server/resources` | Host CPU/mem/disk |
| `GET` | `/admin/server/runtime` | DB pool, GC, locks, Celery |
| `GET` | `/admin/server/recommendations` | Advice only |
| `POST` | `/admin/server/optimize` | Safe optimize actions |

```json
{ "actions": ["all"], "alert_batch_limit": 50 }
```

### 5.13 Application logs (admin)

| Method | Path |
|--------|------|
| `GET` | `/admin/logs` | Filter by `organization_id`, level, time |
| `POST` | `/admin/logs` | Optional ingest / tooling (see OpenAPI) |
| `GET` | `/admin/logs/issues/{issue_id}` | Issue detail |

### 5.14 Engine bus catalog (admin)

| Method | Path |
|--------|------|
| `GET` | `/admin/bus/events` | Event types + subscribers |

Useful for internal debugging / docs in ops UI.

---

## 6. HTTP client patterns

### 6.1 Base client

```ts
const STAFF_API = `${BASE_URL}/api/v1`;

async function staffFetch(path: string, init: RequestInit = {}) {
  const token = getStaffToken(); // from your store
  const res = await fetch(`${STAFF_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401) {
    clearStaffSession();
    redirectToStaffLogin();
    throw new Error("Unauthorized");
  }
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error("Forbidden"), { status: 403, body });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.detail || res.statusText), {
      status: res.status,
      body,
    });
  }
  if (res.status === 204) return null;
  return res.json();
}
```

### 6.2 Login helper

```ts
async function staffLogin(email: string, password: string) {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);
  const res = await fetch(`${STAFF_API}/staff/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json(); // StaffLoginResponse
}
```

### 6.3 Multipart (compliance framework file)

```ts
const fd = new FormData();
fd.append("file", file); // .json
await staffFetch(`/admin/compliance/frameworks/upload?force=true`, {
  method: "POST",
  body: fd,
  // do not set Content-Type — browser sets boundary
});
```

### 6.4 Status codes

| HTTP | Meaning | FE action |
|------|---------|-----------|
| **200 / 201** | OK / created | Render body |
| **204** | OK, empty | Success toast |
| **400** | Validation / business rule | Show `detail` |
| **401** | Missing/invalid staff JWT | Re-login |
| **403** | Wrong staff role | Role-gated empty state |
| **404** | Missing resource | Not found page |
| **409** | Conflict | Explain conflict |
| **422** | Schema validation | Field errors |
| **429** | Rate limited | Backoff |
| **503** | Ops / dependency down | Retry later |

`detail` may be a string or object — always normalize.

---

## 7. Screens & product flows

### 7.1 First-run

1. Deploy / start API with `STAFF_BOOTSTRAP_*` set  
2. Login as superadmin  
3. Create additional `admin` / `support` users  
4. Seed catalogs if empty: experience services, tooling tools, compliance seeds  

### 7.2 Onboard a new client (ops view)

1. Client self-registers on customer portal (or you observe via `/admin/clients`)  
2. Optional: manual verification review  
3. Client configures dual-control + security DB (customer app)  
4. Staff monitors tickets, connections count, experience flags  

Staff does **not** complete dual-control as the customer; that stays in the org portal.

### 7.3 Support ticket lifecycle

1. List open tickets → open thread  
2. Reply via `POST .../messages`  
3. Patch status (open / pending / resolved — confirm enum in OpenAPI)  
4. Link ticket to client detail when `organization_id` present  

### 7.4 Publish a compliance framework

1. Author JSON (or use seed template)  
2. `POST /admin/compliance/frameworks` or file upload  
3. Confirm appears for customers: they use `GET /compliance/frameworks` (org JWT)  
4. Deactivate with `PATCH` if needed  

### 7.5 Platform health

1. Dashboard stats  
2. Server overview health score  
3. Scanner tools status  
4. Optimize only when degraded (document actions in UI)  

---

## 8. Security checklist for the staff FE

- [ ] Separate auth store from customer portal (different token key / domain path)
- [ ] Never send staff token to org-only routes “to see if it works”
- [ ] Role-gate UI **and** handle 403 (UI is not enough)
- [ ] Superadmin-only controls for promoting staff roles
- [ ] Mask secrets in connection UIs; no logging of JWTs or passwords
- [ ] CSRF: same-site cookie strategy if you move tokens to cookies (API is Bearer-first today)
- [ ] Audit-sensitive actions: prefer showing who performed them when API returns actor fields

---

## 9. Environments

| Env | API base | Notes |
|-----|----------|--------|
| Local | `http://localhost:8000` | `docker compose` or host uvicorn + `phantix-postgres` |
| Staging | `https://staging.phantix.site` | Cloudflare tunnel / Coolify |
| Swagger | `{base}/docs` | Authorize with **StaffJWT** scheme → `/api/v1/staff/login` |

Public liveness (no staff token): `GET /health`, `GET /status` (high-level only).

---

## 10. Related documentation

| Doc | Use when |
|-----|----------|
| [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) | Customer portal (do not confuse auth) |
| [RBAC_MFA.md](./RBAC_MFA.md) | Customer dual-control / org-user login |
| [COMPLIANCE.md](./COMPLIANCE.md) | Framework seed + admin upload schema |
| [SERVER_OPS.md](./SERVER_OPS.md) | Server optimize endpoints |
| [AI.md](./AI.md) | Admin AI prompts / costs |
| [ENGINES.md](./ENGINES.md) | Engine map |
| [CONNECTIONS.md](./CONNECTIONS.md) | Customer security DB (client app) |
| [API Testing/PHANTIX_API_TESTING_GUIDE.md](../API%20Testing/PHANTIX_API_TESTING_GUIDE.md) | Curl / Postman staff folder |
| OpenAPI | Live path/body truth for every field |

---

## 11. Quick reference — route prefixes

| Prefix | Auth | Role |
|--------|------|------|
| `/api/v1/staff/login` | Public | — |
| `/api/v1/staff/me` | Staff JWT | any staff |
| `/api/v1/staff` (list/create/patch) | Staff JWT | admin+ (superadmin for elevating roles) |
| `/api/v1/admin/*` | Staff JWT | **admin+** for nearly all routes |
| `/api/v1/admin/support/*` | Staff JWT | **support+** |

When in doubt, call with a support token: if you get 403, the screen is admin-only.

---

## 12. Out of scope for the staff app

- Running scans / VAPT campaigns **as** a customer (use org portal or impersonation only if product later adds a controlled break-glass API — none today)
- Dual-control initiate/authorize for customer mutations
- Org-user domain-email OTP login
- Customer report generation under company JWT

Those remain in [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md).
