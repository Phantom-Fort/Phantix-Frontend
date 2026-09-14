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
import { apiRequest, setStoredSession, type ApplicationKey } from "./api";

/** URL fragment key carrying a handoff code, e.g. `https://attack…/#sg=abc`. */
const HANDOFF_FRAGMENT_KEY = "sg";

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
  organization_user_id?: number;
  email?: string;
  full_name?: string;
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
 */
export async function handoffUrl(target: ApplicationKey, fallbackHost: string): Promise<string> {
  try {
    const minted = await apiRequest<HandoffMinted>("/app/auth/handoff", {
      method: "POST",
      body: { application: target },
    });
    const base = (minted.open_url || fallbackHost || "").replace(/\/+$/, "");
    if (!base || !minted.code) return fallbackHost;
    return `${base}/#${HANDOFF_FRAGMENT_KEY}=${encodeURIComponent(minted.code)}`;
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
export async function consumeHandoff(application: ApplicationKey): Promise<boolean> {
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
    return true;
  } catch {
    return false;
  }
}
