import React from "react";
import {
  Bot, GitBranch, GitPullRequest, LayoutDashboard, Plug, ShieldCheck, ShieldQuestion, Wrench, Workflow,
} from "lucide-react";
import type { NavSection } from "@sg/shell/types";

/** Code — secure code review and the design-time context. */
export const NAV: NavSection[] = [
  {
    label: "Build",
    items: [
      { to: "/", label: "Overview", icon: <LayoutDashboard size={17} /> },
      { to: "/code-review", label: "Security review", icon: <ShieldCheck size={17} /> },
      { to: "/code-review/repositories", label: "Repositories", icon: <GitBranch size={17} /> },
      { to: "/code-review/pull-requests", label: "Pull requests", icon: <GitPullRequest size={17} /> },
      { to: "/code-review/providers", label: "Providers", icon: <Plug size={17} /> },
      { to: "/code-review/autofix", label: "AutoFix", icon: <Wrench size={17} /> },
      { to: "/code-review/continuous-pr", label: "Continuous PR", icon: <Workflow size={17} /> },
    ],
  },
  {
    label: "Design",
    items: [
      { to: "/threat-models", label: "Threat models", icon: <ShieldQuestion size={17} /> },
      { to: "/context", label: "Product context", icon: <Workflow size={17} /> },
    ],
  },
  {
    label: "Help",
    items: [{ to: "/assistant", label: "Assistant", icon: <Bot size={17} /> }],
  },
];
