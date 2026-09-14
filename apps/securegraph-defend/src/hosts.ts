import { APP_URL, ATTACK_URL, CODE_URL, DEFEND_URL } from "@sg/config";
import type { ApplicationKey } from "@sg/shell/types";

/**
 * Absolute hosts for every SecureGraph application (for the app switcher).
 *
 * Resolved by @sg/config: the deployed origins in production, the local dev
 * ports under `vite dev`, and `VITE_*_URL` overrides in either mode. Hardcoding
 * production here would send every unauthenticated local page load to the live
 * Core login.
 */
export const HOSTS: Record<ApplicationKey, string> = {
  core: APP_URL,
  attack: ATTACK_URL,
  defend: DEFEND_URL,
  code: CODE_URL,
};
