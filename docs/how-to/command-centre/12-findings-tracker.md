# Command Centre: Findings tracker

**Where:** **Reports** → **Findings tracker** tab (`/reports?tab=tracker`)  
**What:** Living remediation board — **not** a generated file.

---

## Process flow

```mermaid
flowchart TD
  A[Open tracker tab] --> B[Board + summary chips: open / in_progress / fixed / …]
  B --> C[Filter / search]
  C --> D[Change status · operate + dual-control when configured]
  D --> E[open · in_progress · fixed]
  D --> F[open · in_progress · accepted]
  D --> G[regressed · backend flags when fixed issue returns]
  E & F & G --> H[Optional: open drawer / deep link ?key=]
  H --> I[Cross-link asset / risk / SOC / report file]
```

---

## Steps

1. **Reports** → **Findings tracker**.
2. Review summary counts.
3. Unlock operate to change status.
4. Set owner via API fields if exposed; keep statuses in the allowed set only:
   - `open` · `in_progress` · `fixed` · `accepted` · `retest_failed` · `regressed`
5. Never render PDF/HTML inside this tab.
6. Use library tab for file downloads.

---

## Statuses (do not invent others)

| Status | Meaning |
|--------|---------|
| open | Not started |
| in_progress | Being fixed |
| fixed | Remediated |
| accepted | Risk accepted |
| retest_failed | Fix did not hold |
| regressed | Was fixed; seen again |
