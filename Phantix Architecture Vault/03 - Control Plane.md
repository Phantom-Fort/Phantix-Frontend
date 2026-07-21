Tags: #architecture #control-plane

# Control Plane

Status: 🟢 Implemented, but not yet separated from the engines it orchestrates — see caveat below.

The Control Plane is the administrative brain of Phantix — everything that decides *who* can do *what*: identity, authentication/authorization/JWT, organizations, org users, billing, licensing, API keys, customer setup, staff portal, support. It's also, today, the same FastAPI process as every engine — there's no physical boundary yet, only a logical one.

**It must never:** execute scans, calculate risk, generate AI reports, produce compliance reports, or store scan findings. It only coordinates. Anything that looks like business logic belongs in a domain engine, not here — see [[02 - Engine Registry]]'s Development Rules.

## What lives here today

| Module | Path | Purpose |
|---|---|---|
| Org auth / setup | `/me/setup*`, `/organizations*` | Email OTP, privacy acceptance, optional company verification (domain DNS/HTTP, CAC/RC, manual review) |
| Dual-control users | `/org-users*` | Per-org user directory, initiator/authorizer assignment, domain-email OTP identity + dual-control session |
| Audit trail *(boundary shared with Audit Engine)* | `/audit*` | Pending action queue lives here (it's part of the authorization flow); the immutable completed trail and export are [[12 - Audit Engine]]'s responsibility going forward |
| DB connections | `/db-connections*` | Registers `config_inspection` and `security_data_storage` connections, encrypted credential storage, schema bootstrap |
| Billing / tools / support | respective routers | Platform DB only, not covered in detail elsewhere in this vault yet |
| Staff admin | `/admin/*` | Separate JWT realm from org auth (includes `/admin/compliance/*` framework upload) |
| Server ops | `/admin/server/*` | See [[13 - Operations Engine]] |

## Org identity & setup

Two independent flags gate a completed setup:
- **identity_verified** = email OTP done (required)
- **company_verified** = at least one of domain DNS/HTTP, CAC/RC, or manual staff review (optional)

Phone OTP has been removed — email OTP only, as of the July 2026 update.

## Dual-control (the control plane's core security property)

Every organization can assign one user as **initiator** and a different user as **authorizer**. The company-level JWT alone cannot perform sensitive actions or impersonate either role.

**Org-user identity** (any role — viewer, operator, initiator, …):

```text
POST /org-users/auth/login             { email: you@company.com, purpose: access|dual_control, device_id }
                                       → OTP emailed (email must end with org domain)
POST /org-users/auth/login/mfa         { mfa_token, code, device_id }
                                       → access_token type=org_user
                                       OR device_verification_required if new browser + active session
POST /org-users/auth/login/device      { device_token, code, device_id }   # only when new device gated
```

**Operate session** (initiator/authorizer mutations): login with `purpose=dual_control` → also returns `session_token` for header `X-Dual-Control-Session` (**3-minute inactivity**, 30-minute absolute max). Identity JWT and dual-control session are **distinct** tokens.

```text
POST /audit/pending                    (as initiator session)
POST /audit/pending/{id}/authorize     (as authorizer session)
POST /audit/pending/{id}/reject        (as authorizer session)
```

This same session mechanism gates risk treatment approval (see [[07 - Risk Engine]]) — the authorizer identity always comes from the session, never the request body.

Every completed audit event snapshots both names/titles at write time, so exports stay stable even if a user is later renamed or deactivated.

## Connections: two purposes, least privilege

`config_inspection` connections may read security metadata (roles, grants, RLS policy definitions, schema inventory) but must never `SELECT` business table rows. `security_data_storage` connections get CRUD, but scoped to the `phantix` schema only via role grants, not application-level trust. Full setup detail lives in [[14 - Infrastructure]].

## Where Control Plane ends and Audit Engine begins

As of v1.0, Audit is a first-class engine (see [[12 - Audit Engine]]) — this vault previously argued for keeping it inside Control Plane, and that call has been superseded. The line now drawn:

- **Control Plane owns authorization** — the dual-control session mechanism above: who is logged in as initiator/authorizer, session lifetime, the pending-action queue that gates a sensitive action before it happens.
- **Audit Engine owns the record** — once an action completes, writing the immutable entry, and everything downstream of that (export, retention, compliance consumption). "Nothing outside this Engine writes audit records directly" is now a hard rule, not a convention.

Practically: `POST /audit/pending`, `.../authorize`, `.../reject` stay here because they're part of deciding whether an action is allowed to happen. The moment an action *has* happened and needs to be permanently recorded, that write belongs to Audit Engine even though it's reachable under the same `/audit` router prefix today.

## Related notes

[[01 - Platform Architecture]] · [[02 - Engine Registry]] · [[07 - Risk Engine]] · [[12 - Audit Engine]] · [[14 - Infrastructure]]
