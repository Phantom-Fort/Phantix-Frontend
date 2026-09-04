/**
 * Command Centre (app.phantixlabs.com) — hardcoded browser config (no VITE_*).
 * Browser only talks same-origin; vite/nginx proxies upstream.
 */
export const API_BASE = "/api/v1";
/** Public sandbox cohort slug on the shared backend (POST /sandbox/programs/{slug}/members). */
export const SANDBOX_PROGRAM_SLUG = "public-launch-20";
export const LANDING_URL = "https://phantixlabs.com";
export const PLATFORM_URL = "https://platform.phantixlabs.com";
export const APP_URL = "https://app.phantixlabs.com";
export const AGI_ENABLED = true;
