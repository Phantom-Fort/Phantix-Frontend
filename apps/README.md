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

The hosts are not a frontend choice: the backend serves them as each
application's `open_url` in the launcher, and allows them as CORS origins, from
`APP_LOGIN_BASE_URL` / `ATTACK_BASE_URL` / `DEFEND_BASE_URL` / `CODE_BASE_URL`.
Changing a host means changing that setting too, or the switcher will send
operators to the old one.

## Deploying

Each app is its own Vercel project with **Root Directory** set to
`apps/securegraph-<app>`; `vercel.json` in that directory carries the build, the
SPA rewrite and the API proxy.

**The API proxy is not optional.** The shells call the API same-origin at
`/api/v1`, so a host without the rewrite has no backend at all. Point
`rewrites[0].destination` at the API for that environment:

| Environment | Destination |
|-------------|-------------|
| Staging | `https://staging.phantix.site/api/v1/:path*` (the committed default) |
| Production | the production API origin |

Vercel does not expand environment variables inside `vercel.json`, so this is a
per-environment edit, not a dashboard setting.

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
