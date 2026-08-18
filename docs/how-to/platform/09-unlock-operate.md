# Platform: Unlock operate (dual-control session)

**Where:** Header dual-control widget or any mutation that prompts for operate  
**Result:** Short-lived session attached as `X-Dual-Control-Session` on protected API calls

---

## Process flow

```text
Click Unlock operate
        │
        ▼
 Choose initiator or authorizer email
        │
        ▼
 Request OTP → email code
        │
        ▼
 Enter code → verify
        │
        ▼
 (Optional) device confirm
        │
        ▼
 Operate unlocked (countdown timer)
        │
        ▼
 Perform mutations (create user, bootstrap, etc.)
        │
        ▼
 Idle timeout → lock again
```

```mermaid
flowchart TD
  A[Unlock operate] --> B[Select controller email]
  B --> C[OTP email]
  C --> D[Verify]
  D --> E[Operate active]
  E --> F[Mutations succeed]
  E --> G[Idle expire]
  G --> A
```

---

## Steps

1. Ensure dual-control is configured ([04-assign-dual-control.md](./04-assign-dual-control.md)).
2. Click **Unlock operate**.
3. Select your controller email (must be initiator or authorizer).
4. Request and enter OTP.
5. Confirm the green **Operating as …** state and timer.
6. Complete admin actions.
7. **Lock session** when finished (or let it idle out).

---

## Notes

- Reads rarely need operate; writes often do.
- Command Centre uses the same dual-control model for scans, tracker PATCH, report generate, etc.
