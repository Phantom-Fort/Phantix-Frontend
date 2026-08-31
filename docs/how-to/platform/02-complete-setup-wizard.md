# Platform: Complete the setup wizard

**Where:** `/setup` (auto after first login)  
**Goal:** Mark the organization setup complete so product modules can run.

![Dashboard / setup context](../../screenshots/platform/dashboard.png)

---

## Process flow

```mermaid
flowchart LR
  A[Get setup state · which step is next?] --> B{Step}
  B -->|1. Privacy · required| C[Accept notice]
  B -->|2. Profile · optional| D[Legal name, website…]
  B -->|3. Email OTP · required| E[Verify contact email]
  B -->|4. Company verification · optional| F[DNS / file / CAC / manual]
  B -->|5. Complete| G[setup_complete = true]
  C & D & E & F --> G
  G --> H[/dashboard/]
```

---

## Steps

1. Open Platform after sign-in. If setup is incomplete you stay on **Organization setup**.
2. **Privacy notice** — read and accept (required).
3. **Company profile** — fill optional identity fields; continue.
4. **Email verification** — request OTP, enter code (required to finish).
5. **Company verification** (optional):
   - DNS TXT, or  
   - HTTP well-known file, or  
   - CAC / registration details, or  
   - Request **manual review** (staff approves later)
6. Click **Complete** when required steps show done.
7. You should land on **Dashboard** with progress 100%.

---

## Tips

- Domain / CAC verification is **not** required to use Command Centre if privacy + email are done and security DB is bootstrapped.
- Rehydrate always comes from the API; refreshing the page resumes the correct step.
