// ── Cross-surface URLs (from config — no Vite env) ───────────────────────────
export { LANDING_URL, PLATFORM_URL, APP_URL } from "./config";
import { PLATFORM_URL, APP_URL } from "./config";

/** Tenant admin lives on platform.phantix.site --- not in the Command Centre. */
export const PLATFORM_IDENTITY_URL = `${PLATFORM_URL}/identity`;
export const PLATFORM_CONNECTIONS_URL = `${PLATFORM_URL}/connections`;
export const PLATFORM_BILLING_URL = `${PLATFORM_URL}/billing`;
export const PLATFORM_AI_URL = `${PLATFORM_URL}/ai`;
export const APP_DEMO_URL = `${APP_URL}/demo`;
