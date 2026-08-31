# Command Centre: Add and verify assets

**Where:** **Assets** → `/assets`

![Assets](../../screenshots/app/assets.png)

---

## Process flow

```mermaid
flowchart TD
  A[Add asset] --> B[Choose type: domain / subdomain / IP / URL / repo]
  B --> C[Enter value + criticality + environment]
  C --> D[Save · operate if required]
  D --> E[Asset listed · often unverified]
  E --> F[Verify: DNS / HTTP / method offered]
  F --> G[is_verified = true · safer for scans / campaigns]
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
