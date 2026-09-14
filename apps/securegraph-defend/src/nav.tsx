import React from "react";
import {
  BookOpen, Bot,
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  ClipboardList,
  Cloud,
  Fingerprint,
  LayoutDashboard,
  Logs,
  Network,
  Plug,
  Scale,
  ScrollText,
  SearchCheck,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Swords,
} from "lucide-react";
import type { NavSection } from "@sg/shell/types";

/** Defend — defensive posture and continuous assurance. */
export const NAV: NavSection[] = [
  {
    label: "Posture",
    items: [
      { to: "/", label: "Overview", icon: <LayoutDashboard size={17} /> },
      { to: "/assets", label: "Assets", icon: <Boxes size={17} /> },
      { to: "/assets/intelligence", label: "Asset intelligence", icon: <Activity size={17} /> },
      { to: "/assets/intelligence/graph", label: "Asset graph", icon: <Network size={17} /> },
      { to: "/posture", label: "Exposure", icon: <ShieldCheck size={17} /> },
    ],
  },
  {
    label: "Continuous",
    items: [
      { to: "/cloud", label: "Cloud posture", icon: <Cloud size={17} /> },
      { to: "/risks", label: "Risk register", icon: <ShieldAlert size={17} /> },
    ],
  },
  {
    label: "Compliance",
    items: [
      { to: "/compliance", label: "Frameworks", icon: <Scale size={17} /> },
      { to: "/compliance/questionnaire", label: "Questionnaire", icon: <ClipboardList size={17} /> },
      { to: "/compliance/gaps", label: "Gap analysis", icon: <SearchCheck size={17} /> },
      { to: "/compliance/profile", label: "Business profile", icon: <Building2 size={17} /> },
      { to: "/compliance/connectors", label: "Evidence connectors", icon: <Plug size={17} /> },
    ],
  },
  {
    label: "SOC",
    items: [
      { to: "/soc", label: "SOC dashboard", icon: <Activity size={17} /> },
      { to: "/soc/war-room", label: "War room", icon: <Swords size={17} /> },
      { to: "/soc/playbooks", label: "Playbooks & MITRE", icon: <ScrollText size={17} /> },
      { to: "/soc/advisor", label: "Advisor", icon: <Shield size={17} /> },
      { to: "/soc/logs", label: "Log pipeline", icon: <Logs size={17} /> },
      { to: "/soc/agents", label: "Agents", icon: <Activity size={17} /> },
      { to: "/soc/cloud", label: "Cloud integrations", icon: <Cloud size={17} /> },
    ],
  },
  {
    label: "Operate",
    items: [
      { to: "/threat-intel", label: "Threat intel", icon: <Fingerprint size={17} /> },
      { to: "/alerts", label: "Incidents", icon: <AlertTriangle size={17} /> },
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
