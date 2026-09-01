# Command Centre: Sign in

**Where:** https://app.phantixlabs.com/login  

![Login](../../screenshots/app/login.png)

---

## Process flow

```mermaid
flowchart TD
  A{How do you sign in?} --> B[Email + password]
  A --> C[Invite / login link]
  A --> D[/demo/]
  B --> E[Continue]
  C --> F[Open link]
  D --> G[Demo tenant]
  E --> H[App OTP email]
  F --> I{Set password?}
  I -->|Yes| J[Set password]
  I -->|No| K[OTP / device]
  H --> L[Device confirm]
  J --> L
  K --> L
  L --> M[/dashboard/]
```

---

## A. Email + password

1. Enter email + password â†’ **Continue**.
2. Enter **application login code** from email.
3. Complete **device confirmation** if prompted.

## B. Login link (recommended)

1. Admin issues link on Platform â†’ People.
2. Open link â†’ set password on first use.
3. Complete OTP / device steps.

## C. Demo

Open https://app.phantixlabs.com/demo (no real org data).

---

## After login

You should see the **Command center** dashboard.

![Dashboard](../../screenshots/app/dashboard.png)
