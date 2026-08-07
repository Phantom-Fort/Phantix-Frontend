# Privacy & security (customer view)

---

## Your security database

Assets, findings, scans, risks, and evidence are stored in the **security database you connect** (or, soon, a Phantix-hosted DB dedicated to you).

Phantix platform stores tenancy, billing, and encrypted connection metadata — not a shared multi-tenant lake of everyone’s vulnerabilities.

---

## What we do with code and secrets

| Practice | Meaning |
|----------|---------|
| GitHub App | Short-lived installation tokens; read-only scopes |
| Ephemeral analysis | Clone → scan → **destroy** workspace |
| AI | Findings and summaries — not permanent source retention |
| Client SMTP passwords | Stored encrypted for alert delivery; use app passwords |

---

## Verification & impact

Executive reports prioritize **verified** findings and attach **impact analysis** so boards are not flooded with raw scanner noise.

---

## AI and data protection

- Prefer controlled / local model paths for sensitive context
- External AI only under minimization / approval policies
- Skills shared as patterns are **anonymized**
- Aligns with privacy expectations including **NDPA** for Nigerian organizations

---

## Your responsibilities

- Only test systems you are authorized to test
- Keep security DB backups
- Manage user access and dual-control
- Configure SPF/DKIM for your alert domain

---

## Learn more

Marketing privacy narrative: [../06-privacy-and-trust.md](../06-privacy-and-trust.md)
