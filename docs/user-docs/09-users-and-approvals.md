# Users, roles & dual-control

---

## Why dual-control exists

High-impact security actions should not depend on a single password. Phantix supports **operator + authorizer** patterns so sensitive steps need a second approval.

---

## Typical roles

| Role | Day-to-day |
|------|------------|
| Admin / owner | Billing, connections, invites |
| Operator | Run scans, manage assets, draft campaigns |
| Authorizer | Approve dual-control requests |
| Viewer | Read reports and risks |

Exact role names depend on your org RBAC configuration in the app.

---

## Invite a user

1. **Users** → Invite
2. Assign role
3. They complete login / MFA as required
4. For dual-control, ensure at least one **authorizer** exists

---

## Approvals workflow

1. Operator starts a gated action (e.g. sensitive VAPT step).
2. Request appears in **Approvals**.
3. Authorizer reviews scope and **approves** or **rejects**.
4. Action continues or stops.
5. Audit trail records the decision.

AI Agent sensitive actions can also raise approval tickets.

---

## Sessions & security

- Prefer MFA where offered
- Don’t share logins
- Sessions expire after idle / absolute limits
- Rotate integration secrets if someone leaves

**Next:** [AI Agent API →](./10-ai-agent-api.md)
