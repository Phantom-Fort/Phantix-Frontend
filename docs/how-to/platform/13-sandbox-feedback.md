# Platform: BETA sandbox feedback

**Where:** **BETA sandbox** → `/sandbox` (only if org is enrolled)  
**Who:** Design-partner tenants (max 20)

---

## Process flow

```mermaid
flowchart TD
  A[Staff enrolls org on staff portal] --> B[Platform shows BETA sandbox nav item]
  B --> C[Read live updates from staff · after deploys]
  C --> D[Mark read / ack]
  D --> E[Rate build · 1–5, NPS, area, what broke]
  E --> F[Staff reviews ratings on staff Sandbox board]
```

---

## Steps

1. Confirm staff enrolled your `organization_id`.
2. Sign in to Platform → open **BETA sandbox**.
3. Read **Live updates**; ack each note after you refresh clients.
4. **Rate this build** for Platform or overall areas.
5. Use Command Centre `/sandbox` for product/SOC-focused ratings too.

---

## Not enrolled?

- Apply on https://phantix.site (`#sandbox-apply`).
- Staff approve the application, then enroll the tenant.
- Until enrolled, the sandbox nav item stays hidden (API 404).
