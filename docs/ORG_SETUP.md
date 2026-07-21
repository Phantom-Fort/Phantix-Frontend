# Organization Setup + Identity & Company Verification

**Status**: Updated July 2026 — **email OTP only**; phone OTP removed.  
**Full FE implementation**: [frontend/01_ORG_SETUP_IMPLEMENTATION.md](./frontend/01_ORG_SETUP_IMPLEMENTATION.md)

After registration, clients complete **Organization Setup**: accept privacy messaging, verify **email via OTP**, and optionally complete **company verification modes**.

---

## Frontend page flow

1. **Privacy panel** — `GET /me/setup` → `privacy` object
2. Accept notice → `POST /me/setup/privacy/accept`
3. Optional company identity fields → `POST /me/setup/identity` (website, legal name, …)
4. **Email OTP** → send + verify
5. **Optional company modes** (any combination):
   - Domain DNS TXT
   - Domain HTTP well-known file
   - CAC / RC details
   - Manual staff review
6. **Complete** → `POST /me/setup/complete` (needs privacy + email OTP only)

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

---

## API (org JWT unless noted)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/organizations/privacy` | Public privacy notice |
| `GET` | `/me/setup` | Setup status + privacy + all modes |
| `POST` | `/me/setup/privacy/accept` | Accept privacy |
| `POST` | `/me/setup/identity` | Website, legal name, company phone (contact only) |
| `POST` | `/me/setup/otp/send` | Email OTP only (`channel` defaults to `email`) |
| `POST` | `/me/setup/otp/verify` | Verify email OTP code |
| `POST` | `/me/setup/verify/domain/start` | Issue domain token + instructions |
| `POST` | `/me/setup/verify/domain/check` | Check DNS and/or HTTP (`method`: auto\|dns\|http) |
| `POST` | `/me/setup/cac` | CAC/RC or `{ "skip": true }` |
| `POST` | `/me/setup/verify/manual-review` | Request staff review |
| `POST` | `/me/setup/complete` | Finish setup |

### Staff (staff JWT)

```http
POST /api/v1/admin/clients/{id}/verification/manual-review?approve=true&notes=...
```

---

## Domain verification example

```http
POST /me/setup/verify/domain/start
{ "domain": "acme.ng" }
```

Response includes:

- DNS TXT value: `phantix-verify=<token>`
- HTTP URL: `https://acme.ng/.well-known/phantix-verify.txt` (body = token)

Then:

```http
POST /me/setup/verify/domain/check
{ "method": "auto" }
```

---

## Email OTP example

```http
POST /me/setup/otp/send
{ "channel": "email" }

POST /me/setup/otp/verify
{ "channel": "email", "code": "123456" }
```

With `OTP_DEV_EXPOSE=true`, send responses include `dev_otp` for local testing.

Phone OTP returns **400** if requested.

---

## Privacy messaging

Includes:

- What Phantix stores vs dedicated security DB vs production data
- Email-only OTP explainer
- Company verification modes catalog

---

## Requirements to complete setup

| Check | Required |
|-------|----------|
| Privacy notice accepted | Yes |
| Email OTP verified | Yes |
| Domain / CAC / manual | Optional |
