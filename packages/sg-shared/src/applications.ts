// Application boundary — Core / Attack / Defend.
//
// The operator product is one backend behind three deployable applications.
// `GET /organizations/me/applications` returns one launcher card per application
// with the org's entitlement and the acting principal's access. Core lives on
// this origin (app.phantixlabs.com); Attack and Defend are sibling hosts.
//
// This module owns the browser-side resolution: the hosts, the "where do you
// want to work today" picker, and the dashboard router.
import { api, getActiveApplication, isDemoMode, delay } from "./api";
import { APP_URL, ATTACK_URL, CODE_URL, DEFEND_URL, IS_DEV_HOSTS } from "./config";

export type ApplicationKey = "core" | "attack" | "defend" | "code";

export interface ApplicationSurface {
  path: string;
  label: string;
  group: string;
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
        description: "Unified security graph — overview, findings, risk, reports, context and AI.",
        capabilities: ["Overview", "Findings", "Risk", "Reports", "Context", "AI"],
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
        description: "Offensive testing — VAPT, web/API scans, code security and attack paths.",
        capabilities: ["Targets", "VAPT", "Web", "APIs", "Code", "Pentest"],
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
        description: "Code security, code graph, threat modelling and product context.",
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
    const suffix = path && path !== "/dashboard" ? path : "/";
    return `${base}${suffix}#sg=${encodeURIComponent(minted.code)}`;
  } catch {
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
