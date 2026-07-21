# Phantix Backend — Security Hardening & Implementation Roadmap

**Status**: Living document (July 2026)  
**Audience**: Backend, platform, and product engineering  
**Related**: [ARCHITECTURE.md](./ARCHITECTURE.md) · [ENGINES.md](./ENGINES.md) · [RBAC_MFA.md](./RBAC_MFA.md) · [DUAL_CONTROL_SETUP_FE.md](./DUAL_CONTROL_SETUP_FE.md) · [TWO_PLATFORM_AUTH.md](./TWO_PLATFORM_AUTH.md) · [STAFF_PORTAL.md](./STAFF_PORTAL.md) · [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md)

This document captures:

1. **Current security posture** (what is already solid)
2. **How to tighten backend security** (prioritised hardening)
3. **What is not fully implemented** (product / engine backlog)
4. **Phased roadmap** (P0 → P3)

Update this file when a phase ships or priorities change.

---

## 1. Current security posture (baseline)

### Strengths already in production code

| Area | Implementation |
|------|----------------|
| Auth realms | Separate JWTs: company (`type=access`), org-user (`type=org_user`), app_session + device_token, staff (`type=staff`) |
| Company service keys | Exactly **one active** `pk_live_*` key per company; groups use one key per child company ([TWO_PLATFORM_AUTH.md](./TWO_PLATFORM_AUTH.md)) |
| Tenant IDOR helpers | `app/core/tenant.py` — org-scoped loads, dual-control principal match |
| Dual-control | Initiator/authorizer slots + `X-Dual-Control-Session` (3‑min idle, absolute cap) |
| Org-user login | Domain-email OTP; registration emails domain-exempt; new-device confirmation |
| Operate gate | Middleware blocks non-bootstrap mutations without dual-control when configured |
| Credential encryption | Customer DB passwords Fernet-encrypted on platform DB |
| Tenancy | Security data in customer `security_data_storage` DB / `phantix` schema |
| SSRF | Scan-target protection (`ssrf_protection`) |
| Rate limiting | slowapi + Redis; org-scoped buckets for JWT (`org:{id}`) and service keys (`orgkey:{hash}`); app login IP cap |
| Audit | Login, mutations, optional data-access events on platform `audit_events` |
| Staff isolation | Staff JWT cannot call org routes; org JWT cannot call `/admin/*` |

### Known residual risks (honest)

| Risk | Detail |
|------|--------|
| Dev defaults | `SECRET_KEY`, `STAFF_BOOTSTRAP_*`, `OTP_DEV_EXPOSE` dangerous if left on in prod |
| Create org-user still requires `password` | Login is OTP-first; password field is legacy surface |
| Bootstrap vs operate | FE must use company/org-user Bearer **without** dual session only while dual-control is **not** configured |
| Hosted DB provision | `POST /db-connections/provision` returns **501** — BYO only |
| Shared security DB names | Ops/E2E can reuse DBs across orgs if misconfigured — isolation is operational |
| Alert / Burp / compliance evidence | Stubs reduce blast radius but leave product gaps |
| No refresh tokens / denylist | Stolen JWT valid until expiry |
| OpenAPI public | `/docs` maps the attack surface unless locked down |

---

## 2. Security hardening catalogue

### P0 — Ship before real customer data (blocker)

| # | Action | Owner hint | Done when |
|---|--------|------------|-----------|
| S0.1 | Production secrets: unique `SECRET_KEY`, `ENCRYPTION_KEY`, strong staff bootstrap; disable after first superadmin | Ops | No default credentials in env |
| S0.2 | `OTP_DEV_EXPOSE=false`, `ENVIRONMENT=production` (or staging equivalent) | Ops | No `dev_otp` in API responses |
| S0.3 | CORS allow-list production FE origins only | Backend | No wildcard origins in prod |
| S0.4 | Dedicated security Postgres **per org** (never shared `phantix_security` across tenants) | Ops + BE | Connection host/db unique per org |
| S0.5 | Verify dual-control gate: after assignment, company JWT cannot `POST /org-users` without session | BE QA | Automated test |
| S0.6 | Rate-limit register + company login + org-user login/OTP + staff login (Redis-backed) | BE | Shared limits across workers |

### P1 — High-value auth & control-plane hardening

| # | Action | Notes |
|---|--------|--------|
| S1.1 | Make org-user create `password` optional (auto `!` / OTP-only) | **Done** — omit password on create |
| S1.2 | On dual-control **reassignment**, revoke all operate sessions for affected users | **Done** — previous + new assignees |
| S1.3 | Require operate session (and optionally authorizer approval) to change initiator/authorizer | Stops silent slot takeover with company JWT if any path remains |
| S1.4 | Short staff JWT TTL; document re-login | Staff is break-glass |
| S1.5 | Optional `organization_slug` on org-user login when email matches multiple orgs | Avoid wrong-tenant disambiguation |
| S1.6 | Cap or sample `data.access` GET audit in prod | Reduce noise and PII in logs |
| S1.7 | Disable or auth-protect `/docs` and OpenAPI in production | Attack-surface reduction |
| S1.8 | Security response headers middleware | `X-Content-Type-Options`, `X-Frame-Options`, etc. |

### P2 — Defence in depth

| # | Action | Notes |
|---|--------|--------|
| S2.1 | JWT denylist / logout for company + staff | Redis TTL aligned with exp |
| S2.2 | Refresh-token rotation (optional product) | Or keep short access TTL |
| S2.3 | Bind org-user JWT to device fingerprint claim | Complements new-device OTP |
| S2.4 | Encryption key rotation procedure + re-encrypt connection secrets | Document + script |
| S2.5 | Extend SSRF checks to all outbound URL fetches (GitHub, APK, Wazuh, Burp, webhooks) | Shared helper |
| S2.6 | Redis ACL / separate logical DBs for broker vs rate-limit vs locks | Infra |
| S2.7 | Celery: no pickle; task auth; queue isolation | Workers |
| S2.8 | Password breach / complexity policy for company + staff | zxcvbn or similar |
| S2.9 | Staff fine-grained permissions (beyond admin/support/superadmin) | If product needs least privilege |
| S2.10 | Audit which endpoints decrypt customer DB passwords (server-only) | No password in admin list APIs |

### P3 — Enterprise / compliance-grade

| # | Action | Notes |
|---|--------|--------|
| S3.1 | HSM / KMS for Fernet key material | Cloud KMS |
| S3.2 | Staff break-glass org impersonation with full audit | Product decision |
| S3.3 | SIEM export of `audit_events` | Webhook / S3 |
| S3.4 | Pen-test remediation backlog | External |
| S3.5 | Formal security questionnaire pack (SOC2 evidence from audit trail) | Compliance eng |

---

## 3. Implementation backlog (product / engines)

### 3.1 Status snapshot

| Engine | Status | Gaps |
|--------|--------|------|
| Control Plane | Implemented | Hosted DB provision 501; org-user password field; refresh tokens |
| Asset | Implemented | Continuous discovery polish |
| Scanner | Implemented | Tooling isolation / more tools as product needs |
| VAPT | Implemented | Burp MCP live path stub until configured |
| Risk | Implemented | Expert-review product polish |
| AI | Phase 1–2 live | DeepSeek/Kimi keys wired + fallback chain; Phase 4 agents / Phase 5 RAG deferred |
| Compliance | Phase 1–3 + questionnaire | Merged GRC Q&A multi-user; asset posture merge next; Phase 4 connectors stubbed |
| Reporting | Phase 1–4 core | Read-port cleanup; richer AI narratives |
| Alert | Implemented | WhatsApp / Telegram real providers stubbed |
| Audit | Implemented | Broader pending-action coverage for high-risk ops |
| Operations | Implemented | Search optional; deploy pipeline incomplete |

### 3.2 Critical product gaps

| ID | Item | Status | Target |
|----|------|--------|--------|
| P-CP-01 | Hosted security DB provision (`POST /db-connections/provision`) | **501** | Auto-create Postgres role/DB + register connection |
| P-CP-02 | Org-user create without password / OTP-only directory | Partial | Schema + API optional password |
| P-CP-03 | Token refresh / revoke | Missing | Company + staff |
| P-AL-01 | WhatsApp alert channel | Stub (`provider=log`) | Meta / Twilio API |
| P-AL-02 | Telegram alert channel | Stub | Bot API |
| P-CO-01 | Live Wazuh evidence → `compliance_evidence` | Stub | Connector + worker |
| P-CO-02 | Cloud evidence connectors (AWS/Azure/GCP posture) | Missing | Phase 4 |
| P-CO-03 | Merged GRC questionnaire (multi-user + role audit) | **Done** | session + answers APIs |
| P-CO-04 | Merge questionnaire + asset/scan posture into assessments | **Done** | Dual evidence path |
| P-VA-01 | Burp MCP live findings | Stub until `BURP_MCP_ENDPOINT` | Real adapter |
| P-AI-01 | Remaining agents (auth, flowmapper, chat, …) | Phase 4 | Product-driven |
| P-AI-02 | Full multi-model consensus everywhere | Partial | Enterprise tier |
| P-AI-03 | RAG / vector knowledge | Deferred | Only if sold |
| P-RE-01 | Reporting peer-engine read ports | Polish | Architecture hygiene |
| P-OP-01 | Production deploy CI job | Missing | GitHub Actions → env |
| P-OP-02 | Elasticsearch search default-on | Optional | Feature flag |

### 3.3 Explicit polish (from ENGINES.md)

1. Reporting consolidator — facade/read ports instead of deep imports  
2. AI Engine — deeper product narratives in reports  
3. Compliance Phase 4 — live evidence connectors  

---

## 4. Phased roadmap

### Phase P0 — Security baseline (1–2 weeks)

**Goal**: Safe for real tenants on staging/prod.

- [ ] S0.1–S0.6 secrets, OTP, CORS, per-org DB, dual-control tests, rate limits  
- [ ] Runbook: “prod env checklist” (copy section 6)  
- [ ] Confirm `docs/DUAL_CONTROL_SETUP_FE.md` matches live bootstrap rules  

**Exit criteria**: No default secrets; no dev OTP leak; dual-control automated tests green; each org has isolated security DB.

### Phase P1 — Auth hardening + control-plane UX (2–4 weeks)

**Goal**: OTP-first org users; safer dual-control lifecycle.

- [ ] S1.1 optional password on org-user create  
- [ ] S1.2–S1.3 session revoke + reassignment policy  
- [ ] S1.5 multi-org login disambiguation  
- [ ] S1.7–S1.8 OpenAPI lock + security headers  
- [ ] P-CP-01 design spike for hosted provision (or polished BYO wizard only)

**Exit criteria**: Create dual-control users without legacy password ceremony; changing slots revokes old sessions.

### Phase P2 — Hosted tenancy + channels (4–8 weeks)

**Goal**: Reduce ops toil; complete customer alert loop.

- [ ] P-CP-01 hosted provision (or managed BYO automation script)  
- [ ] P-AL-01 / P-AL-02 real WhatsApp + Telegram  
- [ ] S2.1–S2.5 denylist, SSRF sweep, key rotation script  
- [ ] Broader audit pending coverage for connection secret changes / dual-control assign  

**Exit criteria**: New org can get a security DB without manual SQL; critical alerts reach WA/TG when configured.

### Phase P3 — Compliance evidence + AI depth (as sold)

**Goal**: Differentiated compliance and AI narratives.

- [ ] P-CO-01 Wazuh (and optional cloud) evidence  
- [ ] P-VA-01 Burp live if customers require  
- [ ] P-AI-01 agents only if roadmap demands  
- [ ] P-RE-01 architecture ports  
- [ ] S3.* enterprise controls as enterprise contracts require  

**Exit criteria**: Compliance assessments use live evidence where connectors configured; AI remains non-authoritative on security facts.

### Phase P4 — Platform maturity (ongoing)

- [ ] P-OP-01 deploy pipeline  
- [ ] Multi-tenant load testing (50+ orgs) against pool settings  
- [ ] External pen-test + remediation (S3.4)  
- [ ] SIEM export (S3.3)  

---

## 5. Suggested PR sequencing (security first)

| PR | Scope |
|----|--------|
| 1 | Prod env validation on startup (fail if default SECRET / OTP_DEV in production) |
| 2 | Tests: bootstrap `POST /org-users` without dual session; post-config requires session |
| 3 | ~~Optional password on `OrganizationUserCreate` + create path OTP-only~~ **Done** |
| 4 | Revoke sessions on dual-control assign/update |
| 5 | Security headers + optional disable docs in production |
| 6 | Hosted DB provision MVP or ops script `scripts/provision_org_security_db.py` |
| 7 | Alert provider interfaces + one real channel |

---

## 6. Production environment checklist

```bash
# Must NOT be defaults
SECRET_KEY=...                 # long random
ENCRYPTION_KEY=...             # Fernet
STAFF_BOOTSTRAP_PASSWORD=...   # changed; ideally bootstrap disabled after first user

OTP_DEV_EXPOSE=false
ENVIRONMENT=production
BACKEND_CORS_ORIGINS=https://app.yourdomain.com

# Dual-control
ORG_USER_SESSION_INACTIVITY_MINUTES=3
ORG_USER_SESSION_ABSOLUTE_MINUTES=30

# Rate limits
RATE_LIMIT_ENABLED=true
REDIS_URL=redis://...

# Optional
# DISABLE_OPENAPI=true  # if implemented
```

Operational:

- [ ] Platform DB backups encrypted  
- [ ] Each customer security DB backed up separately  
- [ ] Cloudflare tunnel / TLS edge  
- [ ] Celery workers + alert daemon supervised  
- [ ] Staff accounts least privilege (`support` vs `admin`)  

---

## 7. Testing expectations

| Layer | What to cover |
|-------|----------------|
| Unit | Device fingerprint, registration-email allowlist, bootstrap dependency |
| API | Dual-control not configured → create user OK; configured → 403 without session |
| API | Org-user login OTP; new-device gate |
| API | Staff token rejected on org routes and vice versa |
| Integration | Security schema bootstrap; one org cannot read another's security DB |
| Load | Login/OTP rate limits; connection pool under concurrent orgs |

---

## 8. Out of scope / deferred by default

| Item | Why defer |
|------|-----------|
| Full RAG | Cost/complexity; not required for core VAPT loop |
| Full multi-model consensus on every finding | Enterprise upsell |
| SMS OTP for org setup | Email OTP is primary; SMS stub only |
| Staff impersonation of customer | High risk without product + legal design |

---

## 9. Document history

| Date | Change |
|------|--------|
| 2026-07-17 | Initial roadmap: security hardening P0–P3 + engine backlog + PR sequence |

---

## 10. Quick links

| Topic | Doc |
|-------|-----|
| Customer FE dual-control wizard | [DUAL_CONTROL_SETUP_FE.md](./DUAL_CONTROL_SETUP_FE.md) |
| Customer FE API contract | [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) |
| Staff / admin FE | [STAFF_PORTAL.md](./STAFF_PORTAL.md) |
| Compliance admin upload | [COMPLIANCE.md](./COMPLIANCE.md) |
| Connections / bootstrap | [CONNECTIONS.md](./CONNECTIONS.md) |
| Server ops | [SERVER_OPS.md](./SERVER_OPS.md) |
| Engine map | [ENGINES.md](./ENGINES.md) · `app/_engine_map.py` |
