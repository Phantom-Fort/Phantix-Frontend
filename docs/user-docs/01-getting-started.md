# Getting started with Phantix

Welcome. This guide walks a new organization from registration to first value.

---

## Before you begin

| Have ready | Why |
|------------|-----|
| Work email you control | Login + email OTP |
| Secondary email (different from primary) | Recovery / comms |
| Company name, industry, country | Registration |
| A place to host **PostgreSQL** (or wait for Phantix-hosted DB) | Store assets, findings, risks |
| Optional: domain you control | Company verification (DNS or file) |

---

## Step 1 — Create your organization

1. Open the Platform **Get started free** / Register page.
2. Enter company details, primary contact, and a strong password.
3. You will **not** stay logged in automatically — go to **Sign in** with your **primary email**.

If login requires multi-factor, complete the email MFA step.

---

## Step 2 — Organization setup wizard

In order:

1. **Accept privacy notice**
2. Optional identity fields (legal name, website, phone)
3. **Verify email via OTP** (required to finish setup)
4. Optional company verification:
   - DNS TXT record
   - HTTP well-known file
   - CAC / RC details
   - Request manual review by Phantix staff
5. **Complete setup**

Until setup is complete, some product areas stay locked.

---

## Step 3 — First-run platform checklist

After setup:

1. **Invite users** and assign roles (operator vs authorizer for dual-control)
2. **Connect security database** → [02-security-database.md](./02-security-database.md)
3. **Bootstrap schema** (one click / API after a successful connection test)
4. **Add assets** (domain, public GitHub repo, etc.)
5. **Configure alerts** (SMTP / channels) → [03](./03-email-and-smtp.md), [04](./04-alert-channels.md)
6. Run a **light scan** or inventory check (within Free entitlements)
7. Review findings; export JSON/Markdown on Free

---

## Step 4 — Grow when ready

| Need | Action |
|------|--------|
| Board PDF reports, VAPT campaigns, private GitHub | Upgrade to **Premium** |
| Programmatic AI agents for integrators | **AI Agent plan** (public API) |
| Full pentest with humans | Request an **engagement** |

---

## Time to first value

Most teams can register, verify email, connect a small Postgres database, add a domain, and export a first inventory within one guided session.

**Next:** [Connect your security database →](./02-security-database.md)
