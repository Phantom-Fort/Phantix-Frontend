/**
 * Command Centre (app.phantixlabs.com) — hardcoded browser config (no VITE_*).
 * Browser only talks same-origin; vite/nginx proxies upstream.
 */
export const API_BASE = "/api/v1";
/** Public sandbox cohort slug on the shared backend (POST /sandbox/programs/{slug}/members). */
export const SANDBOX_PROGRAM_SLUG = "public-launch-20";
export const LANDING_URL = "https://phantixlabs.com";
export const PLATFORM_URL = "https://platform.phantixlabs.com";
/**
 * Application hosts.
 *
 * In production these are the four deployed origins. In `vite dev` they resolve
 * to the local ports instead, because otherwise the first thing a dev server
 * does with no session is bounce the browser to production — the shells send an
 * unauthenticated visitor to Core's login, and the switcher opens sibling
 * applications by absolute URL.
 *
 * `VITE_CORE_URL` / `VITE_ATTACK_URL` / `VITE_DEFEND_URL` / `VITE_CODE_URL`
 * override either mode, for pointing a local shell at a deployed sibling.
 */
// Written exactly this way on purpose: Vite only substitutes the literal
// `import.meta.env.DEV` form. Optional chaining leaves it to a runtime object
// that may not exist, which would silently resolve every host to production.
const DEV = import.meta.env.DEV === true;

function host(override: string | undefined, devPort: number, production: string): string {
  const explicit = (override || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  return DEV ? `http://localhost:${devPort}` : production;
}

export const APP_URL = host(import.meta.env.VITE_CORE_URL, 5173, "https://app.phantixlabs.com");
/** Sibling application hosts (Core lives on APP_URL). */
export const ATTACK_URL = host(
  import.meta.env.VITE_ATTACK_URL,
  5175,
  "https://attack.phantixlabs.com",
);
export const DEFEND_URL = host(
  import.meta.env.VITE_DEFEND_URL,
  5176,
  "https://defend.phantixlabs.com",
);
export const CODE_URL = host(import.meta.env.VITE_CODE_URL, 5177, "https://code.phantixlabs.com");
/** True when this bundle is a dev server — the deployed open_url is then wrong. */
export const IS_DEV_HOSTS = DEV;
export const AGI_ENABLED = true;
