import type React from "react";

/** The four deployable operator applications. */
export type ApplicationKey = "core" | "attack" | "defend" | "code";

export interface NavLeaf {
  to: string;
  label: string;
  icon?: React.ReactNode;
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
