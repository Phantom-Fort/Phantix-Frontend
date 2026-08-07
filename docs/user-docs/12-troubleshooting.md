# Troubleshooting

---

## Setup & login

| Symptom | What to try |
|---------|-------------|
| Can’t complete setup | Accept privacy; finish **email OTP**; then Complete |
| OTP not received | Check spam; wait for resend cooldown; contact support if platform mail is down |
| Login MFA loop | Use primary email; complete MFA with latest code |
| “Setup not complete” on features | Finish wizard; refresh session |

---

## Security database

| Symptom | What to try |
|---------|-------------|
| Connection test fails | Host/port, password, SSL mode, IP allowlist, DB awake (Neon) |
| Bootstrap fails | Grant `CREATE` or pre-create schema `phantix` owned by the user |
| Works then fails | Password rotated; IP allowlist changed; managed DB suspended |

---

## Email alerts

| Symptom | What to try |
|---------|-------------|
| Test alert not received | SMTP host/port/TLS; verified from-address; app password; SES sandbox |
| Goes to spam | SPF/DKIM/DMARC for your domain |
| OTP works but alerts don’t | OTP uses **platform** SMTP; alerts use **your** SMTP |

---

## GitHub

| Symptom | What to try |
|---------|-------------|
| Connect not configured | Phantix App credentials missing — contact support |
| Empty repos | Re-install and grant repositories; Sync |
| 402 on Analyze | Private repo on Free → upgrade Premium |

---

## Scans & VAPT

| Symptom | What to try |
|---------|-------------|
| 402 / locked tool | Check Billing entitlements; Premium/pack required |
| Waiting forever | Async job — refresh status; ensure workers healthy (support) |
| Stuck on approval | Authorizer must approve dual-control request |
| Findings not in report | May be **unverified** — check verification status |

---

## AI Agent

| Symptom | What to try |
|---------|-------------|
| 402 on invoke | AI Agent plan / Premium entitlement required |
| Run stuck queued | Async worker; poll `GET .../runs/{id}` |
| Thin results | Connect security DB; ensure campaign/assets exist |

---

## Still stuck?

Use in-app **Support** with: org name, time of error, screenshot, and request id if shown.
