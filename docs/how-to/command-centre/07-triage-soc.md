# Command Centre: Triage SOC detections

**Where:** **SOC Monitor** → `/soc`

![SOC](../../screenshots/app/soc.png)

---

## Process flow

```mermaid
flowchart TD
  A[SOC dashboard] --> B[Open detections queue · open_only]
  B --> C[Select detection]
  C --> D{Action}
  D -->|Assign owner| E[Assign]
  D -->|Notes / enrich| F[Add triage notes]
  D -->|Escalate| G[Open case]
  D -->|Close| H[Close / false positive]
  D -->|Link| I[Link asset / risk chips]
  E & F & G & H & I --> J[Queue counts update · SSE live if connected]
```

---

## Steps

1. Open **SOC Monitor**.
2. Review **by severity** open counts.
3. Click a detection (or `/soc?id=`).
4. Read evidence / correlation source.
5. **Assign**, add notes, or **escalate to case**.
6. Close when done; avoid leaving criticals unowned.
7. Use cases tab for multi-detection incidents.

**Related:** [08-availability-monitoring.md](./08-availability-monitoring.md)
