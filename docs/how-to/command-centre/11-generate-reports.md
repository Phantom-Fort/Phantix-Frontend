# Command Centre: Generate reports

**Where:** **Reports** → library tab `/reports`

![Reports](../../screenshots/app/reports.png)

---

## Process flow

```mermaid
flowchart TD
  A[Generate report] --> B[Unlock operate]
  B --> C[Type: vapt_campaign / executive / compliance / …]
  C --> D[Campaign if required · formats: markdown, json, xlsx, pdf, docx, pptx, html]
  D --> E[Queue · run_inline false recommended for large]
  E --> F[Generating · complete · or SSE reportReady]
  F --> G[Download each format]
  F --> H[Preview narratives / sections in detail modal]
```

---

## Steps

1. **Reports** → **Generate report**.
2. Unlock operate.
3. Choose type and campaign (or AGI source if prompted).
4. Select formats (include **pptx** and **html** when needed; pdf may also produce pptx).
5. Prefer **run_inline = false** for large jobs.
6. Wait until status **complete**.
7. Download artifacts; open detail for executive AI narratives.
8. Remember: **verified-only** policy — candidates may be appendix-only.

**Not the tracker:** living remediation is [12-findings-tracker.md](./12-findings-tracker.md).
