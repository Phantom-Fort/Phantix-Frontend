# SecureGraph applications

One backend behind four deployable operator applications. Platform
(`platform.phantixlabs.com`) and the Staff portal are separate products and are
not in here.

| App | Directory | Host | Dev port |
|-----|-----------|------|----------|
| Core | `securegraph-core` | `app.phantixlabs.com` | 5174 |
| Attack | `securegraph-attack` | `attack.phantixlabs.com` | 5175 |
| Defend | `securegraph-defend` | `defend.phantixlabs.com` | 5176 |
| Code | `securegraph-code` | `code.phantixlabs.com` | 5177 |
| Blog | `securegraph-blog` | (blog host, TBD) | 5178 |

The Blog app is The SecureGraph Weekly, a public-facing magazine (not an
operator app): a React/Vite SPA that renders the full-screen issue spread and
full-page Markdown essays. It reads published posts from `/api/v1/blog`; posts
are written and published only in the Staff Portal (`/weekly`). The bundled
posts under `src/content/posts/` are the demo fallback (see
`apps/securegraph-blog/README.md`). The subscribe link defaults to Substack.

The hosts are not a frontend choice: the backend serves them as each
application's `open_url` in the launcher, and allows them as CORS origins, from
`APP_LOGIN_BASE_URL` / `ATTACK_BASE_URL` / `DEFEND_BASE_URL` / `CODE_BASE_URL`.
Changing a host means changing that setting too, or the switcher will send
operators to the old one.

## Running locally

```bash
cd apps/securegraph-core && npm run dev     # 5173 — start this one first
cd apps/securegraph-attack && npm run dev   # 5175
cd apps/securegraph-defend && npm run dev   # 5176
cd apps/securegraph-code && npm run dev     # 5177
```

Under `vite dev` the four hosts resolve to these local ports, not the deployed
origins, so switching application and the "not signed in" bounce both stay on
localhost. `VITE_CORE_URL` / `VITE_ATTACK_URL` / `VITE_DEFEND_URL` /
`VITE_CODE_URL` override that if you want a local shell to talk to a deployed
sibling.

**Start Core first and sign in there.** Core owns the sign-in handshake; the
other three have no login of their own and will send you to Core's. The dev
server proxies `/api` to staging, so you sign in with a real staging account.
Once signed in, the switcher carries that session across to the other ports.

To look around without an account, use the guided demo from Core's home page —
it runs against fixtures in the browser and never asks for a session.

**On WSL:** run the dev servers and builds from Windows. `node_modules` is
installed for win32, so rollup has no Linux binary and `vite build` dies on
module load before reading any source. `tsc --noEmit` is fine either way.

## Deploying

One repository, four Vercel projects, four domains. Nothing is shared between
the projects except the code.

| Vercel project | Root Directory | Domain |
|---|---|---|
| securegraph-core | `apps/securegraph-core` | `app.phantixlabs.com` |
| securegraph-attack | `apps/securegraph-attack` | `attack.phantixlabs.com` |
| securegraph-defend | `apps/securegraph-defend` | `defend.phantixlabs.com` |
| securegraph-code | `apps/securegraph-code` | `code.phantixlabs.com` |

Create each project against this repository and set:

1. **Root Directory** to the app's folder.
2. **Include source files outside of the Root Directory** — **on**. The app
   imports `packages/sg-shared` and reads the product docs from `docs/`; without
   this the build cannot see either.

Everything else is in that app's `vercel.json` and needs no dashboard setting:

- `installCommand` / `buildCommand` run from the repo root, so the npm
  workspace link to `packages/sg-shared` resolves the same way it does locally.
- `ignoreCommand` skips the build when a push touched neither this app, the
  shared package, the docs, nor the lockfile — otherwise every push rebuilds all
  four.
- `rewrites` carry the SPA fallback and the API proxy; `headers` the cache and
  frame policy.

**The API proxy is not optional.** The shells call the API same-origin at
`/api/v1`, so a host without the rewrite has no backend at all. Point
`rewrites[0].destination` at the API for that environment:

| Environment | Destination |
|-------------|-------------|
| Staging | `https://staging.phantix.site/api/v1/:path*` (the committed default) |
| Production | the production API origin |

Vercel does not expand environment variables inside `vercel.json`, so this is a
per-environment edit, not a dashboard setting.

Locally the same layout works through npm workspaces: `npm install` once at the
root, then `npm run dev:attack` (or `build:attack`, `typecheck:all`).

## Session across the four hosts

Browser storage is per-origin, so signing in on Core does not sign you in on
Attack. Moving between applications mints a single-use handoff code that travels
in the URL fragment and is redeemed once on arrival — see
`packages/sg-shared/src/shell/session.ts` and the backend contract at
`docs/08-frontend/contracts/applications.md` §5.

This is why an application must never be reached by typing its host directly in
a fresh browser and expecting a session: it will bounce to the Core login, which
owns the sign-in handshake.

## Shared code

`packages/sg-shared` holds what the four applications share — the shell, the API
client, the theme, and the modules being graduated out of the Command Centre
monolith. Anything still imported through the `@` alias resolves to the monolith
at `../../src` and is a migration debt, not a design.
