# Command Centre: Run a compliance assessment

**Where:** **Compliance** → `/compliance`

![Compliance](../../screenshots/app/compliance.png)

---

## Process flow

```mermaid
flowchart TD
  A[Compliance] --> B[Select framework · ISO, NDPR, …]
  B --> C[Run assessment · operate]
  C --> D[Score + controls pass / gap / unknown]
  D --> E[Attach evidence · connectors / upload]
  E --> F[Re-run after fixes]
```

---

## Steps

1. Open **Compliance**.
2. Pick a framework.
3. Unlock operate → **Run assessment**.
4. Review control results (pass / gap / unknown).
5. Collect or upload evidence for gaps.
6. Track score over time on the dashboard compliance card.
