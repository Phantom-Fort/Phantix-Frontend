# Connect GitHub

Phantix uses a **GitHub App** (same idea as Vercel / Netlify): install once, choose repositories, no long-lived personal tokens required.

Legacy “paste PAT” remains available temporarily; prefer the App.

---

## Plan rules

| Plan | Public repositories | Private repositories |
|------|---------------------|----------------------|
| **Free** | Analyze allowed | **Not allowed** |
| **Premium** | Allowed | Allowed |

The product enforces this (HTTP **402** if Free tries private analysis).

---

## Connect (in the app)

1. Open **Integrations → GitHub** (or Assets → Connect GitHub).
2. Click **Connect GitHub**.
3. You are redirected to GitHub to install the **Phantix** app.
4. Choose **All repositories** or **Only select repositories**.
5. Approve.
6. You return to Phantix; status should show **Connected** with your GitHub account/org name.
7. Open **Repositories** to see the list (Public / Private badges).

**Disconnect** removes the installation link in Phantix (you can also uninstall the app in GitHub settings).

---

## Analyze a repository

1. Select a repo → **Analyze**.
2. Free users: private rows show lock / Upgrade.
3. Analysis runs in an **ephemeral** workspace (clone → scan → destroy).
4. Findings appear in your **security database** — source code is not kept.

---

## What GitHub permissions mean

Read-only **Contents** + **Metadata** so Phantix can list and analyze granted repos. Phantix does not need write access to your code for standard analysis.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Connect button errors “not configured” | Phantix GitHub App not set on the server — contact support |
| Empty repo list | Sync / refresh; ensure you granted repos on install |
| 402 on Analyze | Private repo on Free — upgrade to Premium |
| Analysis fails to clone | Re-install app; check network; confirm installation still active |

**Next:** [Plans & billing →](./06-plans-and-billing.md)
