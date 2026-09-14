// ── First-party, cookieless analytics (free tier — no third party) ───────────
// Fire-and-forget page-vision beacons to the SecureGraph backend. No cookies, no
// fingerprints, no PII: path, referrer, coarse screen and UTM only. Respects
// Do Not Track and an env kill-switch, and never blocks or logs errors.
//
// Collected server-side by POST /api/v1/analytics/collect and surfaced to
// staff via GET /api/v1/admin/analytics/summary (staff portal → Analytics).
//
// Consent-gated: nothing is sent until the operator accepts analytics.

import { getConsent } from "./consent";

const COLLECT_URL = "/api/v1/analytics/collect";
// Payload `app` per surface: "app" | "platform" | "staff" (staging-rollout §9).
const APP_SOURCE = "app";

const ENV = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
const DEV = Boolean(ENV.DEV);
const DISABLED = String(ENV.VITE_ANALYTICS_DISABLED ?? "") === "true";

let sessionId = "";
let lastPath = "";

/** Field caps are enforced server-side (path 400, ref 600, sid 64) — truncate client-side. */
function cap(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function dnt(): boolean {
  return navigator.doNotTrack === "1" || (window as { doNotTrack?: string }).doNotTrack === "1";
}

function sessionKey(): string {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem("phantix_analytics_sid") ?? "";
    if (!sessionId) {
      sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("phantix_analytics_sid", sessionId);
    }
  } catch {
    sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
  return sessionId;
}

function payload(): Record<string, unknown> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = params.get(key);
    if (v) utm[key] = v;
  }
  return {
    app: APP_SOURCE,
    sid: cap(sessionKey(), 64) ?? undefined,
    path: cap(window.location.pathname, 400) ?? "/",
    ref: cap(document.referrer, 600),
    screen: `${window.innerWidth}x${window.innerHeight}`,
    lang: navigator.language || null,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    utm: Object.keys(utm).length ? utm : null,
    ts: Date.now(),
  };
}

function send(): void {
  if (lastPath === window.location.pathname) return;
  lastPath = window.location.pathname;
  try {
    const body = JSON.stringify(payload());
    if (navigator.sendBeacon) {
      navigator.sendBeacon(COLLECT_URL, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(COLLECT_URL, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
    }
  } catch {
    /* analytics must never break the page */
  }
}

let started = false;

function start(): void {
  if (started) return;
  started = true;
  if (DEV || DISABLED || dnt()) return;
  try {
    const wrap = (fn: History["pushState"]): History["pushState"] =>
      function (this: History, ...args: Parameters<History["pushState"]>) {
        const result = fn.apply(this, args);
        window.setTimeout(send, 0);
        return result;
      };
    history.pushState = wrap(history.pushState.bind(history));
    history.replaceState = wrap(history.replaceState.bind(history));
    window.addEventListener("popstate", send);
  } catch {
    /* ignore */
  }
  send();
}

/**
 * Install the tracker only when the operator has already accepted analytics.
 * Nothing is sent before consent; the banner calls :func:`onConsentAccepted`.
 */
export function initAnalytics(): void {
  if (getConsent() === "accepted") start();
}

/** Called by the consent banner when the operator accepts. */
export function onConsentAccepted(): void {
  start();
}