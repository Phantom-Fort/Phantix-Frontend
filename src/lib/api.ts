// ── Phantix API client ────────────────────────────────────────────────────────
// Token model: app_session + device, platform, dual-control, staff (never mixed).
// API base from src/lib/config.ts (no Vite env). Demo only via /demo flag.
import { API_BASE as CONFIG_API_BASE } from "./config";
import { dedupedRequest } from "./dedupe";

export const API_BASE = CONFIG_API_BASE;

const DEMO_FLAG = "phantix_demo";

/** Enter the guided demo tenant (runtime, survives refresh in this tab). */
export function enterDemoMode(): void {
  sessionStorage.setItem(DEMO_FLAG, "1");
}

/** Leave demo mode --- the next sign-in talks to the real organization. */
export function exitDemoMode(): void {
  sessionStorage.removeItem(DEMO_FLAG);
  localStorage.removeItem(DEMO_FLAG);
}

export function isDemoFlagSet(): boolean {
  return sessionStorage.getItem(DEMO_FLAG) === "1" || localStorage.getItem(DEMO_FLAG) === "1";
}

/** Demo mode = visitor explicitly entered the guided demo tenant. */
export function isDemoMode(): boolean {
  return isDemoFlagSet();
}

// ── Token stores (per-surface, never mixed) ──────────────────────────────────
export const tokens = {
  get platform() { return sessionStorage.getItem("platform_access_token"); },
  set platform(v: string | null) { v ? sessionStorage.setItem("platform_access_token", v) : sessionStorage.removeItem("platform_access_token"); },
  get orgUser() { return sessionStorage.getItem("platform_org_user_token"); },
  set orgUser(v: string | null) { v ? sessionStorage.setItem("platform_org_user_token", v) : sessionStorage.removeItem("platform_org_user_token"); },
  get dualControl() { return sessionStorage.getItem("platform_dual_control"); },
  set dualControl(v: string | null) { v ? sessionStorage.setItem("platform_dual_control", v) : sessionStorage.removeItem("platform_dual_control"); },
  get appSession() { return sessionStorage.getItem("app_session_token"); },
  set appSession(v: string | null) { v ? sessionStorage.setItem("app_session_token", v) : sessionStorage.removeItem("app_session_token"); },
  get device() { return sessionStorage.getItem("app_device_token"); },
  set device(v: string | null) { v ? sessionStorage.setItem("app_device_token", v) : sessionStorage.removeItem("app_device_token"); },
  get staff() { return sessionStorage.getItem("staff_access_token"); },
  set staff(v: string | null) { v ? sessionStorage.setItem("staff_access_token", v) : sessionStorage.removeItem("staff_access_token"); },
};

export function deviceId(): string {
  let id = localStorage.getItem("phantix_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("phantix_device_id", id);
  }
  return id;
}

function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d?.msg ?? "validation error").join(", ");
  }
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === "string") return d.message;
    if (typeof d.detail === "string") return d.detail;
    if (typeof d.error === "string") return d.error;
  }
  return "Request failed";
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  /** Server correlation id (X-Correlation-ID) for support/triage. */
  correlationId?: string;
  constructor(status: number, detail: unknown, correlationId?: string) {
    super(detailMessage(detail));
    this.status = status;
    this.detail = detail;
    this.correlationId = correlationId;
  }
}

// ── Correlation ID (00-shared-auth-and-client.md §6) ────────────────────────
// Surface X-Correlation-ID on failures so support can trace a request.
let lastCorrelationId: string | null = null;

/** Capture X-Correlation-ID from any response (if present). */
function trackCorrelationId(res: Response): void {
  const id = res.headers.get("X-Correlation-ID");
  if (id) lastCorrelationId = id;
}

/** Most recent correlation id seen on any response (or null). */
export function getCorrelationId(): string | null {
  return lastCorrelationId;
}

/** Reset tracking (e.g. on logout). */
export function clearCorrelationId(): void {
  lastCorrelationId = null;
}

/** Copy a correlation detection string into the thrown error's detail when useful. */
function withCorrelation<T extends { status: number; detail: unknown }>(err: T, correlationId?: string): T {
  if (correlationId && err instanceof ApiError) err.correlationId = correlationId;
  return err;
}

/** Apply X-Token-Refreshed response headers to the token store (app sessions). */
function applyTokenRenewal(res: Response): void {
  if (res.headers.get("X-Token-Refreshed") === "1") {
    const access = res.headers.get("X-Refreshed-Access-Token");
    const device = res.headers.get("X-Refreshed-Device-Token");
    if (access) tokens.appSession = access;
    if (device) tokens.device = device;
  }
}

/** 409 on product modules usually means security storage is not bootstrapped. */
export function isSecurityDbBlocked(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const msg = `${err.message} ${JSON.stringify(err.detail ?? "")}`.toLowerCase();
  return (
    msg.includes("security") ||
    msg.includes("bootstrap") ||
    msg.includes("storage") ||
    msg.includes("schema") ||
    msg.includes("not ready") ||
    msg.includes("connection")
  );
}

type Realm = "platform" | "application" | "staff";

type RequestOpts = {
  body?: unknown;
  realm?: Realm;
  dualControl?: boolean;
  form?: Record<string, string>;
  /** Per-request timeout in ms (e.g. 180_000 for AGI session start). */
  timeoutMs?: number;
};

async function request<T>(
  method: string,
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  const realm = opts.realm ?? (tokens.appSession ? "application" : "platform");

  // Demo mode never touches the backend: mutations resolve as a no-op success so
  // every gated action (approve/start/pause/cancel/create, decisions, etc.) passes
  // entirely on the frontend. Data loads already short-circuit via data.ts demo
  // branches and are not routed through this client.
  if (isDemoMode() && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return { ok: true } as T;
  }

  // Build headers fresh on every attempt so a renewal applied by another
  // in-flight response is picked up on retry.
  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    const bearer =
      realm === "staff" ? tokens.staff : realm === "application" ? tokens.appSession : tokens.orgUser ?? tokens.platform;
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
    if (realm === "application" && tokens.device) headers["X-Device-Token"] = tokens.device!;
    // Per 03_APPLICATION_IMPLEMENTATION.md §2.4: every app API call carries X-Device-Id
    if (realm === "application") headers["X-Device-Id"] = deviceId();
    // Dual-control operate session: attach on ALL mutations when a token exists so
    // the Phantix Agent, Pentest Agent, and platform mutations share ONE operate
    // session. Stale/expired tokens are handled separately (the backend rejects the
    // mutation, not the org/app session — see the 401 handling below).
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    if (opts.dualControl && tokens.dualControl) {
      headers["X-Dual-Control-Session"] = tokens.dualControl;
    } else if (isMutation && tokens.dualControl) {
      headers["X-Dual-Control-Session"] = tokens.dualControl;
    }

    let body: BodyInit | undefined;
    if (opts.form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(opts.form).toString();
    } else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }

    const controller = opts.timeoutMs != null ? new AbortController() : null;
    const timer = controller && opts.timeoutMs != null
      ? window.setTimeout(() => controller.abort(), opts.timeoutMs)
      : null;
    try {
      const res = await fetch(`${API_BASE}${path}`, { method, headers, body, signal: controller?.signal });
      // App session token renewal (APP_SESSION_TOKEN_RENEWAL.md): the backend bumps
      // token versions on activity and returns refreshed tokens in response headers.
      applyTokenRenewal(res);
      // Support triage: remember the correlation id even on success, so the next
      // failure can be traced back (00-shared-auth-and-client.md §6).
      trackCorrelationId(res);
      return res;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError(408, "Request timed out");
      }
      throw err;
    } finally {
      if (timer != null) window.clearTimeout(timer);
    }
  };

  const sentDualControl = !!tokens.dualControl && (opts.dualControl || ["POST", "PUT", "PATCH", "DELETE"].includes(method));

  let res = await doFetch();

  // Concurrent-renewal race: another request already bumped the token version,
  // so this one was rejected as superseded. Retry once with the freshly stored
  // token instead of treating it as a dropped session (which logs the user out
  // mid-session).
  if (res.status === 401 && (await isSessionSuperseded(res))) {
    res = await doFetch();
  }

  // The operate session is an *idle* session on the backend: every successful
  // mutation that used it counts as activity and slides the FE expiry forward so
  // the user is not asked for another code while still working.
  if (res.ok && sentDualControl) {
    window.dispatchEvent(new CustomEvent("phantix:operate-activity"));
  }

  if (!res.ok) {
    const correlationId = res.headers.get("X-Correlation-ID") || undefined;
    let detail: unknown = res.statusText;
    try {
      detail = (await res.json()).detail;
    } catch { /* non-JSON */ }
    const detailObj = detail && typeof detail === "object" ? detail as Record<string, unknown> : null;
    const relogin = detailObj?.relogin === true || detailObj?.error === "session_invalid";
    // Only treat a 401 as a dropped session when it is genuinely about an
    // invalid/expired token — NOT an authorization gap such as "dual-control
    // session required" (authorizer inbox) and NOT a transient superseded race.
    const msg = typeof detail === "string" ? detail : detailObj?.message ? String(detailObj.message) : "";
    // Service-key gate (00-shared-auth-and-client.md §8): app access disabled on
    // Platform. Not a session problem — the user stays signed in and is told to
    // have an admin enable app access.
    const serviceKeyRequired =
      detailObj?.error === "service_key_required" ||
      detailObj?.code === "service_key_required" ||
      /service[ -_]?key/.test(msg);
    if (res.status === 403 && serviceKeyRequired) {
      window.dispatchEvent(new CustomEvent("phantix:service-key-required"));
    }
    // A missing/expired dual-control operate session is NOT a dropped org/app
    // session. It only blocks sensitive actions; the user stays signed in.
    const dcSessionIssue =
      (detailObj?.error === "dual_control_session_required" ||
       (detailObj as Record<string, unknown>)?.["required_header"] === "X-Dual-Control-Session" ||
       /authenticator session|dual.?control session|X-Dual-Control-Session/i.test(msg));
    // The backend is authoritative for the operate idle window: if it rejected
    // a mutation because the dual-control session is gone/expired, tell the store
    // to lock so the next action prompts cleanly (instead of the FE guessing).
    if ((res.status === 401 || res.status === 403) && sentDualControl && dcSessionIssue) {
      tokens.dualControl = null;
      window.dispatchEvent(new CustomEvent("phantix:operate-expired", { detail: msg || "Operate session ended." }));
    } else if (res.status === 403 && dcSessionIssue) {
      // Dual-control header missing (not a broken session). 00-shared-auth… §1/§8:
      // open the unlock overlay so the user can operate and retry.
      window.dispatchEvent(new CustomEvent("phantix:operate-required", { detail: msg || undefined }));
    }
    const superseded = detailObj?.error === "session_superseded" || /superseded by renewal/i.test(msg);
    const sessionInvalid =
      relogin ||
      /session_invalid|invalid session|session expired|token expired|not authenticated|authentication expired|expired/i.test(msg);
    if (res.status === 401) {
      if (sessionInvalid && !dcSessionIssue && !superseded) {
        if (realm === "staff") tokens.staff = null;
        else if (realm === "application") { tokens.appSession = null; tokens.device = null; }
        else { tokens.platform = null; tokens.orgUser = null; }
      }
      if (realm === "application" && relogin && !dcSessionIssue && !superseded) {
        window.location.assign("/login");
      }
    }
    if (res.status === 402) {
      const upgradeMsg = typeof detail === "string" ? detail : "Upgrade required";
      window.dispatchEvent(new CustomEvent("phantix:billing-required", { detail: upgradeMsg }));
    }
    throw withCorrelation(new ApiError(res.status, detail, correlationId), correlationId);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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

export const api = {
  get: <T>(path: string, opts?: RequestOpts) =>
    dedupedRequest("GET", path, opts?.body, () => request<T>("GET", path, opts)),
  post: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: Parameters<typeof request>[2]) => request<T>("DELETE", path, opts),
  postForm: <T>(path: string, form: Record<string, string>, opts?: Parameters<typeof request>[2]) =>
    request<T>("POST", path, { ...opts, form }),

  /** Fetch binary/raw content with auth headers, returns a Blob. */
  async download(path: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    const bearer = tokens.appSession || tokens.orgUser || tokens.platform;
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
    if (tokens.device) headers["X-Device-Token"] = tokens.device;

    const res = await fetch(`${API_BASE}${path}`, { method: "GET", headers });
    applyTokenRenewal(res);
    trackCorrelationId(res);
    if (!res.ok) throw new ApiError(res.status, res.statusText, res.headers.get("X-Correlation-ID") || undefined);
    return res.blob();
  },

  /** Fetch text content with auth headers (e.g. markdown). */
  async fetchText(path: string): Promise<string> {
    const headers: Record<string, string> = {};
    const bearer = tokens.appSession || tokens.orgUser || tokens.platform;
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
    if (tokens.device) headers["X-Device-Token"] = tokens.device;

    const res = await fetch(`${API_BASE}${path}`, { method: "GET", headers });
    applyTokenRenewal(res);
    trackCorrelationId(res);
    if (!res.ok) throw new ApiError(res.status, res.statusText, res.headers.get("X-Correlation-ID") || undefined);
    return res.text();
  },

  /** Upload a file with FormData --- sends all auth headers. */
  async upload<T>(path: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    const bearer = tokens.appSession || tokens.orgUser || tokens.platform;
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
    if (tokens.device) headers["X-Device-Token"] = tokens.device;
    headers["X-Device-Id"] = deviceId();
    if (tokens.dualControl) headers["X-Dual-Control-Session"] = tokens.dualControl;

    const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: formData });
    applyTokenRenewal(res);
    trackCorrelationId(res);
    if (!res.ok) {
      let detail: unknown = res.statusText;
      try { detail = (await res.json()).detail; } catch { /* non-JSON */ }
      throw new ApiError(res.status, detail, res.headers.get("X-Correlation-ID") || undefined);
    }
    return res.json() as T;
  },
};

/**
 * Media/download URLs stay same-origin so the Network tab never shows upstream.
 * Absolute backend URLs from the API are rewritten to path-only.
 */
export function mediaUrl(path?: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (u.pathname.startsWith("/api/")) return `${u.pathname}${u.search}`;
    } catch { /* keep original */ }
    return path;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

// Simulated latency for demo mode so loading states are visible
export const delay = (ms = 420) => new Promise((r) => setTimeout(r, ms));
