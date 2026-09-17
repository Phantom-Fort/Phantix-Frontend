/**
 * Minimal same-origin API client for the application shells.
 *
 * The four apps share one backend and one session: tokens live in the same
 * sessionStorage keys on every host (the cross-origin handoff copies them), and
 * each app's dev server proxies `/api` upstream. This is deliberately small —
 * pages that need richer behaviour can import their own client later.
 *
 * Every call declares which application it comes from (`X-Application`). The
 * backend enforces that the declared application owns the route *and* that the
 * operator may enter it, so the Defend shell cannot drive an Attack route just
 * because the operator's role happens to include Attack.
 */
import type { ApplicationKey } from "./types";
import { deviceId as sharedDeviceId } from "../api";

export type { ApplicationKey };

const API_BASE = "/api/v1";

const STORAGE = {
  accessToken: "app_session_token",
  platformToken: "platform_access_token",
  deviceToken: "app_device_token",
  deviceId: "phantix_device_id",
  dualControl: "platform_dual_control",
} as const;

/** The application this shell is — set once at boot by ApplicationShell. */
let currentApplication: ApplicationKey | "" = "";

export function setApplication(app: ApplicationKey): void {
  currentApplication = app;
}

export function activeApplication(): ApplicationKey | "" {
  return currentApplication;
}

function read(key: string): string {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function write(key: string, value: string): void {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    /* private mode / blocked storage — the session simply does not persist */
  }
}

export function appToken(): string {
  return read(STORAGE.accessToken) || read(STORAGE.platformToken);
}

export function deviceToken(): string {
  return read(STORAGE.deviceToken);
}

export function dualControlSession(): string {
  return read(STORAGE.dualControl);
}

/**
 * A stable per-browser id, created once and reused on every host.
 *
 * Single implementation: the shared `@sg/api` client owns it (same
 * `phantix_device_id` key + localStorage) so the shell and the page clients
 * always present ONE device identity — device binding depends on it.
 */
export const deviceId = sharedDeviceId;

export interface StoredSession {
  accessToken: string;
  deviceToken?: string;
  dualControlSession?: string;
}

export function setStoredSession(session: StoredSession): void {
  write(STORAGE.accessToken, session.accessToken);
  write(STORAGE.deviceToken, session.deviceToken || "");
  write(STORAGE.dualControl, session.dualControlSession || "");
  deviceId();
}

export function clearStoredSession(): void {
  write(STORAGE.accessToken, "");
  write(STORAGE.platformToken, "");
  write(STORAGE.deviceToken, "");
  write(STORAGE.dualControl, "");
}

/** An API failure that kept the status and the parsed `detail` payload. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  /** The backend's machine-readable error code, when it sent one. */
  get code(): string {
    const detail = this.detail as { error?: unknown } | null;
    return detail && typeof detail === "object" && typeof detail.error === "string"
      ? detail.error
      : "";
  }

  /** True when this application (or this role) may not enter the route. */
  get isApplicationDenied(): boolean {
    return (
      this.status === 403 &&
      (this.code === "application_access_required" || this.code === "application_mismatch")
    );
  }
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  /** Send without credentials — for the handoff redeem, which has none yet. */
  anonymous?: boolean;
}

/** Apply X-Token-Refreshed response headers (app_session rotation) to storage. */
function applyTokenRenewal(res: Response): void {
  if (res.headers.get("X-Token-Refreshed") !== "1") return;
  const access = res.headers.get("X-Refreshed-Access-Token");
  const device = res.headers.get("X-Refreshed-Device-Token");
  if (access) write(STORAGE.accessToken, access);
  if (device) write(STORAGE.deviceToken, device);
}

/** True when a 401 is the retryable "token superseded by renewal" race. */
async function isSessionSuperseded(res: Response): Promise<boolean> {
  try {
    const j = (await res.clone().json()) as { detail?: { error?: string; message?: string } };
    const d = j?.detail;
    return d?.error === "session_superseded" || /superseded by renewal/i.test(d?.message ?? "");
  } catch {
    return false;
  }
}

function buildHeaders(anonymous: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (!anonymous) {
    const token = appToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const device = deviceToken();
    if (device) headers["X-Device-Token"] = device;
    const dual = dualControlSession();
    if (dual) headers["X-Dual-Control-Session"] = dual;
    headers["X-Device-Id"] = deviceId();
  }
  if (currentApplication) headers["X-Application"] = currentApplication;
  return headers;
}

export async function apiRequest<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const headers = buildHeaders(!!opts.anonymous);
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method || "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    // App-session token rotation (APP_SESSION_TOKEN_RENEWAL.md): the stack
    // bumps the token version on activity and returns the new pair in headers.
    applyTokenRenewal(res);
    return res;
  };

  let res = await doFetch();
  // Concurrent-renewal race: a sibling request already rotated the token, so
  // this one was rejected as superseded. Retry once with the freshly stored
  // token instead of surfacing a dropped session.
  if (res.status === 401 && (await isSessionSuperseded(res))) {
    res = await doFetch();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail: unknown = text;
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      detail = parsed?.detail ?? parsed;
    } catch {
      /* not JSON — keep the raw text */
    }
    // A gateway error page is HTML written for whoever runs the server, not for
    // the operator reading this screen. Keep structured API errors verbatim and
    // replace anything else with what actually happened.
    const structured =
      detail && typeof detail === "object" && "message" in detail
        ? String((detail as { message?: unknown }).message)
        : "";
    const plain = typeof detail === "string" ? detail.trim() : "";
    const looksLikeGatewayPage =
      !structured && (/<html|<!doctype|cloudflare|error code:/i.test(plain) || plain.length > 300);
    const message =
      structured ||
      (looksLikeGatewayPage
        ? res.status >= 500
          ? `The API is not responding (HTTP ${res.status}). It may be restarting or down.`
          : `Request failed (HTTP ${res.status}).`
        : plain) ||
      `HTTP ${res.status}`;
    throw new ApiError(res.status, detail, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}
