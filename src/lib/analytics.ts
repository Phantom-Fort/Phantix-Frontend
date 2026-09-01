// ── First-party, cookieless analytics (free tier — no third party) ───────────
// Fire-and-forget page-vision beacons to the Phantix backend. No cookies, no
// fingerprints, no PII: path, referrer, coarse screen and UTM only. Respects
// Do Not Track and an env kill-switch, and never blocks or logs errors.
//
// Collected server-side by POST /api/v1/analytics/collect and surfaced to
// staff via GET /api/v1/admin/analytics/summary (staff portal → Analytics).

const COLLECT_URL = "/api/v1/analytics/collect";
const APP_SOURCE = "command-centre";

const ENV = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
const DEV = Boolean(ENV.DEV);
const DISABLED = String(ENV.VITE_ANALYTICS_DISABLED ?? "") === "true";

let sessionId = "";
let lastPath = "";

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
    sid: sessionKey(),
    path: window.location.pathname,
    ref: document.referrer || null,
    screen: `${window.screen.width}x${window.screen.height}`,
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

/** Install the tracker: initial view + SPA route changes. Safe to call once. */
export function initAnalytics(): void {
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