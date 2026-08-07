# For developers (public overview)

This page is a **landing-level** developer orientation for **public API access**.

---

## What the public API is (and is not)

| Public API offers | Not sold as a public API product |
|-------------------|----------------------------------|
| **Paid access to the Phantix AI Agent** | Full platform automation of every engine as a stand-alone API product |
| Domain agents (SOC, GRC, VAPT, TI, Asset, Chief) | Unlimited scan/VAPT/reporting API without an app subscription |
| Invoke, poll runs, skills, approvals, repo-analysis assist | Staff/admin APIs |
| Agent auth (org token or agent service token as documented) | Free unauthenticated agent use |

**Product decision (locked):**
The **only public API payment plan** we offer is for **AI Agent access**.
Inventory, scans, VAPT, risk, compliance, and reports remain **Platform product surfaces** (Free / Premium in the app) — not a separate “pay for the whole API” SKU on the landing page.

Integrators who need the agent programmatically → **subscribe to the AI Agent plan** (and any required Premium base if the product ties agent to Premium — see live entitlements).
Teams using Phantix day-to-day → use the **Platform app**; agent can still be invoked from the UI under the same entitlements.

---

## Base URL & auth

| Item | Value |
|------|--------|
| Base | `{API_BASE}/api/v1` |
| Public agent surface | `/api/v1/ai/agent/*` |
| Auth | Org JWT **or** agent token (`PHANTIX_AGENT_TOKEN` / documented service key) for callbacks |
| Async | Runs return `analysis_id` — poll status |

Billing gate: expect **402** when the org lacks AI Agent entitlement.

---

## First calls (AI Agent plan)

```bash
export API=https://api.your-domain
export TOKEN="<org_or_agent_token>"

# Agent platform status
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/ai/agent/status"

# List domain agents
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/ai/agent/domains"

# Invoke VAPT specialist (example)
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"objective":"Write up verified findings for campaign 12","campaign_id":12}' \
  "$API/api/v1/ai/agent/domains/vapt/invoke"

# Poll
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/ai/agent/runs/{analysis_id}"
```

---

## Public agent route groups

| Prefix | Purpose |
|--------|---------|
| `/ai/agent/status` | Enabled flag, domain list |
| `/ai/agent/domains` | Catalog + policies (spin-up guide) |
| `/ai/agent/domains/{domain}/invoke` | On-demand domain agent |
| `/ai/agent/runs` | Start / list / poll investigations |
| `/ai/agent/skills` | Skills list & promote / reinforce |
| `/ai/agent/approvals` | Human gates for sensitive actions |
| `/ai/agent/repo-analysis` | Ephemeral analysis job status path |
| `/ai/agent/callback/result` | OpenClaw / external runtime callback |

Domain values: `soc` · `grc` · `vapt` · `ti` · `asset` · `cross`

---

## Design rules for public API consumers

1. **Only AI Agent is the paid public API product** — do not market full engine API as open SKU
2. **Honor 402** — no agent without entitlement
3. **Poll async runs** — do not block forever on one HTTP call
4. **Agents use engine evidence** — never invent findings client-side
5. **Ground truth stays in Phantix** — agents orchestrate; they don’t replace the security DB

---

## Platform product APIs (not the public API SKU)

Authenticated Platform users (Free/Premium) still use the full product HTTP API **inside the app** (assets, scans, VAPT, reports, etc.). That access is governed by **Platform membership and packs**, not by a separate “public API plan.”

Public website / investor language should say:

> **Public API: AI Agent access (paid plan).**
> Full platform capabilities: available in the Phantix Platform application.

---

## Deep docs (authorized / internal)

- Agent config: `docs/AI_AGENT_CONFIG_GUIDE.md`
- Domain spin-up: `docs/DOMAIN_AGENTS_SPIN_UP.md`
- Full internal route inventory: `docs/PRODUCT_FEATURES_AND_API_CATALOG.md`

---

## Support

- Entitlements: `GET /api/v1/billing/entitlements` (shows agent/AI related packs when configured)
- In-product support for entitled orgs
- Sales for AI Agent plan pricing and design-partner access
