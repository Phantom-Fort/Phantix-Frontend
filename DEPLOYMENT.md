# Deployment

Four deployable applications live in `apps/` and share `packages/sg-shared`.

| App | App directory | Host |
|---|---|---|
| Core | `apps/securegraph-core` | `app.phantixlabs.com` |
| Attack | `apps/securegraph-attack` | `attack.phantixlabs.com` |
| Defend | `apps/securegraph-defend` | `defend.phantixlabs.com` |
| Code | `apps/securegraph-code` | `code.phantixlabs.com` |

Platform (`platform.phantixlabs.com`), landing and staff are separate repositories and are not built here.

## Vercel projects

One Vercel project per app, each with **Root Directory** set to its app folder:

```
Root Directory:  apps/securegraph-<app>
Framework:       Vite
Build Command:   npm run build        # tsc -p tsconfig.json && vite build
Output Directory: dist
Install Command: npm install
```

Each app ships a `vercel.json` (SPA rewrite to `/index.html`, `/api/v1/*` proxy to the
backend, cache/security headers). `packages/sg-shared` and the repo-root `public/` +
`docs/` are consumed via path aliases, so the Vercel checkout must include the whole
repository (do **not** set a Root Directory above `apps/...` while keeping this layout).

## GitHub Actions

- `.github/workflows/ci.yml` — typecheck + build every app on push/PR.
- `.github/workflows/deploy-<app>.yml` — build and deploy one app to Vercel on push to
  `main`, filtered to that app plus the shared paths (`packages/sg-shared`, `public`,
  `docs`). Also runnable via **workflow_dispatch**.

### Required repository secrets

| Secret | Purpose |
|---|---|
| `VERCEL_TOKEN` | Vercel access token (Account → Settings → Tokens) |
| `VERCEL_ORG_ID` | Vercel team/user id (`.vercel/project.json` after first `vercel link`) |
| `VERCEL_PROJECT_ID_CORE` | Project id for Core |
| `VERCEL_PROJECT_ID_ATTACK` | Project id for Attack |
| `VERCEL_PROJECT_ID_DEFEND` | Project id for Defend |
| `VERCEL_PROJECT_ID_CODE` | Project id for Code |

Find the ids by running `vercel link` inside each app directory once, then reading
`.vercel/project.json`.

## Shared package

`packages/sg-shared` is consumed by relative path (`@sg` alias → `../../packages/sg-shared/src`).
This works because every app is built from a checkout that contains `packages/`. If an app
is ever moved to its own repository, publish `@phantix/sg-shared` to a registry (or vendor
it as a submodule) and add it to that app's dependencies.
