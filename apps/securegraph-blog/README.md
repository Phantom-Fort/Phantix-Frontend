# The SecureGraph Weekly

A Markdown-driven magazine. The issue landing is a full-screen two-page spread
(SecureGraph gold-on-dark palette), and every post opens as its own full-page,
single-column article.

## Architecture

- **This app** — a client-only React/Vite SPA. It fetches posts from an admin
  backend and renders them.
- **The SecureGraph API** — the Phantix backend. It serves the read-only
  public endpoints below and receives the analytics beacons.
- **The Staff Portal** — the *only* place posts are written, imported (.md),
  edited, published and unpublished (`/weekly`, admin staff only). It calls
  `/api/v1/admin/blog/*`, which requires an admin staff session. Readers and
  this app can only ever see published posts.
- **Demo fixtures** — `src/content/posts/*.md` are bundled in and used when no
  backend is configured, so the site runs with zero setup and doubles as the
  reference format for the admin backend.

## Content source

Set `VITE_BLOG_API_URL` to switch from demo to live:

| Value | Meaning |
|-------|---------|
| unset | demo mode — bundled fixtures |
| `https://api.example.com/api/v1/blog` | live, absolute (backend must allow CORS) |
| `/api/v1/blog` | live, same-origin (add a Vercel rewrite for `/api/v1` → backend) |

### Public read contract (`/api/v1/blog`)

```
GET {base}/posts
→ {
    "issue": {                    // optional overrides, merged over defaults
      "name": "The SecureGraph Weekly", "number": "Issue 01",
      "date": "September 2026", "folio": "01–02", "kicker": "...", "deck": "...",
      "byline": "...", "pullQuote": "...", "pullCite": "...",
      "newsletterLabel": "...", "newsletterBlurb": "...", "newsletterUrl": "..."
    },
    "posts": [
      {
        "slug": "proof-before-panic",
        "title": "Proof Before Panic",
        "no": "01", "order": 1, "date": "September 2026",
        "kicker": "Lead essay",
        "excerpt": "One-line summary for the contents list.",
        "featured": true
      }
    ]
  }

GET {base}/posts/{slug}
→ { ...same fields as above..., "body": "# raw markdown…" }
```

Only published posts are returned; drafts never leave the Staff Portal. Posts
are ordered by `order` (then `no`). The `featured` post (or the first post)
is the lead essay on the left page, shown as its standfirst and opening
paragraphs with a link to the full piece; the rest are summarised on the right
page. Every post has its own full page at `/posts/:slug`.

### Markdown / frontmatter format

Drop a file like `src/content/posts/05-some-title.md` for the demo issue, or
import the same file in the Staff Portal (The Weekly → Import .md) to publish it. The numeric prefix becomes the default `no` and the
filename becomes the slug.

```md
---
title: "A New Essay"
no: "05"
order: 5
date: "October 2026"
kicker: "Attack surface"
excerpt: "One-line summary."
featured: false
---

First paragraph (gets the gold drop cap if it starts the article)…

## A subheading

Body text with **bold**, *italic*, `inline code`, > quotes, - lists, and links.
```

## Analytics (readers analysis)

First-party, cookieless, consent-gated, DNT-respecting. Nothing is sent until
the reader accepts the banner (consent is shared with the landing page via the
same cookie key).

```
POST {VITE_ANALYTICS_URL | /api/v1/analytics/collect}
{
  app: "blog",
  sid, path, ref, screen, lang, tz, utm, ts,
  event: "page_view" | "post_view" | "post_read" | "subscribe_click" | "external_click",
  slug?, url?
}
```

Events: `page_view` (every route), `post_view` (article opened), `post_read`
(scrolled through ~90%), `subscribe_click`, `external_click`. Kill switch:
`VITE_ANALYTICS_DISABLED=true`. Custom endpoint: `VITE_ANALYTICS_URL`.

## Running

```bash
cd apps/securegraph-blog && npm run dev     # 5178, demo fixtures
cd apps/securegraph-blog && npm run build
```

Or from the repo root (after `npm install`): `npm run dev:blog` / `npm run build:blog`.

## Deploying (Vercel)

Create a Vercel project for this folder with Root Directory
`apps/securegraph-blog`. For live content either set `VITE_BLOG_API_URL` to the
SecureGraph API's absolute `.../api/v1/blog` URL (enable CORS for the blog origin), or set it to
`/api/v1/blog`; the committed `vercel.json` already rewrites `/api/v1` to the backend:

```json
{ "source": "/api/v1/:path*", "destination": "https://staging.phantix.site/api/v1/:path*" }
```

The committed CSP allows `connect-src 'self' https:` and `img-src 'self' data:
blob: https:`, so both same-origin proxying and absolute backend/image URLs work.
