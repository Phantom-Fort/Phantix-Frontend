import type React from "react";

/** The four deployable operator applications. */
export type ApplicationKey = "core" | "attack" | "defend" | "code";

export interface NavLeaf {
  to: string;
  label: string;
  icon?: React.ReactNode;
  /** Paid section the current plan has not unlocked (Free). Rendered with a lock. */
  locked?: boolean;
  lockReason?: string | null;
}

export interface NavSection {
  label: string;
  items: NavLeaf[];
}

export const APPLICATION_LABEL: Record<ApplicationKey, string> = {
  core: "Core",
  attack: "Attack",
  defend: "Defend",
  code: "Code",
};

export const APPLICATION_ORDER: ApplicationKey[] = ["core", "attack", "defend", "code"];
