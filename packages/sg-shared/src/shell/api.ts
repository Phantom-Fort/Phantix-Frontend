/**
 * Minimal same-origin API client for the application shells.
 *
 * The four apps share one backend and one session: tokens live in the same
 * sessionStorage keys on every host (the handoff copies them), and each app's
 * dev server proxies `/api` upstream. This is deliberately small — pages that
 * need richer behaviour can import their own client later.
 */
const API_BASE = "/api/v1";

function read(key: string): string {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function appToken(): string {
  return read("app_session_token") || read("platform_access_token");
}

export function deviceToken(): string {
  return read("app_device_token");
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
}

export async function apiRequest<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = appToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const device = deviceToken();
  if (device) headers["X-Device-Token"] = device;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}
