# Command Centre: Launch a scan

**Where:** **Scans** → `/scans`  
**Limit:** One active scan job per organization

![Scans](../../screenshots/app/scans.png)

---

## Process flow

```text
Scans → Launch scan
    │
    ▼
 Unlock operate
    │
    ▼
 Select tools + target filter (tags / assets / types)
    │
    ▼
 Submit → job queued/running
    │
    ▼
 Progress % + findings_count
    │
    ▼
 Completed → open Results
    │
    ▼
 Verified findings feed risks / reports
 Unverified stay appendix / excluded per policy
```

```mermaid
flowchart TD
  A[Launch scan] --> B[Operate unlock]
  B --> C[Tools + scope]
  C --> D{Slot free?}
  D -->|No| E[Wait / cancel other job]
  D -->|Yes| F[Running]
  F --> G[Results]
  G --> H[Risks / Reports]
```

---

## Steps

1. **Scans** → **Launch scan**.
2. Unlock operate.
3. Choose tools (as licensed) and target filter.
4. Start job.
5. Monitor progress on the scans page.
6. On completion, open **results**; check verification status.
7. Promote important issues via risks / tracker / reports.

---

## Notes

- 409 if another job holds the org lock.
- Cancel requires operate.
- Time budgets / host dedupe may skip already-scanned IPs (see VAPT docs).
