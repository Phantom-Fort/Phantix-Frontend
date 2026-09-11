# Command Centre: Use Phantix Agent

**Where:** **Phantix Agent** → `/agent`

![Agent](../../screenshots/app/agent.png)

---

## Process flow

```mermaid
flowchart TD
  A[Agent page] --> B[Chat tab]
  A --> C[Skills library]
  B --> D[Unlock operate]
  D --> E[Ask question / run skill]
  E --> F[Stream response · SSE]
  C --> G[Browse / promote / quarantine · governance]
```

---

## Steps

1. Open **Phantix Agent**.
2. Confirm agent enabled for your plan.
3. Unlock operate for org-changing actions.
4. Send a prompt (status of scans, explain a risk, etc.).
5. Review streamed answer and any tool traces.
6. In **Skills**, review candidates before promoting.

---

## Notes

- Customer Agent ≠ Staff AGI Management (engagements/containers).
- Plan may return 402 if AI agent entitlement missing.
- To watch a live pentest advance through its methodology loop — including the
  trust-boundary and auth/access-matrix phases and the recon / autofix /
  verify-all subagents — see
  [17-autonomous-pentest.md](./17-autonomous-pentest.md).
