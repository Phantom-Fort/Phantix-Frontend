// ── Analytics consent (cookies & analytics policy) ───────────────────────────
// Analytics is first-party and cookieless, but it is still gated on explicit
// acceptance: no beacon is sent until the operator says yes. The choice is
// stored locally and never leaves the browser.

export type ConsentChoice = "accepted" | "declined";

const KEY = "phantix_cookie_consent";

export function getConsent(): ConsentChoice | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* private mode / storage disabled — the banner will simply reappear */
  }
}

/** Withdraw a previous choice and let the operator decide again. */
export function clearConsent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const COOKIE_POLICY_PATH = "/cookies";
