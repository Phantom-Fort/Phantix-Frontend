// ── First-party, cookieless reader analytics ─────────────────────────────────
// Fire-and-forget beacons to the admin backend: path, referrer, coarse screen,
// language, timezone, UTM and a per-session id — no cookies, no fingerprints,
// no PII. Gated on explicit consent, Do Not Track and an env kill-switch, and
// it never blocks rendering or throws.
//
// Contract (served by the admin backend):
//   POST {VITE_ANALYTICS_URL | /api/v1/analytics/collect}
//   {
//     app: "blog",
//     sid, path, ref, screen, lang, tz, utm, ts,
//     event: "page_view" | "post_view" | "post_read" | "subscribe_click" | "external_click",
//     slug?, url?
//   }

import { getConsent } from "./consent";

export type BlogEvent =
  | { type: "page_view" }
  | { type: "post_view"; slug: string }
  | { type: "post_read"; slug: string }
  | { type: "subscribe_click" }
  | { type: "external_click"; url: string };

const COLLECT_URL =
  (import.meta.env.VITE_ANALYTICS_URL as string | undefined)?.trim() ||
  "/api/v1/analytics/collect";
const APP_SOURCE = "blog";
const DEV = Boolean(import.meta.env.DEV);
const DISABLED = String(import.meta.env.VITE_ANALYTICS_DISABLED ?? "") === "true";

let sessionId = "";
let armed = false;
let lastPath = "";

function dnt(): boolean {
  return (
    navigator.doNotTrack === "1" ||
    (window as { doNotTrack?: string }).doNotTrack === "1"
  );
}

function sid(): string {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem("phantix_blog_sid") ?? "";
    if (!sessionId) {
      sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("phantix_blog_sid", sessionId);
    }
  } catch {
    sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
  return sessionId;
}

function base(): Record<string, unknown> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = params.get(key);
    if (v) utm[key] = v;
  }
  return {
    app: APP_SOURCE,
    sid: sid(),
    path: window.location.pathname,
    ref: document.referrer || null,
    screen: `${window.screen.width}x${window.screen.height}`,
    lang: navigator.language || null,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    utm: Object.keys(utm).length ? utm : null,
    ts: Date.now(),
  };
}

function fields(ev: BlogEvent): Record<string, unknown> {
  switch (ev.type) {
    case "page_view":
      return { event: "page_view" };
    case "post_view":
      return { event: "post_view", slug: ev.slug };
    case "post_read":
      return { event: "post_read", slug: ev.slug };
    case "subscribe_click":
      return { event: "subscribe_click" };
    case "external_click":
      return { event: "external_click", url: ev.url };
  }
}

function send(ev: BlogEvent): void {
  try {
    const body = JSON.stringify({ ...base(), ...fields(ev) });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(COLLECT_URL, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(COLLECT_URL, {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    /* analytics must never break the page */
  }
}

function canSend(): boolean {
  return armed && !DEV && !DISABLED && !dnt();
}

export function track(ev: BlogEvent): void {
  if (!canSend()) return;
  send(ev);
}

/** Page views are deduped per path so SPA re-renders don't double-count. */
export function trackPageView(): void {
  if (lastPath === window.location.pathname) return;
  lastPath = window.location.pathname;
  track({ type: "page_view" });
}

/** Arm the tracker once consent is already on file. Safe to call repeatedly. */
export function initAnalytics(): void {
  if (getConsent() === "accepted") armed = true;
}

/** Called by the consent banner when the reader accepts. */
export function onConsentAccepted(): void {
  armed = true;
  lastPath = "";
  trackPageView();
}
