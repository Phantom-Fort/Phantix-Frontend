# Phantix Frontend Implementation Documentation

**Audience**: Frontend / full-stack engineers building Phantix UIs  
**API base**: `{API_BASE}` + `/api/v1` (staging: `https://staging.phantix.site`, local: `http://localhost:8000`)  
**Live contract**: `GET /docs` (Swagger) · **Generated route table**: [API_ENDPOINT_CATALOG.md](./API_ENDPOINT_CATALOG.md) · `api_routes.json`  
**Last major update**: July 2026 (verification gate, compliance evidence, VAPT report templates)

---

## Product surfaces (do not mix auth stores)

| Surface | Product host | Doc | Primary tokens |
|---------|--------------|-----|----------------|
| **Org setup** | `platform.phantix.site` (onboarding) | [01_ORG_SETUP_IMPLEMENTATION.md](./01_ORG_SETUP_IMPLEMENTATION.md) | Company JWT (`type=access`) during setup |
| **Platform** | `platform.phantix.site` | [02_PLATFORM_IMPLEMENTATION.md](./02_PLATFORM_IMPLEMENTATION.md) | Company JWT and/or org-user JWT + dual-control session |
| **Application** | `app.phantix.site` | [03_APPLICATION_IMPLEMENTATION.md](./03_APPLICATION_IMPLEMENTATION.md) | `app_session` + `X-Device-Token` (+ dual-control when operating) |
| **Staff / Admin** | staff console | [04_STAFF_ADMIN_IMPLEMENTATION.md](./04_STAFF_ADMIN_IMPLEMENTATION.md) | Staff JWT only (`type=staff`) |

**Cross-cutting**

| Topic | Doc |
|-------|-----|
| Full endpoint catalog (326 routes) | [API_ENDPOINT_CATALOG.md](./API_ENDPOINT_CATALOG.md) |
| Auth realms overview | [../TWO_PLATFORM_AUTH.md](../TWO_PLATFORM_AUTH.md) · [../RBAC_MFA.md](../RBAC_MFA.md) |
| Dual-control operate UX | [../DUAL_CONTROL_SETUP_FE.md](../DUAL_CONTROL_SETUP_FE.md) |
| Legacy single guide (still valid) | [../FRONTEND_INTEGRATION.md](../FRONTEND_INTEGRATION.md) |
| Engine maturity | [../ENGINES.md](../ENGINES.md) |
| Postman | [../../API Testing/phantix_postman_collection.json](../../API%20Testing/phantix_postman_collection.json) |

---

## Global conventions for all frontends

### Headers

| Header | When |
|--------|------|
| `Authorization: Bearer <jwt>` | Always for authenticated routes |
| `Content-Type: application/json` | JSON bodies |
| `X-Device-Id: <uuid>` | Org-user login + app login (stable browser id) |
| `X-Device-Token: <jwt>` | Application dual-token mode (`APP_REQUIRE_DEVICE_TOKEN=true`) |
| `X-Dual-Control-Session: <token>` | Customer operate mutations (3‑min idle) |
| `X-Org-Api-Key: pk_live_…` | Optional machine access / resolve-key flows |

### HTTP status handling (recommended)

| Code | FE action |
|------|-----------|
| 200 / 201 | Success |
| 400 | Show `detail` (validation / business rule) |
| 401 | Clear token store → login |
| 403 | Permission / dual-control / staff role gate |
| 404 | “Not found” (may be IDOR-safe hide) |
| 409 | Conflict (active scan lock, duplicate, state machine) |
| 422 | Field validation — map Pydantic errors to form fields |
| 429 | Rate limit — backoff + message |

### Error body shape (typical)

```json
{ "detail": "Human-readable message" }
```

Or FastAPI validation:

```json
{
  "detail": [
    { "loc": ["body", "email"], "msg": "field required", "type": "value_error.missing" }
  ]
}
```

### OpenAPI & codegen

1. Prefer **`GET /docs`** for interactive exploration.
2. Export OpenAPI from the running API for TypeScript clients (`openapi-typescript`, Orval, etc.).
3. Use [api_routes.json](./api_routes.json) for offline inventories / tests.

---

## Document map (what to implement first)

```
1. Auth + org setup          → 01_ORG_SETUP
2. Platform shell + tenants  → 02_PLATFORM (identity, keys, users, DB connections)
3. Product modules           → 02_PLATFORM product sections (assets → scans → VAPT → reports)
4. Application product UI    → 03_APPLICATION (dual-token operate)
5. Staff console             → 04_STAFF_ADMIN
```

---

## Related backend capability docs

| Module | Doc |
|--------|-----|
| Assets / discovery | [../ASSET_DISCOVERY.md](../ASSET_DISCOVERY.md) |
| Scanner | [../VAPT.md](../VAPT.md) (campaigns) + scans under Platform guide |
| Risk | [../RISK.md](../RISK.md) |
| Compliance | [../COMPLIANCE.md](../COMPLIANCE.md) |
| Reporting | [../REPORTING.md](../REPORTING.md) |
| Alerts | [../ALERTS.md](../ALERTS.md) |
| Audit | [../AUDIT.md](../AUDIT.md) |
| AI | [../AI.md](../AI.md) |
| DB connections | [../CONNECTIONS.md](../CONNECTIONS.md) |
