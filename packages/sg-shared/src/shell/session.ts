/**
 * Cross-application session handoff.
 *
 * The four applications live on four origins, and browser storage is per-origin:
 * the session established on Core is invisible to Attack, Defend and Code. Core
 * asks the backend for a short-lived, single-use code bound to one target
 * application, puts it in the target's URL **fragment** (fragments are never sent
 * to a server and never land in access logs or Referer), and the target redeems
 * it once on arrival for the same session.
 *
 * The code is not a second credential: it carries the session that already
 * exists, so signing out or rotating the device kills it too.
 */
import { apiRequest, clearStoredSession, setStoredSession, type ApplicationKey } from "./api";
import { APP_URL } from "../config";
import { enterDemoMode, exitDemoMode, isDemoFlagSet, tokens } from "../api";
import { seedAppIdentity } from "../applications";

/** URL fragment key carrying a handoff code, e.g. `https://attack…/#sg=abc`. */
const HANDOFF_FRAGMENT_KEY = "sg";
/** Fragment marking the guided demo, which has no session to hand over. */
const DEMO_FRAGMENT_KEY = "demo";

interface HandoffMinted {
  code: string;
  expires_in: number;
  application: ApplicationKey;
  open_url: string;
}

interface HandoffRedeemed {
  access_token: string;
  device_token?: string;
  dual_control_session?: string;
  organization_id?: number;
  organization_slug?: string;
  organization_name?: string;
  organization_user_id?: number;
  email?: string;
  full_name?: string;
}

/** Read (and remove) a bare flag from the URL fragment, e.g. `#demo=1`. */
function takeFlagFromFragment(key: string): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  if (params.get(key) !== "1") return false;
  params.delete(key);
  const rest = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ""}`,
  );
  return true;
}

/** Read (and remove) the handoff code from the current URL fragment. */
function takeCodeFromFragment(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return "";
  const params = new URLSearchParams(hash);
  const code = params.get(HANDOFF_FRAGMENT_KEY) || "";
  if (!code) return "";

  // Strip it immediately: a spent code in history helps nobody and a visible
  // secret in the address bar is an invitation to paste it somewhere.
  params.delete(HANDOFF_FRAGMENT_KEY);
  const rest = params.toString();
  const url = `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ""}`;
  window.history.replaceState(null, "", url);
  return code;
}

/**
 * Mint a handoff for `target` and return the URL to open it with.
 *
 * Falls back to the plain host when the handoff cannot be minted — the target
 * then bounces the operator to the Core login, which is the correct failure.
 *
 * `path` is where the operator lands once there — defaults to `/`, which is
 * the authenticated home for Attack/Defend/Code but is Core's *public*
 * marketing page, not its dashboard. Landing there sent every Core switch
 * through an extra "you're signed in, go pick an app" hop (Home's own
 * authenticated redirect to /choose-app) instead of straight into the
 * dashboard the operator actually asked for — callers switching into Core
 * should pass "/dashboard" explicitly.
 */
export async function handoffUrl(target: ApplicationKey, fallbackHost: string, path = "/"): Promise<string> {
  // The guided demo has no session, and its flag lives in per-origin storage —
  // so it has to be told, in the URL, that it is still the demo on arrival.
  if (isDemoFlagSet()) {
    const base = (fallbackHost || "").replace(/\/+$/, "");
    return base ? `${base}${path}#${DEMO_FRAGMENT_KEY}=1` : fallbackHost;
  }
  try {
    const minted = await apiRequest<HandoffMinted>("/app/auth/handoff", {
      method: "POST",
      body: { application: target },
    });
    // The caller already resolved the right host for this environment; the
    // minted open_url only fills in when it did not.
    const base = (fallbackHost || minted.open_url || "").replace(/\/+$/, "");
    if (!base || !minted.code) return fallbackHost;
    return `${base}${path}#${HANDOFF_FRAGMENT_KEY}=${encodeURIComponent(minted.code)}`;
  } catch {
    return fallbackHost;
  }
}

/**
 * Consume a handoff code if this load carries one.
 *
 * Returns true when a session was established, so the caller can skip its
 * "not signed in" redirect. Runs before any other API call on boot.
 */
/**
 * A handoff redeem already in flight for this page load. React StrictMode
 * mounts effects twice in development: without this, the second invocation
 * finds the fragment already consumed, returns false, and bounces the operator
 * to the Core login before the first redeem finishes. Concurrent callers share
 * one attempt instead.
 */
let handoffInflight: Promise<boolean> | null = null;

export function consumeHandoff(application: ApplicationKey): Promise<boolean> {
  if (handoffInflight) return handoffInflight;
  handoffInflight = (async () => {
    if (takeFlagFromFragment(DEMO_FRAGMENT_KEY)) {
      enterDemoMode();
      return true;
    }
    const code = takeCodeFromFragment();
    if (!code) return false;
    try {
      const session = await apiRequest<HandoffRedeemed>("/app/auth/handoff/redeem", {
        method: "POST",
        body: { code, application },
        anonymous: true,
      });
      if (!session?.access_token) return false;
      setStoredSession({
        accessToken: session.access_token,
        deviceToken: session.device_token || "",
        dualControlSession: session.dual_control_session || "",
      });
      // The redeem already validated the session, so carry the tenant + account
      // naming straight into this origin's store — the shell and store can name
      // the org and user immediately instead of after another `/app/auth/me`.
      seedAppIdentity({
        organization_id: session.organization_id,
        organization_slug: session.organization_slug,
        organization_name: session.organization_name,
        organization_user_id: session.organization_user_id,
        email: session.email,
        full_name: session.full_name,
      });
      return true;
    } catch {
      return false;
    }
  })();
  // Do not cache the result: a later navigation can carry a fresh code.
  void handoffInflight.finally(() => {
    handoffInflight = null;
  });
  return handoffInflight;
}


/**
 * Sign out from any application.
 *
 * Core owns sign-in, so it owns sign-out: whichever application the operator is
 * in, the session is revoked on the backend, every token store on this origin is
 * emptied, and they land on Core's login. Clearing storage alone would leave a
 * live session behind that anything holding the token could keep using.
 *
 * The demo has no session to revoke — leaving it is just dropping the flag —
 * but it ends in the same place, so "sign out" means one thing everywhere.
 */
export async function signOutEverywhere(coreHost?: string): Promise<void> {
  const demo = isDemoFlagSet();
  if (!demo) {
    try {
      // Best-effort: a failed revoke must not strand the operator in a session
      // they have asked to leave.
      await apiRequest("/app/auth/logout", { method: "POST" });
    } catch {
      /* revoked locally regardless */
    }
  }
  exitDemoMode();
  clearStoredSession();
  // The Command Centre client keeps its own stores (org-user, dual control,
  // staff); leaving any of them behind is a half sign-out.
  try {
    tokens.platform = null;
    tokens.orgUser = null;
    tokens.dualControl = null;
    tokens.appSession = null;
    tokens.device = null;
    tokens.staff = null;
  } catch {
    /* storage may be unavailable */
  }
  const base = (coreHost || APP_URL || "").replace(/\/+$/, "");
  window.location.assign(base ? `${base}/login` : "/login");
}
