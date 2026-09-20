// Application boundary — Core / Attack / Defend.
//
// The operator product is one backend behind three deployable applications.
// `GET /organizations/me/applications` returns one launcher card per application
// with the org's entitlement and the acting principal's access. Core lives on
// this origin (app.phantixlabs.com); Attack and Defend are sibling hosts.
//
// This module owns the browser-side resolution: the hosts, the "where do you
// want to work today" picker, and the dashboard router.
import { api, getActiveApplication, isDemoMode, delay, ApiError } from "./api";
import { APP_URL, ATTACK_URL, CODE_URL, DEFEND_URL, IS_DEV_HOSTS } from "./config";

export type ApplicationKey = "core" | "attack" | "defend" | "code";

export interface ApplicationSurface {
  /** Stable section id (`core.reports`, `attack.vapt`…) used by the section gate. */
  section_key?: string;
  path: string;
  label: string;
  group: string;
  /** Backend API prefixes this page drives. */
  api?: string[];
  /** `free` = always-included experience; `paid` = Starter/Growth section. */
  gate?: "free" | "paid";
  /** True when the section is a paid one and the org is on Free. */
  locked?: boolean;
  lock_reason?: string | null;
}

export interface ApplicationCard {
  key: ApplicationKey;
  label: string;
  tagline: string;
  description: string;
  capabilities: string[];
  order: number;
  base: boolean;
  entitled: boolean;
  accessible: boolean;
  reason: string | null;
  open_url: string;
  /** The pages this application owns, as the backend reports them. */
  surfaces?: ApplicationSurface[];
}

export interface ApplicationsSnapshot {
  applications: ApplicationCard[];
  enabled: ApplicationKey[];
  default: ApplicationKey;
  /** Resolved plan when section gating is enforced (`free`, `starter`, `growth`, `enterprise`). */
  plan?: string | null;
  section_gate?: {
    enforced: boolean;
    unlocked_for_current_plan: boolean;
    upgrade_to: string | null;
  };
}

/**
 * The signed-in operator as ``GET /app/auth/me`` reports them (app_session
 * realm). The shell uses it to gate rendering; the store uses it to hydrate the
 * tenant chrome — so it is loaded once through :func:`loadAppIdentity`.
 */
export interface AppIdentity {
  organization_id?: number;
  organization_slug?: string;
  organization_name?: string;
  organization_user_id?: number;
  creator_user_id?: number | null;
  parent_organization_id?: number | null;
  email?: string;
  full_name?: string;
  role?: string;
  effective_role?: string;
  is_initiator?: boolean;
  is_authorizer?: boolean;
  dual_control_configured?: boolean;
}

// ── Deduplicated identity load + cross-app persistence ───────────────────────
// Both the shell (render gate) and the store (tenant hydration) need
// `/app/auth/me` on every app load. They used to issue two parallel requests.
// One in-flight promise + a short-lived value cache collapses them into one
// network call.
//
// The identity is also cached in ``sessionStorage`` so tenant + account naming
// survives a reload and a cross-app handoff: the redeem response carries the
// same fields, so the target origin can show the org and user name immediately
// while `/app/auth/me` is still in flight.
let _identityPromise: Promise<AppIdentity | null> | null = null;
let _identityValue: { value: AppIdentity; ts: number } | null = null;
const IDENTITY_TTL_MS = 5_000;
const IDENTITY_STORAGE_KEY = "phantix_app_identity";

function _storeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** The last identity seen on this origin (immediate tenant/name paint). */
export function readPersistedAppIdentity(): AppIdentity | null {
  const storage = _storeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppIdentity;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist the identity for this origin. */
export function persistAppIdentity(identity: AppIdentity): void {
  const storage = _storeStorage();
  if (!storage) return;
  try {
    storage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    /* quota / private mode — in-memory cache still holds it */
  }
}

/**
 * Trust an identity we already validated elsewhere (the handoff redeem) so the
 * shell and store use it without a second `/app/auth/me` round-trip.
 */
export function seedAppIdentity(identity: AppIdentity): void {
  _identityValue = { value: identity, ts: Date.now() };
  persistAppIdentity(identity);
}

/** Drop the cached identity (logout / demo↔real / org switch). */
export function clearAppIdentity(): void {
  _identityPromise = null;
  _identityValue = null;
  try {
    _storeStorage()?.removeItem(IDENTITY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Load the current app principal, deduplicating concurrent callers and briefly
 * caching the success. Rejections are never cached, so a transient failure is
 * retried by the next caller. The result is persisted for the next load.
 */
export function loadAppIdentity(opts: { force?: boolean } = {}): Promise<AppIdentity | null> {
  if (isDemoMode()) return Promise.resolve(null);
  const now = Date.now();
  if (!opts.force && _identityValue && now - _identityValue.ts < IDENTITY_TTL_MS) {
    return Promise.resolve(_identityValue.value);
  }
  if (_identityPromise) return _identityPromise;
  _identityPromise = api
    .get<AppIdentity>("/app/auth/me", { realm: "application" })
    .then((value) => {
      if (value) {
        _identityValue = { value, ts: Date.now() };
        persistAppIdentity(value);
      }
      return value ?? null;
    })
    .finally(() => {
      _identityPromise = null;
    });
  return _identityPromise;
}

/** Apps in launcher order. */
export const APPLICATION_ORDER: ApplicationKey[] = ["core", "attack", "defend", "code"];

/** Absolute host for each application (Core stays on this origin). */
export const APPLICATION_HOSTS: Record<ApplicationKey, string> = {
  core: APP_URL,
  attack: ATTACK_URL,
  defend: DEFEND_URL,
  code: CODE_URL,
};

const LAST_APP_KEY = "sg_last_app";

function isKey(v: unknown): v is ApplicationKey {
  return v === "core" || v === "attack" || v === "defend" || v === "code";
}

function demoSnapshot(): ApplicationsSnapshot {
  return {
    default: "core",
    enabled: ["core", "attack", "defend"],
    applications: [
      {
        key: "core",
        label: "Core",
        tagline: "Connect the security picture",
        description:
          "Core is the security graph every other application writes into — assets, findings, risk, reports and alerts in one place.",
        capabilities: ["Overview", "Findings", "Risk", "Reports", "Alerts", "AI"],
        order: 0,
        base: true,
        entitled: true,
        accessible: true,
        reason: null,
        open_url: APP_URL,
      },
      {
        key: "attack",
        label: "Attack",
        tagline: "Test your security",
        description:
          "Attack tests your own security the way an attacker would: scoped VAPT campaigns, web, API and mobile scans, and an autonomous pentest agent.",
        capabilities: ["Targets", "VAPT", "Web", "APIs", "Mobile", "Pentest"],
        order: 1,
        base: false,
        entitled: true,
        accessible: true,
        reason: null,
        open_url: ATTACK_URL,
      },
      {
        key: "defend",
        label: "Defend",
        tagline: "Protect and continuously monitor",
        description: "Assets, exposure, cloud, compliance, SOC and threat intelligence.",
        capabilities: ["Assets", "Exposure", "Cloud", "Compliance", "SOC", "Threat Intel"],
        order: 2,
        base: false,
        entitled: true,
        accessible: true,
        reason: null,
        open_url: DEFEND_URL,
      },
      {
        key: "code",
        label: "Code",
        tagline: "Design and build it securely",
        description:
          "Code catches security problems before they ship: repository review with the fix offered back as a pull request, plus the threat models and product context that define what secure means for your system.",
        capabilities: ["Code review", "Code graph", "Threat models", "Product context"],
        order: 3,
        base: false,
        entitled: true,
        accessible: true,
        reason: null,
        open_url: CODE_URL,
      },
    ],
  };
}

/** Load the applications the org + acting user may enter. Never throws: on
 *  error it degrades to Core-only so the operator is never locked out. */
export async function loadApplications(): Promise<ApplicationsSnapshot> {
  if (isDemoMode()) {
    await delay(150);
    return demoSnapshot();
  }
  // Application realm first (app_session + device token); the org endpoint is the
  // same card shape for company/org-JWT callers.
  for (const path of ["/app/auth/applications", "/organizations/me/applications"]) {
    try {
      const snap = await api.get<ApplicationsSnapshot>(path);
      if (snap && Array.isArray(snap.applications) && snap.applications.length > 0) {
        return snap;
      }
    } catch {
      /* try the next endpoint */
    }
  }
  return {
    default: "core",
    enabled: ["core"],
    applications: demoSnapshot().applications.map((a) => ({
      ...a,
      entitled: a.key === "core",
      accessible: a.key === "core",
      reason: a.key === "core" ? null : "Application availability could not be determined.",
    })),
  };
}

/** Admin enable/disable (org admins; requires platform access + dual control). */
export async function setEnabledApplications(
  enabled: ApplicationKey[],
): Promise<ApplicationsSnapshot> {
  return api.put<ApplicationsSnapshot>("/organizations/me/applications", { enabled });
}

export function rememberApp(key: ApplicationKey): void {
  try {
    localStorage.setItem(LAST_APP_KEY, key);
  } catch {
    /* ignore private-mode failures */
  }
}

export function lastApp(): ApplicationKey | null {
  try {
    const v = localStorage.getItem(LAST_APP_KEY);
    return isKey(v) ? v : null;
  } catch {
    return null;
  }
}

export interface AppTarget {
  /** True when the destination is a different origin (full navigation). */
  external: boolean;
  href: string;
}

/** Where an application's "Open" action should go. */
export function applicationTarget(key: ApplicationKey, path = "/dashboard"): AppTarget {
  // "Local" means this bundle's own application, whichever one it is. Assuming
  // Core was always local was true while there was one bundle; each application
  // is now its own origin, so a Core link from Defend is a cross-origin link.
  if (key === getActiveApplication()) return { external: false, href: path || "/dashboard" };
  const base = APPLICATION_HOSTS[key] || "";
  return { external: true, href: `${base}${path && path !== "/dashboard" ? path : "/"}` };
}

interface HandoffMinted {
  code: string;
  expires_in: number;
  open_url: string;
}

/**
 * The href to open another application **with this session**.
 *
 * Browser storage is per-origin, so Attack / Defend / Code cannot see the
 * session established here. The backend mints a short-lived, single-use code
 * bound to that one application; it travels in the URL fragment (never sent to
 * a server, never logged) and the target redeems it once on arrival.
 *
 * On any failure this degrades to the plain host: the target then sends the
 * operator to the Core login, which is the correct outcome, not a lockout.
 */
export async function applicationHandoffHref(
  key: ApplicationKey,
  path = "/",
): Promise<string> {
  const target = applicationTarget(key, path);
  const fallback = target.href;
  // Staying inside this application needs no handoff.
  if (!target.external) return fallback;
  // The demo has no session to hand over — but its flag lives in per-origin
  // storage, so the target has to be told in the URL that this is still a demo.
  if (isDemoMode()) {
    const base = (APPLICATION_HOSTS[key] || "").replace(/\/+$/, "");
    return base ? `${base}/#demo=1` : fallback;
  }
  try {
    const minted = await api.post<HandoffMinted>("/app/auth/handoff", { application: key });
    // The backend's open_url is the deployed host; on a dev server that is the
    // wrong machine, so the local host wins there.
    const preferred = IS_DEV_HOSTS
      ? APPLICATION_HOSTS[key] || minted?.open_url
      : minted?.open_url || APPLICATION_HOSTS[key];
    const base = (preferred || "").replace(/\/+$/, "");
    if (!minted?.code || !base) return fallback;
    // "/" is the authenticated home for Attack/Defend/Code, so a caller
    // asking for the generic "/dashboard" (or passing nothing) collapses to
    // "/" there. Core is the one app where that's wrong: its "/" is the
    // public marketing page, and landing there just bounces back through
    // "/choose-app" instead of actually opening the dashboard the caller
    // asked for — so for Core, the same generic request resolves to its
    // real "/dashboard" instead.
    const suffix =
      key === "core"
        ? path && path !== "/" && path !== "/dashboard"
          ? path
          : "/dashboard"
        : path && path !== "/dashboard"
          ? path
          : "/";
    return `${base}${suffix}#sg=${encodeURIComponent(minted.code)}`;
  } catch (err) {
    // Expired/invalid session: go to Core sign-in (remembering the intended
    // application) instead of the target's login screen, which reads as a
    // silent logout on app switch.
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      const core = (APPLICATION_HOSTS.core || "").replace(/\/+$/, "");
      const next = key === "core" ? "" : `?next=${encodeURIComponent(key)}`;
      return core ? `${core}/login${next}` : "/login";
    }
    return fallback;
  }
}

/** The apps this principal may actually enter (order preserved). */
export function accessibleApplications(snap: ApplicationsSnapshot | null): ApplicationCard[] {
  if (!snap) return [];
  return snap.applications
    .filter((a) => a.accessible)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
