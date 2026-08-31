# Command Centre: Manage risks

**Where:** **Risks** → `/risks`

![Risks](../../screenshots/app/risks.png)

---

## Process flow

```mermaid
flowchart TD
  A[Risks list · sort by priority] --> B[Open risk · P1 first]
  B --> C{Action}
  C -->|Owner| D[Assign owner / department]
  C -->|Treatment| E[Propose treatment]
  C -->|Approve| F[Authorizer approves treatment if required]
  C -->|Status| G[In progress / accepted / closed]
  C -->|Link| H[Link asset / detections / tracker]
  D & E & F & G & H --> I[Priority queue on dashboard shrinks]
```

---

## Steps

1. Open **Risks**; sort by priority score / band.
2. Click a risk (or `/risks?id=`).
3. Unlock operate for writes.
4. Assign owner.
5. Propose treatment with residual notes.
6. Track status until closed or formally accepted.
7. Export risk list if needed for GRC.
