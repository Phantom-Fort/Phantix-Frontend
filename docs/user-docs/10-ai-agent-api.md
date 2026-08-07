# Public AI Agent API

---

## Product rule

**The only public API payment plan Phantix offers is for AI Agent access.**

| You get | You do not get as a public API SKU |
|---------|-------------------------------------|
| Programmatic domain agents | Unrestricted access to all Platform APIs as a sold product |
| Invoke / poll / skills / approvals | Free anonymous agent usage |
| Integration with your automation | Staff admin APIs |

Platform Free/Premium still use the full product **inside the app**.

---

## Domains you can call

| Domain | Use |
|--------|-----|
| `soc` | Alert triage assist |
| `grc` | Compliance gap narrative |
| `vapt` | Verified finding write-ups |
| `ti` | Threat intel correlation assist |
| `asset` | Exposure / inventory narrative |
| `cross` | Multi-domain Chief routing |

Agents are **on-demand** (not always-on bots).

---

## Minimal flow

```bash
export API=https://api.your-domain
export TOKEN="<org_token_with_ai_agent_entitlement>"

# Catalog
curl -s -H "Authorization: Bearer $TOKEN" "$API/api/v1/ai/agent/domains"

# Invoke
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"objective":"Triage open alerts","run_inline":false}' \
  "$API/api/v1/ai/agent/domains/soc/invoke"

# Poll
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/ai/agent/runs/<analysis_id>"
```

Without entitlement: **HTTP 402** `ai_agent_plan_required`.

---

## Principles for integrators

1. Poll async runs
2. Display engine evidence IDs — don’t invent findings
3. Respect human approval gates
4. Agents use your org’s connected security data and engines

**Pricing:** sales or in-app billing for the AI Agent plan.
