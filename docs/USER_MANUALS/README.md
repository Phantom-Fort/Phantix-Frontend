# Phantix User Manuals

Complete user documentation for the Phantix product surfaces, with screenshots captured from the
live applications.

| Manual | URL | Audience | Screenshots |
|--------|-----|----------|-------------|
| [01 — Landing site](01-landing.md) | https://phantix.site | Prospective customers, investors, partners | 5 |
| [02 — Platform](02-platform.md) | https://platform.phantix.site | Organization administrators | 12 |
| [03 — Staff portal](03-staff-portal.md) | https://staff.phantix.site | Phantix platform staff | 19 |

> **Note:** The **Command Centre** (`app.phantix.site`) manual is pending — its authenticated
> screenshots could not be captured due to a backend "Failed to fetch" on the app-realm login
> verification. See the open issue in the project backlog.

## Screenshots

All screenshots live in `docs/../screenshots/`:

- `docs/../screenshots/landing-*.png` — landing sections
- `docs/../screenshots/platform-login.png`, `docs/../screenshots/platform/*` — platform pages
- `docs/../screenshots/staff-login.png`, `docs/../screenshots/staff/*` — staff portal pages
- `docs/../screenshots/app-login.png`, `docs/../screenshots/app-dashboard.png` — Command Centre (login only)

## How these were produced

Screenshots were captured with Google Chrome (headless) via Playwright against the live sites, after
authenticating with a real account (email + password + email OTP). See `docs/../screenshots/README.md`
for the full inventory.
