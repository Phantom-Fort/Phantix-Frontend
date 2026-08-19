/**
 * Command Centre (app.phantix.site) — hardcoded browser config (no VITE_*).
 * Browser only talks same-origin; vite/nginx proxies upstream.
 */
export const API_BASE = "/api/v1";
/** Public sandbox cohort slug on the shared backend (POST /sandbox/programs/{slug}/members). */
export const SANDBOX_PROGRAM_SLUG = "public-launch-20";
export const LANDING_URL = "https://phantix.site";
export const PLATFORM_URL = "https://platform.phantix.site";
export const APP_URL = "https://app.phantix.site";
export const AGI_ENABLED = true;
