# Command Centre: Add and verify assets

**Where:** **Assets** → `/assets`

![Assets](../../screenshots/app/assets.png)

---

## Process flow

```text
Assets → Add asset
    │
    ▼
 Choose type (domain, subdomain, IP, URL, repo, …)
 Enter value + criticality + environment
    │
    ▼
 Save (operate if required)
    │
    ▼
 Asset listed (often unverified)
    │
    ▼
 Verify (DNS / HTTP / method offered)
    │
    ▼
 is_verified = true → safer for scans / campaigns
```

```mermaid
flowchart TD
  A[Add asset] --> B[Save]
  B --> C[Unverified]
  C --> D[Start verification]
  D --> E[Verified]
  E --> F[Include in scan scope]
```

---

## Steps

1. **Assets** → **Add asset**.

![Add modal](../../screenshots/app/assets_add_modal.png)

2. Unlock operate if prompted.
3. Set type, value, name, criticality, environment, tags.
4. Save.
5. Select the asset → **Verify** using the method shown (e.g. DNS TXT, HTTP probe).
6. Confirm verification badge.
7. Optionally open **Intelligence** for risk score / related findings.

![Intelligence](../../screenshots/app/intelligence.png)

---

## Tips

- Prefer verified assets before production-impacting scans.
- Imports (GitHub, OpenAPI, APK) also land here after Platform/GitHub connect.
