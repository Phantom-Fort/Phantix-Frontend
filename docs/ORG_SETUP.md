# Organization Setup + Identity & Company Verification

**Status**: Updated 21 July 2026 — email OTP only; phone OTP removed.  
**Full FE implementation (endpoints + payloads)**: [frontend/01_ORG_SETUP_IMPLEMENTATION.md](./frontend/01_ORG_SETUP_IMPLEMENTATION.md)

After **registration** and **company login**, clients complete **Organization Setup**: accept privacy messaging, verify **email via OTP**, and optionally complete **company verification modes**.

---

## Frontend page flow

1. **Register** — `POST /api/v1/organizations/register` (JSON; **no JWT** returned)
2. **Login** — `POST /api/v1/organizations/login` (form `username` + `password`) + optional `POST …/login/mfa`
3. **Privacy** — `GET /api/v1/organizations/me/setup` → accept via `POST …/me/setup/privacy/accept`
4. Optional company identity fields — `POST …/me/setup/identity`
5. **Email OTP** — send + verify
6. **Optional company modes** (any combination):
   - Domain DNS TXT
   - Domain HTTP well-known file
   - CAC / RC details
   - Manual staff review
7. **Complete** — `POST …/me/setup/complete` (needs privacy + email OTP only)
8. **First-run platform** (separate): dual-control users → security DB → assets

---

## Verification model

| Mode | ID | Required for setup? | Purpose |
|------|-----|---------------------|---------|
| Email OTP | `email_otp` | **Yes** | Prove control of primary sign-in email |
| Domain DNS | `domain_dns` | No | TXT `phantix-verify=<token>` |
| Domain HTTP | `domain_http` | No | `/.well-known/phantix-verify.txt` |
| CAC / RC | `cac_rc` | No | Self-attested CAC registration fields |
| Manual review | `manual_review` | No | Staff approve/reject |

- **identity_verified** = email OTP done  
- **company_verified** = at least one of domain / CAC / manual approved  
- **can_complete_setup** = privacy + email OTP done and setup not yet marked complete  
- **setup_completed** = `POST …/complete` succeeded  

---

## API (full paths)

Auth: company JWT (`Authorization: Bearer …`) unless **Public**.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/organizations/register` | Public — create company (JSON) |
| `POST` | `/api/v1/organizations/login` | Public — form-urlencoded password |
| `POST` | `/api/v1/organizations/login/mfa` | Public — complete email MFA |
| `GET` | `/api/v1/organizations/privacy` | Public privacy notice |
| `GET` | `/api/v1/organizations/me/setup` | Setup status + privacy + modes |
| `POST` | `/api/v1/organizations/me/setup/privacy/accept` | `{ accepted: true, notice_version? }` |
| `POST` | `/api/v1/organizations/me/setup/identity` | website, legal_name, registration_number, company_phone |
| `POST` | `/api/v1/organizations/me/setup/otp/send` | `{ channel: "email" }` |
| `POST` | `/api/v1/organizations/me/setup/otp/verify` | `{ channel: "email", code }` |
| `POST` | `/api/v1/organizations/me/setup/verify/domain/start` | `{ domain?, website? }` |
| `POST` | `/api/v1/organizations/me/setup/verify/domain/check` | `{ method: "auto"\|"dns"\|"http" }` |
| `POST` | `/api/v1/organizations/me/setup/cac` | CAC fields or `{ skip: true }` |
| `POST` | `/api/v1/organizations/me/setup/verify/manual-review` | `{ notes? }` |
| `POST` | `/api/v1/organizations/me/setup/complete` | Finish setup (no body) |

### Staff (staff JWT)

```http
POST /api/v1/admin/clients/{id}/verification/manual-review?approve=true&notes=...
```

---

## Register (required fields)

`name`, `slug`, `email`, `secondary_email`, `password`, `industry`, `country`, `primary_contact` (with at least `name`).

See FE guide for full example JSON and enums.

---

## Domain verification example

```http
POST /api/v1/organizations/me/setup/verify/domain/start
{ "domain": "acme.ng" }
```

Response includes token + `instructions` (DNS TXT / HTTP file).

```http
POST /api/v1/organizations/me/setup/verify/domain/check
{ "method": "auto" }
```

---

## Email OTP example

```http
POST /api/v1/organizations/me/setup/otp/send
{ "channel": "email" }

POST /api/v1/organizations/me/setup/otp/verify
{ "channel": "email", "code": "123456" }
```

Requires privacy accepted first. With `OTP_DEV_EXPOSE=true`, send responses may include `dev_otp` (local only).

Phone OTP returns **400**.

---

## Requirements to complete setup

| Check | Required |
|-------|----------|
| Privacy notice accepted | Yes |
| Email OTP verified | Yes |
| Domain / CAC / manual | Optional |

---

## After setup

| Step | Doc |
|------|-----|
| Dual-control initiator/authorizer | [DUAL_CONTROL_SETUP_FE.md](./DUAL_CONTROL_SETUP_FE.md) |
| Security Postgres connection | [CONNECTIONS.md](./CONNECTIONS.md) |
| Platform shell | [frontend/02_PLATFORM_IMPLEMENTATION.md](./frontend/02_PLATFORM_IMPLEMENTATION.md) |
