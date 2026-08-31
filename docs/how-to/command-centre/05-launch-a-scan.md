# Command Centre: Launch a scan

**Where:** **Scans** → `/scans`  
**Limit:** One active scan job per organization

![Scans](../../screenshots/app/scans.png)

---

## Process flow

```mermaid
flowchart TD
  A[Launch scan] --> B[Unlock operate]
  B --> C[Select tools + target filter]
  C --> D[Submit · job queued / running]
  D --> E[Progress % + findings_count]
  E --> F[Completed · open Results]
  F --> G[Verified findings feed risks / reports]
  F --> H[Unverified stay appendix / excluded per policy]
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
