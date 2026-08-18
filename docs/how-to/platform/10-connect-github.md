# Platform: Connect GitHub

**Where:** **GitHub** → `/github`  
**Why:** Import repos as assets / feed discovery into Command Centre

![GitHub](../../screenshots/platform/github.png)

---

## Process flow

```text
GitHub page
    │
    ├─► Option A: GitHub App
    │      Connect → authorize org → callback
    │      Discover installs → select repos → import
    │
    └─► Option B: Personal access token (if offered)
           Paste PAT → validate → import
    │
    ▼
 Repos appear as assets (Command Centre → Assets)
```

---

## Steps (GitHub App)

1. Platform → **GitHub**.
2. **Connect GitHub App** (operate if required).
3. Complete GitHub authorization in the popup/redirect.
4. Return to Platform; confirm **connected** status.
5. **Discover** installations / repos.
6. Select repositories → **Import**.
7. Open Command Centre **Assets** and verify imported repos.

---

## Tips

- Prefer GitHub App over long-lived PATs.
- Private repo features may require Premium entitlement.
- Re-run discover after adding the App to new GitHub orgs.
