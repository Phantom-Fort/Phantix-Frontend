# Staff / Admin Implementation Guide

**Surface**: Phantix internal console (staff portal)  
**Audience**: FE engineers for admin, support, and superadmin UIs  
**Auth**: Staff JWT only (`type=staff`) — **never** company/org-user/app tokens  
**API prefix**: `/api/v1`  
**Related**: [STAFF_PORTAL.md](../STAFF_PORTAL.md) · [API_ENDPOINT_CATALOG.md](./API_ENDPOINT_CATALOG.md) · [SERVER_OPS.md](../SERVER_OPS.md)

---

## 1. Roles & route guards

| Role | Code | Access |
|------|------|--------|
| Superadmin | `superadmin` | Everything + create staff |
| Admin | `admin` | Full `/admin/*` management |
| Support | `support` | Support tickets primarily; limited admin |

| Backend dependency | Roles |
|--------------------|-------|
| `get_current_staff` | any active staff |
| `require_support_staff` | superadmin, admin, support |
| `require_admin_staff` | superadmin, admin |
| `require_superadmin` | superadmin |

**FE**: After `GET /staff/me`, hide nav items by role. Backend still enforces.

---

## 2. Auth endpoints

| Method | Path | Use case |
|--------|------|----------|
| `POST` | `/staff/login` | Email/password → staff JWT |
| `GET` | `/staff/me` | Profile + role |
| `GET` | `/staff` | List staff (admin+) |
| `POST` | `/staff` | Create staff user (superadmin for elevated roles) |
| `PATCH` | `/staff/{staff_id}` | Update staff |

```http
POST /api/v1/staff/login
Content-Type: application/json

{ "email": "admin@phantix.site", "password": "..." }
```

```json
{ "access_token": "...", "token_type": "staff", "staff": { "id": 1, "role": "admin" } }
```

Store as `staff_access_token` only.

---

## 3. Admin information architecture

```
/login
/dashboard                 → GET /admin/dashboard/stats
/clients                   → clients CRUD
/clients/:id               → detail, connections, experience, verification
/support                   → tickets
/billing                   → settings, renewals
/compliance                → frameworks, questionnaire, seed
/tooling                   → tools + provisions
/discovery                 → nmap settings
/experience                → experience services / nav modules
/scanner-tools             → tool updates / wordlists
/ai                        → prompts, costs, scopes, activate
/vapt-admin                → procedures, correlation rules, schedules
/server                    → overview, processes, resources, optimize
/logs                      → developer logs
/staff                     → staff users (superadmin/admin)
```

---

## 4. Clients (tenant admin)

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/admin/clients` | Search/list organizations |
| `GET` | `/admin/clients/{id}` | Detail |
| `PATCH` | `/admin/clients/{id}` | Suspend, notes, flags |
| `GET` | `/admin/clients/{id}/connections` | Security DB status |
| `GET` | `/admin/clients/{id}/experience` | Enabled product modules |
| `POST` | `/admin/clients/{id}/verification/manual-review` | Approve/reject company verification |

**Manual review query example**

```http
POST /api/v1/admin/clients/11/verification/manual-review?approve=true&notes=Docs%20OK
```

**Use cases**

1. Support looks up tenant by email/name  
2. See if security DB bootstrapped  
3. Resolve stuck setup manual verification  
4. Adjust experience entitlements  

---

## 5. Support desk

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/admin/support/tickets` | Queue |
| `GET` | `/admin/support/tickets/{id}` | Thread |
| `PATCH` | `/admin/support/tickets/{id}` | Status (open/pending/closed) |
| `POST` | `/admin/support/tickets/{id}/messages` | Staff reply |

**Support role**: primary surface; do not expose dangerous server/billing controls.

Customer-side counterpart: `/support/tickets` (org JWT) — different app.

---

## 6. Billing admin

| Method | Path | Use case |
|--------|------|----------|
| `GET/PUT` | `/admin/billing/settings` | Monthly list price (NGN) |
| `GET` | `/admin/billing/pricing-preview` | Yearly auto calc preview |
| `POST` | `/admin/billing/run-renewals` | Cron-friendly renewal job |

**FE**: Confirm dialogs on price change; show audit note.

---

## 7. Compliance admin (global catalog)

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/admin/compliance/frameworks` | All frameworks (seed + uploads) |
| `POST` | `/admin/compliance/frameworks` | Create/update framework JSON body |
| `POST` | `/admin/compliance/frameworks/upload` | Multipart seed-format upload |
| `GET` | `/admin/compliance/frameworks/{id}` | Detail |
| `PATCH` | `/admin/compliance/frameworks/{id}` | Activate/deactivate |
| `POST` | `/admin/compliance/seed` | Reload built-in seeds |
| Questionnaire admin | `/admin/compliance/questionnaire/*` | Curate GRC questions |
| `POST` | `/admin/compliance/questionnaire/rebuild` | Rebuild merged questionnaire |
| Framework questions | `/admin/compliance/frameworks/{id}/questions` | Per-framework list |

**Use case**: GRC expert uploads ISO/NDPR controls without code deploy.

Org-side consumption: `/compliance/*` (customer JWT).

---

## 8. Tooling marketplace admin

| Method | Path | Use case |
|--------|------|----------|
| `GET/POST` | `/admin/tooling/tools` | Catalog CRUD |
| `POST` | `/admin/tooling/tools/seed` | Seed defaults |
| `GET/PATCH` | `/admin/tooling/tools/{id}` | Edit tool |
| Provisions | `/admin/tooling/provisions*` | Grant tools to orgs |
| `GET` | `/admin/tooling/stats` | Adoption metrics |

Customer-side: `/tools/catalog`, `/tools/request`, `/tools/subscribe`.

---

## 9. Discovery & scanner ops

| Method | Path | Use case |
|--------|------|----------|
| `GET/PUT` | `/admin/discovery/settings` | Nmap binary + admin flags |
| `POST` | `/admin/discovery/nmap/preview` | Preview command string |
| `GET` | `/admin/scanner-tools` | Installed tool status |
| `POST` | `/admin/scanner-tools/update` | Update tools |
| `POST` | `/admin/scanner-tools/wordlists/ensure` | Ensure wordlists present |

**FE**: Dangerous command preview with copy; warn production impact.

---

## 10. Experience services (product modules / nav)

| Method | Path | Use case |
|--------|------|----------|
| `GET/POST` | `/admin/experience-services` | List/create service keys |
| `POST` | `/admin/experience-services/seed` | Seed defaults once |
| `GET/PUT/PATCH/DELETE` | `/admin/experience-services/{service_key}` | Edit modules, nav, widgets, onboarding |

**Use case**: Toggle which platform modules a plan unlocks without frontend redeploy.

---

## 11. AI admin

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/admin/ai/settings` | Global AI info |
| `POST` | `/admin/ai/activate` | Seed prompts + enable providers when keys present |
| `GET/POST` | `/admin/ai/prompts` | Prompt versioning |
| `GET/PATCH` | `/admin/ai/prompts/{key}` | Edit → new immutable version |
| `POST` | `/admin/ai/prompts/{key}/activate` | Activate version |
| `GET/PUT` | `/admin/ai/data-scopes` | Max evidence fields AI may see |
| `GET` | `/admin/ai/costs` | Cost rollup |
| `GET` | `/admin/ai/audit-logs` | AI audit |
| `POST` | `/admin/ai/consensus/test` | Dry-run multi-model |

**FE copy**: AI assists narratives only; never authoritative scoring.

---

## 12. VAPT admin (platform procedures)

Mounted under `/api/v1/admin/vapt/…` (see catalog for exact paths):

| Use case | Capability |
|----------|------------|
| Manage procedures | CRUD procedure definitions |
| Correlation rules | Staff-managed rules |
| Global schedules | Cross-tenant scheduling admin |

Org-facing read of procedures: `/vapt/procedures`.

---

## 13. Server operations

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/admin/server/overview` | Process + workers snapshot |
| `GET` | `/admin/server/processes` | Process list |
| `GET` | `/admin/server/resources` | CPU/mem |
| `GET` | `/admin/server/runtime` | Runtime info |
| `GET` | `/admin/server/recommendations` | Ops suggestions |
| `POST` | `/admin/server/optimize` | Safe in-process optimizations |

**FE**: Admin-only; confirm on optimize; refresh overview after.

Doc: [SERVER_OPS.md](../SERVER_OPS.md).

---

## 14. Developer logs

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/admin/logs` | List |
| `POST` | `/admin/logs` | Create entry |
| `GET` | `/admin/logs/issues/{issue_id}` | Issue timeline |

---

## 15. Bus diagnostics

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/admin/bus/events` | Event catalog for debugging engines |

---

## 16. Public/status (no staff token required)

| Method | Path | Use case |
|--------|------|----------|
| `GET` | `/health` | LB probe |
| `GET` | `/status` or `/api/v1/status` | Full ops status (engines, DB, redis) |
| `GET` | `/api/v1/engines` | Engine registry |

Staff dashboard can embed `/status` widgets.

---

## 17. Cross-links to customer product APIs

Staff generally **do not** call customer data plane as the customer. For impersonation-like support:

1. Use admin client detail + connections status  
2. Ask customer to act in their portal  
3. Or use documented support procedures — do not reuse customer JWTs in staff SPA storage  

---

## 18. Acceptance checklist

- [ ] Staff login stores only `type=staff` token  
- [ ] Support role cannot open server/billing/AI admin nav  
- [ ] Clients list/detail + manual verification works  
- [ ] Support ticket reply works  
- [ ] Compliance framework upload + seed reload  
- [ ] Experience service edit updates customer nav entitlements  
- [ ] AI prompt version activate works  
- [ ] Server overview loads  
- [ ] 401 clears staff session; 403 shows role error  
- [ ] No dual-control headers on staff routes  
