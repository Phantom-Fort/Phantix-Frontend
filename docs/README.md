# Phantix — Public & landing documentation

**Tagline:** PROTECT. PREVENT. PERFORM.
**Audience:** Website visitors, buyers, investors, design partners, first-contact organizations, developers, founders
**Tone:** Clear, confident, honest — outcomes first; no internal engineering jargon on the homepage path

These documents are **client-facing**. Use them for:

- Landing page copy and structure
- Investor / partner one-pagers
- First sales conversations
- Public developer overview
- Trust & privacy answers

**Not for this folder:** internal API dumps, Celery queues, migration IDs. Deep technical catalogs live under `docs/` (engineering).

---

## A. Marketing / audience pages (this folder)

| File | Best for |
|------|----------|
| [01-what-is-phantix.md](./01-what-is-phantix.md) | Hero, one-liner, positioning |
| [02-for-business-leaders.md](./02-for-business-leaders.md) | CEOs, founders, boards |
| [03-for-security-and-it.md](./03-for-security-and-it.md) | CISOs, IT managers, security engineers |
| [04-for-investors-and-partners.md](./04-for-investors-and-partners.md) | Investors, MSSPs, resellers |
| [05-product-capabilities.md](./05-product-capabilities.md) | Product depth (tabs / features) |
| [06-privacy-and-trust.md](./06-privacy-and-trust.md) | Privacy model, NDPA, dual-control |
| [07-pricing-and-plans.md](./07-pricing-and-plans.md) | Free / Premium / add-ons / engagements |
| [08-how-it-works.md](./08-how-it-works.md) | Journey from signup to report |
| [09-ai-with-accountability.md](./09-ai-with-accountability.md) | AI that advises, never invents facts |
| [10-for-developers.md](./10-for-developers.md) | Public API overview (high level) |
| [11-faq.md](./11-faq.md) | FAQ for first contact |
| [12-getting-started.md](./12-getting-started.md) | CTAs and onboarding path |

**Landing section map** (suggested page order):
`01` hero → problem (in 01/02) → `08` how it works → `05` capabilities → `06` privacy → `07` pricing → `09` AI → `11` FAQ → `12` start.

---

## B. Help Centre / setup documentation (standard docs site)

**Folder:** [user-docs/](./user-docs/) — **use this for Documentation in the site nav.**

| Doc | Content |
|-----|---------|
| [user-docs/README.md](./user-docs/README.md) | Help Centre home + setup checklist |
| [user-docs/01-getting-started.md](./user-docs/01-getting-started.md) | Register → setup wizard → first run |
| [user-docs/02-security-database.md](./user-docs/02-security-database.md) | PostgreSQL from Supabase, Neon, RDS, DO, Railway… + **Phantix-hosted DB coming soon** |
| [user-docs/03-email-and-smtp.md](./user-docs/03-email-and-smtp.md) | SES, Brevo, Mailgun, SendGrid, Google, M365 |
| [user-docs/04-alert-channels.md](./user-docs/04-alert-channels.md) | Telegram BotFather, WhatsApp Meta |
| [user-docs/05-github-connection.md](./user-docs/05-github-connection.md) | GitHub App connect & analyze |
| [user-docs/06-plans-and-billing.md](./user-docs/06-plans-and-billing.md) | Free / Premium / AI Agent API plan |
| [user-docs/07-daily-activities.md](./user-docs/07-daily-activities.md) | Day / week / month workflows |
| [user-docs/08-features-overview.md](./user-docs/08-features-overview.md) | Public feature list |
| [user-docs/09-users-and-approvals.md](./user-docs/09-users-and-approvals.md) | Users & dual-control |
| [user-docs/10-ai-agent-api.md](./user-docs/10-ai-agent-api.md) | Public AI Agent API only |
| [user-docs/11-privacy-and-security.md](./user-docs/11-privacy-and-security.md) | Customer privacy view |
| [user-docs/12-troubleshooting.md](./user-docs/12-troubleshooting.md) | Common fixes |

---

## Brand lines (locked)

- **Tagline:** PROTECT. PREVENT. PERFORM.
- **Privacy:** Your security record lives under your keys.
- **Quality:** If it isn’t verified, it doesn’t ship to the board.
- **AI:** AI orchestrates. Engines execute. Facts stay grounded.
- **Public API:** Only payment plan for public API access = **AI Agent plan** (not full-platform API SKU).

---

## Contact / CTA defaults

| CTA | Destination |
|-----|-------------|
| Get started free | Platform registration |
| Sign in | Platform / App (label clearly) |
| Talk to us / Book engagement | Sales or contact form |
| Developer docs | Link to public API section or status |

Update live NGN prices from the Platform billing API when the site goes live — do not hardcode stale amounts on the marketing site without a refresh path.
