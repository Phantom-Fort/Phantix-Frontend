import type { ApplicationKey } from "@sg/shell/types";

/** Absolute hosts for every SecureGraph application (for the app switcher). */
export const HOSTS: Record<ApplicationKey, string> = {
  core: "https://app.phantixlabs.com",
  attack: "https://attack.phantixlabs.com",
  defend: "https://defend.phantixlabs.com",
  code: "https://code.phantixlabs.com",
};
