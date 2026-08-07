# Daily & weekly activities

Practical rhythms for operators using Phantix.

---

## Every day (or on-call)

| Activity | Where | Why |
|----------|-------|-----|
| Check **alerts** | Alerts / email / Telegram | Catch failed scans and critical risks |
| Review **open risks** (P1–P2) | Risks | Keep critical items owned |
| Approve **pending dual-control** actions | Approvals | Don’t block campaigns |
| Skim **new assets** from discovery | Assets | Unexpected exposure |

---

## Every week

| Activity | Where | Why |
|----------|-------|-----|
| Run or schedule **scoped scans** on crown jewels | Scans / VAPT | Continuous assurance |
| Review **unverified** findings (if shown) | Findings / report appendix | Decide manual verify or dismiss |
| Update **tags / criticality** | Assets | Better prioritization |
| Sync **GitHub** repos if engineering moved fast | GitHub | Keep inventory fresh |
| Check **tracker** remediation dates | Reports → Tracker | Drive closure |

---

## Every month / board cycle

| Activity | Where | Why |
|----------|-------|-----|
| Generate **executive report** (Premium) | Reports | Board / auditor pack |
| Confirm **impact** language on top findings | Findings / report | Business conversation |
| Review **compliance gaps** | Compliance | GRC progress |
| Optional: invoke **GRC or VAPT agent** for narrative assist | AI Agent | Faster write-ups |
| Billing: confirm subscription / seats | Billing | Avoid surprise locks |

---

## Common workflows (click-path)

### A. “We launched a new subdomain”

1. Assets → Add domain / run discovery
2. Tag criticality
3. Scan (as entitled)
4. Review findings → risks
5. Alert owners

### B. “Engineering wants a repo checked”

1. GitHub → ensure connected
2. Find repo → Analyze (Premium if private)
3. Review findings in security DB
4. Open tracker items

### C. “Campaign finished”

1. VAPT → campaign detail
2. Review verified findings + impact
3. Generate report
4. Optional: **VAPT agent** write-up assist
5. Share PDF / tracker with IT

### D. “Auditor asked for evidence”

1. Compliance → frameworks / gaps
2. Link technical findings where mapped
3. Export report section
4. Optional: **GRC agent** for narrative (evidence still from engines)

---

## What not to do daily

- Don’t run unscoped internet-wide scans without authorization
- Don’t share org JWT or SMTP passwords in chat
- Don’t treat unverified scanner noise as board fact
- Don’t skip dual-control for exploit-class steps

**Next:** [Features overview →](./08-features-overview.md)
