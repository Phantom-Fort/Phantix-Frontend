# Social profiles — Phantix Security Solutions (SecureGraph)

**Status:** draft v2 — company/product profile copy, a founder-facing profile and the first five launch
posts are drafted and length-checked. Handles and a few company facts still need a human decision —
see [Open questions](#14-open-questions).

| | |
|---|---|
| **Scope** | Company/product profiles: LinkedIn, X, Instagram, Facebook, YouTube, GitHub · founder profile · launch posts |
| **Owner** | Marketing / founders |
| **Brand lines** | Locked in [docs/README.md](../README.md#brand-lines-locked) — quote them, don't paraphrase |
| **Founder profile** | [§9](#9-founder-facing-linkedin-profile) — headline + About, first-person |
| **Launch posts** | [§10](#10-first-five-launch-posts) — the first five, LinkedIn / X / Instagram |
| **Copy source** | [docs/01-what-is-securegraph.md](../01-what-is-securegraph.md), [docs/05-product-capabilities.md](../05-product-capabilities.md), [docs/06-privacy-and-trust.md](../06-privacy-and-trust.md), [docs/09-ai-with-accountability.md](../09-ai-with-accountability.md) |
| **Length check** | `npm run validate:social` — fails if a draft overflows its platform field or a cross-reference is broken |
| **Assets** | [§7 asset matrix](#7-asset-matrix--what-goes-where-from-this-repo) |

---

## 1. Facts we may state publicly

Only what is already published in this repo. Anything marked ⚠️ needs a decision before it goes live.

| Field | Value | Source |
|---|---|---|
| Company | **Phantix Security Solutions** | `landing/index.html` structured data |
| Alternate names already declared | Phantix Labs · Phantom Labs · Phantom Security | `landing/index.html` |
| Product | **SecureGraph** — Command Centre | `public/site.webmanifest`, [docs/01](../01-what-is-securegraph.md) |
| Product surfaces | Core (`app.`) · Attack (`attack.`) · Defend (`defend.`) · Code (`code.`) · Platform (`platform.`) | `DEPLOYMENT.md`, `landing/src/lib/config.ts` |
| Blog | The SecureGraph Weekly — `blog.phantixlabs.com` | `staff-portal/src/lib/config.ts` |
| Website | `https://phantixlabs.com` | `landing/src/lib/config.ts` |
| Tagline | **PROTECT. PREVENT. PERFORM.** | [docs/README.md](../README.md) |
| Locked brand lines | Your security record lives under your keys. · If it isn't verified, it doesn't ship to the board. · AI orchestrates. Engines execute. Facts stay grounded. | [docs/README.md](../README.md) |
| Support | `support@phantixlabs.com` | `apps/securegraph-core/src/pages/Support.tsx` |
| Privacy / DPO | `privacy@phantixlabs.com` | `landing/src/pages/Cookies.tsx` |
| Public numbers already on site | 13 engines · 10+ AI agents · 600+ checks | `landing/src/components/chrome.tsx` |
| Plans | Free (no card) · Starter ₦19,900/mo · Growth ₦49,900/mo ⚠️ *verify against live billing before quoting* | `landing/index.html` `Offer` |
| Billing | Paystack, NGN-first | [docs/07](../07-pricing-and-plans.md) |
| Privacy posture | Data-isolation design aligned with Nigeria's **NDPA** | [docs/06](../06-privacy-and-trust.md) |
| GitHub org | `https://github.com/Phantom-Fort` (existing — do not rename for social tidy-up) | repo remote |
| Headquarters / city | ⚠️ not stated anywhere in this repo | — |
| Founded year, team size, phone | ⚠️ not stated anywhere in this repo | — |

**Never claim** (explicitly ruled out in the docs): zero false positives, "AI finds vulnerabilities
by itself", a public full-platform API, or customer logos and ARR we can't evidence
([docs/04](../04-for-investors-and-partners.md), [docs/05](../05-product-capabilities.md)).

---

## 2. Handles & naming

One handle everywhere we can get it. Primary is `phantixlabs` because it matches the domain.

| Platform | Recommended | Fallbacks, in order | Notes |
|---|---|---|---|
| LinkedIn (company) | `/company/phantixlabs` | `/company/phantix-security-solutions`, `/company/securegraph` | Custom URL is editable after page creation |
| X | `@phantixlabs` | `@phantixhq`, `@securegraph`, `@phantixsecurity` | Display name can carry the product |
| Instagram | `@phantixlabs` | `@phantix.security`, `@securegraph` | |
| Facebook Page | `@phantixlabs` | `@phantixsecuritysolutions` | Username is editable later |
| YouTube | `@phantixlabs` | `@phantixsecurity` | Handle feeds the channel URL |
| GitHub | `Phantom-Fort` (keep) | — | Org already exists; set the display name and bio, don't migrate |

⚠️ **Check availability before claiming anything.** Availability is not verifiable from this repo,
and a squatted X handle is not worth renaming the company over — take the fallback and keep the
display name exact.

---

## 3. Platform profiles

Each draft below is fenced as `bio:<id> limit=<n>` (or `limit=<n>w` for word ceilings) so
`npm run validate:social` can prove it fits the field before you paste it.

### LinkedIn — company page

| Field | Limit | Value |
|---|---|---|
| Page name | 120 | Phantix Security Solutions |
| Tagline ("slogan") | 120 | see below |
| About us | 2,000 | see below |
| Industry | — | Computer and Network Security |
| Company size | — | ⚠️ decide (e.g. "2–10 employees") |
| Headquarters | — | ⚠️ decide |
| Website | — | `https://phantixlabs.com` |
| Specialties | 20 tags | Attack surface management · Vulnerability assessment · Penetration testing · VAPT · Continuous security · Verified findings · Risk prioritization · Remediation tracking · Compliance mapping · Dual-control governance · Audit trail · AI security agents · Security reporting · Asset intelligence · Privacy-first security · NDPA |

```bio:linkedin-tagline limit=120
SecureGraph: vulnerability assessment, pentesting and continuous security. Verified findings, data you control.
```

```bio:linkedin-about limit=2000
Phantix Security Solutions builds SecureGraph — a cybersecurity command centre for organizations that need real visibility, honest findings and board-ready proof, without handing their security record to another black-box SaaS.

SECUREGRAPH IN ONE LINE
Discover what you own, test what matters, and deliver verified findings leadership can trust — while your security inventory stays in your database.
PROTECT. PREVENT. PERFORM.

WHAT IT DOES
• Know — asset and attack-surface intelligence across domains, apps, APIs, repos and mobile
• Test — scoped scanning and VAPT campaigns; sensitive actions can require approval
• Prioritize — explainable risk scoring and remediation order
• Prove — verified findings, impact analysis, compliance-aware board packages
• Respond — email, WhatsApp and Telegram alerts, with a full audit trail

WHERE WE DIFFER
• Your security record lives under your keys — assets, scans, findings and risks sit in a dedicated security database you control
• If it isn't verified, it doesn't ship to the board — heuristic noise is held back or listed separately
• AI orchestrates, engines execute, facts stay grounded — agents explain and plan; engines carry the evidence
• Dual control by default — a sensitive test needs an initiator and an authorizer

WHO WE SERVE
SMEs and scale-ups without an in-house SOC, security and IT leads who need engineer-grade evidence, boards and founders who need plain-language impact, and security providers building a multi-tenant delivery practice. Privacy-first design, aligned with Nigeria's NDPA.

Start free — no card required: https://platform.phantixlabs.com/register
Product: https://phantixlabs.com · Docs: https://app.phantixlabs.com/docs
Support: support@phantixlabs.com
```

**Call-to-action button:** Sign up → `https://platform.phantixlabs.com/register`.
Pinned post: the [brag-output/brag.mp4](../../brag-output/brag.mp4) launch film with the caption in
[brag-output/share-copy.txt](../../brag-output/share-copy.txt).

The founder's personal profile copy — headline and About — is in
[§9](#9-founder-facing-linkedin-profile); the company page and the founder profile should never
contradict each other.

---

## 4. X (Twitter)

| Field | Limit | Value |
|---|---|---|
| Display name | 50 | SecureGraph by Phantix |
| Bio | 160 | see below |
| Location | 30 | ⚠️ decide (e.g. `Nigeria`) |
| Website | — | `https://phantixlabs.com` |

```bio:x-bio limit=160
VAPT and continuous security for lean teams. Verified findings, security data you control. SecureGraph by Phantix. PROTECT. PREVENT. PERFORM.
```

Alternative display name if the legal brand should lead: `Phantix Security Solutions` (26 chars).

**Pinned post:** launch film plus one-line claim — *"Open findings are the verified ones.
Heuristic noise never gets here."* — then the link. Keep the "we're looking for builders" line for
a separate post ([brag-output/brag-plan.md](../../brag-output/brag-plan.md)).

---

## 5. Instagram

| Field | Limit | Value |
|---|---|---|
| Name (searchable) | 30 | Phantix Security Solutions |
| Username | 30 | `phantixlabs` |
| Bio | 150 | see below |
| Link | — | `https://phantixlabs.com` (or a link-in-bio page) |

```bio:instagram-bio limit=150
SecureGraph by Phantix — VAPT & continuous security for lean teams. Verified findings. Your data stays yours. PROTECT. PREVENT. PERFORM.
```

**Highlights to build:** Surfaces · How it works · Trust & data · Pricing · Docs · Blog.
**First content:** the 20s launch film, cut vertical (see [§7](#7-asset-matrix--what-goes-where-from-this-repo)),
then carousels built from `landing/public/scenes/product-*.jpg`.

---

## 6. Facebook Page, YouTube & GitHub

### Facebook Page

| Field | Value |
|---|---|
| Page name | Phantix Security Solutions |
| Username | `@phantixlabs` |
| Category | Software Company (add Computer Company / Network Security if offered) |
| Website | `https://phantixlabs.com` |
| CTA button | Sign Up → `https://platform.phantixlabs.com/register` |
| Short description | see below |
| About | see below |

```bio:facebook-short limit=255
SecureGraph by Phantix is a cybersecurity command centre for lean teams: vulnerability assessment, pentesting and continuous security with verified findings — and your security record in a database you control.
```

```bio:facebook-about limit=1000
Phantix Security Solutions builds SecureGraph — a cybersecurity command centre for organizations that need real visibility, honest findings and board-ready proof, without giving up control of their security record.

SecureGraph takes a lean team from inventory to evidence: know what you own, test what matters, prioritize by business impact, and prove remediation with verified findings. Sensitive tests can require dual control — an initiator and an authorizer — and every action is auditable.

Free to start, no card required. Premium adds VAPT campaigns, private-repository analysis, board-ready PDF packages and AI domain agents.

Website: https://phantixlabs.com
Start free: https://platform.phantixlabs.com/register
Support: support@phantixlabs.com

PROTECT. PREVENT. PERFORM.
```

### YouTube channel

| Field | Value |
|---|---|
| Channel name | Phantix Security Solutions |
| Handle | `@phantixlabs` |
| Links | Website · Docs · Blog · LinkedIn |
| Banner | 2560×1440 upload; keep everything inside the 1546×423 centre safe area |
| Trailer | `brag-output/brag.mp4` (20s, 1920×1080, no voice) — channel trailer, not the featured video |

```bio:youtube-about limit=1000
SecureGraph is a cybersecurity command centre for lean security teams — built by Phantix Security Solutions.

Know what you own. Test what matters. Prove what you fixed.
Asset and attack-surface inventory, scoped scanning and VAPT campaigns, explainable risk prioritization, and verified findings with business impact — packaged for engineers and for the board. Your security record lives in a dedicated database you control, sensitive tests can require dual control, and AI agents explain and plan while the engines carry the evidence.

On this channel: short walkthroughs of real SecureGraph screens, Command Centre how-tos, and the occasional security-programme explainer. No fear marketing, no invented findings.

Start free (no card required): https://platform.phantixlabs.com/register
Website: https://phantixlabs.com
Docs: https://app.phantixlabs.com/docs
Blog: https://blog.phantixlabs.com
Support: support@phantixlabs.com

PROTECT. PREVENT. PERFORM.
```

### GitHub org (`github.com/Phantom-Fort`)

| Field | Limit | Value |
|---|---|---|
| Display name | — | Phantix Security Solutions |
| Bio | 160 | see below |
| Website | — | `https://phantixlabs.com` |
| Location | — | ⚠️ decide |

```bio:github-bio limit=160
Phantix Security Solutions — building SecureGraph, an AI-native cybersecurity command centre for lean teams. PROTECT. PREVENT. PERFORM.
```

Add an org profile README (`Phantom-Fort/.github/profile/README.md`) that repeats the
[§8 boilerplate](#8-boilerplates) and links Support and Docs. Keep client work, tokens and internal
hostnames out of public repos — the rule in [brag-output/brag-plan.md](../../brag-output/brag-plan.md)
applies to anything published, not only to the video.

---

## 7. Asset matrix — what goes where, from this repo

Dimensions below were measured from the committed files, so the crop maths is real.

### Brand marks (in `public/`, mirrored in `landing/public/`)

| Asset | Size | Use |
|---|---|---|
| `logo.svg` / `logo-white.svg` | vector wordmark, ≈3.97:1 | Any cover or banner — scale freely, never stretch |
| `logo-transparent.png` / `logo.png` | 1200×302 | Light backgrounds; current `og:image` |
| `logo-white.png` | 1200×302 | Dark backgrounds (`#090806` canvas) |
| `mark-white.svg` / `mark-white.png` | vector / 471×512 | Profile avatars — pad to a square canvas |
| `mark-navy.png`, `mark-black.svg` | 471×512 / vector | Light-background variants |
| `android-chrome-512x512.png`, `favicon-512x512.png` | 512×512 | Already square: safe as an avatar if the tile background suits |
| `apple-touch-icon.png` | 180×180 | App icon only — below avatar minimums |
| `favicon.svg`, `favicon.ico` | vector / 48 | Browser tabs, not profiles |

### Profile avatars (1:1)

Every platform here wants 400×400 or larger, so:

- `public/android-chrome-512x512.png` — 512×512, the simplest "works everywhere" avatar.
- `public/mark-white.png` — 471×512; pad to 512×512 with `#090806` so the mark isn't clipped.

Do **not** use the wordmark as an avatar: at ≈3.97:1 it renders as a sliver in a circular crop.

### Covers and banners — **nothing in this repo is the right shape yet**

| Platform | Upload target (verify in the current uploader) |
|---|---|
| LinkedIn company cover | 1128×191 (≈5.9:1) |
| LinkedIn personal background | 1584×396 |
| X header | 1500×500, safe area ≈1500×360 centre |
| Facebook cover | 820×312 |
| YouTube banner | 2560×1440 upload, 1546×423 centre safe area |
| Instagram post | 1080×1080 or 1080×1350 |
| Story / Reel / Short | 1080×1920 |

Compose these from the existing scene renders — 2000×1226 and 1400-wide JPEGs are enough
resolution for every slot above once cropped:

| Scene | Size | Best cover / banner material |
|---|---|---|
| `landing/public/scenes/command-centre-dashboard.jpg` | 2000×1226 | X header, LinkedIn cover (dashboard crop left, wordmark right) |
| `landing/public/scenes/product-agent.jpg` | 1400×1196 | AI / agent posts |
| `landing/public/scenes/product-vapt.jpg` | 1400×2666 | Vertical posts, Story backgrounds |
| `landing/public/scenes/product-soc.jpg` | 1400×1769 | Vertical posts |
| `landing/public/scenes/product-assets.jpg` | 1400×1570 | Carousels |
| `landing/public/scenes/product-risks.jpg` | 1400×1251 | Risk-prioritization posts |
| `landing/public/scenes/product-reports.jpg` | 1400×1338 | Verified-findings / board-pack posts |
| `landing/public/scenes/privacy-your-database-poster.jpg` | 1280×720 | Privacy and trust posts |
| `landing/public/scenes/hero-command-centre-poster.jpg` | 1280×702 | Fallback thumbnail |

Each scene also ships a `-light` variant — use dark by default, light only for light-mode feeds.

### Screenshots and video

| Asset | Size | Use |
|---|---|---|
| `brag-output/brag.mp4` + `brag.jpg` | 1920×1080, 20s | YouTube trailer, LinkedIn/X native video, Facebook |
| `brag-output/share-copy.txt` | — | Ready-made caption for the launch film |
| `landing/public/scenes/hero-command-centre.mp4` / `.webm` | 1280×702 | Looping product demo for posts |
| `public/screenshots/app/*.png` | 1440×900 viewport shots | Product feature posts |
| `public/screenshots/landing-*.png` | 1440×9577 full-page | **Crop first** — never post a full-page capture |
| `docs/screenshots/**` | mixed | Same library, docs-facing |
| `AAAnimations/` | — | Motion assets for Reels / Shorts |

**Gap:** vertical 1080×1920 video does not exist. The launch film is landscape — re-render it with
`/brag --format vertical` before the first Reels or Shorts post.

---

## 8. Boilerplates

Reuse one of these wherever a profile field or a press listing needs a fixed blurb.

```bio:boilerplate-15w limit=25w
Phantix Security Solutions builds SecureGraph, a cybersecurity command centre for lean security teams.
```

```bio:boilerplate-30w limit=40w
Phantix Security Solutions builds SecureGraph, a cybersecurity command centre that turns vulnerability assessment and penetration testing into verified, board-ready evidence: with the security record kept in a database the customer controls.
```

```bio:boilerplate-50w limit=65w
Phantix Security Solutions builds SecureGraph, a cybersecurity command centre for teams that need real visibility, honest findings and board-ready proof. It covers asset and attack-surface inventory, scoped scanning and VAPT campaigns, explainable risk prioritization and verified reporting, with security posture data held in a dedicated database the customer controls. PROTECT. PREVENT. PERFORM.
```

```bio:boilerplate-100w limit=125w
Phantix Security Solutions builds SecureGraph, a cybersecurity command centre for organizations that cannot staff a full security operations centre. SecureGraph takes a team from inventory to evidence: know what you own across domains, apps, APIs, repos and mobile; test what matters with scoped scans and VAPT campaigns; prioritize by explainable risk; and prove remediation with findings that have been verified rather than raw scanner noise. Sensitive tests can require dual control, every action is auditable, AI agents explain and plan while the engines carry the evidence, and the security record lives in a dedicated database the customer controls. Free to start, no card required. PROTECT. PREVENT. PERFORM.
```

```bio:boilerplate-press limit=300w
About Phantix Security Solutions

Phantix Security Solutions builds SecureGraph, a cybersecurity command centre for organizations that need real visibility, honest findings and board-ready proof without surrendering control of their security record.

SecureGraph covers the full programme in one platform: asset and attack-surface intelligence across domains, applications, APIs, repositories and mobile packages; scoped scanning and VAPT campaigns; explainable risk scoring and remediation order; verified findings with business impact; and compliance-aware reporting for both engineers and the board. Alerts reach email, WhatsApp and Telegram, sensitive actions can require dual control, and every action is audit-controlled.

Three design positions define the product. Your security record lives under your keys: assets, scans, findings and risks are designed to live in a dedicated security database the customer controls, not a shared vendor lake. If it isn't verified, it doesn't ship to the board: heuristic noise is held back or listed separately rather than dressed up as confirmed risk. AI orchestrates, engines execute, facts stay grounded: domain agents (SOC, GRC, VAPT, threat intel, asset and Chief) explain, triage and plan using engine evidence, and they never bypass human approval.

The platform is built for SMEs and scale-ups without an in-house SOC, for security and IT leads who need engineer-grade evidence, for boards and founders who need plain-language impact, and for security providers who want a multi-tenant delivery platform. Privacy-first design is aligned with Nigeria's NDPA, and billing is NGN-first. Free is available with no card required, alongside paid Starter and Growth plans, add-ons and human-led engagements.

PROTECT. PREVENT. PERFORM.
```

---

## 9. Founder-facing LinkedIn profile

The company page earns trust; a founder profile earns reach. Both say the same things — the personal
profile just leads with the problem instead of the product.

| Field | Limit | Value |
|---|---|---|
| Headline | 220 | see below |
| About | 2,600 | see below |
| Location | — | ⚠️ decide |
| Website | — | `https://phantixlabs.com` |
| Featured | — | pin the launch film (`brag-output/brag.mp4`) and the landing page |
| Skills worth listing | — | Vulnerability Assessment · Penetration Testing · Application Security · Cloud Security · Threat Modeling · Risk Management · Security Architecture · Compliance (NDPA, ISO-oriented) · LLM/AI security |
| Contact info | — | ⚠️ a business address rather than a personal one |

⚠️ Swap `Founder` if the title is different (CEO / CTO / co-founder), and keep `{{founder email}}`
out of the live profile until it's replaced — placeholders count as characters, so re-run
`npm run validate:social` after editing.

```bio:founder-headline limit=220
Founder at Phantix Security Solutions — we build SecureGraph, a cybersecurity command centre for lean teams: verified findings, dual control, and security data you keep. PROTECT. PREVENT. PERFORM.
```

```bio:founder-about limit=2600
I spend most of my time with teams who are accountable for security without the headcount to match it — and the same three problems come up in almost every conversation.

They can't say with confidence what they own. The findings they do have are a scanner dump nobody trusts. And they have no appetite for putting their vulnerability list inside someone else's cloud just to get a report out.

So we built SecureGraph.

WHAT WE'RE BUILDING
A cybersecurity command centre for lean teams. It takes you from inventory to evidence:
• Know — asset and attack-surface intelligence across domains, apps, APIs, repos and mobile
• Test — scoped scanning and VAPT campaigns, with approval gates on sensitive actions
• Prioritize — explainable risk scoring, so remediation order is defensible
• Prove — verified findings with business impact, packaged for engineers and for the board
• Respond — alerts where the team already works, on a complete audit trail

THREE THINGS I WON'T TRADE AWAY
1. Your security record lives under your keys. Assets, scans, findings and risks sit in a dedicated security database the customer controls — not a shared vendor lake.
2. If it isn't verified, it doesn't ship to the board. Heuristic noise is held back or listed separately; it never gets dressed up as confirmed risk.
3. AI orchestrates, engines execute, facts stay grounded. Our agents explain, triage and plan from engine evidence — and they cannot bypass human approval.

WHO WE BUILD FOR
Security and IT leads who need engineer-grade evidence, founders and boards who need it in plain language, and security providers who want a delivery platform instead of another spreadsheet. Privacy-first by design, aligned with Nigeria's NDPA, with NGN-first billing.

WHAT I'LL SAY OUT LOUD
Free is real and needs no card. We label what's live versus what's still maturing. We don't sell fear, and we won't claim we find everything.

WHAT I'M LOOKING FOR
Design partners who want to shape the roadmap, security providers who want a multi-tenant delivery path, and builders who want to help make this a reliable, real-world product.

If any of that is you: {{founder email}} · https://phantixlabs.com
PROTECT. PREVENT. PERFORM.
```

**Voice rules for founder posts:** lead with the problem, never with the product; name the constraint
you refused to accept; one CTA per post; no client names, live findings, tokens or internal hostnames
([§12](#12-governance--what-never-gets-posted)); never claim traction we can't evidence.

---

## 10. First five launch posts

Same idea per platform, never the same text. LinkedIn carries the argument, X carries the claim,
Instagram carries the visual. Every draft is ready to paste — just swap the visual in the
`Pair with` line for anything in [§7](#7-asset-matrix--what-goes-where-from-this-repo).

| # | Post | Claim it lands | Pair with |
|---|---|---|---|
| 1 | What SecureGraph is | Evidence problem, not a tooling problem | `brag-output/brag.mp4` or `command-centre-dashboard.jpg` |
| 2 | Verified findings | Open findings are the verified ones | `product-reports.jpg` |
| 3 | Dual control | Initiator and authorizer, not a checkbox | `public/screenshots/app/authorizations.png` |
| 4 | Your database | Your security record lives under your keys | `privacy-your-database-poster.jpg` |
| 5 | NDPA / Nigeria | Data residency is architecture, not policy | `product-compliance.jpg` |

Suggested order: **1 → 4 → 2 → 3 → 5** — introduce the product, lead with the differentiator buyers
actually ask about, then the quality and governance claims, then the local angle.

### Post 1 — What SecureGraph is

```bio:post-1-linkedin limit=3000
Most security programmes don't have a tooling problem. They have an evidence problem.

Ask a team what they own and you get three different answers depending on who you ask. Ask for the last assessment and you get a file nobody trusts. Ask the board what's at risk and you get a severity label with no consequence attached to it.

SecureGraph is a command centre for that gap. One place to:
• know what you own — domains, apps, APIs, repos and mobile
• test what matters — scoped scans and VAPT campaigns
• prioritize by real impact instead of raw severity
• prove what you fixed — findings that have been verified
• keep the whole record in a database you control

Free to start, no card required.

PROTECT. PREVENT. PERFORM.
```

```bio:post-1-x limit=280
Most security teams don't have a tooling problem. They have an evidence problem.

SecureGraph: know your surface, test what matters, verify findings, prove the fix — with the record in a database you control.

PROTECT. PREVENT. PERFORM.
```

```bio:post-1-instagram limit=2200
Know what you own. Test what matters. Prove the fix.

SecureGraph is a cybersecurity command centre for lean teams: asset intelligence, scoped scanning and VAPT campaigns, explainable risk prioritization, and verified findings your board can actually read. Your security record stays in a database you control.

Free to start. Link in bio.

#cybersecurity #VAPT #pentesting #infosec #appsec #securityoperations #NDPA
```

### Post 2 — Verified findings

```bio:post-2-linkedin limit=3000
Open findings are the verified ones. Heuristic noise never gets here.

That's a product rule, not a marketing line — and it changes what happens between a scan finishing and a report landing on a desk:

• engines produce raw signals
• duplicates and unconfirmed noise are held back, or listed separately for transparency
• anything reportable carries business impact next to the technical detail
• only verified findings drive the executive narrative

Why be that strict? Because a report that overstates once is a report nobody reads twice. False positives are how security programmes lose the argument with the people who fund them.

If it isn't verified, it doesn't ship to the board.
```

```bio:post-2-x limit=280
Open findings are the verified ones. Heuristic noise never gets here.

Signals are held back or listed separately until confirmed, and every reportable finding carries business impact, not just a severity label.

If it isn't verified, it doesn't ship to the board.
```

```bio:post-2-instagram limit=2200
A finding you can't defend in a meeting isn't a finding. It's a distraction.

Report quality is the whole job:
• verified before it's reportable
• business impact, not just a severity label
• noise listed separately, never dressed up as confirmed risk

If it isn't verified, it doesn't ship to the board.

#infosec #vulnerabilitymanagement #VAPT #cybersecurity #remediation
```

### Post 3 — Dual control

```bio:post-3-linkedin limit=3000
One person should not be able to run the most sensitive test in your estate without a second pair of eyes. We made that a platform rule instead of a paragraph in a process document.

Dual control in SecureGraph:
• high-impact actions can require an initiator and an authorizer
• both approvals are authenticated — not a checkbox someone ticks
• approvals are visible where the work happens, not in a separate spreadsheet
• every action lands in the audit trail: who did what, when

In a real assessment programme the tense question is never "can the tool do it?". It's "who authorised this, and can we prove it?". That's the part most platforms leave to email threads.

You define the scope. Your approvers authorise. The engines execute within policy. The audit trail explains the rest.
```

```bio:post-3-x limit=280
A sensitive test should need two pairs of eyes, not one checkbox.

SecureGraph: high-impact actions can require an initiator AND an authorizer, both fully authenticated, every action on the audit trail.

You authorise the scope. The engines execute within policy.
```

```bio:post-3-instagram limit=2200
Who authorised that test — and can you prove it?

Dual control in SecureGraph: sensitive actions can require an initiator and an authorizer, not a checkbox. Every action is auditable.

Authorised testing only.

#cybersecurity #infosec #governance #audit #pentesting
```

### Post 4 — Your database

```bio:post-4-linkedin limit=3000
"Where does our vulnerability list actually live?" is the first question serious buyers ask. Too many platforms answer it with a shrug.

Here's ours: the record of your posture is yours.

SecureGraph splits the two concerns:
• the platform handles identity, tenancy, billing and orchestration
• your assets, scans, findings and risks live in a dedicated security database you control

The practical consequences:
• no central vendor lake holding every customer's findings next to yours
• you choose where that database runs and where its backups live
• repository analysis happens in ephemeral workspaces that are destroyed after the job
• AI works from findings, not from a permanent copy of your source

Privacy by architecture, not by policy paragraph.

Your security record lives under your keys.
```

```bio:post-4-x limit=280
"Where does our vulnerability list actually live?"

Ours: assets, scans, findings and risks in a dedicated security database you control. Repo analysis runs in ephemeral workspaces that are destroyed after the job.

Your security record lives under your keys.
```

```bio:post-4-instagram limit=2200
Your security record lives under your keys.

Your assets, scans, findings and risks stay in a dedicated security database you control — not a central vendor lake. Repository analysis runs in ephemeral workspaces that get destroyed after the job.

Privacy by architecture, not by paragraph.

#cybersecurity #privacy #dataprotection #infosec #NDPA
```

### Post 5 — NDPA and the Nigerian market

```bio:post-5-linkedin limit=3000
A note for the Nigerian market: privacy-first isn't a feature request here. It's the architecture question.

Most security platforms were designed for a buyer who assumes the vendor's cloud. Organisations working under the NDPA have to think harder about where evidence lives, who can reach it, and what crosses the boundary — especially before the AI story starts.

How we design for that:
• security posture data sits in a dedicated database the customer controls
• external AI only with minimisation or an explicit approval path — never by default
• AI actions are logged and auditable, and reusable skills are anonymised before any platform-level pattern sharing
• NGN-first billing, so procurement doesn't open with a currency problem

Local pricing, local privacy expectations, and honest labels about what's live today versus what's still maturing.

If your team is facing audits, buyer questionnaires or a first real assessment this year: start free, no card required.
```

```bio:post-5-x limit=280
Security buyers in Nigeria don't get to treat data residency as an afterthought — the NDPA makes it an architecture question.

Our answer: your data in a database you control, external AI only with minimisation or approval, AI actions auditable, NGN-first billing.
```

```bio:post-5-instagram limit=2200
Data residency isn't a checkbox. It's architecture.

For teams working under the NDPA: your security data in a database you control, external AI only with minimisation or an explicit approval path, every AI action auditable, and NGN-first billing.

Local pricing. Local privacy expectations.

#NDPA #Nigeria #dataprotection #cybersecurity #compliance
```

**Cadence and housekeeping:** one LinkedIn post a week and two or three on X; reply to comments
within a business day; one CTA per post; never post identical text across platforms — the reasoning
changes, the claim doesn't; keep the first 125 characters of every Instagram caption self-contained,
because that's all that displays before "more".

---

## 11. Links, `sameAs` and the OG card

1. **Structured data.** `landing/index.html` declares `"sameAs": []` for the organization. Once the
   handles are live, replace that line with:

   ```json
   "sameAs": [
     "https://x.com/phantixlabs",
     "https://www.linkedin.com/company/phantixlabs",
     "https://www.instagram.com/phantixlabs",
     "https://www.facebook.com/phantixlabs",
     "https://www.youtube.com/@phantixlabs",
     "https://github.com/Phantom-Fort"
   ]
   ```

   Edit only the URLs that actually resolve — a dead `sameAs` entry is worse than none.

2. **Social / OG card.** All three `og:image` / `twitter:image` values point at
   `logo-transparent.png`, which is 1200×302. Feed scrapers want a 1200×630 card; a ≈3.97:1
   wordmark gets letterboxed or badly cropped. Produce one 1200×630 card (wordmark on `#090806`
   with the tagline) and point both meta tags at it — `landing/index.html` lines 49 and 57.

3. **Consistent link targets.** Send every "start free" link to
   `https://platform.phantixlabs.com/register` and the product link to `https://phantixlabs.com`,
   the same destinations the site footer already uses.

---

## 12. Governance — what never gets posted

| Rule | Why |
|---|---|
| No customer names, logos, quotes or ARR we can't evidence | [docs/04](../04-for-investors-and-partners.md) explicitly forbids inventing traction |
| No live findings, real asset lists, tokens, emails or internal hostnames | Same rule as the brag pipeline; public repos and screenshots count as public |
| No "zero false positives", no "AI finds vulnerabilities on its own" | [docs/05](../05-product-capabilities.md) and [docs/09](../09-ai-with-accountability.md) rule these out |
| No "full platform API" framing | Public API is sold only as the AI Agent plan |
| Say "available now" vs "coming" honestly | Product rule in [docs/05](../05-product-capabilities.md) |
| Authorized testing only, in every demo we show | [docs/06](../06-privacy-and-trust.md) |
| Refresh NGN prices from live billing before quoting them | Note in [docs/README.md](../README.md) |

Response expectations worth agreeing up front: reply to comments within one business day; route
security reports and privacy requests to `support@phantixlabs.com` / `privacy@phantixlabs.com`
rather than DMs; never debug a customer issue in a public thread.

---

## 13. Launch checklist

- [ ] Confirm the ⚠️ facts in [§1](#1-facts-we-may-state-publicly) — city, size, entity name, prices
- [ ] Claim the handles in [§2](#2-handles--naming) in order, and record which ones were taken
- [ ] Export avatars: `android-chrome-512x512.png` (512×512) plus a padded `mark-white` variant
- [ ] Compose the covers per [§7](#7-asset-matrix--what-goes-where-from-this-repo)
- [ ] Create the 1200×630 OG card and update the two meta tags in `landing/index.html`
- [ ] Run `npm run validate:social`, then paste the bios plus the founder profile in [§9](#9-founder-facing-linkedin-profile) — replace `{{founder email}}` first
- [ ] Re-render the launch film vertical with `/brag --format vertical` for Reels / Shorts
- [ ] Publish LinkedIn page + X + GitHub org first, then Instagram, Facebook and YouTube
- [ ] Update `sameAs` in `landing/index.html` with the handles that actually resolved
- [ ] Publish the launch film with the caption from [brag-output/share-copy.txt](../../brag-output/share-copy.txt)
- [ ] Publish the first five posts in the order set in [§10](#10-first-five-launch-posts), each paired with its visual
- [ ] Add the profile links to the site footer once they are live

---

## 14. Open questions

| # | Question | Why it matters |
|---|---|---|
| 1 | Which platforms are actually in scope for launch? (LinkedIn + X + GitHub is the credible minimum) | Instagram, Facebook and YouTube demand a cadence we may not want yet |
| 2 | City and country for the location fields? | LinkedIn (HQ) and Facebook require them |
| 3 | Registered entity name and founding year for the press boilerplate? | Press listings usually ask |
| 4 | Public contact email on social: `support@` or a new `hello@` / `social@`? | The bios currently point at `support@` |
| 5 | Are the NGN prices safe to quote publicly today? | Site structured data says Starter ₦19,900 / Growth ₦49,900; [docs/07](../07-pricing-and-plans.md) warns to load live prices |
| 6 | Founder profile specifics: exact title, business email, city? | [§9](#9-founder-facing-linkedin-profile) is drafted with a `{{founder email}}` placeholder still in it |
| 7 | Should Instagram / TikTok be fed from `AAAnimations/` motion assets? | Determines whether we need 1080×1920 renders |
