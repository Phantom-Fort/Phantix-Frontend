# Phantix Frontend

React 18 + TypeScript portal for **Phantix Security Solutions** — organization onboarding, asset management, VAPT campaigns, scan jobs, risk/monitoring, dual-control auth, and Command-inspired dark-first UI.

> **PROTECT. PREVENT. PERFORM.**

---

## Features

| Area | What it does |
|------|----------------|
| **Auth** | Organization JWT login; org-user email+OTP sign-in; dual-control initiator/authorizer sessions |
| **Onboarding** | Step-by-step wizard: privacy, email OTP, create org users, dual-control assign, unlock, security DB, first asset |
| **Assets** | Full asset types (cloud, mobile APK, domain, IP, repo, etc.), tags, import (GitHub PAT, OpenAPI/Postman), DB connections |
| **Scans** | On-demand jobs (1 active/org), Nmap/Nuclei/YAML results, normalized evidence, active job tracking |
| **VAPT** | Campaign lifecycle (plan/execute/pause/resume/cancel), procedures, approvals, schedules, settings |
| **Alerts** | Critical-only sidebar badges, blink animation for scans, global popups for high/critical, auto-attend |
| **Reports & Risk** | Cross-engine reports, risk register, treatments, assessment, export |
| **Dual-Control** | Two-person rule for mutations: initiator proposes, authorizer approves; OTP-based operate unlock |
| **Branding** | Dark-first (navy + cyan), plain backgrounds, solid button colors, stacked logo + tagline on public pages |

---

## Quick start

```bash
cp .env.example .env
# Set VITE_API_URL (default: http://localhost:8000)

npm install
npm run dev      # Vite dev server → http://localhost:5173
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint check |

---

## Project layout

```text
src/
  components/
    auth/          # MfaChallenge, DualControlUnlock, SessionExpiredOverlay
    layout/        # Sidebar (alert badges), TopBar, ThemeToggle
    onboarding/    # Wizard steps (Welcome, Privacy, OTP, CreateUsers, DualControl, Unlock, DB, Asset, Complete)
    shared/        # DataTable, Pagination, StatusBadge, SeverityBadge, ScanEvidence, ErrorBoundary, etc.
    ui/            # Primitive UI (button, input, card)
  hooks/           # usePolling
  lib/             # api (axios instance + interceptor for dual-control sessions), utils (cn)
  pages/
    assets/        # AssetList with DB form, tags, nmap column
    auth/          # (not used — login/register live in public/)
    dashboard/     # OrgDashboardPage
    onboarding/    # SetupWizard (wired to /organizations/me/setup)
    public/        # LoginPage, RegisterPage
    scans/         # ScanJobs, ScanResults
    vapt/          # CampaignList, CampaignDetail
  store/           # Zustand stores: auth, theme, dualControl, toast
  types/           # api.ts (shared types)
public/
  logo.png         # Original icon (sidebar/topbar)
  logo-transparent.png  # Larger transparent (light theme, login/register)
  logo-white.png        # Larger white (dark theme, login/register)
```

---

## Auth flow

1. **Org login** → JWT (`type=access`) — establishes organization session
2. **Org-user sign-in** → email + OTP (`purpose=access`) — for subsequent logins (skipped on first login after registration)
3. **Dual-control unlock** → email + OTP (`purpose=dual_control`) — short-lived session for mutations

| Party | Token | Storage |
|-------|-------|---------|
| Organization | `Bearer <org_jwt>` | `localStorage` |
| Org user identity | `Bearer <org_user_jwt>` | `localStorage` |
| Dual-control session | `X-Dual-Control-Session` | `sessionStorage` |

Writes require dual-control configured + active session (auto-prompt on 403 with `required_header`).

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |

---

## Dependencies

- React 18, React Router 6, TanStack Query 5
- Zustand (state)
- Axios (HTTP)
- Tailwind CSS 3 + tailwindcss-animate
- Lucide React (icons)
- class-variance-authority + clsx/tw-merge (via `cn`)

---

## License / status

Internal Phantix platform frontend — MVP features under active development.

**PROTECT. PREVENT. PERFORM.**
