// ── Cross-surface URLs ────────────────────────────────────────────────────────
// Production hosts; override per-environment via Vite env vars.

export const LANDING_URL =
  (import.meta.env.VITE_LANDING_URL as string | undefined) ?? "https://phantix.site";

export const PLATFORM_URL =
  (import.meta.env.VITE_PLATFORM_URL as string | undefined) ?? "https://platform.phantix.site";

export const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined) ?? "https://app.phantix.site";

/** Tenant admin lives on platform.phantix.site — not in the Command Centre. */
export const PLATFORM_IDENTITY_URL = `${PLATFORM_URL}/identity`;
export const PLATFORM_CONNECTIONS_URL = `${PLATFORM_URL}/connections`;
export const PLATFORM_BILLING_URL = `${PLATFORM_URL}/billing`;
export const PLATFORM_AI_URL = `${PLATFORM_URL}/ai`;
