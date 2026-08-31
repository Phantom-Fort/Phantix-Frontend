# Command Centre: Availability monitoring & heartbeat agent

**Where:** **SOC Monitor** → Availability  

---

## Process flow — outbound checks

```mermaid
flowchart TD
  A[Add check] --> B[Type: http / https / tcp / tls / dns]
  B --> C[Target, interval, thresholds]
  C --> D[Save · Run now optional]
  D --> E[Status up / down / degraded]
  E --> F[Failures · open incident · notify]
  E --> G[Recovery · MTTR logged]
```

## Process flow — private host agent

```mermaid
flowchart TD
  A[Platform: mint org API key] --> B[Download agent]
  B --> C[linux · macos · windows · python]
  C --> D[Install on host with X-Org-Api-Key]
  D --> E[Heartbeat · check_type=agent appears]
  E --> F[Missed beats · downtime incident]
```

---

## Steps — add a check

1. SOC → **Availability**.
2. **Add check** — name, type, target, interval, failure thresholds.
3. Save → **Run now**.
4. Confirm status chip **up**.

## Steps — install agent

1. Open **Download heartbeat agent**.
2. Download OS package; note sha256.
3. Install per commands accordion / walkthrough.
4. Use **org service key**, never user JWT.
5. Confirm new check `agent://hostname` is **up**.

---

## Dual-control

Availability CRUD is not dual-control in v0.2 (per product docs); downloads are reads.
