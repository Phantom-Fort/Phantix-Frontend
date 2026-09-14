/**
 * Helpers for same-origin API + WebSocket URLs.
 * Never embed the upstream backend hostname in browser requests.
 */

/** Absolute same-origin base for fetch when needed (usually just use API_BASE="/api/v1"). */
export function sameOriginApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return p;
  return `${window.location.origin}${p}`;
}

/** WebSocket URL on the current page host (proxy upgrades WS). */
export function sameOriginWsUrl(apiPath: string): string {
  if (typeof window === "undefined") return apiPath;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${proto}//${window.location.host}${path}`;
}
