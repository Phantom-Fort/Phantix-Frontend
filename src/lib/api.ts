// ── Phantix API client ────────────────────────────────────────────────────────
// Implements the token model from the FE guides:
//   platform_access_token  (company JWT, type=access)
//   platform_org_user_token (type=org_user)
//   platform_dual_control  (X-Dual-Control-Session, 3-min idle)
//   app_session_token + app_device_token (application dual-token)
//   staff_access_token     (type=staff)
//   phantix_device_id      (stable browser UUID)
//
// Demo mode: active when VITE_API_BASE is unset, OR when the visitor enters the
// demo from the landing page (runtime flag) — even against a configured API.
// Set VITE_API_BASE (e.g. https://staging.phantix.site/api/v1) for live data.

export const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;

const DEMO_FLAG = "phantix_demo";

/** Enter the guided demo tenant (runtime, survives refresh in this tab). */
export function enterDemoMode(): void {
  sessionStorage.setItem(DEMO_FLAG, "1");
}

/** Leave demo mode — the next sign-in talks to the real organization. */
export function exitDemoMode(): void {
  sessionStorage.removeItem(DEMO_FLAG);
  localStorage.removeItem(DEMO_FLAG);
}

export function isDemoFlagSet(): boolean {
  return sessionStorage.getItem(DEMO_FLAG) === "1" || localStorage.getItem(DEMO_FLAG) === "1";
}

/** Demo mode = no API configured, or the visitor explicitly chose the demo. */
export function isDemoMode(): boolean {
  return !API_BASE || isDemoFlagSet();
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
  constructor(status: number, detail: unknown) {
    super(detailMessage(detail));
    this.status = status;
    this.detail = detail;
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

async function request<T>(
  method: string,
  path: string,
  opts: { body?: unknown; realm?: Realm; dualControl?: boolean; form?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const realm = opts.realm ?? (tokens.appSession ? "application" : "platform");

  const bearer =
    realm === "staff" ? tokens.staff : realm === "application" ? tokens.appSession : tokens.orgUser ?? tokens.platform;
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  if (realm === "application" && tokens.device) headers["X-Device-Token"] = tokens.device!;
  // Per 03_APPLICATION_IMPLEMENTATION.md §2.4: every app API call carries X-Device-Id
  if (realm === "application") headers["X-Device-Id"] = deviceId();
  if (opts.dualControl && tokens.dualControl) headers["X-Dual-Control-Session"] = tokens.dualControl;

  let body: BodyInit | undefined;
  if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body });
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      detail = (await res.json()).detail;
    } catch { /* non-JSON */ }
    if (res.status === 401) {
      if (realm === "staff") tokens.staff = null;
      else if (realm === "application") { tokens.appSession = null; tokens.device = null; }
      else { tokens.platform = null; tokens.orgUser = null; }
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: Parameters<typeof request>[2]) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: Parameters<typeof request>[2]) => request<T>("DELETE", path, opts),
  postForm: <T>(path: string, form: Record<string, string>, opts?: Parameters<typeof request>[2]) =>
    request<T>("POST", path, { ...opts, form }),
};

// Simulated latency for demo mode so loading states are visible
export const delay = (ms = 420) => new Promise((r) => setTimeout(r, ms));
