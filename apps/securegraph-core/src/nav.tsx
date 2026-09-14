import React from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LifeBuoy,
  Plug,
  ScrollText,
  UserCheck,
} from "lucide-react";
import type { NavSection } from "@sg/shell/types";

/** Core — the shared security graph: overview, findings, risk, reports, AI. */
export const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
      { to: "/analytics", label: "Analytics", icon: <BarChart3 size={17} /> },
    ],
  },
  {
    label: "Security graph",
    items: [
      { to: "/reports", label: "Report solutions", icon: <FileText size={17} /> },
      { to: "/integrations", label: "Integrations hub", icon: <Plug size={17} /> },
      { to: "/audit", label: "Audit trail", icon: <ScrollText size={17} /> },
    ],
  },
  {
    label: "Assistant",
    items: [
      { to: "/agent", label: "SecureGraph Agent", icon: <Bot size={17} /> },
      { to: "/agent-activity", label: "Agent activity", icon: <Activity size={17} /> },
    ],
  },
  {
    label: "Organization",
    items: [
      { to: "/authorizations", label: "Authorizations", icon: <UserCheck size={17} /> },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/docs", label: "Documentation", icon: <BookOpen size={17} /> },
      { to: "/support", label: "Support", icon: <LifeBuoy size={17} /> },
      { to: "/sandbox", label: "Sandbox", icon: <FlaskConical size={17} /> },
    ],
  },
];
