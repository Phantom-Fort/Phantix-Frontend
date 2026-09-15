import React from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
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
      { to: "/assets", label: "Assets", icon: <Boxes size={17} /> },
      { to: "/reports", label: "Report solutions", icon: <FileText size={17} /> },
      { to: "/integrations", label: "Integrations hub", icon: <Plug size={17} /> },
      { to: "/audit", label: "Audit trail", icon: <ScrollText size={17} /> },
    ],
  },
  {
    label: "Assistant",
    items: [
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
      { to: "/support", label: "Support", icon: <LifeBuoy size={17} /> },
      { to: "/sandbox", label: "Sandbox", icon: <FlaskConical size={17} /> },
    ],
  },
  {
    label: "Help",
    items: [
      { to: "/assistant", label: "Assistant", icon: <Bot size={17} /> },
      { to: "/docs", label: "Documentation", icon: <BookOpen size={17} /> },
    ],
  },
];
