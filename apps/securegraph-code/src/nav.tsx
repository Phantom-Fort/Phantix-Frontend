import React from "react";
import { GitBranch, LayoutDashboard, ShieldQuestion, Workflow } from "lucide-react";
import type { NavSection } from "@sg/shell/types";

/** Code — secure code review and the design-time context. */
export const NAV: NavSection[] = [
  {
    label: "Build",
    items: [
      { to: "/", label: "Overview", icon: <LayoutDashboard size={17} /> },
      { to: "/code-review", label: "Code review", icon: <GitBranch size={17} /> },
    ],
  },
  {
    label: "Design",
    items: [
      { to: "/threat-models", label: "Threat models", icon: <ShieldQuestion size={17} /> },
      { to: "/context", label: "Product context", icon: <Workflow size={17} /> },
    ],
  },
];
