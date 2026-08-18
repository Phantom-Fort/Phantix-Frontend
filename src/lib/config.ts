/**
 * Browser-facing config. API calls are always same-origin so the Network tab
 * never shows the upstream backend host (vite/nginx/Vercel proxy cloaks it).
 */
export const API_BASE = "/api/v1";
export const LANDING_URL = "https://phantix.site";
export const PLATFORM_URL = "https://platform.phantix.site";
export const APP_URL = "https://app.phantix.site";
export const AGI_ENABLED = true;

/** Upstream target for dev proxy / deploy rewrites only (never used in browser fetch). */
export const UPSTREAM_API_ORIGIN = "https://staging.phantix.site";
